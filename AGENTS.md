# SETI 快速入口

这个仓库是一个无构建步骤的 SETI 浏览器原型：页面入口是 `randomizer/index.html`，app 装配边界在 `randomizer/app/**`，主 UI 与流程编排在 `randomizer/app.js`，核心游戏逻辑集中在 `randomizer/game/**`。

每次修改，验证好后你需要自动提交代码。提交信息使用中文描述。

## Agent 工作约定

- 开始修改前，先读相关模块和本文件列出的细节文档；不要只凭记忆改机制。
- 机制、状态模型、能力流程或资料路径发生变化时，同步更新对应文档。
- `AGENTS.md` 只维护快速导航和关键路径；长机制说明放在 `docs/mechanics-reference.md`。
- 当前没有 `package.json` 或构建步骤；验证以 `node --check` 和 Node 测试脚本为主。
- Node 测试只允许 unit 与唯一 full-flow 两类；分类、准入和完整流程 fixture 见 `docs/node-testing.md`。
- 跨模块状态机、规则内核或 runtime 迁移开工前，按 `docs/implementation-proof-obligations.md` 将验收条款转成可证伪义务和分层证据；静态 coverage label 不算行为完成证据。
- coding issue 已实现、验收通过且没有待 owner 拍板事项时，直接按 issue-workflow 收口为 `done`；不得把自己设为 reviewer，也不得因“等待明确收口指令”继续停在 `in_progress`。
- 从大型闭包迁出 runtime 或修改传统脚本顺序时，除语法与全量 Node 回归外，必须补迁移域代表性执行路径和真实 Chrome smoke，覆盖显式 context、嵌套回调与浏览器装配。
- 代码和资产路径以仓库根目录为基准。
- 共享 dirty worktree 中若本次修改与他人改动重叠同一文件，提交前除工作树回归外，还必须验证仅含本次 staged 内容的独立快照；不得把他人未提交修复当作本次验收证据。
- 并行任务可能同时写共享 index 时，提交必须从最新 HEAD 创建私有 `GIT_INDEX_FILE`，只装入本 issue 的明确 blob；初始化与后续每条 index 命令必须在同一 shell segment 显式携带 `GIT_INDEX_FILE=<private-path>`，禁止先裸跑 `git read-tree HEAD`；commit 后立即用 `git show --name-only/--stat` 核对实际文件清单与 issue 范围。

## 代码地图

- `randomizer/index.html`：浏览器页面入口。
- `randomizer/app/dependencies.js`：app 层全局模块依赖收集与脚本顺序校验。
- `randomizer/app/alien-trace-reward-flow.js`：外星人痕迹奖励的方舟解锁、面板放置与无目标落空编排。
- `randomizer/app/constants.js`：app 层静态配置、图标路径、奖励表和 UI 参数。
- `randomizer/app/dom.js`：固定 DOM 元素注册表。
- `randomizer/app/events.js`：app 层事件绑定、overlay 点击分发、拖拽绑定与 resize 入口。
- `randomizer/app/debug-runtime.js`：debug / calibration / quick sector scan / failsafe / alien reveal 调试入口与开发辅助壳层。
- `randomizer/app/start-screen.js`：开始界面选项同步、继续游戏入口与新局启动壳层。
- `randomizer/app/turn-flow.js`：新局初始化、随机化装配与 round / turn 推进壳层。
- `randomizer/app/turn-end-flow.js`：PASS 必做效果、回合末外星人揭示、收入与跨轮收尾。
- `randomizer/app/action-interaction-runtime.js`：冥王星行动、移动箭头 UI 与数据放置 picker。
- `randomizer/app/final-score-ai-runtime.js`：终局板块 AI 估值、可行性惩罚与竞速调整。
- `randomizer/app/card-runtime.js`：手牌出牌、弃牌角标、公共牌选择、PASS 预留与卡牌移动运行时。
- `randomizer/app/card-trigger-runtime.js`：卡牌任务、触发匹配、奖励队列和确认/取消/续跑运行时。
- `randomizer/app/income-runtime.js`：卡牌收入、轮开始收入和公司轮开始收益运行时。
- `randomizer/app/scan-flow.js`：扫描目标、扇区结算、延迟补牌与公共牌/手牌扫描运行时。
- `randomizer/app/tech-runtime.js`：科技选择、蓝槽确认、取消/撤销恢复与海盗科技标记运行时。
- `randomizer/app/industry-runtime.js`：公司 1x、被动奖励、picker、pending 与 quick history 回滚运行时。
- `randomizer/app/alien-ui.js`：外星人揭示提示、痕迹 picker、方舟用途分流与各物种痕迹放置模式 UI 壳层。
- `randomizer/app/aliens/species-runtime.js`：八种外星人的奖励、牌获取/任务 dialog、机会队列、followup 与具体面板渲染；通过显式 context 接收 app 编排依赖。
- `randomizer/app/action-log-export.js`：终局行动日志 Markdown 导出格式与文件名生成。
- `randomizer/app/public-api.js`：调试、AI 验证和外部脚本使用的 `window.SetiRandomizer` API 组装。
- `randomizer/app/ai/control-runtime.js`：AI 控制状态、难度/权重配置、快照恢复、pending owner 与自动调度的单一所有者。
- `randomizer/app/ai/initial-card-pending.js`、`interaction-pending.js`：按初始/卡牌与交互域拆分的 pending resolver，通过窄 context 调用 app flow。
- `randomizer/app/ai/action-executor.js`、`automation-runtime.js`：顶层行动执行、pending 优先级与自动化步骤编排。
- `randomizer/app/ai-controller.js`：AI runtime/rule domain 装配、`REQUIRED_CONTEXT_KEYS` 完整性校验与稳定 API adapter；不再承载 resolver/executor 函数体。
- `randomizer/game/ai/*-valuation.js`、`*-candidates.js`、`action-value.js`、`demand-card.js`、`route-planet.js` 等：按资源、卡牌、路线、扫描、科技、终局和外星人拆分的只读 AI 估值域；它们只产生评分/诊断，不创建公共 Action identity。
- `randomizer/game/ai/policy-port.js`：启发式与 Learned Policy 共用的 `DecisionContext -> PolicyDecision` 契约、公共 validator 和请求失效语义；Policy 不在此执行规则。
- `randomizer/game/ai/machine-player-host.js`：浏览器与 headless 共用的固定机器席位、Policy 请求代际、deadline/取消/去重和 fail-closed 提交协调器；详见 `docs/machine-player-host.md`。
- `randomizer/game/ai/heuristic-policy.js`：无 DOM/Host 推进依赖的版本化 Heuristic Policy，实现公共端口并为浏览器席位、teacher 与冻结 opponent 提供同一 provenance。
- `randomizer/game/ai/selection-evaluator.js`：setup、弃牌、支付、科技与外星人 legal choice 的纯估值；不拥有选择或提交权，结果必须经公共 Policy 端口。
- `randomizer/game/ai/heuristic-evaluator.js`：直接从公共 observation/legal descriptors 计算策略分与稳定排序；不得恢复 legacy candidate 或 selector adapter。
- `randomizer/app/ai/battle-log.js`、`battle-report.js`：AI 对战日志、bug、结果/pending 汇总及报告 schema。
- `randomizer/app/ai/tuning-history.js`、`experiment-runner.js`：调参历史持久化/推荐与单局、batch、A/B、tuning cycle runner。
- `randomizer/training/self-play.js`：Node self-play 训练、action-kind baseline、逐步 JSONL 与 episode checkpoint。
- `randomizer/training/worker-protocol.js`、`headless-worker.js`、`worker-pool.js`：Python/PyTorch 常驻采样协议、隔离 worker、超时/背压/崩溃恢复与批量请求。
- `tools/run_self_play_training.js`：训练、恢复和评测命令行入口。
- `tools/run_rl_worker_server.js`、`tools/rl_worker_client.py`：Node JSONL worker 服务与 Python 标准库客户端；`tools/benchmark_rl_workers.js` 为分项吞吐闸门。
- `randomizer/app.js`：composition root、顶层状态、跨 flow continuation、统一刷新与控制器接线；不再承载已迁移域的成片具体实现。
- `randomizer/game/effects/industry-alien-session.js`、`randomizer/app/browser-host/industry-alien-decision-ui.js`：公司与八种外星人的标准 Decision/Effect Session adapter 和只读领域 renderer；机会队列、痕迹奖励、followup、history/rollback 归 session，UI 只消费 projection。
- `randomizer/app/browser-host/policy-input-adapter.js`：把公共 PolicyDecision 映射回与玩家相同的 Standard Action/Decision 输入端口；提交前重验 boundary，未知/stale fail-closed。
- `randomizer/app/effects/**`：按移动扫描、奖励选择、外星人和顶层分发拆分的具体 effect executors。
- `randomizer/style.css`：页面布局、交互聚焦、高亮与各区视觉状态。
- `randomizer/solar-system/layout.js`：太阳系盘面坐标、扇区、星云与内容类型定义。
- `randomizer/solar-system/core.js`：太阳系渲染与旋转相关核心逻辑。
- `randomizer/game/players.js`：玩家资源、收入、手牌、保留牌、科技与初始选择状态。
- `randomizer/game/rockets.js`：火箭状态、发射、移动、旋转推动与访问事件。部分地方可能把火箭称为探测器，他们是同一个东西。
- `randomizer/game/planet-stats.js`：星球环绕、登陆、卫星登陆和参考图标记统计。
- `randomizer/game/initial-cards.js`：公司牌和初始牌的初始选择结算。
- `randomizer/game/final-scoring.js`：终局计分板块标记流程。
- `randomizer/game/end-game-scoring.js`：终局板块与 3 型卡实时计分。
- `randomizer/game/abilities/**`：可复用能力函数与能力链，包括发射、移动、扫描、科技、环绕、登陆、分析等。
- `randomizer/game/actions/**`：主行动和快速行动的效果构建、奖励表与交易逻辑。
- `randomizer/game/history/**`：主行动/快速行动事务历史、撤销命令和不可撤销屏障。
- `randomizer/game/cards/**`：卡牌牌库、效果模型、任务状态和卡牌触发结算。
- `randomizer/game/data/**`：数据池、计算机放置、星云数据 token、扇区结算与渲染。
- `randomizer/game/tech/**`：科技供应区、玩家科技板、bonus、放置与渲染。
- `randomizer/game/industry/**`：公司牌目录、1x 主动能力、被动钩子、标记槽和渲染。
- `randomizer/game/aliens/**`：外星人通用状态、揭示、痕迹、渲染与物种专属机制。

## 常见任务入口

- 改回合、PASS、主行动锁定、效果栏或日志：先读 `randomizer/app.js` 和 `randomizer/game/history/**`。
- 改 app 框架、脚本依赖、常量、DOM、事件绑定或公开 API：先读 `docs/app-architecture.md` 和 `randomizer/app/**`。
- 改 debug 面板、failsafe、快速扇区扫描、外星人调试揭示或校准入口：先读 `randomizer/app/debug-runtime.js` 和 `docs/app-topdown-architecture.md`。
- 改发射、移动、环绕、登陆或星球奖励：先读 `randomizer/game/abilities/**`、`randomizer/game/actions/planet-rewards.js`、`randomizer/game/rockets.js`。
- 改扫描、星云、数据池或扇区结算：先读 `randomizer/game/actions/scan-effects.js` 和 `randomizer/game/data/**`。
- 改打牌、任务卡、弃牌角标或卡牌 DSL：先读 `randomizer/game/cards/**` 和卡牌相关文档。
- 改科技、bonus 或科技板放置：先读 `randomizer/game/tech/**` 和 `randomizer/game/abilities/tech.js`。
- 改公司牌：先读 `randomizer/game/industry/**` 和 `assets/industry/industry-abilities.md`。
- 改外星人：先读 `randomizer/game/aliens/**`、`docs/alien-design.md` 和对应物种文档。

## 详细资料索引

- `docs/card-data-sources.md`：SETI 卡牌资料站导航；可查询普通卡牌、公司（组织）牌和起始卡等内容。
- `docs/mechanics-reference.md`：从旧版 `AGENTS.md` 迁出的完整机制参考。
- `docs/app-architecture.md`：浏览器 app 装配层、`randomizer/app/**` 边界与后续拆分原则。
- `docs/effect-glossary.md`：效果术语表；不确定效果名含义时先查这里。
- `docs/card-modeling-dsl-spec.md`：卡牌描述转换为可执行 DSL 的规范。
- `docs/alien-design.md`：外星人通用设计总结与新增外星人检查清单。
- `docs/ai-design.md`：电脑玩家 AI 的当前唯一设计文档（控制器接口、价值模型、目标系统、回合规划、自博弈验证），后续开发以此为准。
- `docs/rl-headless-env.md`：RL headless env 契约、observation/action/replay schema 与当前浏览器实现映射。
- `docs/implementation-proof-obligations.md`：跨模块状态机/迁移任务的验收条款正向推导、proof obligation、检查问题与分层证据模板。
- `assets/final/final_detail.md`：终局计分 a/b/c/d 板块的规则公式。
- `assets/industry/industry-abilities.md`：公司牌主动/被动能力设计与建模说明。

## 外星人专属文档

- `assets/aliens/九折/implementation.md`
- `assets/aliens/异常点/implementation.md`
- `assets/aliens/半人马/implementation.md`
- `assets/aliens/方舟/implementation.md`
- `assets/aliens/虫/implementation.md`
- `assets/aliens/阿米巴/implementation.md`
- `assets/aliens/奥陌陌/implementation.md`
- `assets/aliens/符文族/implementation.md`

## 常用验证

推荐回归：

```powershell
node --check randomizer/app.js
node tools/run_node_tests.js
```

`tools/run_node_tests.js` 按显式清单执行 unit 与唯一 full-flow，并分别输出数量和耗时；可用 `--list`、`--match <路径子串>`、`--exclude <路径子串>` 做清单与定向验证。架构审计不混入默认 Node 回归。

需要额外检查能力/历史基础语法时：

```powershell
node --check randomizer/game/history/action-history.js
node --check randomizer/game/history/transactions.js
node --check randomizer/game/abilities/scan.js
```

资料生成脚本：

```powershell
python tools/build_card_catalog_js.py
python tools/analyze_alien_cards.py
```
