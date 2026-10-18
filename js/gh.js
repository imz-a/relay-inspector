/* ============================================================
 * 照妖镜 — GitHub 检测记录模块
 * 公开仓库 records/index.json 读写；纯逻辑与 IO 分离
 * ============================================================ */
window.MT = window.MT || {};
MT.gh = (function () {
  var DEFAULT = { owner: 'imz-a', repo: 'relay-inspector', branch: 'main', autoSave: true, remember: false };
  var LS_KEY = 'mt.gh';

  /* ---------- 配置（token 仅在选择"记住"时落盘） ---------- */
  function getCfg() {
    var c = { owner: DEFAULT.owner, repo: DEFAULT.repo, branch: DEFAULT.branch, autoSave: true, remember: false, token: '' };
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (s) {
        c.owner = s.owner || c.owner;
        c.repo = s.repo || c.repo;
        c.branch = s.branch || c.branch;
        c.autoSave = s.autoSave !== false;
        c.remember = !!s.remember;
        c.token = s.token || '';
      }
    } catch (e) { }
    if (mem.token && !c.remember) c.token = mem.token;
    return c;
  }
  var mem = { token: '' };
  function saveCfg(c) {
    mem.token = c.token || '';
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        owner: c.owner, repo: c.repo, branch: c.branch,
        autoSave: !!c.autoSave, remember: !!c.remember,
        token: c.remember ? (c.token || '') : ''
      }));
    } catch (e) { }
  }
  function isConfigured() {
    var c = getCfg();
    return !!(c.owner && c.repo && c.token);
  }

  /* ---------- 纯逻辑 ---------- */
  function hostOf(url) {
    try { return new URL(url).host; } catch (e) { return String(url || '').replace(/^https?:\/\//, '').split('/')[0]; }
  }
  function bucket(index) { return Math.round((index || 0) / 5) * 5; }
  /* 去重键：同一中转站+同一模型+同协议，结论/指数档/实际后端完全一致 → 重复 */
  function recordKey(r) {
    return [r.host, r.model, r.protocol, r.verdict, bucket(r.index), r.identified || ''].join('|');
  }
  /* 在既有索引上追加记录；返回 {list, dup} */
  function appendRecord(list, rec) {
    var arr = (list || []).slice();
    var key = recordKey(rec);
    var dup = arr.some(function (x) { return recordKey(x) === key; });
    if (!dup) {
      arr.unshift(rec);
      rec.id = rec.id || shortId(rec);
    }
    return { list: arr, dup: dup };
  }
  function shortId(rec) {
    var s = (rec.ts || '') + '|' + (rec.host || '') + '|' + (rec.model || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return (h < 0 ? -h : h).toString(36);
  }
  function fileName(rec) {
    var ts = (rec.ts || new Date().toISOString()).replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    var host = String(rec.host || 'host').replace(/[^a-z0-9.-]/gi, '-');
    var model = String(rec.model || 'model').replace(/[^a-z0-9.-]/gi, '-');
    return 'records/' + ts + '_' + host + '_' + model + '.json';
  }
  /* 由检测结果构造记录（不含任何密钥信息） */
  function buildRecord(cfg, summary, results) {
    var top = summary.identified && summary.identified[0];
    return {
      v: 1,
      ts: new Date().toISOString(),
      host: hostOf(cfg.baseUrl),
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      protocol: cfg.protocol || 'openai',
      verdict: summary.band ? summary.band.level : 'unknown',
      verdictLabel: summary.band ? summary.band.label : '未知',
      index: summary.index,
      identified: top ? (top.model ? top.model.name : top.id) : null,
      identifiedPct: top ? top.pct : null,
      testsRun: Object.keys(results || {}).length + '/' + MT.TESTS.length,
      claim: summary.claim ? summary.claim.name : null,
      axes: (summary.axes || []).map(function (a) { return { label: a.label, a: a.a, b: a.b }; })
    };
  }
  /* 详情文件内容（完整报告，剔除一切密钥） */
  function buildDetail(cfg, summary, results) {
    return {
      v: 1,
      ts: new Date().toISOString(),
      target: { host: hostOf(cfg.baseUrl), baseUrl: cfg.baseUrl, model: cfg.model, protocol: cfg.protocol },
      summary: {
        index: summary.index, verdict: summary.band ? summary.band.level : null,
        verdictLabel: summary.band ? summary.band.label : null,
        identified: (summary.identified || []).map(function (x) {
          return { id: x.id, name: x.model ? x.model.name : x.id, vendor: x.model ? x.model.vendor : null, pct: x.pct };
        })
      },
      results: results
    };
  }

  /* ---------- GitHub API ---------- */
  function api(path, opts) {
    opts = opts || {};
    if (typeof fetch !== 'function') return Promise.reject(new Error('当前环境不支持网络请求'));
    var c = getCfg();
    var headers = { 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' };
    if (c.token) headers['Authorization'] = 'Bearer ' + c.token;
    return fetch('https://api.github.com' + path, {
      method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && j.message) || ('HTTP ' + r.status));
        return j;
      });
    });
  }
  function readIndex() {
    var c = getCfg();
    var p = '/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + '/contents/records/index.json?ref=' + encodeURIComponent(c.branch);
    return api(p).then(function (j) {
      if (j.encoding !== 'base64' || !j.content) return { records: [], sha: null };
      var bin = atob(String(j.content).replace(/\n/g, ''));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var obj = JSON.parse(new TextDecoder('utf-8').decode(bytes));
      return { records: Array.isArray(obj.records) ? obj.records : [], sha: j.sha, raw: obj };
    }).catch(function (e) {
      if (/Not Found|404/i.test(e.message)) return { records: [], sha: null };
      throw e;
    });
  }
  function writeFile(path, content, msg) {
    var c = getCfg();
    var p = '/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + '/contents/' + path;
    return api(p + '?ref=' + encodeURIComponent(c.branch)).then(function (j) {
      var body = { message: msg, content: toB64(content), branch: c.branch };
      if (j && j.sha) body.sha = j.sha;
      return api(p, { method: 'PUT', body: body });
    }).catch(function (e) {
      if (/Not Found|404/i.test(e.message)) {
        var c2 = getCfg();
        return api('/repos/' + encodeURIComponent(c2.owner) + '/' + encodeURIComponent(c2.repo) + '/contents/' + path, {
          method: 'PUT',
          body: { message: msg, content: toB64(content), branch: c2.branch }
        });
      }
      throw e;
    });
  }
  function toB64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  /* ---------- 保存一条检测记录 ---------- */
  /* 返回 {status:'saved'|'skipped'|'error', message, url?} */
  function saveRecord(cfg, summary, results) {
    if (!isConfigured()) return Promise.resolve({ status: 'error', message: '尚未配置 GitHub：请在「高级设置 → 检测记录同步」中填写仓库与 Token' });
    var rec = buildRecord(cfg, summary, results);
    var detail = buildDetail(cfg, summary, results);
    var c = getCfg();
    return readIndex().then(function (idx) {
      var out = appendRecord(idx.records, rec);
      if (out.dup) return { status: 'skipped', message: '该中转站+模型的相同结论已在记录中，未重复写入', record: rec };
      var fname = fileName(rec);
      rec.detailFile = fname;
      var indexObj = { v: 1, repo: c.owner + '/' + c.repo, updated: rec.ts, count: out.list.length, records: out.list };
      /* 先写详情，再更新索引——索引永远指向已存在的文件 */
      return writeFile(fname.replace(/^records\//, ''), JSON.stringify(detail, null, 2),
        'record: ' + rec.host + ' / ' + rec.model + ' — ' + rec.verdictLabel + ' ' + rec.index)
        .then(function () {
          return writeFile('records/index.json', JSON.stringify(indexObj, null, 2),
            'index: +1 record (' + out.list.length + ')');
        })
        .then(function () {
          return {
            status: 'saved', message: '记录已写入 ' + c.owner + '/' + c.repo + '（第 ' + out.list.length + ' 条）',
            record: rec,
            url: 'https://github.com/' + c.owner + '/' + c.repo + '/blob/' + c.branch + '/' + fname
          };
        });
    }).catch(function (e) {
      return { status: 'error', message: '写入失败：' + e.message };
    });
  }

  /* ---------- 公开读取（raw，免 token，CORS 友好） ---------- */
  function loadPublicIndex() {
    if (typeof fetch !== 'function') return Promise.resolve({ records: [], source: 'none' });
    var c = getCfg();
    var url = 'https://raw.githubusercontent.com/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + '/' + encodeURIComponent(c.branch) + '/records/index.json';
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      return { records: Array.isArray(j.records) ? j.records : [], source: 'public' };
    }).catch(function () {
      /* 私有仓库或未启用：回退到 API（需要 token） */
      if (!c.token) return { records: [], source: 'none' };
      return readIndex().then(function (idx) { return { records: idx.records, source: 'api' }; });
    });
  }

  /* ---------- 渲染 ---------- */
  function esc(s) { return MT.util.esc(s); }
  function fmtTime(iso) {
    try {
      var d = new Date(iso);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    } catch (e) { return String(iso || ''); }
  }
  var LEVEL_CLS = { clean: 'ok', mild: 'warn', suspect: 'suspect', severe: 'bad', fake: 'fake', unknown: 'warn' };
  function renderRecords(container, data, opts) {
    opts = opts || {};
    var c = getCfg();
    var records = (data.records || []).slice();
    var q = (opts.q || '').toLowerCase();
    var filter = opts.filter || 'all';
    if (q) {
      records = records.filter(function (r) {
        return (r.host + ' ' + r.model + ' ' + (r.identified || '') + ' ' + r.verdictLabel).toLowerCase().indexOf(q) !== -1;
      });
    }
    if (filter === 'bad') records = records.filter(function (r) { return ['suspect', 'severe', 'fake'].indexOf(r.verdict) !== -1; });
    if (filter === 'ok') records = records.filter(function (r) { return r.verdict === 'clean' || r.verdict === 'mild'; });

    var total = (data.records || []).length;
    var bad = (data.records || []).filter(function (r) { return ['suspect', 'severe', 'fake'].indexOf(r.verdict) !== -1; }).length;
    var sites = {};
    (data.records || []).forEach(function (r) { sites[r.host] = 1; });
    var siteCount = Object.keys(sites).length;
    var badPct = total ? Math.round(bad / total * 100) : 0;

    var html = '';
    html += '<div class="rec-stats">';
    html += '<div class="rec-stat"><b>' + total + '</b><span>累计记录</span></div>';
    html += '<div class="rec-stat"><b>' + siteCount + '</b><span>覆盖中转站</span></div>';
    html += '<div class="rec-stat"><b style="color:' + (bad ? 'var(--red)' : 'var(--green)') + '">' + bad + '</b><span>检出掺水（' + badPct + '%）</span></div>';
    html += '<div class="rec-stat rec-src"><b style="font-size:13px">' + esc(c.owner + '/' + c.repo) + '</b><span>数据源 · ' +
      ({ public: '公开仓库', api: 'API（含 Token）', none: '未连接' })[data.source || 'none'] + '</span></div>';
    html += '</div>';

    html += '<div class="base-toolbar">';
    html += '<input id="recSearch" type="search" placeholder="搜索中转站 / 模型 / 后端…" value="' + esc(opts.q || '') + '" aria-label="搜索记录">';
    html += '<div class="seg" id="recFilter" data-value="' + esc(filter) + '" role="group" aria-label="记录筛选">';
    html += '<button type="button" data-v="all" class="' + (filter === 'all' ? 'on' : '') + '">全部</button>';
    html += '<button type="button" data-v="bad" class="' + (filter === 'bad' ? 'on' : '') + '">仅掺水</button>';
    html += '<button type="button" data-v="ok" class="' + (filter === 'ok' ? 'on' : '') + '">未见异常</button>';
    html += '</div>';
    html += '<button class="btn btn-ghost" id="btnRecRefresh" type="button" style="margin-left:auto">⟳ 刷新</button>';
    html += '</div>';

    if (!records.length) {
      html += '<div class="panel" style="text-align:center;color:var(--text-2);padding:36px">' +
        (total ? '没有符合筛选条件的记录。' : '暂无记录。完成一次全量检测后点击「保存记录到 GitHub」，记录将写入仓库 records/ 目录并在此展示。') + '</div>';
    } else {
      html += '<div class="table-wrap"><table class="base rec-table"><thead><tr>' +
        '<th>检测时间</th><th>中转站</th><th>声称模型</th><th>结论</th><th>掺水指数</th><th>实际后端（鉴定）</th><th>检测覆盖</th><th>详情</th></tr></thead><tbody>';
      records.forEach(function (r) {
        var cls = LEVEL_CLS[r.verdict] || 'warn';
        var detailUrl = r.detailFile ? 'https://github.com/' + c.owner + '/' + c.repo + '/blob/' + c.branch + '/' + r.detailFile : null;
        html += '<tr>' +
          '<td class="num" style="white-space:nowrap">' + esc(fmtTime(r.ts)) + '</td>' +
          '<td><a href="' + esc(r.baseUrl || '#') + '" target="_blank" rel="noopener" style="color:var(--accent)"><b>' + esc(r.host) + '</b></a></td>' +
          '<td>' + esc(r.model) + '</td>' +
          '<td><span class="verdict-badge ' + cls + '" style="font-size:12px;padding:3px 12px;letter-spacing:0">' + esc(r.verdictLabel) + '</span></td>' +
          '<td class="num"><b>' + (r.index != null ? r.index.toFixed(1) : '—') + '</b></td>' +
          '<td>' + (r.identified ? esc(r.identified) + (r.identifiedPct != null ? ' <small style="color:var(--text-3)">' + r.identifiedPct + '%</small>' : '') : '—') + '</td>' +
          '<td class="num">' + esc(r.testsRun || '—') + '</td>' +
          '<td>' + (detailUrl ? '<a href="' + detailUrl + '" target="_blank" rel="noopener" style="color:var(--text-3);font-family:var(--mono);font-size:11.5px">JSON ↗</a>' : '—') + '</td>' +
          '</tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '<div style="font-size:12px;color:var(--text-3);margin-top:12px;line-height:1.9">' +
      '去重规则：同一中转站 + 同一声称模型 + 同协议下，结论分级 / 掺水指数档（5 分一档）/ 鉴定后端完全一致的记录不会重复写入；' +
      '任何一项不同（如后端被更换、指数跨档）都会作为新记录保留。Token 仅在写入时使用，记录内容不含任何密钥。</div>';
    container.innerHTML = html;
    return html;
  }

  /* ---------- UI 绑定 ---------- */
  var lastData = { records: [], source: 'none' };
  var uiState = { q: '', filter: 'all' };
  function refresh(container, silent) {
    return loadPublicIndex().then(function (data) {
      lastData = data;
      renderRecords(container, data, uiState);
      bindToolbar(container);
      if (!silent && typeof MT.app.toast === 'function') MT.app.toast('记录已刷新（' + data.records.length + ' 条）');
    }).catch(function (e) {
      container.innerHTML = '<div class="panel" style="text-align:center;color:var(--text-2);padding:36px">记录加载失败：' + esc(e.message) + '</div>';
    });
  }
  function bindToolbar(container) {
    var s = container.querySelector('#recSearch');
    if (s) s.addEventListener('input', function () {
      uiState.q = s.value || '';
      renderRecords(container, lastData, uiState);
      bindToolbar(container);
      var el = container.querySelector('#recSearch');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
    var seg = container.querySelector('#recFilter');
    if (seg) Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        uiState.filter = b.dataset.v;
        renderRecords(container, lastData, uiState);
        bindToolbar(container);
      });
    });
    var rb = container.querySelector('#btnRecRefresh');
    if (rb) rb.addEventListener('click', function () { refresh(container); });
  }

  /* ---------- 配置面板绑定 ---------- */
  function loadCfgToForm() {
    var c = getCfg();
    $('#ghOwner').value = c.owner || '';
    $('#ghRepo').value = c.repo || '';
    $('#ghBranch').value = c.branch || 'main';
    $('#ghToken').value = c.token || '';
    $('#ghRemember').checked = !!c.remember;
    $('#ghAutoSave').checked = c.autoSave !== false;
    updateGhStatus();
  }
  function saveCfgFromForm() {
    var c = {
      owner: ($('#ghOwner').value || '').trim(),
      repo: ($('#ghRepo').value || '').trim(),
      branch: ($('#ghBranch').value || 'main').trim(),
      token: ($('#ghToken').value || '').trim(),
      remember: $('#ghRemember').checked,
      autoSave: $('#ghAutoSave').checked
    };
    if (!c.owner || !c.repo) { toastCfg('请填写仓库拥有者与仓库名', true); return; }
    saveCfg(c);
    updateGhStatus();
    toastCfg('GitHub 配置已保存' + (c.remember ? '（Token 已加密存放于本机 localStorage）' : '（Token 仅在本页内存中有效）'));
  }
  function updateGhStatus() {
    var el = document.getElementById('ghStatus');
    if (!el) return;
    var c = getCfg();
    el.innerHTML = isConfigured()
      ? '<span style="color:var(--green)">● 已连接</span> ' + esc(c.owner + '/' + c.repo + ' @ ' + c.branch) + (c.autoSave ? ' · 检测后自动保存' : ' · 手动保存')
      : '<span style="color:var(--amber)">● 未配置 Token</span> 仓库 ' + esc(c.owner + '/' + c.repo) + '（只读浏览无需 Token，写入需要）';
  }
  function toastCfg(msg, isErr) {
    if (typeof MT.app.toast === 'function') MT.app.toast(msg, isErr);
  }
  function $(s) { return document.querySelector(s); }

  /* ---------- 演示记录 ---------- */
  function demoRecord() {
    return {
      v: 1, id: 'demo1',
      ts: new Date(Date.now() - 3600e3).toISOString(),
      host: 'relay-demo.example.com',
      baseUrl: 'https://relay-demo.example.com/v1',
      model: 'claude-opus-4-8', protocol: 'openai',
      verdict: 'fake', verdictLabel: '高度假冒', index: 62.3,
      identified: 'GLM-4-9B', identifiedPct: 99, testsRun: '12/12',
      claim: 'Claude Opus 4.8', detailFile: null
    };
  }

  return {
    DEFAULT: DEFAULT,
    getCfg: getCfg, saveCfg: saveCfg, isConfigured: isConfigured,
    hostOf: hostOf, bucket: bucket, recordKey: recordKey, appendRecord: appendRecord,
    buildRecord: buildRecord, buildDetail: buildDetail, fileName: fileName,
    saveRecord: saveRecord, loadPublicIndex: loadPublicIndex, readIndex: readIndex,
    renderRecords: renderRecords, refresh: refresh, getLast: function () { return lastData; },
    loadCfgToForm: loadCfgToForm, saveCfgFromForm: saveCfgFromForm, updateGhStatus: updateGhStatus,
    demoRecord: demoRecord
  };
})();
