/* ============================================================
 * 照妖镜 · API 中转站掺水检测站 — 数据层
 * 数据来源：
 *  - CISPA《Real Money, Fake Models》(arXiv 2603.01919, 2026-03)
 *  - Bruckner《One Token Is Enough》(arXiv 2606.04101, 2026-07)
 *  - tokwhois v1.1 tokenizer 目录 (2026-08-27, Apache-2.0)
 *  - TSecurity 五信号检测法 / XTokenChecker / Relaylens
 *  - LiveBench / SWE-bench / SuperCLUE / OpenCompass 公开榜单 (2026-10)
 * 注意：部分历史/小模型分数为社区估算值，已标注 est。
 * ============================================================ */
window.MT = window.MT || {};

/* ---------- 1. 官方模型基线库 ---------- */
/* tier: flagship(旗舰) / pro(高端) / mini(轻量) / legacy(过时) */
MT.MODELS = [
  { id:'gpt-5.5',        name:'GPT-5.5',            vendor:'OpenAI',    livebench:81.3, swe:88.7, ctx:'1.1M', cutoff:'2026-02', tok:'o200k_base', tier:'flagship', priceIn:1.25, priceOut:30.0, latency:'medium', note:'LiveBench 榜首，SWE-bench Verified 88.7%' },
  { id:'gpt-5.4',        name:'GPT-5.4',            vendor:'OpenAI',    livebench:80.9, swe:59.1, ctx:'1.1M', cutoff:'2026-01', tok:'o200k_base', tier:'flagship', priceIn:1.25, priceOut:15.0, latency:'medium', note:'SWE-bench Pro 59.1%' },
  { id:'gpt-5.2',        name:'GPT-5.2',            vendor:'OpenAI',    livebench:75.4, swe:80.0, ctx:'400K', cutoff:'2025-10', tok:'o200k_base', tier:'pro',      priceIn:1.25, priceOut:14.0, latency:'medium', note:'' },
  { id:'gpt-5.1',        name:'GPT-5.1',            vendor:'OpenAI',    livebench:72.6, swe:null, ctx:'400K', cutoff:'2025-08', tok:'o200k_base', tier:'pro',      priceIn:1.25, priceOut:10.0, latency:'medium', note:'' },
  { id:'gpt-4o',         name:'GPT-4o',             vendor:'OpenAI',    livebench:57.0, swe:33.0, ctx:'128K', cutoff:'2023-10', tok:'o200k_base', tier:'legacy',   priceIn:2.5,  priceOut:10.0, latency:'fast',    note:'历史值；2024-10 曾为业界标杆', est:true },
  { id:'gpt-3.5-turbo',  name:'GPT-3.5 Turbo',      vendor:'OpenAI',    livebench:38.0, swe:null, ctx:'16K',  cutoff:'2021-09', tok:'cl100k_base', tier:'legacy',  priceIn:0.5,  priceOut:1.5,  latency:'fast',    note:'历史估算值', est:true },
  { id:'claude-opus-4.8',name:'Claude Opus 4.8',    vendor:'Anthropic', livebench:79.5, swe:null, ctx:'1M',   cutoff:'2026-03', tok:'proprietary', tier:'flagship', priceIn:15.0, priceOut:25.0, latency:'medium', note:'Thinking 版本；CISPA 审计中最常被仿冒的对象' },
  { id:'claude-opus-4.7',name:'Claude Opus 4.7',    vendor:'Anthropic', livebench:77.1, swe:87.6, ctx:'1M',   cutoff:'2026-01', tok:'proprietary', tier:'flagship', priceIn:15.0, priceOut:25.0, latency:'medium', note:'SWE-bench Pro 64.3%' },
  { id:'claude-opus-4.5',name:'Claude Opus 4.5',    vendor:'Anthropic', livebench:76.0, swe:80.9, ctx:'200K', cutoff:'2025-07', tok:'proprietary', tier:'flagship', priceIn:5.0,  priceOut:25.0, latency:'medium', note:'' },
  { id:'claude-sonnet-4.6',name:'Claude Sonnet 4.6',vendor:'Anthropic', livebench:75.7, swe:79.6, ctx:'1M',   cutoff:'2025-11', tok:'proprietary', tier:'pro',      priceIn:3.0,  priceOut:15.0, latency:'medium', note:'常被用来冒充 Opus（静默降级模式）' },
  { id:'claude-fable-5', name:'Claude Fable 5',     vendor:'Anthropic', livebench:78.6, swe:null, ctx:'1M',   cutoff:'2026-04', tok:'proprietary', tier:'flagship', priceIn:5.0,  priceOut:50.0, latency:'medium', note:'' },
  { id:'gemini-3.1-pro', name:'Gemini 3.1 Pro',     vendor:'Google',    livebench:80.7, swe:80.6, ctx:'1M',   cutoff:'2026-01', tok:'proprietary', tier:'flagship', priceIn:2.5,  priceOut:12.0, latency:'medium', note:'' },
  { id:'gemini-3.5-flash',name:'Gemini 3.5 Flash',  vendor:'Google',    livebench:75.8, swe:78.0, ctx:'1M',   cutoff:'2026-03', tok:'proprietary', tier:'pro',      priceIn:0.3,  priceOut:9.0,  latency:'fast',    note:'' },
  { id:'qwen3.8-max',    name:'Qwen3.8-Max',        vendor:'阿里',       livebench:73.0, swe:null, ctx:'1M',   cutoff:'2026-05', tok:'qwen-class',  tier:'flagship', priceIn:1.6,  priceOut:6.4,  latency:'fast',    note:'SuperCLUE 72.62（2026-09）' },
  { id:'qwen3.7-max',    name:'Qwen3.7-Max',        vendor:'阿里',       livebench:75.2, swe:null, ctx:'1M',   cutoff:'2026-04', tok:'qwen-class',  tier:'flagship', priceIn:1.6,  priceOut:6.4,  latency:'fast',    note:'' },
  { id:'deepseek-v4-pro',name:'DeepSeek-V4-Pro',    vendor:'深度求索',   livebench:74.4, swe:80.6, ctx:'1M',   cutoff:'2026-02', tok:'deepseek-class', tier:'flagship', priceIn:0.27, priceOut:1.1, latency:'medium', note:'高性价比；中转站常见"平替"目标' },
  { id:'deepseek-v4.1-flash',name:'DeepSeek-V4.1-Flash',vendor:'深度求索',livebench:71.0, swe:79.0, ctx:'1M',  cutoff:'2026-06', tok:'deepseek-class', tier:'pro',   priceIn:0.07, priceOut:0.28, latency:'fast',  note:'SuperCLUE 71.81（2026-09）' },
  { id:'glm-5.3',        name:'GLM-5.3',            vendor:'智谱',       livebench:73.0, swe:null, ctx:'1M',   cutoff:'2026-06', tok:'glm-class',   tier:'flagship', priceIn:0.6,  priceOut:2.2,  latency:'fast',    note:'SuperCLUE 71.29（2026-09）' },
  { id:'glm-5.2',        name:'GLM-5.2',            vendor:'智谱',       livebench:73.2, swe:null, ctx:'1M',   cutoff:'2026-03', tok:'glm-class',   tier:'flagship', priceIn:0.6,  priceOut:2.42, latency:'fast',    note:'' },
  { id:'glm-4-9b',       name:'GLM-4-9B',           vendor:'智谱',       livebench:40.0, swe:null, ctx:'128K', cutoff:'2024-05', tok:'glm-class',   tier:'mini',     priceIn:0.05, priceOut:0.15, latency:'fast',    note:'CISPA 案例：冒充 GPT-5 的热门后端', est:true },
  { id:'kimi-k2.6',      name:'Kimi K2.6',          vendor:'月之暗面',   livebench:72.4, swe:80.2, ctx:'262K', cutoff:'2026-02', tok:'deepseek-class', tier:'flagship', priceIn:0.6, priceOut:2.5, latency:'medium', note:'' },
  { id:'kimi-k3',        name:'Kimi K3',            vendor:'月之暗面',   livebench:70.7, swe:null, ctx:'256K', cutoff:'2026-07', tok:'deepseek-class', tier:'flagship', priceIn:0.6, priceOut:2.5, latency:'medium', note:'SuperCLUE 70.68（2026-08）' },
  { id:'grok-4.20',      name:'Grok 4.20',          vendor:'xAI',        livebench:69.0, swe:null, ctx:'1M',   cutoff:'2025-11', tok:'proprietary', tier:'pro',      priceIn:3.0,  priceOut:15.0, latency:'medium', note:'' },
  { id:'minimax-m3',     name:'MiniMax M3',         vendor:'MiniMax',   livebench:70.0, swe:null, ctx:'512K', cutoff:'2026-03', tok:'proprietary', tier:'pro',      priceIn:0.3,  priceOut:1.2,  latency:'medium', note:'' },
  { id:'doubao-seed-2.0-pro',name:'豆包 Seed 2.0 Pro',vendor:'字节',     livebench:63.5, swe:null, ctx:'256K', cutoff:'2026-01', tok:'proprietary', tier:'pro',      priceIn:0.3,  priceOut:0.9,  latency:'fast',    note:'OpenCompass 63.5' },
  { id:'qwen2.5-72b',    name:'Qwen2.5-72B',        vendor:'阿里',       livebench:48.0, swe:null, ctx:'128K', cutoff:'2024-06', tok:'qwen-class',  tier:'mini',     priceIn:0.35, priceOut:0.4,  latency:'fast',    note:'开源模型，常见冒充后端', est:true },
  { id:'llama-3.3-70b',  name:'Llama 3.3 70B',      vendor:'Meta',       livebench:52.0, swe:null, ctx:'128K', cutoff:'2023-12', tok:'llama-class', tier:'mini',     priceIn:0.23, priceOut:0.4,  latency:'fast',    note:'随机数指纹偏爱 53', est:true }
];
MT.modelById = function (id) {
  id = String(id || '').toLowerCase();
  let hit = MT.MODELS.find(function (m) { return m.id === id; });
  if (hit) return hit;
  hit = MT.MODELS.find(function (m) { return id.indexOf(m.id) !== -1 || m.id.indexOf(id) !== -1; });
  return hit || null;
};
/* 根据用户声明的模型名猜测其声称身份（用于能力对比） */
MT.guessClaim = function (name) {
  var n = String(name || '').toLowerCase();
  var pairs = [
    ['opus-4-8|opus-4.8', 'claude-opus-4.8'], ['opus-4-7|opus-4.7', 'claude-opus-4.7'],
    ['opus-4-5|opus-4.5', 'claude-opus-4.5'], ['opus', 'claude-opus-4.5'],
    ['sonnet-4-6|sonnet-4.6', 'claude-sonnet-4.6'], ['sonnet', 'claude-sonnet-4.6'],
    ['fable', 'claude-fable-5'],
    ['gpt-5.5|gpt5.5', 'gpt-5.5'], ['gpt-5.4|gpt5.4', 'gpt-5.4'], ['gpt-5.2|gpt5.2', 'gpt-5.2'],
    ['gpt-5.1|gpt5.1', 'gpt-5.1'], ['gpt-5|gpt5', 'gpt-5.5'], ['gpt-4o', 'gpt-4o'],
    ['gpt-3.5', 'gpt-3.5-turbo'], ['chatgpt', 'gpt-5.2'],
    ['gemini-3.1|gemini3.1', 'gemini-3.1-pro'], ['gemini-3.5|gemini3.5', 'gemini-3.5-flash'], ['gemini', 'gemini-3.1-pro'],
    ['qwen3.8|qwen-3.8', 'qwen3.8-max'], ['qwen3.7|qwen-3.7', 'qwen3.7-max'], ['qwen-max', 'qwen3.8-max'],
    ['qwen2.5', 'qwen2.5-72b'], ['qwen', 'qwen3.8-max'],
    ['deepseek-v4.1|deepseek-v4-1', 'deepseek-v4.1-flash'], ['deepseek-v4|deepseek-v4-pro', 'deepseek-v4-pro'], ['deepseek', 'deepseek-v4-pro'],
    ['glm-5.3|glm5.3', 'glm-5.3'], ['glm-5.2|glm5.2', 'glm-5.2'], ['glm-4-9b', 'glm-4-9b'], ['glm', 'glm-5.3'],
    ['kimi-k3|kimi-k-3', 'kimi-k3'], ['kimi-k2.6|kimi-k2-6', 'kimi-k2.6'], ['kimi', 'kimi-k2.6'],
    ['grok', 'grok-4.20'], ['minimax', 'minimax-m3'], ['doubao|seed-2', 'doubao-seed-2.0-pro'],
    ['llama-3.3|llama3.3', 'llama-3.3-70b'], ['llama', 'llama-3.3-70b']
  ];
  for (var i = 0; i < pairs.length; i++) {
    var re = new RegExp(pairs[i][0], 'i');
    if (re.test(n)) return MT.modelById(pairs[i][1]);
  }
  return null;
};

/* ---------- 2. Tokenizer 指纹目录（tokwhois v1.1, 2026-08-27） ----------
 * 14 个探针的参考 token 数。探针字符串为本站等效重建，
 * 与 tokwhois 原始探针可能存在 1-3 token 的偏移，
 * 因此判别以 L1 距离最小家族为准，差值 < margin 时判 ambiguous。
 * 更可靠的方式是配置"参考端点"做差分比对。 */
MT.TOKENIZER_PROBES = [
  { id:'cjk30',      label:'30 个中文字符',   str:'春秋战国秦汉唐宋元明清东西南北中内外上下左右大小多少高低长短快慢' },
  { id:'space40',    label:'40 连续空格',     str:' '.repeat(40) },
  { id:'digit64',    label:'64 位数字串',     str:'1234567890'.repeat(6) + '1234' },
  { id:'ascii100',   label:'100 个 ASCII 字符',str:'The quick brown fox jumps over the lazy dog and then runs away quickly into the dark forest nearby' },
  { id:'emoji8',     label:'8 个 Emoji',      str:'😀😃😄😁😆😅😂🤣' },
  { id:'hello_leadsp',label:'前导空格 hello', str:' hello' },
  { id:'nl16',       label:'16 个换行',       str:'\n'.repeat(16) },
  { id:'tab16',      label:'16 个制表符',     str:'\t'.repeat(16) },
  { id:'cjk_en',     label:'中英混合',        str:'你好world你好world你好' },
  { id:'im_start',   label:'特殊标记 im_start',str:'' },
  { id:'gmask',      label:'特殊标记 gmask',  str:'<gmask>' },
  { id:'eot',        label:'特殊标记 endoftext',str:'<|endoftext|>' },
  { id:'bot_llama',  label:'Llama 起始标记',  str:'<|begin_of_text|>' },
  { id:'byte_rare',  label:'生僻 CJK 字符',   str:'㐀㐁䶮䶷𠀀𠀁' }
];
MT.TOKENIZER_CATALOG = {
  'glm4-class':   { cjk30:22, space40:1, digit64:43, ascii100:26, emoji8:21, hello_leadsp:1, nl16:1, tab16:1, cjk_en:8,  im_start:6, gmask:1, eot:1, bot_llama:7, byte_rare:22 },
  'glm5-class':   { cjk30:22, space40:1, digit64:43, ascii100:26, emoji8:13, hello_leadsp:1, nl16:1, tab16:1, cjk_en:8,  im_start:6, gmask:1, eot:1, bot_llama:7, byte_rare:22 },
  'qwen3_8-class':{ cjk30:22, space40:1, digit64:64, ascii100:26, emoji8:19, hello_leadsp:1, nl16:1, tab16:1, cjk_en:8,  im_start:1, gmask:3, eot:1, bot_llama:7, byte_rare:23 },
  'cl100k_base':  { cjk30:30, space40:1, digit64:22, ascii100:26, emoji8:21, hello_leadsp:1, nl16:1, tab16:1, cjk_en:12, im_start:6, gmask:3, eot:1, bot_llama:7, byte_rare:22 },
  'o200k_base':   { cjk30:23, space40:1, digit64:22, ascii100:27, emoji8:29, hello_leadsp:1, nl16:1, tab16:1, cjk_en:8,  im_start:1, gmask:3, eot:1, bot_llama:7, byte_rare:24 },
  'internlm2':    { cjk30:30, space40:1, digit64:32, ascii100:26, emoji8:21, hello_leadsp:1, nl16:1, tab16:1, cjk_en:12, im_start:6, gmask:3, eot:7, bot_llama:7, byte_rare:22 }
};
/* tokenizer 家族 -> 可能模型 */
MT.TOK_MODEL_HINTS = {
  'glm4-class':   ['GLM-4 系列 / ChatGLM'],
  'glm5-class':   ['GLM-5 系列'],
  'qwen3_8-class':['Qwen3 / Qwen3.8 系列'],
  'cl100k_base':  ['GPT-3.5 / GPT-4 / GPT-4o 时代 OpenAI 模型'],
  'o200k_base':   ['GPT-4.1 / GPT-5 系列 OpenAI 模型'],
  'internlm2':    ['InternLM2 / 书生系列'],
  'llama-class':  ['Llama 2/3 系列'],
  'deepseek-class':['DeepSeek V2/V3/V4 系列'],
  'proprietary':  ['Claude / Gemini 等无公开词表模型（需差分比对）']
};

/* ---------- 3. 行为指纹：随机数偏好（Bruckner 论文数据） ---------- */
MT.RANDOM_REF = [
  { id:'gpt-4o',        label:'GPT-4o',        sig:{ '42':0.30, '37':0.18, '57':0.14 }, note:'偏爱 42 / 37 / 57' },
  { id:'gpt-5-class',   label:'GPT-5 系列',    sig:{ '42':0.22, '37':0.15, '57':0.12 }, note:'延续 42 偏好，分布更散（论文外推）', ext:true },
  { id:'claude-sonnet', label:'Claude Sonnet', sig:{ '47':0.55 }, note:'疯狂输出 47' },
  { id:'claude-opus',   label:'Claude Opus',   sig:{ '47':0.45 }, note:'偏爱 47，略有波动（论文外推）', ext:true },
  { id:'llama-3.3',     label:'Llama 3.3',     sig:{ '53':0.45 }, note:'多数回答 53' },
  { id:'qwen3-max',     label:'Qwen3-Max',     sig:{ '42':1.00 }, note:'30 次全部 42，一次未变' },
  { id:'qwen-class',    label:'Qwen 系列',     sig:{ '42':0.40, '7':0.12 }, note:'偏爱 42 与个位数（论文外推）', ext:true },
  { id:'deepseek',      label:'DeepSeek',      sig:{ '42':0.25, '7':0.15 }, note:'未见显著聚集（论文外推）', ext:true },
  { id:'glm',           label:'GLM',           sig:{ '42':0.20, '8':0.12 }, note:'未见显著聚集（论文外推）', ext:true }
];
MT.RANDOM_EXTRA_PROBES = [
  { id:'color',   label:'随机颜色', prompt:'请随便说一种颜色，只输出颜色名称。', refs:{ 'red':'OpenAI 系偏爱', 'blue':'Claude 系偏爱', 'green':'Qwen 系偏爱' } },
  { id:'coin',    label:'抛硬币',   prompt:'抛一枚硬币，只输出"正面"或"反面"。', refs:{ '正面':'多模型略偏正面', '反面':'GPT 系略偏' } },
  { id:'animal',  label:'随机动物', prompt:'请随便说一种动物，只输出动物名称。', refs:{ 'dog':'GPT 系偏爱', 'cat':'Claude 系偏爱', 'elephant':'Qwen 系偏爱' } }
];

/* ---------- 4. 文风指纹参考 ---------- */
MT.STYLE_REF = [
  { id:'openai',    label:'OpenAI 系',     markers:['as an ai', 'i cannot', 'certainly!', 'sure!', '作为人工智能', '作为AI'], style:'重度 Markdown、条目化、喜欢加粗小标题、常用 "Certainly!" 开头' },
  { id:'anthropic', label:'Anthropic 系',  markers:["i don't actually", 'i should note', 'it\'s worth', '值得注意'], style:'自然行文为主、少用条目、几乎不出现 "作为AI"、中英混排自然' },
  { id:'qwen',      label:'Qwen 系',       markers:['首先', '其次', '最后', '总结', '希望对您有帮助', '综上所述'], style:'中文流畅自然、爱用"首先/其次/最后"、偶尔结尾送祝福语' },
  { id:'deepseek',  label:'DeepSeek 系',   markers:['首先', '综上', '需要注意的是', '让我们'], style:'长思维链风格、爱分点、解释详尽、代码注释多' },
  { id:'glm',       label:'GLM 系',        markers:['首先', '其次', '总结一下', '希望对你有帮助'], style:'结构清晰、礼貌用语多、偶尔夹带英文术语' },
  { id:'gemini',    label:'Gemini 系',     markers:['i am a text-based', 'i cannot', 'here is', 'it\'s important to note'], style:'表格偏好、清单体、安全声明显式' }
];

/* ---------- 5. 知识截止探测题库 ---------- */
MT.FACTS = [
  { q:'OpenAI 在 2026 年 4 月发布、登顶 LiveBench 榜首的模型是什么？', a:['GPT-5.5'], date:'2026-04', type:'recent', hint:'如果不认识它，知识截止早于 2026-04' },
  { q:'Anthropic 在 2026 年 5 月发布的 Opus 系列旗舰模型叫什么？', a:['Opus 4.8', 'Opus4.8'], date:'2026-05', type:'recent', hint:'Claude Opus 4.8' },
  { q:'Google 在 2026 年 2 月发布的旗舰模型是什么？', a:['Gemini 3.1', 'Gemini3.1'], date:'2026-02', type:'recent', hint:'Gemini 3.1 Pro' },
  { q:'DeepSeek 在 2026 年 4 月发布的旗舰模型是什么？', a:['V4', 'DeepSeek-V4'], date:'2026-04', type:'recent', hint:'DeepSeek V4 Pro' },
  { q:'月之暗面在 2026 年 4 月发布的模型是什么？', a:['K2.6', 'Kimi K2.6'], date:'2026-04', type:'recent', hint:'Kimi K2.6' },
  { q:'智谱 AI 在 2026 年 4 月发布的模型是什么？', a:['GLM-5.1', 'GLM5.1'], date:'2026-04', type:'recent', hint:'GLM-5.1' },
  { q:'中国明朝的开国皇帝是谁？', a:['朱元璋'], date:'-', type:'timeless', hint:'基础知识' },
  { q:'《三体》的作者是谁？', a:['刘慈欣'], date:'-', type:'timeless', hint:'基础知识' },
  { q:'比特币的总量上限是多少枚？', a:['2100'], date:'-', type:'timeless', hint:'2100 万枚' },
  { q:'欧盟目前有多少个成员国？', a:['27'], date:'-', type:'timeless', hint:'27 个' },
  { q:'水的化学式是什么？', a:['H2O', 'H₂O'], date:'-', type:'timeless', hint:'H₂O' },
  { q:'1 字节等于多少位（bit）？', a:['8'], date:'-', type:'timeless', hint:'8 位' }
];

/* ---------- 6. 能力底线题库（客观判分） ---------- */
MT.FLOOR = [
  { id:'arith1', q:'一个书架有 5 层，每层放 12 本书，拿走 18 本后还剩多少本？请只回答数字。', check:function (t) { return /42/.test(t); }, ans:'42' },
  { id:'rev1',   q:'请只输出 strawberry 这个词倒序拼写的结果，不要输出任何其他内容。', check:function (t) { return /yrrebwarts/i.test(t); }, ans:'yrrebwarts' },
  { id:'count1', q:'单词 uncommonly 中字母 n 出现了几次？请只回答数字。', check:function (t) { return /(^|[^0-9])2([^0-9]|$)/.test(t); }, ans:'2' },
  { id:'json1',  q:'请只输出一个 JSON 对象（不要 markdown 代码块、不要任何解释），包含两个键：name 值为"测试"，value 值为数字 42。', check:function (t) { var m = t.match(/\{[\s\S]*\}/); if (!m) return false; try { var o = JSON.parse(m[0]); return o && o.name === '测试' && o.value === 42; } catch (e) { return false; } }, ans:'{"name":"测试","value":42}' },
  { id:'multi1', q:'小明有 3 盒铅笔，每盒 8 支。他给了小红 5 支，又买了 2 盒（每盒 8 支）。现在有多少支？请只回答数字。', check:function (t) { return /(^|[^0-9])35([^0-9]|$)/.test(t); }, ans:'35' },
  { id:'cmp1',   q:'比较 3 的 5 次方和 5 的 3 次方，请只回答"3^5更大"或"5^3更大"。', check:function (t) { return /3\s*\^?\s*5\s*更?大|3的5次方更?大/i.test(t); }, ans:'3^5 更大（243>125）' },
  { id:'unit1',  q:'2.5 公里等于多少米？请只回答数字。', check:function (t) { return /2500/.test(t); }, ans:'2500' },
  { id:'upper1', q:'请把 Hello World 变成全大写，只输出结果。', check:function (t) { return /HELLO WORLD/i.test(t); }, ans:'HELLO WORLD' }
];

/* ---------- 7. 推理深度题库（旗舰应接近全对） ---------- */
MT.REASON = [
  { id:'dry1',   q:'如果 3 件衬衫需要 3 小时晾干，那么 9 件衬衫同时晾干需要多少小时？请只回答数字。', check:function (t) { return /(^|[^0-9])3\s*(小时|个小时|h)?([^0-9]|$)/i.test(t) && !/9/.test(t.slice(0, 12)); }, ans:'3（陷阱题，同时晾）' },
  { id:'eq1',    q:'已知 x + 2y = 10，2x − y = 5，求 x + y 的值。请只回答数字。', check:function (t) { return /(^|[^0-9])7([^0-9]|$)/.test(t); }, ans:'7' },
  { id:'date1',  q:'2026 年 10 月 18 日是星期日，那么 2026 年 12 月 25 日是星期几？', check:function (t) { return /星期[五5]|周五/i.test(t); }, ans:'星期五' },
  { id:'depth1', q:'字符串 "((()())())" 中括号的最大嵌套深度是多少？请只回答数字。', check:function (t) { return /(^|[^0-9])3([^0-9]|$)/.test(t); }, ans:'3' },
  { id:'prime1', q:'数列 2, 3, 5, 7, 11, 13, ? 的下一项是什么？请只回答数字。', check:function (t) { return /(^|[^0-9])17([^0-9]|$)/.test(t); }, ans:'17' },
  { id:'logic1', q:'所有的 A 都是 B，有些 B 是 C。能否确定地推出"有些 A 是 C"？请只回答：能 / 不能 / 无法确定。', check:function (t) { return /无法确定/.test(t); }, ans:'无法确定' },
  { id:'prob1',  q:'抛 3 枚均匀硬币，恰好出现 2 枚正面的概率是多少？请用最简分数回答。', check:function (t) { return /3\s*\/\s*8/.test(t); }, ans:'3/8' },
  { id:'age1',   q:'今年（2026 年）小明 12 岁，他出生在星期日的概率忽略不计。5 年前他的年龄是他父亲当时年龄的 1/4，他父亲今年多少岁？请只回答数字。', check:function (t) { return /(^|[^0-9])38([^0-9]|$)/.test(t); }, ans:'38（5年前小明7岁，父28岁，今年33+5=38）' }
];

/* ---------- 8. 代码能力题库（JS 可在沙箱判分） ---------- */
MT.CODE = [
  {
    id:'prime', title:'isPrime 素数判断',
    q:'请写一个 JavaScript 函数 isPrime(n)，判断正整数 n 是否为素数。只输出代码（放在 ```js 代码块中或直接给出函数）。',
    extract:/function\s+isPrime[\s\S]*?\n\}/,
    tests:[[2,true],[17,true],[1,false],[91,false],[97,true],[100,false]],
    wrap:function (body) { return body + '\nreturn isPrime;'; }
  },
  {
    id:'flatten', title:'deepFlatten 深度扁平化',
    q:'请写一个 JavaScript 函数 deepFlatten(arr)，将多层嵌套数组拍平为一维数组，例如 deepFlatten([1,[2,[3,[4]],5]]) 返回 [1,2,3,4,5]。只输出代码。',
    extract:/function\s+deepFlatten[\s\S]*?\n\}/,
    tests:[[[[1,[2,[3,[4]],5]]],[1,2,3,4,5]],[[[],[]],[]],[[[1],[[2]]],[1,2]]],
    wrap:function (body) { return body + '\nreturn deepFlatten;'; }
  },
  {
    id:'roman', title:'intToRoman 整数转罗马数字',
    q:'请写一个 JavaScript 函数 intToRoman(num)，把 1-3999 的整数转为罗马数字，例如 1994 -> "MCMXCIV"。只输出代码。',
    extract:/function\s+intToRoman[\s\S]*?\n\}/,
    tests:[[1994,'MCMXCIV'],[58,'LVIII'],[9,'IX'],[4,'IV'],[2026,'MMXXVI']],
    wrap:function (body) { return body + '\nreturn intToRoman;'; }
  },
  {
    id:'pyout', title:'Python 输出预测',
    q:'下面这段 Python 代码的输出是什么？请只回答输出内容。\n```python\ns = "hello世界"\nprint(len(s), s[5:7])\n```',
    check:function (t) { return /7/.test(t) && /世界/.test(t); }, ans:'7 世界'
  }
];

/* ---------- 9. 长上下文 Needle 配置 ---------- */
MT.NEEDLE = {
  passphrase: '紫鲸-7Q2M-4419',
  question: '前面材料的口令栏中写的口令是什么？请只输出口令本身。',
  /* 生成确定性填充文本（每段约 45 token） */
  filler: function (n) {
    var out = [];
    var nouns = ['数据库','服务器','编译器','算法','协议','缓存','队列','索引','集群','镜像','网关','容器'];
    var verbs = ['优化','重构','部署','监控','调度','同步','迁移','压缩','加密','校验'];
    for (var i = 0; i < n; i++) {
      var a = nouns[i % nouns.length], b = nouns[(i * 3 + 5) % nouns.length];
      var v = verbs[(i * 7 + 3) % verbs.length];
      out.push('第' + (i + 1) + '节：在分布式系统的' + a + '设计中，团队需要' + v + '核心' + b + '模块，以保证高可用与一致性。');
    }
    return out;
  }
};

/* ---------- 10. 方法论与参考文献 ---------- */
MT.METHODS = [
  { name:'LLMmap 模型指纹', source:'CISPA《Real Money, Fake Models》arXiv:2603.01919', desc:'对 17 家中转站审计，45.83% 未通过指纹校验；归纳出静默降级、跨厂商偷换、按上下文长度分流三大掺水模式。', weight:'高' },
  { name:'行为指纹（随机数）', source:'Bruckner《One Token Is Enough》arXiv:2606.04101', desc:'对 165 个模型、32.6 万次请求的统计：各模型在"1-100 随机数"上有稳定偏好（GPT-4o→42、Claude→47、Qwen3-Max→恒 42），JS 散度比对，40 单元准确率 92.7%。', weight:'高' },
  { name:'Tokenizer 词表指纹', source:'tokwhois v1.1（Apache-2.0）', desc:'tokenizer 训练时冻结且难以伪造，通过 14 个探针字符串的 usage.prompt_tokens 差值向量，与 18 个公开词表家族做 L1 距离判别，可识别后端模型家族。', weight:'高' },
  { name:'五信号综合检测', source:'TSecurity Verification Playbook / XTokenChecker / Relaylens', desc:'Tokenizer 指纹 + 能力底线 + 长上下文大海捞针 + 稳定性与延迟 + 自我认知（低权重），多信号交叉验证，避免单一探针被针对性绕过。', weight:'高' },
  { name:'公开基准加权评分（MCS）', source:'llm-api-benchmark-skill（726 题，10 个 GitHub 题库）', desc:'用开源题库对端点打分，与官方基线对比。实测：某 2.0 倍率"Claude Opus 4.8"中转站得分 51.55，低于 DeepSeek-V4-Pro 的 66.76。', weight:'中' }
];

MT.VERDICT_BANDS = [
  { min:0,   max:15,  level:'ok',      label:'未发现掺水',   desc:'所有检测信号正常或轻微不确定。不能 100% 排除按流量分流的隐藏路由，建议每周复测。' },
  { min:16,  max:35,  level:'warn',    label:'轻微异常',     desc:'存在个别可疑信号（如元数据不稳、能力底线偶发失败）。可能是线路波动，也可能是掺水的前兆。' },
  { min:36,  max:60,  level:'suspect', label:'疑似掺水',     desc:'多个独立信号同时异常。按 CISPA 的统计，此区间端点存在偷换或降级路由的概率很高。' },
  { min:61,  max:85,  level:'bad',     label:'严重掺水',     desc:'能力、指纹、上下文等多个维度与官方基线差距显著，基本可判定被替换为廉价后端或量化版本。' },
  { min:86,  max:100, level:'fake',    label:'高度疑似假冒', desc:'指纹直指完全不同的模型家族（如声称 GPT-5 实为 GLM/Qwen 后端），与 CISPA 审计中的跨厂商偷换模式一致。' }
];
