# App 架构边界

本文档说明浏览器入口层的职责边界。这里的 app 指 `randomizer/index.html` 加载后由 `randomizer/app/**` 和 `randomizer/app.js` 组成的页面装配层；核心规则仍以 `randomizer/game/**` 为准。

如果你需要看“当前 app 层到底还剩哪些逻辑、top-down 模块该怎么拆”，优先再读 [docs/app-topdown-architecture.md](./app-topdown-architecture.md)。

浏览器的 View、Input Adapter、ViewState、可见性边界和 proof obligations 见 [docs/browser-host-ui.md](./browser-host-ui.md)。本文件与该契约都描述当前生产装配。

Standard Action 的 app 装配边界由 `app/action-runtime.js` 统一承载：浏览器 DOM 的 `standard_intent` 只解析唯一 descriptor，浏览器 AI 与训练宿主直接取得完整 descriptor，并交回同一 `registry.execute`。旧 Browser AI action executor 已删除；`app/simulation-contract.js` 只补 RL feature、mask 与版本字段并沿用 registry `actionId`。UI picker、AI valuation 和训练 policy 都不得在 adapter 外预扣资源或执行规则。

Primary Board 的 `launch`、`move`、`orbit`、`land` 由 `app/primary-board-action-executor.js` 统一接收 Browser authority 的显式 working root 与 Standard Action descriptor。Browser 按钮和 AI descriptor 都经 `action-runtime` 进入该 executor；移动支付仍由宿主收集，但最终规则写入也回到同一 executor。该边界不读取 DOM、旧 Decision store 或 `app.js` 全局规则 slice，stale 与失败不得污染传入 root。

通用 pending 容器和字段豁免表不属于生产架构。规则选择与流程状态只进入 Browser Composition working root / Effect Session；PASS overlay 的临时关闭状态位于 `runtime.ui`，扫描关联序号位于 `runtime.browserHost`。

机器玩家公共选择边界位于 `game/ai/policy-port.js`：Browser/Simulation Host 负责构造当前 viewer 的只读 `DecisionContext`、控制 deadline/AbortSignal/恢复失效，并在 `PolicyDecision` 返回后调用公共 validator；Policy 不依赖 app、DOM、Effect Session 或 StateStore。Host 只有在 validator 与 registry 复核通过后才能显式提交 descriptor。详见 `docs/policy-port-contract.md`。

## 当前加载层次

1. `randomizer/index.html` 按传统 `<script>` 顺序加载，无构建步骤，也不使用 ES module。
2. `randomizer/solar-system/**`、`randomizer/game/**` 先注册各自的 `window.Seti*` 全局模块。
3. `randomizer/app/alien-trace-reward-flow.js` 编排痕迹奖励的方舟解锁、面板放置与无目标落空分支。
4. `randomizer/app/dependencies.js` 收集并校验 app 层需要的全局模块。
5. `randomizer/app/constants.js` 创建 app 层静态配置、图标路径、扫描/扇区奖励表和 UI 参数。
6. `randomizer/app/dom.js` 集中查询页面上的固定 DOM 节点。
7. Browser 生产入口直接装配真实 DOM/render runtime，并只通过 `BrowserProjection.resident` 的深冻结 selector 读取规则视图；Simulation 直接创建 rules-only Composition，不加载 `app.js`，生产入口不再保留 `simulationMode` 或 no-op DOM/view adapter 分支。
8. `randomizer/app/events.js` 绑定页面事件、overlay 点击分发、拖拽回调和 resize 入口。
8. `randomizer/app/start-screen.js` 处理开始界面选项同步、入口按钮和继续游戏恢复。
9. `randomizer/app/rule-composition.js` 建立 Browser 唯一 StateStore、Standard Action registry、Effect runtime 与 active Session；`randomizer/app/turn-flow.js` 只通过其 lifecycle 重置新局并处理随机化和 round / turn 推进壳层；`turn-end-flow.js` 处理 PASS 队列、回合末外星人揭示与跨轮收尾。
10. `randomizer/app/card-runtime.js`、`card-trigger-runtime.js`、`income-runtime.js` 与 `scan-flow.js` 承接卡牌交互、任务触发、收入和扫描运行域。
11. `randomizer/app/tech-runtime.js` 与 `industry-runtime.js` 承接科技选择、公司能力、被动奖励及其 pending/history 回滚运行域。
12. `randomizer/app/action-briefing.js` 封装 AI 行动简报的条目归纳、scan 目标摘要和 overlay 渲染控制器。
13. `randomizer/app/action-log-export.js` 生成行动日志 Markdown 和下载文件名。
14. `randomizer/app/action-log-runtime.js` 封装行动日志 draft/entry 组装与日志导入等纯运行时逻辑。
15. `randomizer/app/game-recovery.js` 封装恢复快照、本地持久化包读写与恢复应用适配。
16. `randomizer/app/public-api.js` 组装 `window.SetiRandomizer` 调试/外部脚本 API。
17. `randomizer/app/ai/control-runtime.js` 封装机器席位配置、快照/恢复与调度；`ai/browser-bootstrap.js` 独占 Browser Machine Player Host、Composition boundary reader 与 PolicyInputAdapter 装配。Browser 不加载 action executor / automation runtime，也不暴露 candidate、selector、pending automation 或 batch/A-B API；`ai-controller.js` 只保留控制与估值 helper 装配。
18. `randomizer/app/conditional-decision-domain.js` 构建条件动作的 owner/version/choices/followup；`conditional-action-executor.js` 只负责 descriptor 校验、stale 检查和失败原子恢复。`randomizer/app/effects/**` 继续按移动扫描、奖励选择、外星人和顶层分发四个域注册具体 effect executors。
19. `randomizer/app/alien-ui.js` 封装外星人揭示提示、痕迹 picker、方舟用途分流与各物种面板放置模式 UI。
20. `randomizer/app/aliens/species-runtime.js` 封装八种外星人的奖励、牌获取/任务 dialog、机会队列、followup 和具体面板渲染，通过显式 context 接收跨域依赖。
21. `randomizer/app/action-interaction-runtime.js` 承接冥王星行动、移动箭头 UI 与数据放置 picker。
22. `randomizer/app/score-source-runtime.js` 承接初始、扫描、科技、外星人和行动效果的分数来源账本及撤销命令。
23. `randomizer/app.js` 保留 composition、跨域流程接线、渲染调度和各控制器装配；规则提交、Effect working state 与 Policy 请求分别由公共 owner 管理。常驻玩家统计与 readout 已进入 `browser-host/player-stats-ui.js`，Action Bar/quick panel/effect bar 进入 `browser-host/action-bar.js`，下载进入 `browser-host/browser-services.js`，布局、交互焦点和恢复 chrome 进入 `render-runtime.js`，初始选择 UI/readout 进入 `start-screen.js`，登陆 picker 与扫描行动 picker 分别进入 `action-interaction-runtime.js`、`scan-flow.js`。

## 文件职责

- `randomizer/app/runtime.js`：创建 Decision Session、纯 UI 状态与 Browser Host 内部状态；不得恢复通用 `pending` 容器或把规则事实塞入 UI/host state。
- `randomizer/app/browser-rule-composition.js`：把 Browser working-state adapter、committed/save metadata 与 rules-only Composition factory 连接起来；不读取 DOM、恢复 UI、AI controller 或领域 renderer。
- `randomizer/app/render-runtime.js`：传统 DOM renderer 的兼容外壳；生产 context 只接收 `getProjection()`、纯 ViewState 与显式 capability inventory 中的纯模块、DOM-only helper、标量/新 DTO selector、输入 callback，不接收 `browserRuleState/workingState/playerState/turnState/cardState/...` 或复合 root reader/writer。未分类能力在生产 bootstrap 时 fail-fast；对象型窄 selector 必须在 composition 边界返回新 identity。旧领域 readout 若会 normalize 输入，只能处理 projection 的一次性克隆；补牌、机会排队、AI 调度等规则推进不得由 renderer 触发。
- `randomizer/app/rule-composition.js`：Browser 唯一规则 composition；内部独占 StateStore、Standard Action registry、Effect runtime 与 active Session，向生产 caller 只暴露 `inputPort`、只读 projection/state source 和 `lifecycle.newGame/save/validateRestore/restore`。稳定 working root 由 composition 内部 state adapter 原位水合，宿主不得执行 slices 回灌；Browser Services 与 GameRecovery 只接受 composition save envelope，旧 StateStore-only schema fail-closed。
- `randomizer/app/primary-board-action-executor.js`：四类盘面行动的 working-root 生产 executor；只接受显式 root、descriptor 与规则模块能力，原子保护失败路径，不拥有 UI、Decision 或 composition lifecycle。
- `randomizer/app/engine-action-executor.js`：科技、扫描、分析、打牌四类引擎行动的 working-root 生产边界；科技/分析在边界内直连规则 action/ability，扫描与打牌分别下沉到 `scan-flow.js` / `hand-flow.js` 的显式 root 入口，`app.js` 只负责装配。Browser 与 AI 的 Standard Action descriptor 共用该原子入口，支付、目标校验及返回的 Effect/history/result 均绑定 caller 传入的 root，UI 只保留选择与渲染续接。
- `randomizer/app/quick-turn-action-executor.js`：快速交易、公司 1x、弃牌角标、放置数据、符文族面部 symbol、PASS 与结束回合的 working-root 生产边界。Browser/AI 的 descriptor 共用同一原子入口；Quick family 只写 caller root 与 quick history，不推进 turn，PASS 只完成主行动，只有 `end_turn` 推进 turn/current player；stale 与失败会恢复完整 working root。
- `randomizer/app/conditional-decision-domain.js`：扫描/卡牌、公司/外星人、科技/终局等 conditional family 的 owner、choices 与 followup 唯一生产定义；通过显式 context 调用既有领域 continuation，不拥有第二份状态。
- `randomizer/app/conditional-action-executor.js`：七类 conditional family 的 descriptor validation 与 working-root 原子边界。Browser、Policy 与 replay 提交同一个 Standard Action/Decision identity；stale、未知 followup、规则失败或异常均 fail-closed 并恢复完整 working root。宿主恢复产生的 composition stateVersion 不覆盖 Effect Session 内已确认的 domain decision identity。
- `randomizer/app/dependencies.js`：唯一的 app 入口依赖表。新增或删除 `window.Seti*` 依赖时先改这里，让脚本顺序错误能尽早报错。
- `randomizer/app/browser-host/decision-ui.js`：统一 Decision shell、renderer registry、科技 presentation 与 focus/confirm/cancel intent；只消费 `BrowserProjection + ViewState`，不得枚举领域合法项或续跑 Effect queue。
- `randomizer/app/browser-host/action-bar.js`：统一 Standard Action/undo controls，并承接传统 Action Bar、quick panel 与 Effect Bar 的 DOM presentation；只通过注入的窄 selector/port 读取状态和提交输入，不持有 working root。
- `randomizer/app/browser-host/browser-services.js`：承接恢复 envelope、local persistence、下载和 debug/public facade 窄端口；Browser 下载端口独占 Blob/URL/临时节点生命周期。
- `randomizer/app/browser-host/industry-alien-decision-ui.js`：公司与八物种的领域 presentation registry；只把标准 Decision choices 映射为公司、痕迹、机会、牌、任务和分支视图，不读取旧 pending 或领域 continuation。
- `randomizer/game/effects/industry-alien-session.js`：公司/外星人 Decision schema 与 Effect Session adapter；机会队列、痕迹奖励、followup、history/rollback 由 session journal/priority/barrier 统一负责。
- `randomizer/app/alien-trace-reward-flow.js`：只决定痕迹奖励应进入方舟解锁、面板放置还是无目标落空；无目标时必须结束当前奖励节点，包括 `required` / 不可跳过节点。
- `randomizer/app/constants.js`：只放静态常量和依赖派生常量。不要在这里读写游戏状态、DOM 或 pending 流程。
- `randomizer/app/dom.js`：只收集固定 DOM 元素和 NodeList。新增 HTML id、overlay、按钮或常驻区域时先在这里登记。
- `randomizer/app/events.js`：只做事件到 app 回调的路由。新增按钮、overlay、拖拽入口时优先改这里；不要在这里实现规则结算。
- `randomizer/app/start-screen.js`：处理开始界面选项、继续游戏入口、新局入口壳层与初始选择 Browser Host adapter；规则结算仍委托 `action-runtime`，不得复制恢复逻辑。
- `randomizer/app/turn-flow.js`：只通过 Browser Rule Composition lifecycle 重置新局，并处理随机化和回合推进壳层；不得再直接创建或恢复各领域长期 state。
- `randomizer/app/turn-end-flow.js`：处理 PASS 必做效果队列、回合末外星人揭示 continuation、收入与跨轮刷新；通过显式 context 调用所属规则/runtime。
- `randomizer/app/action-interaction-runtime.js`：处理冥王星交互、移动箭头和数据放置 picker；不拥有规则状态，所有状态和 continuation 均由 composition root 注入。
- `randomizer/app/score-source-runtime.js`：处理分数来源账本、扫描/初始选择记账和 history 撤销命令；只写调用方显式 player/root，不读取 DOM。
- `randomizer/app/final-score-ai-runtime.js`：处理终局板块候选估值、可行性惩罚和竞速调整；不维护 AI 自动机状态。
- `randomizer/app/action-briefing.js`：只处理 AI 行动简报的数据归纳、摘要文案和 overlay 开关；不要在这里执行规则结算或直接修改行动日志源数据。
- `randomizer/app/alien-ui.js`：只处理外星人揭示弹层、痕迹选择器、方舟分流和“进入某物种放置模式”的 UI 壳层；不实现物种奖励、dialog 或具体面板渲染。
- `randomizer/app/aliens/species-runtime.js`：处理物种奖励、外星人牌获取、虫族任务、九折/半人马机会、符文 symbol、followup 和具体面板渲染，并由 `createAlienSpeciesPort` 统一区分只读/DOM 调用与 Composition host command。Browser 装配只接受 `stateQuery`、`decisionInput`、`history`、`legality`、`render`、`speciesRules`、`constants` 七个显式窄 port，并在创建期按 `port.key` 校验缺项；禁止从 dependencies/runtime sources 按同名键搜索或拼成共享 capability bag。
- `randomizer/app/tech-runtime.js`：处理科技供应区选择、蓝槽 picker、确认/取消/undo 恢复和海盗科技标记交互；规则判断仍委托 `game/tech/**` 与 `game/industry/**`。
- `randomizer/app/industry-runtime.js`：处理公司能力与被动的 UI/pending/history 编排；公司规则、数值和文案继续由 `game/industry/**` 提供。
- `randomizer/app/action-log-runtime.js`：处理行动日志草稿、步骤、entry、导入组装及日志列表/tab 的 DOM 展示；通过显式参数接收 turn/player/history 与 view 上下文，不直接抓 app 闭包。
- `randomizer/app/action-log-export.js`：只做纯 Markdown 格式化和文件名生成，不读 DOM、不读取隐藏牌序，也不触发浏览器下载。
- `randomizer/app/game-recovery.js`：只处理恢复快照、本地存档包和恢复流程适配；规则状态、活跃 Session、RNG 与确定性序列统一由 Browser Composition lifecycle 原子保存/恢复，模块不接受 StateStore-only snapshot，也不在 composition 外回灌序列。UI 刷新通过显式回调注入。
- `randomizer/app/public-api.js`：只组装 `window.SetiRandomizer` 的 Browser/debug 窄 facade，不暴露 Simulation reset/step/checkpoint/Decision API，也不返回 mutable working root。
- `randomizer/app/ai/control-runtime.js`：机器席位控制层。唯一持有席位配置、scheduler 标志与策略权重；scheduler 只请求 Browser Machine Player Host 执行一次公共 Policy 输入，不读取或解析旧 pending。
- `randomizer/app/ai/browser-bootstrap.js`：Browser Machine Player 装配边界。从 Composition inspection/projection 构造 Action/Decision boundary，连接公共 PolicyInputAdapter/Machine Player Host 和 BrowserInputAdapter；人类席位拒绝创建 Policy 请求，lifecycle 变化统一使在途 generation 失效。
- `randomizer/app/ai/battle-log.js`：AI 对战日志 compact、entry、bug 计数与玩家/比分快照。
- `randomizer/app/ai/battle-report.js`、`tuning-history.js`、`experiment-runner.js`：历史诊断、报告和离线实验实现；不在 `window.SetiRandomizer` 暴露 Browser 生产入口，也不参与机器席位推进。
- `randomizer/app/ai/initial-card-pending.js`、`interaction-pending.js`：迁移期遗留的估值 helper 容器；Browser controller 只消费仍有调用者的纯估值/检查能力，不暴露其中的 pending resolver。
- `randomizer/app/ai-controller.js`：控制与估值 helper 装配 adapter；对 Browser 只返回席位配置/快照/调度和仍有生产 caller 的只读估值能力，不构造或暴露旧 action executor、automation runtime、candidate selector 或 pending automation。
- `randomizer/app/effects/movement-scan.js`：移动、行星落点、轨道/登陆、扇区扫描和相关选择执行器。
- `randomizer/app/effects/rewards.js`：资源、数据、抽牌、条件奖励、手牌选择和科技/扫描奖励执行器。
- `randomizer/app/effects/aliens.js`：异常点、虫和奥陌陌的效果执行器及 continuation 适配。
- `randomizer/app/effects/dispatcher.js`：卡牌、星球奖励、科技、公司和扫描 effect 的顶层分发；不得在 `app.js` 重建巨型 type switch。
- `randomizer/app/effects/bootstrap.js`：按 movement/scan、reward、alien、dispatcher 四个 owner 建立隔离 capability scope 并装配 executor suite；缺失能力在创建期 fail-fast，领域 executor 不共享可枚举的巨型 context。
- `randomizer/app/card-runtime.js`：卡牌选择、打牌/弃牌、角标快速行动、卡牌移动、公共牌控制与 PASS 预留选择；相关 pending 的确认、取消和继续选择在模块内闭环。
- `randomizer/app/card-trigger-runtime.js`：任务就绪、1 型触发、任务确认、奖励队列和触发后的续跑；不在 `app.js` 复制任务/触发分支。
- `randomizer/app/income-runtime.js`：弃牌收入、收入资源发放、轮开始公司收益和原教旨主义轮开始收入队列。
- `randomizer/app/scan-flow.js`：公共牌/手牌扫描、扫描目标、扇区结算、延迟补牌及扫描收尾；扫描 pending 的确认、取消和续跑在该 flow 内完成。
- `randomizer/app.js`：Browser composition root。只收集依赖、实例化 Composition/Browser Host/领域 runtime、注入显式 context/handler 并启动页面；Host command switch、continuation、卡牌/收入/扫描/任务触发、外星人/公司/debug、具体渲染、公开 API 或 AI 策略正文均不得回流。
- `randomizer/app.js` 只负责 Browser UI 与 Browser composition 装配；Simulation 不加载该入口。
- `randomizer/app/render-runtime.js`：承接卡牌 hover、玩家/对手面板、手牌/保留牌、数据板、状态读出、火箭/marker、棋盘坐标转换与引用贴图适配；`app.js` 只保留渲染调度和跨 flow 刷新组合。

## 仍需拆分的高耦合区

- AI 控制状态与调度位于 `randomizer/app/ai/control-runtime.js`；Browser 推进只走 `browser-bootstrap` 的 Machine Player Host。纯估值、目标/需求、规划和竞速位于 `randomizer/game/ai/**`，game AI 模块不得读取 DOM。
- `randomizer/app/aliens/species-runtime.js` 当前 4,455 行，边界是八物种共用机会队列、dialog、followup 与面板运行域；后续应按物种或 rewards/dialogs/render 子域继续拆，并保持共用队列单一所有者。
- `randomizer/app/ai-controller.js` 仍有迁移期估值 helper 装配债务；旧 `action-executor.js` / `automation-runtime.js` 已物理删除，新增 Browser 接线不得恢复这两个全局模块或它们的 controller API。
- 行动日志状态与 DOM 展示已经由 `action-log-runtime` 接管，恢复快照与持久化包由 `game-recovery` 接管；`app.js` 仍保留跨全部 pending 状态的恢复清理与全 UI 刷新调度。
- 卡牌、收入、扫描和任务触发的 `pending*` 已按 runtime/flow 收口；新增相关选择应扩展所属 runtime，并通过 `app.js` 注入跨域 continuation，避免重新把具体确认/取消分支堆回总装配层。

## 后续拆分原则

- 保持无构建、全局命名空间风格，除非一次性迁移计划明确覆盖全部脚本加载顺序和测试方式。
- 从 `app.js` 抽代码时优先选择低耦合边界：静态配置、DOM 注册、事件绑定、公开调试 API、日志渲染、AI 自动机适配层。
- 规则语义仍落在 `randomizer/game/**` 或对应机制文档；`app.js` 只负责把 UI 操作路由到规则模块并把结果展示出来。
- 抽出的 app 模块应采用 `window.SetiApp*` 命名，必要时同时支持 `module.exports`，方便 Node 语法检查或后续单测。
- 大块迁移不要顺手改规则、文案或常量值。先做无行为移动，通过回归后再做功能性调整。

## AI Stage 1 迁移记录

以下 Stage 1～5 仅记录当时的拆分过程与旧文件归属，不描述当前 Browser 生产接线；当前边界以上文“当前加载层次 / 文件职责”为准。

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
- Stage 5 的 controller 拆分数字仅为历史迁移记录；当前 Browser 已进一步删除旧 action/automation 模块、public candidate/batch API 与 pending 顺序推进器，不能再把当时的稳定 API/pending 顺序描述当作现状。历史证据见 `docs/ai-controller-migration-stage5.md`。

## 验证要求

- 修改 `randomizer/app/**` 或 `randomizer/app.js` 后，至少运行对应 `node --check`。
- 若变更影响脚本加载、DOM 查询、事件绑定或首屏初始化，需要用本地静态服务器做浏览器烟测。
- 跨流程拆分时运行 `node tools/run_node_tests.js` 全量 Node 回归。
