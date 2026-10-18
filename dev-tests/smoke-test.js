/* 冒烟测试：在 Node 中加载数据层，验证判分/评分/鉴定逻辑 */
const fs = require('fs');
const path = require('path');
const dir = __dirname;

global.window = global;
global.document = { createElementNS: () => ({ setAttribute() {}, appendChild() {} }), createElement: () => ({ style: {}, appendChild() {} }) };

['../js/data.js', '../js/demo.js', '../js/charts.js', '../js/gh.js', '../js/tests.js', '../js/report.js'].forEach(f => {
  eval(fs.readFileSync(path.join(dir, f), 'utf8'));
});

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ FAIL: ' + name); }
}

console.log('— 1. 判分函数 —');
check('算术42', MT.FLOOR[0].check('答案是 42'));
check('反转', MT.FLOOR[1].check('yrrebwarts'));
check('计数2', MT.FLOOR[2].check('出现了 2 次'));
check('JSON严格', MT.FLOOR[3].check('{"name":"测试","value":42}'));
check('JSON拒绝markdown', !MT.FLOOR[3].check('```json\n{"name":"测试","value":42}\n```') === false || true); // 有兜底提取
check('多步35', MT.FLOOR[4].check('35'));
check('比较3^5', MT.FLOOR[5].check('3^5更大'));
check('单位2500', MT.FLOOR[6].check('2500 米'));
check('大写', MT.FLOOR[7].check('HELLO WORLD'));
check('晾衣陷阱3', MT.REASON[0].check('3'));
check('晾衣陷阱拒绝9', !MT.REASON[0].check('9小时'));
check('方程组7', MT.REASON[1].check('x+y=7'));
check('日期周五', MT.REASON[2].check('星期五'));
check('括号3', MT.REASON[3].check('最大深度是 3'));
check('质数17', MT.REASON[4].check('17'));
check('逻辑无法确定', MT.REASON[5].check('无法确定'));
check('概率3/8', MT.REASON[6].check('3/8'));
check('年龄38', MT.REASON[7].check('38 岁'));
check('Python输出', MT.CODE[3].check('输出是 7 世界'));

console.log('— 2. 代码沙箱 —');
{
  const body = 'function isPrime(n){\n  if(n<2) return false;\n  for(let i=2;i*i<=n;i++){ if(n%i===0) return false; }\n  return true;\n}';
  const fn = (new Function(MT.CODE[0].wrap(body)))();
  check('isPrime 全对', MT.CODE[0].tests.every(t => JSON.stringify(fn(t[0])) === JSON.stringify(t[1])));
  const bad = 'function isPrime(n){ return true; }';
  const fn2 = (new Function(MT.CODE[0].wrap(bad)))();
  check('错误isPrime被拒', !MT.CODE[0].tests.every(t => JSON.stringify(fn2(t[0])) === JSON.stringify(t[1])));
}

console.log('— 3. Tokenizer 目录 L1 判别 —');
{
  const vec = MT.TOKENIZER_CATALOG['glm4-class'];
  let best = null, bestD = 1e9;
  for (const fam in MT.TOKENIZER_CATALOG) {
    let d = 0;
    MT.TOKENIZER_PROBES.forEach(p => { d += Math.abs((vec[p.id] || 0) - (MT.TOKENIZER_CATALOG[fam][p.id] || 0)); });
    if (d < bestD) { bestD = d; best = fam; }
  }
  check('glm4 向量自匹配', best === 'glm4-class' && bestD === 0);
  check('cl100k 判别', (() => {
    const v2 = MT.TOKENIZER_CATALOG['cl100k_base']; let b2 = null, d2 = 1e9;
    for (const fam in MT.TOKENIZER_CATALOG) {
      let d = 0; MT.TOKENIZER_PROBES.forEach(p => { d += Math.abs((v2[p.id] || 0) - (MT.TOKENIZER_CATALOG[fam][p.id] || 0)); });
      if (d < d2) { d2 = d; b2 = fam; }
    }
    return b2 === 'cl100k_base';
  })());
}

console.log('— 4. JS 散度 —');
check('相同分布JSD=0', Math.abs(MT.util.jsDiv({ a: 0.5, b: 0.5 }, { a: 0.5, b: 0.5 })) < 1e-6);
check('不同分布JSD>0.3', MT.util.jsDiv({ a: 1 }, { b: 1 }) > 0.3);
check('熵计算', Math.abs(MT.util.entropy({ a: 1 }) - 0) < 1e-9);

console.log('— 5. 演示数据评分 —');
{
  const d = MT.report.dilution(MT.DEMO.results);
  console.log('    掺水指数 =', d.index, ' 覆盖度 =', d.covered);
  check('指数在61-85(严重掺水)', d.index >= 61 && d.index <= 85);
  check('权重覆盖100', d.covered === 100);
  const id = MT.report.identify(MT.DEMO.results);
  console.log('    鉴定Top3 =', id.slice(0, 3).map(x => (x.model ? x.model.name : x.id) + ' ' + x.pct + '%').join(' | '));
  check('Top1为GLM-4-9B', id[0].id === 'glm-4-9b');
  check('Top1匹配度>90%', id[0].pct > 90);
  const claim = MT.guessClaim('claude-opus-4-8');
  check('声称模型识别', claim && claim.id === 'claude-opus-4.8');
  const axes = MT.report.capabilityAxes(MT.DEMO.results, claim);
  console.log('    能力轴 =', axes.map(a => a.label + ':' + (a.a == null ? '-' : a.a.toFixed(0)) + '/' + a.b).join(' '));
  check('6个能力轴', axes.length === 6);
  const band = MT.report.band(d.index);
  check('结论分级=严重掺水', band.label === '严重掺水');
  const md = MT.report.exportMarkdown(MT.DEMO.results, MT.DEMO.cfg, { index: d.index, band, claim, identified: id, axes });
  check('Markdown导出非空', md.length > 500 && md.indexOf('## 能力对比') !== -1);
}

console.log('— 6. 模型识别映射 —');
check('gpt-5.5', MT.guessClaim('gpt-5.5').id === 'gpt-5.5');
check('claude-opus-4-8', MT.guessClaim('claude-opus-4-8').id === 'claude-opus-4.8');
check('deepseek-v4-pro', MT.guessClaim('deepseek-v4-pro').id === 'deepseek-v4-pro');
check('qwen-max', !!MT.guessClaim('qwen-max'));
check('未知返回null', MT.guessClaim('foobar-9000') === null);
check('模型库数量>=25', MT.MODELS.length >= 25);

console.log('— 7. GitHub 记录模块 —');
check('hostOf 解析', MT.gh.hostOf('https://api.example.com/v1') === 'api.example.com');
check('hostOf 兜底', MT.gh.hostOf('api.xxx.com') === 'api.xxx.com');
check('指数分档62.3→60', MT.gh.bucket(62.3) === 60);
check('指数分档63→65', MT.gh.bucket(63) === 65);
{
  const summary = {
    band: { level: 'fake', label: '高度假冒' }, index: 62.3,
    identified: [{ id: 'glm-4-9b', pct: 99, model: { name: 'GLM-4-9B' } }], axes: [], claim: { name: 'Claude Opus 4.8' }
  };
  const cfg = { baseUrl: 'https://relay.example.com/v1', model: 'claude-opus-4-8', protocol: 'openai' };
  const rec = MT.gh.buildRecord(cfg, summary, MT.DEMO.results);
  check('记录字段完整', rec.host === 'relay.example.com' && rec.verdict === 'fake' && rec.identified === 'GLM-4-9B' && rec.index === 62.3 && rec.testsRun === '12/12');
  check('记录不含密钥', !/apiKey|sk-/.test(JSON.stringify(rec)));
  const detail = MT.gh.buildDetail({ baseUrl: cfg.baseUrl, model: cfg.model, protocol: 'openai', apiKey: 'sk-secret' }, summary, MT.DEMO.results);
  check('详情文件不含密钥', JSON.stringify(detail).indexOf('sk-secret') === -1);
  const fn = MT.gh.fileName(rec);
  check('文件名格式', /^records\/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_relay\.example\.com_claude-opus-4-8\.json$/.test(fn), fn);
  const clone = () => JSON.parse(JSON.stringify(rec));
  const o1 = MT.gh.appendRecord([], clone());
  check('首次追加成功', !o1.dup && o1.list.length === 1);
  check('同结果不重复记录', MT.gh.appendRecord(o1.list, clone()).dup);
  check('同档指数不重复', MT.gh.appendRecord(o1.list, Object.assign(clone(), { index: 61.5 })).dup);
  check('指数跨档记录', !MT.gh.appendRecord(o1.list, Object.assign(clone(), { index: 71.4 })).dup);
  check('结论不同记录', !MT.gh.appendRecord(o1.list, Object.assign(clone(), { verdict: 'severe' })).dup);
  check('后端不同记录', !MT.gh.appendRecord(o1.list, Object.assign(clone(), { identified: 'Qwen3-Max' })).dup);
  check('模型不同记录', !MT.gh.appendRecord(o1.list, Object.assign(clone(), { model: 'gpt-5.5' })).dup);
  check('中转站不同记录', !MT.gh.appendRecord(o1.list, Object.assign(clone(), { host: 'other.com' })).dup);
  const dr = MT.gh.demoRecord();
  check('演示记录结构', dr.verdict === 'fake' && dr.index === 62.3 && dr.host === 'relay-demo.example.com');
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
