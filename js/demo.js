/* ============================================================
 * 照妖镜 — 演示数据
 * 模拟场景：某 2.0 倍率「Claude Opus 4.8」中转站（参照公开实测案例构造）
 * ============================================================ */
window.MT = window.MT || {};
MT.DEMO = {
  cfg: { baseUrl: 'https://relay-demo.example.com/v1', model: 'claude-opus-4-8', protocol: 'openai' },
  results: {
    t1: {
      status: 'warn', score: 0.35,
      detail: 'model=claude-opus-4-8 · fingerprint=无 · id=resp_9f2ka7d · 输出一致=否',
      evidence: [
        { t: 'info', text: '/models 返回 46 个模型，包含声称的 claude-opus-4-8' },
        { t: 'good', text: 'model 字段回声称值「claude-opus-4-8」' },
        { t: 'info', text: '未返回 system_fingerprint 字段（官方 OpenAI 端点通常会返回；Anthropic 官方亦不返回）' },
        { t: 'info', text: '响应 ID 格式：非标准格式（resp_ 前缀，中转站自定义）' },
        { t: 'info', text: 'temperature=0 下两次输出不一致（采样实现或路由不稳定）' }
      ],
      votes: {}, metrics: { modelField: 'claude-opus-4-8', idFormat: '非标准格式（中转站自定义）' }
    },
    t2: {
      status: 'fail', score: 0.95,
      detail: '判别家族：glm4-class · 向量：cjk30=22 space40=1 digit64=43 ascii100=26 emoji8=21 hello_leadsp=1 nl16=1 tab16=1 cjk_en=8 im_start=6 gmask=1 eot=1 bot_llama=7 byte_rare=22',
      evidence: [
        { t: 'info', text: '词表家族判别：glm4-class（L1=0，领先第二名 glm5-class 8 token）→ GLM-4 系列 / ChatGLM' },
        { t: 'bad', text: '声称家族词表应为 proprietary（Claude 无公开词表），实测为 glm4-class —— 高置信度跨家族偷换信号：后端词表与 GLM-4 系列完全一致' },
        { t: 'info', text: '数字串探针：64 位数字计 43 token（cl100k 仅 22、Qwen3 为 64），glm4 系列特征值' }
      ],
      votes: { 'glm-4-9b': 26 },
      metrics: {
        family: 'glm4-class', offset: 7,
        probes: { cjk30: 22, space40: 1, digit64: 43, ascii100: 26, emoji8: 21, hello_leadsp: 1, nl16: 1, tab16: 1, cjk_en: 8, im_start: 6, gmask: 1, eot: 1, bot_llama: 7, byte_rare: 22 },
        dists: [{ fam: 'glm4-class', d: 0 }, { fam: 'glm5-class', d: 8 }, { fam: 'cl100k_base', d: 23 }, { fam: 'internlm2', d: 27 }, { fam: 'qwen3_8-class', d: 29 }, { fam: 'o200k_base', d: 35 }]
      }
    },
    t3: {
      status: 'warn', score: 0.14,
      detail: '通过 7/8；未过：count1（期望 2，得到「3 次」）',
      evidence: [
        { t: 'info', text: '通过 7/8 道底线题' },
        { t: 'bad', text: '未过：count1（期望 2，得到「uncommonly 中字母 n 出现 3 次」）' },
        { t: 'good', text: '多步算术、字符串反转、严格 JSON 等其余 7 项通过' }
      ],
      votes: { 'claude-sonnet-4.6': 6, 'gpt-5.2': 6 },
      metrics: { pass: 7, total: 8, rate: 0.875 }
    },
    t4: {
      status: 'fail', score: 0.75,
      detail: '样本 20/20 · 高频 42×12、7×3 · 熵 1.42bit · 最接近 glm（JSD 0.09）',
      evidence: [
        { t: 'info', text: '20 次随机数高频答案：42×12、7×3、88×2 · 分布熵 1.42 bit（真随机理论值 6.64）' },
        { t: 'bad', text: '随机偏好更像 GLM，与声称的 Claude Opus 4.8 家族不符（Claude 论文特征为恒偏 47）' },
        { t: 'info', text: '随机颜色 3 次：红/蓝/红 · 抛硬币 3 次：正/正/反 · 随机动物 3 次：猫/猫/狗' },
        { t: 'info', text: 'temperature=0 时固定输出「42」（Qwen3-Max 的论文特征为恒 42；GLM 小模型亦高频 42）' }
      ],
      votes: { 'glm-4-9b': 14 },
      metrics: { samples: 20, counts: { '42': 12, '7': 3, '88': 2, '13': 1, '91': 1, '37': 1 }, entropy: 1.42, top: ['42×12', '7×3', '88×2'], bestRef: 'glm', bestJsd: 0.09, det0: '42' }
    },
    t5: {
      status: 'fail', score: 0.75,
      detail: '正确 7/12（新模型认知 2/6，称不知道 2）',
      evidence: [
        { t: 'good', text: '✓ 中国明朝的开国皇帝是谁？… → 正确（朱元璋）' },
        { t: 'good', text: '✓ 《三体》的作者是谁？… → 正确（刘慈欣）' },
        { t: 'bad', text: '✗ OpenAI 在 2026 年 4 月发布、登顶 LiveBench 榜首的模型是什么？… → 错误（回答 GPT-4o）' },
        { t: 'bad', text: '✗ Anthropic 在 2026 年 5 月发布的 Opus 系列旗舰模型叫什么？… → 错误（回答 Opus 4.1）' },
        { t: 'info', text: '? Google 在 2026 年 2 月发布的旗舰模型是什么？… → 称不知道' },
        { t: 'bad', text: '声称 Claude Opus 4.8（知识截止 2026-03），但 2026 年新模型认知仅 2/6 —— 后端可能是旧模型或低版本' }
      ],
      votes: { 'gpt-4o': 8, 'qwen2.5-72b': 8, 'glm-4-9b': 8 },
      metrics: { right: 7, wrong: 3, unknown: 2, recentRight: 2, recentTotal: 6 }
    },
    t6: {
      status: 'warn', score: 0.7,
      detail: '4K:✓ 16K:✓ 32K:✗',
      evidence: [
        { t: 'good', text: '约 4K token 深度召回口令：成功（实际上报 4128 tokens）' },
        { t: 'good', text: '约 16K token 深度召回口令：成功（实际上报 16204 tokens）' },
        { t: 'bad', text: '约 32K token 深度召回口令：失败（模型回答「材料中未提及口令」）' },
        { t: 'bad', text: '长上下文失效而短上下文正常——典型的静默上下文截断（CISPA 审计中的"按长度分流"模式）' }
      ],
      votes: { 'gpt-4o': 8, 'qwen2.5-72b': 8 },
      metrics: { depths: [{ depth: 4096, ok: true, promptTokens: 4128 }, { depth: 16384, ok: true, promptTokens: 16204 }, { depth: 32768, ok: false, promptTokens: 32712 }] }
    },
    t7: {
      status: 'warn', score: 0.5,
      detail: '通过 5/8；未过：晾衣陷阱题、日期推算、括号深度',
      evidence: [
        { t: 'info', text: '推理题通过 5/8' },
        { t: 'bad', text: '未过：如果 3 件衬衫需要 3 小时晾干…（期望 3，实际回答 9 小时）' },
        { t: 'bad', text: '未过：2026 年 12 月 25 日是星期几…（期望 星期五，实际回答 星期四）' },
        { t: 'bad', text: '未过：括号最大嵌套深度…（期望 3，实际回答 4）' },
        { t: 'good', text: '方程组、数列、逻辑三段论、概率题通过' }
      ],
      votes: { 'gpt-4o': 8, 'qwen2.5-72b': 8 },
      metrics: { pass: 5, total: 8, rate: 0.625 }
    },
    t8: {
      status: 'fail', score: 0.9,
      detail: '通过 1/4；未过：isPrime（91 误判）、deepFlatten（引用未清空）、intToRoman（次级规则错误）',
      evidence: [
        { t: 'bad', text: '✗ isPrime 素数判断 边界用例未过（isPrime(91) 返回 true）' },
        { t: 'bad', text: '✗ deepFlatten 深度扁平化 边界用例未过（空数组处理返回原数组）' },
        { t: 'bad', text: '✗ intToRoman 整数转罗马数字 边界用例未过（1994 返回 MCMXIV）' },
        { t: 'good', text: '✓ Python 输出预测（7 世界）' }
      ],
      votes: { 'gpt-3.5-turbo': 8, 'glm-4-9b': 8, 'qwen2.5-72b': 8 },
      metrics: { pass: 1, total: 4, rate: 0.25 }
    },
    t9: {
      status: 'fail', score: 0.5,
      detail: '最接近家族：GLM 系 · Markdown重度=否 · 免责声明=0',
      evidence: [
        { t: 'info', text: '风格画像：标题 0 · 列表 0 · 加粗 0 · emoji 0 · 免责声明 0 · 连接词 3 · 均句长 41' },
        { t: 'bad', text: '文风签名指向 GLM 系，与声称的 Claude Opus 4.8 不符（样本：「首先要说，春天总是不声不响地就来访了。其次，它把整座城市都翻新了一遍。」）' }
      ],
      votes: { 'glm-4-9b': 5, 'glm-5.3': 4 },
      metrics: { markdownHeads: 0, bullets: 0, bold: 0, emoji: 0, disclaimer: 0, connectors: 3, avgLen: 41, styleBest: 'glm' }
    },
    t10: {
      status: 'warn', score: 0.6,
      detail: 'TTFT 2.31s · 38 tok/s · 分块 46 · 输出唯一数 3/5',
      evidence: [
        { t: 'info', text: 'TTFT 2.31s · 总耗时 8.4s · 分块 46 · 速率约 38 tok/s' },
        { t: 'bad', text: 'temperature=0 下输出不稳定（3 种），可能后端路由在多个模型间轮换' },
        { t: 'info', text: '5 次相同请求：不同输出 3 种 · 不同 model 字段 1 种 · 延迟中位 1.42s / 最大 6.8s' }
      ],
      votes: {},
      metrics: { ttft: 2310, ms: 8400, chunks: 46, tokPerSec: 38, uniqueOutputs: 3, uniqueModels: 1, p50: 1420, p95: 6800 }
    },
    t11: {
      status: 'info', score: 0.05,
      detail: '拒答话术：国产模型常见话术',
      evidence: [
        { t: 'good', text: '探针「fiction」应作答 → 实际作答 ✓' },
        { t: 'good', text: '探针「inject」应拒答 → 实际拒答 ✓' },
        { t: 'good', text: '探针「meta」应作答 → 实际作答 ✓' },
        { t: 'info', text: '检测到拒答话术特征：国产模型常见话术（「作为人工智能助手，我无法……」）' }
      ],
      votes: { 'qwen3.8-max': 4, 'glm-4-9b': 3, 'deepseek-v4-pro': 3 },
      metrics: { style: ['国产模型常见话术'] }
    },
    t12: {
      status: 'info', score: 0.3,
      detail: '自述身份：我是 Step，由阶跃星辰（StepFun）开发的语言模型……',
      evidence: [
        { t: 'info', text: '身份自述：「我是 Step，由阶跃星辰（StepFun）开发的大语言模型……」' },
        { t: 'info', text: '知识截止自述：「我的知识截止到 2024 年中」' },
        { t: 'info', text: '自述指向 Step/GLM 系，与声称的 Claude Opus 4.8 不符（弱信号，可被系统提示词伪造）' }
      ],
      votes: { 'glm-4-9b': 3 },
      metrics: { identity: '我是 Step，由阶跃星辰（StepFun）开发的语言模型……', cutoff: '我的知识截止到 2024 年中' }
    }
  }
};
