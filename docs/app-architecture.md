# App 架构边界

本文档说明浏览器入口层的职责边界。这里的 app 指 `randomizer/index.html` 加载后由 `randomizer/app/**` 和 `randomizer/app.js` 组成的页面装配层；核心规则仍以 `randomizer/game/**` 为准。

如果你需要看“当前 app 层到底还剩哪些逻辑、top-down 模块该怎么拆”，优先再读 [docs/app-topdown-architecture.md](./app-topdown-architecture.md)。

浏览器逐步剥离为纯 View、Input Adapter 与 ViewState 的目标契约、可见性边界、所有权矩阵和 proof obligations，见 [docs/browser-host-ui.md](./browser-host-ui.md)。迁移期间本文件描述的是现状装配边界，后者描述目标宿主边界与分阶段删除条件。

## 当前加载层次

1. `randomizer/index.html` 按传统 `<script>` 顺序加载，无构建步骤，也不使用 ES module。
2. `randomizer/solar-system/**`、`randomizer/game/**` 先注册各自的 `window.Seti*` 全局模块。
3. `randomizer/app/alien-trace-reward-flow.js` 编排痕迹奖励的方舟解锁、面板放置与无目标落空分支。
4. `randomizer/app/dependencies.js` 收集并校验 app 层需要的全局模块。
5. `randomizer/app/constants.js` 创建 app 层静态配置、图标路径、扫描/扇区奖励表和 UI 参数。
6. `randomizer/app/dom.js` 集中查询页面上的固定 DOM 节点。
7. `randomizer/app/view-adapter.js` 提供 Node composition 使用的 no-op view adapter；浏览器继续使用真实 DOM/render runtime。
8. `randomizer/app/events.js` 绑定页面事件、overlay 点击分发、拖拽回调和 resize 入口。
8. `randomizer/app/start-screen.js` 处理开始界面选项同步、入口按钮和继续游戏恢复。
9. `randomizer/app/turn-flow.js` 处理 turnState 初始化、新局随机化和 round / turn 推进壳层；`turn-end-flow.js` 处理 PASS 队列、回合末外星人揭示与跨轮收尾。
10. `randomizer/app/card-runtime.js`、`card-trigger-runtime.js`、`income-runtime.js` 与 `scan-flow.js` 承接卡牌交互、任务触发、收入和扫描运行域。
11. `randomizer/app/tech-runtime.js` 与 `industry-runtime.js` 承接科技选择、公司能力、被动奖励及其 pending/history 回滚运行域。
12. `randomizer/app/action-briefing.js` 封装 AI 行动简报的条目归纳、scan 目标摘要和 overlay 渲染控制器。
13. `randomizer/app/action-log-export.js` 生成行动日志 Markdown 和下载文件名。
14. `randomizer/app/action-log-runtime.js` 封装行动日志 draft/entry 组装与日志导入等纯运行时逻辑。
15. `randomizer/app/game-recovery.js` 封装恢复快照、本地持久化包读写与恢复应用适配。
16. `randomizer/app/public-api.js` 组装 `window.SetiRandomizer` 调试/外部脚本 API。
17. `randomizer/app/ai/control-runtime.js` 封装 AI 控制状态、难度/权重、快照/恢复、pending owner 与调度；`initial-card-pending.js`、`interaction-pending.js`、`action-executor.js`、`automation-runtime.js` 承接 pending resolver、顶层行动执行与优先级编排；`ai-controller.js` 只装配这些 runtime 并转发稳定 API。
18. `randomizer/app/effects/**` 按移动扫描、奖励选择、外星人和顶层分发四个域注册具体 effect executors。
19. `randomizer/app/alien-ui.js` 封装外星人揭示提示、痕迹 picker、方舟用途分流与各物种面板放置模式 UI。
20. `randomizer/app/aliens/species-runtime.js` 封装八种外星人的奖励、牌获取/任务 dialog、机会队列、followup 和具体面板渲染，通过显式 context 接收跨域依赖。
21. `randomizer/app/action-interaction-runtime.js` 承接冥王星行动、移动箭头 UI 与数据放置 picker。
22. `randomizer/app.js` 保留运行态、跨域流程编排、效果队列、渲染调度和各控制器接线；严格验收后为 9,930 行。

## 文件职责

- `randomizer/app/dependencies.js`：唯一的 app 入口依赖表。新增或删除 `window.Seti*` 依赖时先改这里，让脚本顺序错误能尽早报错。
- `randomizer/app/alien-trace-reward-flow.js`：只决定痕迹奖励应进入方舟解锁、面板放置还是无目标落空；无目标时必须结束当前奖励节点，包括 `required` / 不可跳过节点。
- `randomizer/app/constants.js`：只放静态常量和依赖派生常量。不要在这里读写游戏状态、DOM 或 pending 流程。
- `randomizer/app/dom.js`：只收集固定 DOM 元素和 NodeList。新增 HTML id、overlay、按钮或常驻区域时先在这里登记。
- `randomizer/app/view-adapter.js`：定义 headless 的空元素集合与 no-op render/log/hover 接口；不得模拟 DOM 节点或把规则分支塞进 adapter。
- `randomizer/app/events.js`：只做事件到 app 回调的路由。新增按钮、overlay、拖拽入口时优先改这里；不要在这里实现规则结算。
- `randomizer/app/start-screen.js`：只处理开始界面选项、继续游戏入口和新局入口壳层；不要在这里新增规则结算或复制恢复逻辑。
- `randomizer/app/turn-flow.js`：只处理 turnState 初始化、新局随机化和回合推进壳层；不要在这里复制核心规则实现。
- `randomizer/app/turn-end-flow.js`：处理 PASS 必做效果队列、回合末外星人揭示 continuation、收入与跨轮刷新；通过显式 context 调用所属规则/runtime。
- `randomizer/app/action-interaction-runtime.js`：处理冥王星交互、移动箭头和数据放置 picker；不拥有规则状态，所有状态和 continuation 均由 composition root 注入。
- `randomizer/app/final-score-ai-runtime.js`：处理终局板块候选估值、可行性惩罚和竞速调整；不维护 AI 自动机状态。
- `randomizer/app/action-briefing.js`：只处理 AI 行动简报的数据归纳、摘要文案和 overlay 开关；不要在这里执行规则结算或直接修改行动日志源数据。
- `randomizer/app/alien-ui.js`：只处理外星人揭示弹层、痕迹选择器、方舟分流和“进入某物种放置模式”的 UI 壳层；不实现物种奖励、dialog 或具体面板渲染。
- `randomizer/app/aliens/species-runtime.js`：处理物种奖励、外星人牌获取、虫族任务、九折/半人马机会、符文 symbol、followup 和具体面板渲染。模块不得抓取 `app.js` 闭包，所有状态、规则模块和 continuation 均由 `createAlienSpeciesRuntime(context)` 显式注入。
- `randomizer/app/tech-runtime.js`：处理科技供应区选择、蓝槽 picker、确认/取消/undo 恢复和海盗科技标记交互；规则判断仍委托 `game/tech/**` 与 `game/industry/**`。
- `randomizer/app/industry-runtime.js`：处理公司能力与被动的 UI/pending/history 编排；公司规则、数值和文案继续由 `game/industry/**` 提供。
- `randomizer/app/action-log-runtime.js`：处理行动日志草稿、步骤、entry、导入组装及日志列表/tab 的 DOM 展示；通过显式参数接收 turn/player/history 与 view 上下文，不直接抓 app 闭包。
- `randomizer/app/action-log-export.js`：只做纯 Markdown 格式化和文件名生成，不读 DOM、不读取隐藏牌序，也不触发浏览器下载。
- `randomizer/app/game-recovery.js`：只处理恢复快照、本地存档包和恢复流程适配；状态恢复和 UI 刷新通过显式回调注入。
- `randomizer/app/public-api.js`：只组装 `window.SetiRandomizer` 暴露面。新增调试 API 时优先改这里，保持 API 与运行态编排分离。
- `randomizer/app/ai/control-runtime.js`：AI 控制层。唯一持有 `aiAutoBattleState`、scheduler 标志与策略权重；通过显式 `state` getter 和回调读取 pending、执行自动步骤，不复制 app pending 或 resolver 状态。
- `randomizer/app/ai/battle-log.js`：AI 对战日志 compact、entry、bug 计数与玩家/比分快照。
- `randomizer/app/ai/battle-report.js`：player result、pending state、report/progress/analysis schema；不执行对战步骤。
- `randomizer/app/ai/tuning-history.js`：调参历史的 localStorage 持久化、A/B 摘要、推荐与应用入口。
- `randomizer/app/ai/experiment-runner.js`：单局自动对战、batch、同 seed A/B、tuning cycle 与样本诊断压缩。
- `randomizer/app/ai/initial-card-pending.js`：初始选择、收入弃牌、PASS 预留、公共牌/手牌选择、卡牌触发/任务与打牌 pending resolver。
- `randomizer/app/ai/interaction-pending.js`：数据、移动支付、登陆、扫描、科技、公司免费移动与外星人 pending resolver；只通过筛选后的显式 context 调用 app flow，不持有 pending 状态。
- `randomizer/app/ai/action-executor.js`：顶层候选汇总、重试诊断与行动执行器；不拥有回合或 pending 状态。
- `randomizer/app/ai/automation-runtime.js`：非回合 pending 优先级、效果恢复、选定行动执行和 `runAiAutomationStep` 编排。
- `randomizer/app/ai-controller.js`：AI 装配 adapter。注入 `app/ai/**` runtime 与 `game/ai/**` 规则域并转发稳定 API，不再包含 resolver、行动 executor、控制状态、日志/报告、实验 runner 或成片纯估值/候选函数体。
- `randomizer/app/effects/movement-scan.js`：移动、行星落点、轨道/登陆、扇区扫描和相关选择执行器。
- `randomizer/app/effects/rewards.js`：资源、数据、抽牌、条件奖励、手牌选择和科技/扫描奖励执行器。
- `randomizer/app/effects/aliens.js`：异常点、虫和奥陌陌的效果执行器及 continuation 适配。
- `randomizer/app/effects/dispatcher.js`：卡牌、星球奖励、科技、公司和扫描 effect 的顶层分发；不得在 `app.js` 重建巨型 type switch。
- `randomizer/app/card-runtime.js`：卡牌选择、打牌/弃牌、角标快速行动、卡牌移动、公共牌控制与 PASS 预留选择；相关 pending 的确认、取消和继续选择在模块内闭环。
- `randomizer/app/card-trigger-runtime.js`：任务就绪、1 型触发、任务确认、奖励队列和触发后的续跑；不在 `app.js` 复制任务/触发分支。
- `randomizer/app/income-runtime.js`：弃牌收入、收入资源发放、轮开始公司收益和原教旨主义轮开始收入队列。
- `randomizer/app/scan-flow.js`：公共牌/手牌扫描、扫描目标、扇区结算、延迟补牌及扫描收尾；扫描 pending 的确认、取消和续跑在该 flow 内完成。
- `randomizer/app.js`：composition root 与跨 flow 顶层总控。可以维护状态所有权、组合规则模块、调度 continuation 和注入 context，但不应再新增卡牌/收入/扫描/任务触发、外星人/公司/debug、具体渲染、公开 API 或 AI 策略正文。
- `randomizer/app.js` 在 `SetiHeadlessRuntimeConfig.enabled` 下必须跳过 DOM 收集、事件绑定、浏览器持久化与 shell 初始化；规则 runtime 只能通过注入的 no-op view 接口感知无界面模式。
- `randomizer/app/render-runtime.js`：承接卡牌 hover、玩家/对手面板、手牌/保留牌、数据板、状态读出、火箭/marker、棋盘坐标转换与引用贴图适配；`app.js` 只保留渲染调度和跨 flow 刷新组合。

## 仍需拆分的高耦合区

- AI 控制状态与调度位于 `randomizer/app/ai/control-runtime.js`；pending resolver 与 action executor 位于 `randomizer/app/ai/**`；纯估值、目标/需求、规划、竞速和候选构建位于 `randomizer/game/ai/**`。app AI runtime 通过窄显式 context 调用 UI flow，game AI 模块不得读取 DOM。
- `randomizer/app/aliens/species-runtime.js` 当前 4,367 行，边界是八物种共用机会队列、dialog、followup 与面板运行域；后续应按物种或 rewards/dialogs/render 子域继续拆，并保持共用队列单一所有者。
- `randomizer/app/ai-controller.js` 在 Stage 5 收口后为 1,968 行；四个 pending/action runtime 均低于 3,000 行，controller context 缺项会在装配时直接失败。最终行数、测试拆分与删除证据见 `docs/ai-controller-migration-stage5.md`。
- 行动日志状态与 DOM 展示已经由 `action-log-runtime` 接管，恢复快照与持久化包由 `game-recovery` 接管；`app.js` 仍保留跨全部 pending 状态的恢复清理与全 UI 刷新调度。
- 卡牌、收入、扫描和任务触发的 `pending*` 已按 runtime/flow 收口；新增相关选择应扩展所属 runtime，并通过 `app.js` 注入跨域 continuation，避免重新把具体确认/取消分支堆回总装配层。

## 后续拆分原则

- 保持无构建、全局命名空间风格，除非一次性迁移计划明确覆盖全部脚本加载顺序和测试方式。
- 从 `app.js` 抽代码时优先选择低耦合边界：静态配置、DOM 注册、事件绑定、公开调试 API、日志渲染、AI 自动机适配层。
- 规则语义仍落在 `randomizer/game/**` 或对应机制文档；`app.js` 只负责把 UI 操作路由到规则模块并把结果展示出来。
- 抽出的 app 模块应采用 `window.SetiApp*` 命名，必要时同时支持 `module.exports`，方便 Node 语法检查或后续单测。
- 大块迁移不要顺手改规则、文案或常量值。先做无行为移动，通过回归后再做功能性调整。

## AI Stage 1 迁移记录

- 行数：`app/ai-controller.js` 从 Stage 0 的 22,960 行降为 22,434 行；新增 `app/ai/control-runtime.js` 659 行，低于 3,000 行边界。
- 控制状态与配置：迁出 `aiAutoBattleState`、scheduler 四状态、`normalize/get/applyAiDifficulty*`、`configureDefaultAiOpponent`、`configureAiAutoBattle` 和玩家解析/配置函数。
- 策略权重与 seed：迁出权重默认值、`get/normalize/configure/resetAiStrategyWeights`、难度默认权重选择、`hash/create/runWithAiRandomSeed` 与 `getAiBatchSeed`。
- 快照与调度：迁出 `create/restoreAiControlSnapshot`、恢复 fallback/disable、pending owner/automation player 判定、自动运行开关、`schedule/runScheduledAiAutoStep`。
- 保持边界：具体 pending resolver、候选估值、自动对战循环、批跑/A/B/调参仍在 `ai-controller.js`；runtime 只通过显式 state/getter/callback 注入访问它们。

## AI Stage 2 迁移记录

- 行数：`app/ai-controller.js` 从 22,434 行降为 21,089 行；新增 `battle-log.js` 223 行、`battle-report.js` 175 行、`tuning-history.js` 221 行、`experiment-runner.js` 932 行，均低于 3,000 行边界。
- 日志/报告：迁出日志 compact/record/bug、player result、pending 汇总与 report/progress/analysis schema。
- 调参/runner：迁出 history persistence、recommendation/apply，以及 single battle、batch、同 seed A/B 和 tuning cycle。
- 保持边界：controller API、默认值、seed 派生、权重恢复、bug/block 判定和报告 schema 保持不变；controller 只以显式 context 装配领域 runtime。

## AI Stage 3 迁移记录

- 规则边界：资源/收入/交易、卡牌/任务、扫描/数据、路线/星球、科技、终局节奏与外星人估值均通过显式 context 迁入 `game/ai/**`；app 层只保留 pending、DOM、确认/执行和顶层行动 adapter。
- 行数：`app/ai-controller.js` 从 21,089 行降为 5,686 行；`app/ai-controller.test.js` 从 10,295 行降为 1,033 行，完整集成回归迁至 `ai-controller.integration.test.js`。
- 删除证据：`game/ai/ai-domain-migration.test.js` 校验迁移函数体不再出现在控制器、生产模块不读 DOM、单模块少于 3,000 行且浏览器入口已装配。

## AI Stage 4 迁移记录

- resolver：初始/收入/弃牌/PASS/卡牌选择与触发迁入 `initial-card-pending.js`；移动、扫描、数据、科技、公司与外星人 pending 迁入 `interaction-pending.js`。
- executor：顶层候选执行迁入 `action-executor.js`，pending 优先级、效果恢复与 `runAiAutomationStep` 迁入 `automation-runtime.js`。
- 状态边界：pending 与回合状态继续由 `app.js` 单一持有；四个模块只接收按 `REQUIRED_CONTEXT_KEYS` 筛选后的显式 context。
- 删除证据：控制器 5,686 → 1,961 行；`app/ai/pending-domain-migration.test.js` 校验函数体删除、浏览器装配、行数和状态所有权。

## AI Stage 5 收口记录

- composition：controller 按 runtime 的 `REQUIRED_CONTEXT_KEYS` 严格校验并注入 context，缺失依赖不再被静默过滤；深空换牌阈值按既有口径 `10` 补入显式 binding。
- 测试：10,295 行集成测试拆为 pending、alien、action、strategy 四份 2,500 行以内的领域回归，共享 harness/fixture 独立维护；automation 与 action executor 增加直接模块契约测试。
- 最终边界：controller 22,960 → 1,968 行，稳定 API、headless/public API 调用方式、固定 seed 摘要与 pending 顺序保持不变；完整证据见 `docs/ai-controller-migration-stage5.md`。

## 验证要求

- 修改 `randomizer/app/**` 或 `randomizer/app.js` 后，至少运行对应 `node --check`。
- 若变更影响脚本加载、DOM 查询、事件绑定或首屏初始化，需要用本地静态服务器做浏览器烟测。
- 跨流程拆分时运行 `randomizer/**/*.test.js` 全量 Node 回归。
