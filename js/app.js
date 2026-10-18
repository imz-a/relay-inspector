/* ============================================================
 * 照妖镜 — 应用编排层
 * ============================================================ */
window.MT = window.MT || {};
MT.app = (function () {
  var state = { results: {}, running: false, summary: null };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- 通知与日志 ---------- */
  var toastTimer = null;
  function toast(msg, isErr) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, 3600);
  }
  function log(msg, cls) {
    var box = $('#logBox');
    box.className = 'log-box show';
    var line = document.createElement('div');
    if (cls) line.className = cls;
    var ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    line.innerHTML = '<span class="lt">[' + ts + ']</span> ' + MT.util.esc(msg);
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  /* ---------- 配置 ---------- */
  function collectCfg() {
    return {
      baseUrl: $('#baseUrl').value.trim(),
      apiKey: $('#apiKey').value.trim(),
      model: $('#modelName').value.trim(),
      protocol: $('#protocolSeg').dataset.value || 'openai',
      temperature: parseFloat($('#temperature').value) || 0
    };
  }
  function collectRefCfg() {
    if (!$('#useRef').checked) return null;
    var c = {
      baseUrl: $('#refBaseUrl').value.trim(),
      apiKey: $('#refApiKey').value.trim(),
      model: $('#refModel').value.trim(),
      protocol: $('#refProtocolSeg').dataset.value || 'openai'
    };
    return (c.baseUrl && c.apiKey && c.model) ? c : null;
  }
  function saveCfg() {
    try {
      localStorage.setItem('mt.cfg', JSON.stringify({
        baseUrl: $('#baseUrl').value.trim(), model: $('#modelName').value.trim(),
        protocol: $('#protocolSeg').dataset.value, temperature: $('#temperature').value
        /* 绝不持久化 API Key */
      }));
    } catch (e) { }
  }
  function loadCfg() {
    try {
      var c = JSON.parse(localStorage.getItem('mt.cfg') || 'null');
      if (c) {
        $('#baseUrl').value = c.baseUrl || '';
        $('#modelName').value = c.model || '';
        $('#temperature').value = c.temperature || 0;
        setSeg($('#protocolSeg'), c.protocol || 'openai');
      }
    } catch (e) { }
  }
  function setSeg(seg, val) {
    seg.dataset.value = val;
    $$('button', seg).forEach(function (b) {
      b.className = b.dataset.v === val ? 'on' : '';
    });
  }

  /* ---------- 测试卡片 ---------- */
  function renderCards() {
    var wrap = $('#testGrid');
    wrap.innerHTML = '';
    MT.TESTS.forEach(function (t) {
      var card = document.createElement('article');
      card.className = 'test-card';
      card.id = 'card-' + t.id;
      card.innerHTML =
        '<div class="tc-head"><span class="tc-id">' + t.id.toUpperCase() + '</span>' +
        '<span class="tc-name">' + t.name + '</span>' +
        '<span class="tc-weight">权重 ' + t.weight + ' · 约 ' + Math.round(t.cost / 100) / 10 + 'K tok</span></div>' +
        '<p class="tc-desc">' + t.desc + '</p>' +
        '<div class="tc-status"><span class="dot idle"></span><span class="st-text">待运行</span></div>' +
        '<div class="tc-detail" id="detail-' + t.id + '"></div>' +
        '<div class="tc-foot">' +
        '<button class="btn btn-primary btn-run" data-id="' + t.id + '">运行</button>' +
        '<button class="btn btn-ghost btn-toggle" data-id="' + t.id + '">详情</button>' +
        '</div>';
      wrap.appendChild(card);
    });
    $$('.btn-run').forEach(function (b) {
      b.addEventListener('click', function () { runOne(b.dataset.id); });
    });
    $$('.btn-toggle').forEach(function (b) {
      b.addEventListener('click', function () {
        $('#detail-' + b.dataset.id).classList.toggle('open');
      });
    });
  }

  function setCard(id, status, statusText) {
    var card = $('#card-' + id);
    if (!card) return;
    card.className = 'test-card' + (status === 'running' ? ' is-running' : status === 'pass' ? ' is-pass' : status === 'warn' ? ' is-warn' : status === 'fail' ? ' is-fail' : '');
    var dot = $('.dot', card);
    dot.className = 'dot ' + (status === 'running' ? 'running' : status || 'idle');
    $('.st-text', card).textContent = statusText;
  }

  function renderDetail(id, r) {
    var box = $('#detail-' + id);
    var html = '<div style="margin-bottom:8px;color:var(--text)">' + MT.util.esc(r.detail || '') + '</div>';
    (r.evidence || []).forEach(function (e) {
      html += '<div class="evi ' + (e.t === 'bad' ? 'bad' : e.t === 'good' ? 'good' : '') + '">' + MT.util.esc(e.text) + '</div>';
    });
    if (r.metrics && (r.metrics.counts || r.metrics.probes || r.metrics.sample || r.metrics.responses)) {
      var m = r.metrics;
      if (m.probes) html += '<pre>词表向量：' + JSON.stringify(m.probes) + '</pre>';
      if (m.counts) html += '<pre>随机数分布：' + JSON.stringify(m.counts) + '</pre>';
      if (m.sample) html += '<pre>创作样本：' + MT.util.esc(m.sample) + '</pre>';
      if (m.responses) html += '<pre>' + MT.util.esc(JSON.stringify(m.responses.map(function (x) { return { id: x.id, refused: x.refused, text: x.text }; }))) + '</pre>';
    }
    box.innerHTML = html;
  }

  /* ---------- 运行 ---------- */
  function runOne(id) {
    var cfg = collectCfg();
    if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) {
      toast('请先填写完整的端点地址、API Key 和模型名称', true); return;
    }
    var t = MT.TESTS.find(function (x) { return x.id === id; });
    setCard(id, 'running', '运行中…');
    log('[' + id.toUpperCase() + ' ' + t.name + '] 开始检测…');
    var refCfg = collectRefCfg();
    Promise.resolve()
      .then(function () { return t.run({ cfg: cfg, refCfg: refCfg, log: log }); })
      .then(function (r) {
        state.results[id] = r;
        var label = r.status === 'pass' ? '正常' : r.status === 'warn' ? '可疑' : r.status === 'fail' ? '异常' : '参考';
        setCard(id, r.status, label + (r.score != null ? ' · 异常度 ' + (r.score * 100).toFixed(0) + '%' : ''));
        renderDetail(id, r);
        log('[' + id.toUpperCase() + '] 完成：' + label + ' — ' + (r.detail || ''), r.status === 'fail' ? 'err' : 'ok');
        toast('「' + t.name + '」完成：' + label);
      })
      .catch(function (e) {
        setCard(id, 'warn', '出错');
        log('[' + id.toUpperCase() + '] 出错：' + e.message, 'err');
        $('#detail-' + id).innerHTML = '<div class="evi bad">检测出错：' + MT.util.esc(e.message) + '</div>';
        toast('「' + t.name + '」出错：' + e.message.slice(0, 60), true);
      });
  }

  function runAll() {
    var cfg = collectCfg();
    if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) {
      toast('请先填写完整的端点地址、API Key 和模型名称', true); return;
    }
    if (state.running) return;
    state.running = true;
    state.results = {};
    saveCfg();
    $('#btnRunAll').disabled = true;
    $('#btnRunAll').textContent = '检测中…';
    log('—— 开始全量检测：' + cfg.model + ' @ ' + cfg.baseUrl + ' ——');
    var refCfg = collectRefCfg();
    var queue = MT.TESTS.map(function (t) { return t.id; });
    var done = 0;
    (function next() {
      if (!queue.length) {
        state.running = false;
        $('#btnRunAll').disabled = false;
        $('#btnRunAll').textContent = '▶ 运行全部检测';
        $('#runProgress').style.width = '100%';
        $('#runPtext').textContent = '完成';
        log('—— 全部检测完成，生成报告 ——', 'ok');
        showReport();
        autoSaveRecord(cfg);
        return;
      }
      var id = queue.shift();
      var t = MT.TESTS.find(function (x) { return x.id === id; });
      setCard(id, 'running', '运行中…');
      log('[' + id.toUpperCase() + ' ' + t.name + '] 开始…');
      Promise.resolve()
        .then(function () { return t.run({ cfg: cfg, refCfg: refCfg, log: log }); })
        .then(function (r) {
          state.results[id] = r;
          var label = r.status === 'pass' ? '正常' : r.status === 'warn' ? '可疑' : r.status === 'fail' ? '异常' : '参考';
          setCard(id, r.status, label + (r.score != null ? ' · 异常度 ' + (r.score * 100).toFixed(0) + '%' : ''));
          renderDetail(id, r);
          log('[' + id.toUpperCase() + '] ' + label + ' — ' + (r.detail || ''), r.status === 'fail' ? 'err' : 'ok');
        })
        .catch(function (e) {
          setCard(id, 'warn', '出错');
          log('[' + id.toUpperCase() + '] 出错：' + e.message, 'err');
          $('#detail-' + id).innerHTML = '<div class="evi bad">检测出错：' + MT.util.esc(e.message) + '</div>';
        })
        .then(function () {
          done++;
          var pct = Math.round(done / MT.TESTS.length * 100);
          $('#runProgress').style.width = pct + '%';
          $('#runPtext').textContent = done + '/' + MT.TESTS.length;
          setTimeout(next, 150);
        });
    })();
  }

  /* ---------- 报告 ---------- */
  function showReport() {
    if (!Object.keys(state.results).length) { toast('请先运行至少一项检测', true); return; }
    var cfg = collectCfg();
    state.summary = MT.report.render($('#reportBody'), state.results, cfg);
    $('#btnExport').disabled = false;
    $('#reportEmpty').style.display = 'none';
  }

  function exportReport() {
    if (!state.summary) return;
    var cfg = collectCfg();
    var md = MT.report.exportMarkdown(state.results, cfg, state.summary);
    download('掺水检测报告-' + cfg.model + '-' + Date.now() + '.md', md, 'text/markdown');
    download('掺水检测报告-' + cfg.model + '-' + Date.now() + '.json', JSON.stringify({ cfg: { baseUrl: cfg.baseUrl, model: cfg.model }, summary: state.summary, results: state.results }, null, 2), 'application/json');
    toast('报告已导出（Markdown + JSON）');
  }
  function download(name, content, type) {
    var blob = new Blob([content], { type: type + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- 记录同步 ---------- */
  function saveRecordNow() {
    if (!state.summary) { toast('请先运行检测（或加载演示数据）生成报告', true); return; }
    var cfg = collectCfg();
    var btn = $('#btnSaveRecord');
    btn.disabled = true; btn.textContent = '保存中…';
    MT.gh.saveRecord(cfg, state.summary, state.results).then(function (res) {
      btn.disabled = false; btn.textContent = '☁️ 保存记录到 GitHub';
      toast(res.message, res.status === 'error');
      log('记录同步：' + res.message, res.status === 'error' ? 'err' : res.status === 'saved' ? 'ok' : null);
      if (res.status === 'saved') MT.gh.refresh($('#recordsBody'), true);
    });
  }
  function autoSaveRecord(cfg) {
    if (!state.summary) return;
    if (!MT.gh.isConfigured()) {
      log('记录同步：未配置 GitHub Token，已跳过自动保存（高级设置 → 检测记录同步）');
      return;
    }
    MT.gh.saveRecord(cfg, state.summary, state.results).then(function (res) {
      log('记录同步：' + res.message, res.status === 'error' ? 'err' : res.status === 'saved' ? 'ok' : null);
      toast(res.message, res.status === 'error');
      if (res.status === 'saved') MT.gh.refresh($('#recordsBody'), true);
    });
  }

  /* ---------- 基线库 ---------- */
  function renderBase() {
    var q = ($('#baseSearch').value || '').toLowerCase();
    var tier = $('#baseTier').value;
    var rows = MT.MODELS.filter(function (m) {
      if (tier && m.tier !== tier) return false;
      if (!q) return true;
      return (m.name + ' ' + m.vendor + ' ' + m.id).toLowerCase().indexOf(q) !== -1;
    });
    var html = '<table class="base"><thead><tr>' +
      '<th>模型</th><th>厂商</th><th>档位</th><th>LiveBench</th><th>SWE-bench</th>' +
      '<th>上下文</th><th>知识截止</th><th>词表家族</th><th>输出价 $/M</th><th>备注</th></tr></thead><tbody>';
    rows.forEach(function (m) {
      html += '<tr><td><b>' + MT.util.esc(m.name) + '</b></td><td>' + MT.util.esc(m.vendor) + '</td>' +
        '<td><span class="tier-pill ' + m.tier + '">' + ({ flagship: '旗舰', pro: '高端', mini: '轻量', legacy: '过时' })[m.tier] + '</span></td>' +
        '<td class="num">' + m.livebench.toFixed(1) + (m.est ? ' <span class="est-mark">est</span>' : '') + '</td>' +
        '<td class="num">' + (m.swe ? m.swe.toFixed(1) + '%' : '—') + '</td>' +
        '<td class="num">' + m.ctx + '</td><td class="num">' + m.cutoff + '</td>' +
        '<td class="num" style="font-size:11.5px">' + m.tok + '</td>' +
        '<td class="num">' + m.priceOut.toFixed(2) + '</td>' +
        '<td style="white-space:normal;color:var(--text-3);font-size:12px">' + MT.util.esc(m.note || '') + '</td></tr>';
    });
    html += '</tbody></table>';
    $('#baseTable').innerHTML = html;
  }

  /* ---------- 方法论 ---------- */
  function renderMethods() {
    var html = '';
    MT.METHODS.forEach(function (m) {
      html += '<div class="method-card"><h3>' + MT.util.esc(m.name) + '<span class="w">证据权重 ' + m.weight + '</span></h3>' +
        '<div class="src">' + MT.util.esc(m.source) + '</div><p>' + MT.util.esc(m.desc) + '</p></div>';
    });
    $('#methodGrid').innerHTML = html;
  }

  /* ---------- 成本估算 ---------- */
  function updateCost() {
    var total = MT.TESTS.reduce(function (s, t) { return s + t.cost; }, 0);
    var claim = MT.guessClaim($('#modelName').value);
    var price = claim ? (claim.priceIn * 0.85 + claim.priceOut * 0.15) : 2.0;
    var cost = total / 1e6 * price;
    $('#costEstimate').textContent = '全量检测约消耗 ' + (total / 1000).toFixed(1) + 'K tokens ≈ $' + cost.toFixed(2) +
      (claim ? '（按 ' + claim.name + ' 官方价）' : '（按通用旗舰价估算）');
  }

  /* ---------- 连接测试 ---------- */
  function testConnection() {
    var cfg = collectCfg();
    if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) { toast('请先填写端点、Key 和模型', true); return; }
    log('连接测试：' + cfg.model + ' @ ' + cfg.baseUrl);
    MT.api.chat(cfg, [{ role: 'user', content: '请只回复两个字：正常' }], { maxTokens: 32 })
      .then(function (r) {
        log('连接成功 · ' + MT.util.fmtMs(r.ms) + ' · model=' + (r.model || '?') + ' · 回复「' + r.text.trim().slice(0, 40) + '」', 'ok');
        toast('连接成功（' + MT.util.fmtMs(r.ms) + '）');
      })
      .catch(function (e) {
        log('连接失败：' + e.message, 'err');
        toast('连接失败：' + e.message.slice(0, 70), true);
      });
  }

  /* ---------- 演示模式 ---------- */
  function loadDemo() {
    state.results = JSON.parse(JSON.stringify(MT.DEMO.results));
    MT.TESTS.forEach(function (t) {
      var r = state.results[t.id];
      if (!r) return;
      var label = r.status === 'pass' ? '正常' : r.status === 'warn' ? '可疑' : r.status === 'fail' ? '异常' : '参考';
      setCard(t.id, r.status, label + ' · 异常度 ' + (r.score * 100).toFixed(0) + '%（演示数据）');
      renderDetail(t.id, r);
    });
    $('#runPtext').textContent = MT.TESTS.length + '/' + MT.TESTS.length;
    $('#runProgress').value = 100;
    $('#modelName').value = MT.DEMO.cfg.model;
    $('#baseUrl').value = MT.DEMO.cfg.baseUrl;
    log('—— 已载入演示数据（某 2.0 倍率「Claude Opus 4.8」中转站实测样本）——', 'ok');
    toast('已载入演示数据，可直接查看报告');
    showReport();
    /* 记录区并入一条演示记录，展示记录格式（不写入 GitHub） */
    var demo = MT.gh.demoRecord();
    MT.gh.renderRecords($('#recordsBody'), { records: MT.gh.getLast().records.concat([demo]), source: MT.gh.getLast().source }, {});
  }

  /* ---------- 初始化 ---------- */
  function init() {
    renderCards();
    renderBase();
    renderMethods();
    updateCost();
    loadCfg();

    $('#btnTestConn').addEventListener('click', testConnection);
    $('#btnRunAll').addEventListener('click', runAll);
    $('#btnShowReport').addEventListener('click', showReport);
    $('#btnExport').addEventListener('click', exportReport);
    $('#btnSaveRecord').addEventListener('click', saveRecordNow);
    $('#btnGhSave').addEventListener('click', MT.gh.saveCfgFromForm);
    $('#btnDemo').addEventListener('click', loadDemo);
    $('#modelName').addEventListener('input', updateCost);
    $('#baseSearch').addEventListener('input', renderBase);
    $('#baseTier').addEventListener('change', renderBase);

    /* GitHub 记录模块 */
    MT.gh.loadCfgToForm();
    MT.gh.refresh($('#recordsBody'), true);

    /* 协议分段切换 */
    $$('#protocolSeg button').forEach(function (b) {
      b.addEventListener('click', function () { setSeg($('#protocolSeg'), b.dataset.v); });
    });
    $$('#refProtocolSeg button').forEach(function (b) {
      b.addEventListener('click', function () { setSeg($('#refProtocolSeg'), b.dataset.v); });
    });

    /* 平滑导航高亮由浏览器锚点完成；Header 演示按钮文案 */
    $('#btnExport').disabled = true;
  }

  return { init: init, state: state, toast: toast };
})();

document.addEventListener('DOMContentLoaded', MT.app.init);
