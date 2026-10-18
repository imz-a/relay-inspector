/* ============================================================
 * 照妖镜 — SVG 图表库（无外部依赖）
 * ============================================================ */
window.MT = window.MT || {};
MT.charts = (function () {
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(parent, x, y, str, attrs) {
    var t = el('text', Object.assign({ x: x, y: y }, attrs || {}), parent);
    t.textContent = str;
    return t;
  }

  /* ---------- 雷达图 ----------
   * axes: [{label, a, b}]  a=检测值 b=官方基线值 (0-100) */
  function radar(container, axes, opts) {
    opts = opts || {};
    var W = 460, H = 420, cx = W / 2, cy = H / 2 + 8, R = 150;
    var n = axes.length;
    container.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': '能力雷达对比图' }, container);

    var ang = function (i) { return (Math.PI * 2 * i / n) - Math.PI / 2; };
    var pt = function (i, r) { return [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r]; };

    // 网格环
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      var d = '';
      for (var i = 0; i < n; i++) { var p = pt(i, R * f); d += (i ? ' L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }
      el('path', { d: d + ' Z', fill: 'none', stroke: '#E3E3E8', 'stroke-width': 1 }, svg);
    });
    // 轴线 + 标签
    for (var i = 0; i < n; i++) {
      var p = pt(i, R), lp = pt(i, R + 26);
      el('line', { x1: cx, y1: cy, x2: p[0], y2: p[1], stroke: '#E3E3E8', 'stroke-width': 1 }, svg);
      var anchor = Math.abs(lp[0] - cx) < 30 ? 'middle' : (lp[0] > cx ? 'start' : 'end');
      txt(svg, lp[0], lp[1] + 4, axes[i].label, { fill: '#6E6E73', 'font-size': 13, 'text-anchor': anchor, 'font-family': 'sans-serif' });
    }
    function poly(key, color, fillOpacity, dash) {
      var d = '';
      for (var i = 0; i < n; i++) {
        var v = Math.max(0, Math.min(100, axes[i][key] || 0));
        var p = pt(i, R * v / 100);
        d += (i ? ' L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      }
      var attrs = { d: d + ' Z', fill: color, 'fill-opacity': fillOpacity, stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' };
      if (dash) attrs['stroke-dasharray'] = dash;
      el('path', attrs, svg);
    }
    poly('b', '#A1A1A6', 0.08, '5 4');   // 官方基线（虚线灰）
    poly('a', '#0071E3', 0.20);          // 检测结果（主蓝）
    // 数据点
    for (var i = 0; i < n; i++) {
      var v = Math.max(0, Math.min(100, axes[i].a || 0));
      var p = pt(i, R * v / 100);
      el('circle', { cx: p[0], cy: p[1], r: 3.4, fill: '#0071E3' }, svg);
    }
    return svg;
  }

  /* ---------- 掺水指数仪表盘 ---------- */
  function gauge(container, value) {
    var W = 300, H = 190, cx = W / 2, cy = H - 26, R = 112;
    container.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': '掺水指数' }, container);
    var bands = [
      [0, 15, '#248A3D'], [15, 35, '#B25000'], [35, 60, '#C72C00'], [60, 85, '#D70015'], [85, 100, '#A80012']
    ];
    var toAng = function (v) { return Math.PI * (1 - v / 100); };
    bands.forEach(function (b) {
      var r = 22, x1 = cx + Math.cos(toAng(b[0])) * r, y1 = cy - Math.sin(toAng(b[0])) * r;
      var x2 = cx + Math.cos(toAng(b[1])) * r, y2 = cy - Math.sin(toAng(b[1])) * r;
      el('path', {
        d: 'M' + x1 + ' ' + y1 + ' A' + r + ' ' + r + ' 0 0 1 ' + x2 + ' ' + y2,
        fill: 'none', stroke: b[2], 'stroke-width': 15, 'stroke-linecap': 'butt', opacity: 0.85
      }, svg);
    });
    // 刻度
    for (var v = 0; v <= 100; v += 10) {
      var a = toAng(v), r1 = R - 34, r2 = R - 27;
      el('line', {
        x1: cx + Math.cos(a) * r1, y1: cy - Math.sin(a) * r1,
        x2: cx + Math.cos(a) * r2, y2: cy - Math.sin(a) * r2,
        stroke: '#C7C7CC', 'stroke-width': 1
      }, svg);
      var lr = R - 47;
      txt(svg, cx + Math.cos(a) * lr, cy - Math.sin(a) * lr + 4, String(v),
        { fill: '#A1A1A6', 'font-size': 9.5, 'text-anchor': 'middle', 'font-family': 'monospace' });
    }
    // 指针
    var a = toAng(Math.max(0, Math.min(100, value)));
    var px = cx + Math.cos(a) * (R - 16), py = cy - Math.sin(a) * (R - 16);
    el('line', { x1: cx, y1: cy, x2: px, y2: py, stroke: '#1D1D1F', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
    el('circle', { cx: cx, cy: cy, r: 6, fill: '#1D1D1F' }, svg);
    txt(svg, cx, cy - 62, value.toFixed(1), { fill: '#1D1D1F', 'font-size': 40, 'font-weight': 800, 'text-anchor': 'middle', 'font-family': 'monospace' });
    txt(svg, cx, cy - 42, '掺水指数 / 100', { fill: '#6E6E73', 'font-size': 12, 'text-anchor': 'middle', 'font-family': 'sans-serif' });
    return svg;
  }

  /* ---------- 水平条形图（延迟/TTFT 等） ---------- */
  function bars(container, rows, opts) {
    opts = opts || {};
    container.innerHTML = '';
    var max = Math.max.apply(null, rows.map(function (r) { return r.v; })) || 1;
    rows.forEach(function (r) {
      var line = document.createElement('div');
      line.style.cssText = 'display:grid;grid-template-columns:110px 1fr 74px;gap:10px;align-items:center;font-size:12.5px;margin-bottom:8px;';
      var name = document.createElement('span'); name.textContent = r.k; name.style.color = '#6E6E73';
      var track = document.createElement('div');
      track.style.cssText = 'height:12px;background:#F0F0F2;border-radius:99px;overflow:hidden;border:1px solid #E3E3E8;position:relative;';
      var fill = document.createElement('i');
      fill.style.cssText = 'position:absolute;inset:0 auto 0 0;width:' + (r.v / max * 100).toFixed(1) + '%;border-radius:99px;background:' + (r.color || '#0071E3') + ';';
      track.appendChild(fill);
      var val = document.createElement('span'); val.textContent = r.t || String(r.v);
      val.style.cssText = 'font-family:monospace;color:#1D1D1F;text-align:right;';
      line.appendChild(name); line.appendChild(track); line.appendChild(val);
      container.appendChild(line);
    });
  }

  return { radar: radar, gauge: gauge, bars: bars };
})();
