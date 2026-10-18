# 照妖镜 · API 中转站掺水检测站

用学术界与工业界最权威的模型指纹技术，检测你的 API 中转站背后到底跑的是什么模型。**纯静态单页应用，零依赖，可离线部署，API Key 不经过任何第三方服务器。**

🔗 在线使用：<https://imz-a.github.io/relay-inspector/>

## 为什么做这个

2026 年 3 月，德国 CISPA 审计 17 家中转站，**45.83% 未通过模型指纹校验**；被冒充最多的是 Claude Opus 与 GPT-5 系列。常见掺水手法：

- **静默降级**：声称 Claude Opus，实际转发到便宜的小模型
- **跨厂商偷换**：声称 GPT-5，实际是 DeepSeek / GLM / Qwen
- **按上下文长度分流**：短请求用真模型，长请求偷偷切换

## 检测方法（12 项，多信号交叉验证）

| 检测 | 方法 | 来源 |
|---|---|---|
| T1 协议元数据 | 响应头 / model 字段指纹 | TSecurity |
| T2 词表指纹 | 14 探针读 `usage.prompt_tokens`，L1 距离判别 tokenizer 家族 | tokwhois v1.1 |
| T3 能力底线 | 指令遵循底线题 | llm-api-benchmark-skill |
| T4 随机数行为指纹 | 「1-100 随机数」偏好分布，JS 散度比对（165 模型库，准确率 92.7%） | 《One Token Is Enough》arXiv:2606.04101 |
| T5 知识截止探测 | 时效性事实题 | 通用 |
| T6 大海捞针 | 4K–32K 长上下文针点召回 | 通用 |
| T7 推理数学 | 多步推理题 | 通用 |
| T8 代码能力 | 沙箱自动判分 | 通用 |
| T9 文风指纹 | 创作样本风格比对 | 通用 |
| T10 延迟流式特征 | TTFT / 流式节奏 / 假流式检测 | 通用 |
| T11 拒答话术 | 安全拒答模板匹配 | 通用 |
| T12 自我认知 | 模型自述（低权重） | 通用 |

综合输出：**掺水指数（0-100）**、结论分级、**实际后端模型鉴定（Top 6 匹配度）**、能力雷达对比（实测 vs 官方基线）、成本账。

## 检测记录（GitHub 同步）

每次全量检测完成后，结果可一键保存到本仓库的 `records/` 目录：

- `records/index.json` — 全部记录索引（时间 / 中转站 / 声称模型 / 结论 / 掺水指数 / 鉴定后端）
- `records/<时间>_<中转站>_<模型>.json` — 单次完整报告（含全部证据）

**去重规则**：同一中转站 + 同一声称模型 + 同协议下，结论分级 / 掺水指数档（5 分一档）/ 鉴定后端完全一致的记录不会重复写入；任何一项不同都会作为新记录保留——即"结果没变不刷屏，结果变了必留痕"。

### 配置 GitHub 写入（可选）

浏览记录无需任何配置。要写入记录，需要一个 GitHub Token：

1. 打开 <https://github.com/settings/tokens?type=beta> → **Generate new token**（fine-grained）
2. **Repository access** 选 `Only selected repositories` → 选中 `imz-a/relay-inspector`
3. **Permissions → Repository permissions → Contents** 设为 `Read and write`
4. 生成后粘贴到网页「⚙️ 高级设置 → ☁️ 检测记录同步 → Access Token」

Token 与 API Key 同等级别对待：默认只存在页面内存，勾选"在本机记住"才会写入 localStorage。记录内容永远不含任何密钥。

## 本地运行

无需构建，任选其一：

```bash
# 直接打开
open index.html

# 或起个静态服务
python -m http.server 8000
```

## 工程结构

```
index.html            单页入口
assets/style.css      浅色简约样式（Apple HIG 中性色系）
js/data.js            模型基线库 / 指纹目录 / 题库 / 结论分级
js/charts.js          SVG 图表（雷达图 / 掺水指数仪表盘 / 条形图）
js/gh.js              GitHub 记录模块（读写 + 去重 + 渲染）
js/tests.js           12 项检测引擎
js/report.js          评分 / 鉴定 / 报告渲染
js/app.js             应用编排
js/demo.js            演示数据
dev-tests/            自动化测试（91 项）
```

跑测试：

```bash
node dev-tests/smoke-test.js   # 57 项纯逻辑测试
# DOM 测试需要 jsdom：
NODE_PATH=<node_modules 路径> node dev-tests/dom-test.js   # 34 项全页面测试
```

## 参考文献

1. CISPA Helmholtz《Real Money, Fake Models: Deceptive Model Claims in Shadow APIs》arXiv:2603.01919
2. T. Bruckner《One Token Is Enough: Detecting Model Substitution via Behavioral Fingerprints》arXiv:2606.04101
3. tokwhois — 14 探针 tokenizer 家族识别 <https://github.com/fasuizu-br/tokwhois>
4. TSecurity 五信号检测法
5. llm-api-benchmark-skill — 726 题公开基准加权评分

## 免责声明

本工具只检测「你拿到的回复像不像声称的模型」，不判定商业欺诈意图；检测结论仅供维权与选型参考，不构成法律证据。
