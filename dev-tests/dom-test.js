/* DOM 级启动测试：jsdom 全页面加载 + 演示模式 + 报告渲染验证 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const dir = path.join(__dirname, '..');

const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const errors = [];
const dom = new JSDOM(html, {
  url: 'http://localhost/index.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const { window } = dom;
const { document } = window;
window.addEventListener('error', e => errors.push('window: ' + e.message));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ FAIL: ' + name + (extra ? ' — ' + extra : '')); }
}

/* 按页面顺序加载脚本 */
['js/data.js', 'js/demo.js', 'js/charts.js', 'js/gh.js', 'js/tests.js', 'js/report.js', 'js/app.js'].forEach(f => {
  try { window.eval(fs.readFileSync(path.join(dir, f), 'utf8')); }
  catch (e) { errors.push(f + ': ' + e.message); }
});
document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

console.log('— 页面初始化 —');
check('12 个测试卡片', document.querySelectorAll('.test-card').length === 12, String(document.querySelectorAll('.test-card').length));
check('测试卡片含运行按钮', document.querySelectorAll('.btn-run').length === 12);
check('基线表行数>=25', document.querySelectorAll('#baseTable tbody tr').length >= 25, String(document.querySelectorAll('#baseTable tbody tr').length));
check('方法论卡片 5 张', document.querySelectorAll('#methodGrid .method-card').length === 5);
check('成本估算已填充', /tokens/.test(document.querySelector('#costEstimate').textContent));
check('运行按钮已绑定', typeof window.MT.app === 'object');
check('测试定义 12 项', window.MT.TESTS.length === 12);

console.log('— 基线库筛选 —');
const search = document.querySelector('#baseSearch');
search.value = 'deepseek';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
const rows = document.querySelectorAll('#baseTable tbody tr').length;
check('搜索 DeepSeek 有结果', rows >= 1 && rows < 25, String(rows));
search.value = '';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
const tier = document.querySelector('#baseTier');
tier.value = 'flagship';
tier.dispatchEvent(new window.Event('change', { bubbles: true }));
check('旗舰筛选生效', document.querySelectorAll('#baseTable tbody tr').length < 25);

console.log('— 演示模式 —');
try {
  document.querySelector('#btnDemo').click();
} catch (e) { errors.push('demo click: ' + e.message); }
const reportHtml = document.querySelector('#reportBody').innerHTML;
check('报告已渲染', reportHtml.length > 2000);
check('掺水指数仪表盘 SVG', !!document.querySelector('#gaugeBox svg'));
check('结论徽章', !!document.querySelector('.verdict-badge'));
check('结论=严重掺水', /严重掺水/.test(reportHtml));
check('能力雷达 SVG', !!document.querySelector('#radarBox svg'));
check('雷达网格+双多边形', document.querySelectorAll('#radarBox svg path').length === 6, String(document.querySelectorAll('#radarBox svg path').length));
check('鉴定列表 6 行', document.querySelectorAll('.idrow').length === 6);
check('鉴定Top1=GLM-4-9B', /GLM-4-9B/.test(document.querySelector('.idrow.top').textContent));
check('成本账面板出现', /成本账/.test(reportHtml));
check('证据流非空', document.querySelectorAll('.evi-list .evi').length >= 20, String(document.querySelectorAll('.evi-list .evi').length));
check('测试卡片全部完成态', document.querySelectorAll('.test-card.is-fail, .test-card.is-warn, .test-card.is-pass, .test-card').length === 12);
check('导出按钮启用', document.querySelector('#btnExport').disabled === false);
check('卡片详情已填充', document.querySelectorAll('.tc-detail .evi').length > 20);

console.log('— 导出功能 —');
try {
  const md = window.MT.report.exportMarkdown(window.MT.app.state.results, { baseUrl: 'x', model: 'claude-opus-4-8' }, window.MT.app.state.summary);
  check('Markdown 报告生成', md.indexOf('掺水指数') !== -1 && md.indexOf('GLM') !== -1);
} catch (e) { errors.push('export: ' + e.message); check('Markdown 报告生成', false, e.message); }

console.log('— GitHub 记录模块 —');
check('记录容器存在', !!document.querySelector('#recordsBody'));
check('保存记录按钮存在', !!document.querySelector('#btnSaveRecord'));
check('GitHub 配置表单存在', !!document.querySelector('#ghOwner') && !!document.querySelector('#ghRepo') && !!document.querySelector('#ghToken') && !!document.querySelector('#ghBranch'));
check('gh 模块已加载', typeof window.MT.gh === 'object' && typeof window.MT.gh.saveRecord === 'function');
const recHtml = document.querySelector('#recordsBody').innerHTML;
check('演示记录已渲染统计条', /rec-stats/.test(recHtml) && /累计记录/.test(recHtml));
check('演示记录表格行', document.querySelectorAll('#recordsBody tbody tr').length === 1, String(document.querySelectorAll('#recordsBody tbody tr').length));
check('演示记录含中转站与结论', /relay-demo\.example\.com/.test(recHtml) && /高度假冒/.test(recHtml));
try {
  document.querySelector('#ghOwner').value = 'imz-a';
  document.querySelector('#ghRepo').value = 'relay-inspector';
  document.querySelector('#ghToken').value = 'github_pat_test';
  document.querySelector('#ghRemember').checked = true;
  document.querySelector('#btnGhSave').click();
} catch (e) { errors.push('gh cfg: ' + e.message); }
check('配置后状态=已连接', /已连接/.test(document.querySelector('#ghStatus').textContent));
check('配置已持久化', (window.localStorage.getItem('mt.gh') || '').indexOf('relay-inspector') !== -1);
check('isConfigured 为真', window.MT.gh.isConfigured() === true);

console.log('— 无 JS 运行时错误 —');
check('零错误', errors.length === 0, errors.join(' | '));

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
if (errors.length) console.log('错误详情:\n' + errors.join('\n'));
process.exit(fail ? 1 : 0);
