# SETI 快速入口

这个仓库是一个无构建步骤的 SETI 浏览器原型：页面入口是 `randomizer/index.html`，app 装配边界在 `randomizer/app/**`，主 UI 与流程编排在 `randomizer/app.js`，核心游戏逻辑集中在 `randomizer/game/**`。

每次修改，验证好后你需要自动提交代码。提交信息使用中文描述。

## Agent 工作约定

- **改动即文档（硬规矩，所有 agent 必读）**：每次代码/机制/接口改动，必须**同步更新对应文档并与改动同一次提交**；提交前自查文档与代码一致——被删除/重命名的函数、字段、判定规则不得在文档留痕，过期定义立即删除。
- **错误必须暴露，禁止静默处理（硬规矩，所有 agent 必读）**：任何失败都要显式抛错/上报，不得 `catch (_e) { 忽略/continue/置 null }` 静默吞掉。典型红线：V(state) 评估失败（observation 漏装配/结构不符）、反事实 outcome 缺叶、规则执行失败——静默吞掉会让"看不到东西"（AI 评估失真、动作不可见、诊断全空）长期潜伏，agent 每次都重新踩坑。需要容错的场景（fork 清理、枚举容错）必须注释写明"为何可忽略"。新增"喂数据给评估/搜索"的调用点时，跑 `node tools/audit_v_state_inputs.js` 验证所有路径输入完整。
- 开始修改前，先读相关模块和本文件列出的细节文档；不要只凭记忆改机制。
- 机制、状态模型、能力流程或资料路径发生变化时，同步更新对应文档。
- 所有接口改动必须记录并更新文档（如 `docs/ai-design.md`、`docs/rl-simulation-env.md`）；过期定义必须删除，不得遗留会产生误导的痕迹（已删除的函数名、旧判定规则、死诊断字段、已废弃设计的文档段落）。
- `AGENTS.md` 只维护快速导航和关键路径；长机制说明放在 `docs/mechanics-reference.md`。
- `SETI-*` issue 使用 `/Users/bilibili/.local/bin/mocha` 的默认 workspace；执行 issue 命令前先运行 `mocha config show`，确认 workspace ID 为 `6377be1d-624b-40f3-aec9-810bdeaff66d`。不得附加 `--profile algo1-wyfx`，也不得把不存在的 `SETI-N` 改查或改写为同号 `ALG-N`。
- 当前没有 `package.json` 或构建步骤；验证以 `node --check` 和 Node 测试脚本为主。
- Node 测试只允许 unit 与唯一 full-flow 两类；分类、准入和完整流程 fixture 见 `docs/node-testing.md`。
- 跨模块状态机、规则内核或 runtime 迁移开工前，按 `docs/implementation-proof-obligations.md` 将验收条款转成可证伪义务和分层证据；静态 coverage label 不算行为完成证据。
- coding issue 已实现、验收通过且没有待 owner 拍板事项时，直接按 issue-workflow 收口为 `done`；不得把自己设为 reviewer，也不得因“等待明确收口指令”继续停在 `in_progress`。
- 从大型闭包迁出 runtime 或修改传统脚本顺序时，除语法与全量 Node 回归外，必须补迁移域代表性执行路径和真实 Chrome smoke，覆盖显式 context、嵌套回调与浏览器装配。
- 代码和资产路径以仓库根目录为基准。
- 共享 dirty worktree 中若本次修改与他人改动重叠同一文件，提交前除工作树回归外，还必须验证仅含本次 staged 内容的独立快照；不得把他人未提交修复当作本次验收证据。
- 并行任务可能同时写共享 index 时，提交必须从最新 HEAD 创建私有 `GIT_INDEX_FILE`，只装入本 issue 的明确 blob；初始化与后续每条 index 命令必须在同一 shell segment 显式携带 `GIT_INDEX_FILE=<private-path>`，禁止先裸跑 `git read-tree HEAD`；commit 后立即用 `git show --name-only/--stat` 核对实际文件清单与 issue 范围。
- 共享 index 中可能残留并行任务早先 `git add` 的**过期 staged 快照**（blob 早于最新 HEAD，文件级工作树却已同步到 HEAD）：此时直接 `git commit` 会把他人已提交的改动整体回退。提交前必须核对 `git diff --cached` 与工作树/HEAD 一致；发现过期 staged 用 `git reset -- <paths>` 清掉（不动工作树、不动提交）。

## 代码地图

- `randomizer/index.html`：浏览器页面入口。
- `randomizer/app/dependencies.js`：app 层全局模块依赖收集与脚本顺序校验。
- `randomizer/app/dom.js`：固定 DOM 元素注册表。
- `randomizer/app/public-api.js`：调试、AI 验证和外部脚本使用的 `window.SetiRandomizer` API 组装。
- `randomizer/app/ai/browser-bootstrap.js`：Browser 机器席位端口——装配与 Simulation 同一协调器（`machine-player-coordinator.js`）与 Heuristic 决策函数（`heuristic-decision-function.js`），唯一差异是 `recordStep` 记账钩子（browser 空操作）；席位判定、决策前稳定化、同 decision 去重、lifecycle 失效重建、失败转显式 fail 结果。创建期校验必需端口。
- 旧 `randomizer/game/ai/machine-player-host.js` 与 `randomizer/app/browser-host/policy-input-adapter.js` 异步 Host 壳已删除；Browser 机器席位不得恢复独立于协调器的第二份搜索/提交链。
- 旧 `randomizer/app/ai-controller.js`、pending/automation/action-executor、report/tuning runtime 与 legacy valuation/candidate 域已物理删除；Browser 机器席位不得恢复 candidate/selector/pending automation 旁路。
- `randomizer/game/ai/policy-port.js`：启发式与 Learned Policy 共用的 `DecisionContext -> PolicyDecision` 契约、公共 validator 和请求失效语义；Policy 不在此执行规则。
- `randomizer/game/ai/heuristic-policy.js`：无 DOM/Host 推进依赖的版本化 Heuristic Policy，实现公共端口并为浏览器席位、teacher 与冻结 opponent 提供同一 provenance。
- `randomizer/game/ai/heuristic-evaluator.js`、`expected-score-evaluator.js`：只消费公共 observation、legal descriptors 与标准反事实 outcome，负责纯估值和稳定排序；不得恢复 legacy candidate 或 selector adapter。
- `randomizer/game/ai/machine-player-coordinator.js`：机器人玩家协调器（Browser/Simulation 共用）——席位决策函数注册表、裸调共享 composition 读边界（合法集原生 + 观察直接 createDecisionObservation(projection.state)）、计划复用（`planReuseCheck`）、调用决策函数、execute 提交共享 inputPort、recordStep 记账钩子；失败直接抛错。详见 `docs/ai-design.md` §1。
- `randomizer/game/ai/heuristic-decision-function.js`：Heuristic 决策函数（AI 类型）——统一反事实搜索（目标引导 + 需求引导单一路径，无 bounded 分桶）+ 直调启发式 Policy + 从 winning leaf 构建 plan；实现 `(ctx) => ({ actionId, plan? })` 接口。
- `randomizer/game/ai/plan-continuation.js`：计划延续复用的纯逻辑——决策函数输出的计划结构（`buildPlanFromSnapshot`/`advancePlan`）、复用判定（`planReuseCheck`）、依赖事实与外星揭示基线；详见 `docs/ai-design.md` §3。装配在 `randomizer/app/simulation-env.js`（`planContinuationFastPath`，默认开，`false` 可关），诊断/验证工具 `tools/diagnose_plan_continuation.js`、`tools/verify_plan_continuation_fastpath.js`。
- `randomizer/training/self-play.js`：Node self-play 训练、action-kind baseline、逐步 JSONL 与 episode checkpoint。
- `randomizer/training/trajectory-recorder.js`：`seti-self-play-log-v1` 轨迹录制器（Browser/Node 共用，人类示范与 self-play 同一格式）。
- `randomizer/app/browser-host/trajectory-recording.js`：Browser 输入链录制适配器（只读 projection、按确认 replay 对齐、终局导出 JSONL）。
- `randomizer/training/worker-protocol.js`、`simulation-worker.js`、`worker-pool.js`：Python/PyTorch 常驻采样协议、隔离 worker、超时/背压/崩溃恢复与批量请求。
- `tools/run_self_play_training.js`：训练、恢复和评测命令行入口。
- `tools/run_rl_worker_server.js`、`tools/rl_worker_client.py`：Node JSONL worker 服务与 Python 标准库客户端；`tools/benchmark_rl_workers.js` 为分项吞吐闸门。
- `randomizer/app.js`：Browser Production composition、projection/ViewState、标准输入、服务与渲染的窄装配根。
- `randomizer/game/effects/residual-domain-session.js`、`randomizer/app/browser-host/decision-ui.js`：公司、卡牌、数据与八种外星人的标准 Decision/Effect owner 和只读 presentation；机会队列、痕迹奖励、followup、history/rollback 归 session，UI 只消费 projection。
- `randomizer/game/production-kernel.js`、`randomizer/game/production-composition.js`：Browser/Simulation 共用的唯一 Production factory、23 family registry（16 顶层 + 7 conditional）、五个 domain、Decision 与提交链。
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
- `randomizer/game/data/**`：数据池、计算机放置、星云数据 token 与扇区结算规则。
- `randomizer/game/tech/**`：科技供应区、玩家科技板、bonus 与放置规则。
- `randomizer/game/industry/**`：公司牌目录、1x 主动能力、被动钩子与标记槽规则。
- `randomizer/game/aliens/**`：外星人通用状态、揭示、痕迹与物种专属机制。DOM 渲染统一位于 `randomizer/app/browser-host/**`。

## 常见任务入口

- 改回合、PASS、主行动锁定、效果栏或日志：先读 `randomizer/app.js` 和 `randomizer/game/history/**`。
- 改 app 框架、脚本依赖、DOM、事件绑定或公开 API：先读 `docs/app-architecture.md` 和 `randomizer/app/**`。
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
- `docs/fixed-boards.md`：固定盘面 seed ↔ 盘面 ↔ 初始公司关联清单（浏览器下拉与训练侧默认盘面的对号入座）。
- `docs/rl-simulation-env.md`：RL Simulation env 契约、observation/action/replay schema 与当前浏览器实现映射。
- `docs/save-replay-guide.md`：存档复盘与迁移指南——旧档（如 v47+v54+v223 三档拼接）用当前内核重放生成兼容新存档（`tools/migrate_537_full_chain.js`）、扫描流补牌时机差异、复盘工具用法。
- `docs/browser-simulation-unification.md`：Browser/Simulation 内核共用审计、family 接口唯一性矩阵、打牌登陆与直接登陆双实现差异、代码与文档冲突清单与统一方案。
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
node --check randomizer/game/abilities/scan.js
```

资料生成脚本：

```powershell
python tools/build_card_catalog_js.py
python tools/analyze_alien_cards.py
```
