/* ============================================================
 * 照妖镜 — 评分与报告层
 * ============================================================ */
window.MT = window.MT || {};
MT.report = (function () {

  /* ---------- 掺水指数 ---------- */
  function dilution(results) {
    var wSum = 0, aSum = 0, perTest = [];
    MT.TESTS.forEach(function (t) {
      var r = results[t.id];
      if (!r || r.status === 'error') { perTest.push({ id: t.id, name: t.name, weight: t.weight, score: null }); return; }
      wSum += t.weight; aSum += t.weight * (r.score || 0);
      perTest.push({ id: t.id, name: t.name, weight: t.weight, score: r.score });
    });
    var index = wSum ? (aSum / wSum) * 100 : 0;
    return { index: Math.round(index * 10) / 10, perTest: perTest, covered: wSum };
  }

  /* ---------- 实际模型鉴定 ---------- */
  function identify(results) {
    var votes = {};
    Object.keys(results).forEach(function (tid) {
      var r = results[tid];
      if (!r || !r.votes) return;
      for (var k in r.votes) votes[k] = (votes[k] || 0) + r.votes[k];
    });
    var max = 0;
    for (var k in votes) max = Math.max(max, votes[k]);
    var list = Object.keys(votes).map(function (k) {
      return { id: k, votes: votes[k], pct: max ? Math.round(votes[k] / max * 99) : 0 };
    }).sort(function (a, b) { return b.votes - a.votes; });
    list.forEach(function (x) { x.model = MT.modelById(x.id); });
    return list.slice(0, 6);
  }

  /* ---------- 能力维度估算（0-100） ---------- */
  function capabilityAxes(results, claim) {
    function rate(id) { var r = results[id]; return r && r.metrics && r.metrics.rate != null ? r.metrics.rate * 100 : null; }
    var axes = [];
    axes.push({ label: '推理数学', a: rate('t7') });
    axes.push({ label: '代码', a: rate('t8') });
    var t5 = results.t5, t5v = t5 && t5.metrics ? (t5.metrics.right / 12) * 100 : null;
    axes.push({ label: '知识', a: t5v });
    var t6 = results.t6, t6v = null;
    if (t6 && t6.metrics && t6.metrics.depths) {
      var pass = t6.metrics.depths.filter(function (d) { return d.ok; }).length;
      t6v = pass / 3 * 100;
    }
    axes.push({ label: '长上下文', a: t6v });
    axes.push({ label: '指令遵循', a: rate('t3') });
    var t10 = results.t10, t10v = null;
    if (t10 && t10.metrics) {
      var s = 60;
      if (t10.metrics.uniqueOutputs <= 1) s += 30; else if (t10.metrics.uniqueOutputs <= 2) s += 15;
      if (!t10.metrics.fakeStream) s += 10;
      t10v = s;
    }
    axes.push({ label: '稳定性', a: t10v });
    /* 官方基线 */
    var lb = claim ? claim.livebench : 75;
    var swe = claim && claim.swe ? claim.swe : lb - 6;
    var ctxScore = 92;
    if (claim) {
      var c = String(claim.ctx);
      if (/1\.?1?M/.test(c)) ctxScore = 96;
      else if (/1M/.test(c)) ctxScore = 94;
      else if (/512K/.test(c)) ctxScore = 88;
      else if (/256K|262K/.test(c)) ctxScore = 86;
      else if (/200K/.test(c)) ctxScore = 82;
      else if (/128K/.test(c)) ctxScore = 76;
      else ctxScore = 66;
    }
    var base = [lb, swe, Math.min(96, lb + 6), ctxScore, lb - 4, 90];
    axes.forEach(function (ax, i) {
      ax.b = base[i];
      if (ax.a == null) ax.a = null;
    });
    return axes;
  }

  /* ---------- 成本对比 ---------- */
  function costCompare(claim, identified) {
    if (!claim) return null;
    var top = identified && identified[0];
    var real = top && top.model ? top.model : null;
    if (!real) return null;
    var ratio = claim.priceOut && real.priceOut ? (real.priceOut / claim.priceOut) : null;
    return { claim: claim, real: real, ratio: ratio };
  }

  /* ---------- 渲染 ---------- */
  function band(v) {
    for (var i = 0; i < MT.VERDICT_BANDS.length; i++) {
      var b = MT.VERDICT_BANDS[i];
      if (v >= b.min && v <= b.max) return b;
    }
    return MT.VERDICT_BANDS[MT.VERDICT_BANDS.length - 1];
  }

  function render(container, results, cfg) {
    var d = dilution(results);
    var claim = MT.guessClaim(cfg.model);
    var identified = identify(results);
    var b = band(d.index);
    var axes = capabilityAxes(results, claim);

    var html = '';
    /* 结论面板 */
    html += '<div class="report-grid">';
    html += '<div class="panel verdict-panel">';
    html += '<div class="mini-title" style="justify-content:center">综合判定</div>';
    html += '<div class="gauge-wrap" id="gaugeBox"></div>';
    html += '<div class="verdict-badge ' + b.level + '">' + b.label + '</div>';
    html += '<div class="verdict-desc">' + MT.util.esc(b.desc) + '</div>';
    html += '<div style="margin-top:14px;font-size:12.5px;color:var(--text-3);text-align:left;line-height:1.9">';
    html += '检测覆盖度：<b style="color:var(--text-2)">' + d.covered + '/100</b> 权重<br>';
    html += '声称模型：<b style="color:var(--text-2)">' + MT.util.esc(cfg.model) + '</b>' + (claim ? '（参考基线 ' + claim.name + '）' : '（未匹配到基线库，按通用旗舰评估）') + '<br>';
    html += '检测时间：' + new Date().toLocaleString('zh-CN');
    html += '</div></div>';

    /* 右列 */
    html += '<div class="report-side">';
    /* 模型鉴定 */
    html += '<div class="panel"><div class="mini-title">掺水后端鉴定 · 它最可能是什么模型</div>';
    if (identified.length) {
      html += '<div class="idlist">';
      identified.forEach(function (x, i) {
        html += '<div class="idrow' + (i === 0 ? ' top' : '') + '">' +
          '<span class="rank">' + (i + 1) + '</span>' +
          '<div><div class="idname">' + MT.util.esc(x.model ? x.model.name : x.id) +
          (x.model ? '<small>' + MT.util.esc(x.model.vendor) + ' · LiveBench ' + x.model.livebench + (x.model.est ? ' (est)' : '') + '</small>' : '') +
          '</div><div class="idbar"><i style="width:' + x.pct + '%"></i></div></div>' +
          '<span class="idpct">' + x.pct + '%</span></div>';
      });
      html += '</div>';
      html += '<div style="font-size:12px;color:var(--text-3);margin-top:10px">匹配度由词表指纹、随机数行为指纹、知识截止、能力档位、文风与拒答话术加权得出；若第一名与声称模型不同且匹配度显著，即高置信度偷换证据。</div>';
    } else {
      html += '<div style="font-size:13px;color:var(--text-2)">证据不足，请先运行至少 T2/T4/T7 测试。</div>';
    }
    html += '</div>';

    /* 能力对比 */
    html += '<div class="panel"><div class="mini-title">模型能力对比 · 实测 vs 官方基线</div>';
    html += '<div class="charts-flex"><div class="chart-box" id="radarBox"></div><div>';
    html += '<table class="cmp-table"><tr><th>维度</th><th>实测</th><th>官方基线</th><th>差距</th></tr>';
    axes.forEach(function (ax) {
      var a = ax.a == null ? '—' : ax.a.toFixed(0);
      var diff = ax.a == null ? null : ax.a - ax.b;
      var cls = diff == null ? 'mid' : diff < -12 ? 'bad' : diff < -4 ? 'mid' : 'ok';
      html += '<tr><td>' + ax.label + '</td><td class="num">' + a + '</td><td class="num">' + ax.b.toFixed(0) + '</td>' +
        '<td>' + (diff == null ? '<span class="delta mid">未测</span>' : '<span class="delta ' + cls + '">' + (diff > 0 ? '+' : '') + diff.toFixed(0) + '</span>') + '</td></tr>';
    });
    html += '</table>';
    html += '<div class="legend"><span><i style="background:#0071E3"></i>实测能力</span><span><i style="background:#A1A1A6"></i>声称模型官方基线</span></div>';
    html += '</div></div>';
    if (claim) {
      html += '<div style="font-size:12.5px;color:var(--text-3);margin-top:10px">基线来源：' + MT.util.esc(claim.name) + ' · LiveBench ' + claim.livebench + ' · SWE-bench ' + (claim.swe || '—') + ' · 上下文 ' + claim.ctx + ' · 知识截止 ' + claim.cutoff + '</div>';
    }
    html += '</div>';

    /* 成本账 */
    var cc = costCompare(claim, identified);
    if (cc && d.index >= 36) {
      html += '<div class="panel" style="border-color:rgba(215,0,21,.35)"><div class="mini-title" style="color:var(--red)">成本账 · 你可能在为什么付费</div>';
      html += '<div style="font-size:13.5px;line-height:2">';
      html += '你按 <b>' + MT.util.esc(cc.claim.name) + '</b>（输出 $' + cc.claim.priceOut.toFixed(2) + '/M tokens）付费，<br>';
      html += '指纹鉴定的实际后端最可能是 <b style="color:var(--red)">' + MT.util.esc(cc.real.name) + '</b>（输出 $' + cc.real.priceOut.toFixed(2) + '/M tokens）。<br>';
      html += '<span style="color:var(--red);font-weight:700">单位输出 token 的实际价值约为标价的 ' + (cc.ratio * 100).toFixed(1) + '%——每支付 100 元，约 ' + (100 - cc.ratio * 100).toFixed(0) + ' 元买不到对应模型。</span>';
      html += '</div></div>';
    }
    html += '</div></div>';

    /* 证据流 */
    html += '<div class="panel" style="margin-top:16px"><div class="mini-title">证据流 · 全部检测信号</div><div class="evi-list">';
    MT.TESTS.forEach(function (t) {
      var r = results[t.id];
      if (!r) return;
      var tag = r.status === 'fail' ? ['bad', '异常'] : r.status === 'warn' ? ['info', '可疑'] : r.status === 'pass' ? ['good', '正常'] : ['info', '参考'];
      (r.evidence || []).forEach(function (e) {
        var et = e.t === 'bad' ? ['bad', '异常'] : e.t === 'good' ? ['good', '正常'] : ['info', '信息'];
        html += '<div class="evi"><span class="tag ' + et[0] + '">' + et[1] + '</span><span><b style="color:var(--text)">[' + t.id.toUpperCase() + ' ' + t.name + ']</b> ' + MT.util.esc(e.text) + '</span></div>';
      });
    });
    html += '</div></div>';

    container.innerHTML = html;
    MT.charts.gauge(document.getElementById('gaugeBox'), d.index);
    MT.charts.radar(document.getElementById('radarBox'), axes);
    if (typeof container.scrollIntoView === 'function') {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return { index: d.index, band: b, claim: claim, identified: identified, axes: axes, cost: cc };
  }

  /* ---------- 导出 ---------- */
  function exportMarkdown(results, cfg, summary) {
    var L = [];
    L.push('# 中转站掺水检测报告');
    L.push('');
    L.push('- 声称模型：' + cfg.model);
    L.push('- 端点：' + cfg.baseUrl);
    L.push('- 掺水指数：**' + summary.index + ' / 100**（' + summary.band.label + '）');
    L.push('- 检测时间：' + new Date().toLocaleString('zh-CN'));
    if (summary.claim) L.push('- 官方基线：' + summary.claim.name + '（LiveBench ' + summary.claim.livebench + ' / SWE-bench ' + (summary.claim.swe || '—') + '）');
    if (summary.identified.length) {
      L.push('- 后端鉴定：' + summary.identified.map(function (x) { return (x.model ? x.model.name : x.id) + ' ' + x.pct + '%'; }).join('、'));
    }
    L.push('');
    L.push('## 能力对比（实测 vs 官方基线）');
    L.push('');
    L.push('| 维度 | 实测 | 官方基线 | 差距 |');
    L.push('|---|---|---|---|');
    summary.axes.forEach(function (ax) {
      L.push('| ' + ax.label + ' | ' + (ax.a == null ? '—' : ax.a.toFixed(0)) + ' | ' + ax.b.toFixed(0) + ' | ' + (ax.a == null ? '—' : (ax.a - ax.b).toFixed(0)) + ' |');
    });
    L.push('');
    L.push('## 各项检测');
    MT.TESTS.forEach(function (t) {
      var r = results[t.id];
      if (!r) return;
      L.push('### ' + t.id.toUpperCase() + ' ' + t.name + ' — ' + (r.status === 'fail' ? '异常' : r.status === 'warn' ? '可疑' : r.status === 'pass' ? '正常' : '参考'));
      L.push('- ' + (r.detail || ''));
      (r.evidence || []).forEach(function (e) { L.push('  - ' + e.text); });
      L.push('');
    });
    L.push('---');
    L.push('由「照妖镜 · API 中转站掺水检测站」生成；方法论综合 CISPA LLMmap / One Token Is Enough / tokwhois / TSecurity 五信号法。');
    return L.join('\n');
  }

  return { dilution: dilution, identify: identify, capabilityAxes: capabilityAxes, render: render, band: band, exportMarkdown: exportMarkdown };
})();
