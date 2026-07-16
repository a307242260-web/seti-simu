# App 架构边界

本文档说明浏览器入口层的职责边界。这里的 app 指 `randomizer/index.html` 加载后由 `randomizer/app/**` 和 `randomizer/app.js` 组成的页面装配层；核心规则仍以 `randomizer/game/**` 为准。

如果你需要看“当前 app 层到底还剩哪些逻辑、top-down 模块该怎么拆”，优先再读 [docs/app-topdown-architecture.md](./app-topdown-architecture.md)。

## 当前加载层次

1. `randomizer/index.html` 按传统 `<script>` 顺序加载，无构建步骤，也不使用 ES module。
2. `randomizer/solar-system/**`、`randomizer/game/**` 先注册各自的 `window.Seti*` 全局模块。
3. `randomizer/app/alien-trace-reward-flow.js` 编排痕迹奖励的方舟解锁、面板放置与无目标落空分支。
4. `randomizer/app/dependencies.js` 收集并校验 app 层需要的全局模块。
5. `randomizer/app/constants.js` 创建 app 层静态配置、图标路径、扫描/扇区奖励表和 UI 参数。
6. `randomizer/app/dom.js` 集中查询页面上的固定 DOM 节点。
7. `randomizer/app/events.js` 绑定页面事件、overlay 点击分发、拖拽回调和 resize 入口。
8. `randomizer/app/start-screen.js` 处理开始界面选项同步、入口按钮和继续游戏恢复。
9. `randomizer/app/turn-flow.js` 处理 turnState 初始化、新局随机化和 round / turn 推进壳层；`turn-end-flow.js` 处理 PASS 队列、回合末外星人揭示与跨轮收尾。
10. `randomizer/app/card-runtime.js`、`card-trigger-runtime.js`、`income-runtime.js` 与 `scan-flow.js` 承接卡牌交互、任务触发、收入和扫描运行域。
11. `randomizer/app/tech-runtime.js` 与 `industry-runtime.js` 承接科技选择、公司能力、被动奖励及其 pending/history 回滚运行域。
12. `randomizer/app/action-briefing.js` 封装 AI 行动简报的条目归纳、scan 目标摘要和 overlay 渲染控制器。
13. `randomizer/app/action-log-export.js` 生成行动日志 Markdown 和下载文件名。
14. `randomizer/app/action-log-runtime.js` 封装行动日志 draft/entry 组装与日志导入等纯运行时逻辑。
15. `randomizer/app/game-recovery.js` 封装恢复快照、本地持久化包读写与恢复应用适配。
16. `randomizer/app/public-api.js` 组装 `window.SetiRandomizer` 调试/外部脚本 API。
17. `randomizer/app/ai-controller.js` 封装 AI 自动机、策略权重、批跑/AB 测试和 AI 决策控制器；`final-score-ai-runtime.js` 单独承接终局板块估值与竞速模型适配。
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
- `randomizer/app/ai-controller.js`：AI 层。内部维护 AI 批跑状态、策略权重和需求缓存；需要读取 app pending 状态时通过 `state` getter/setter，不要在模块内复制 pending 值。
- `randomizer/app/effects/movement-scan.js`：移动、行星落点、轨道/登陆、扇区扫描和相关选择执行器。
- `randomizer/app/effects/rewards.js`：资源、数据、抽牌、条件奖励、手牌选择和科技/扫描奖励执行器。
- `randomizer/app/effects/aliens.js`：异常点、虫和奥陌陌的效果执行器及 continuation 适配。
- `randomizer/app/effects/dispatcher.js`：卡牌、星球奖励、科技、公司和扫描 effect 的顶层分发；不得在 `app.js` 重建巨型 type switch。
- `randomizer/app/card-runtime.js`：卡牌选择、打牌/弃牌、角标快速行动、卡牌移动、公共牌控制与 PASS 预留选择；相关 pending 的确认、取消和继续选择在模块内闭环。
- `randomizer/app/card-trigger-runtime.js`：任务就绪、1 型触发、任务确认、奖励队列和触发后的续跑；不在 `app.js` 复制任务/触发分支。
- `randomizer/app/income-runtime.js`：弃牌收入、收入资源发放、轮开始公司收益和原教旨主义轮开始收入队列。
- `randomizer/app/scan-flow.js`：公共牌/手牌扫描、扫描目标、扇区结算、延迟补牌及扫描收尾；扫描 pending 的确认、取消和续跑在该 flow 内完成。
- `randomizer/app.js`：composition root 与跨 flow 顶层总控。可以维护状态所有权、组合规则模块、调度 continuation 和注入 context，但不应再新增卡牌/收入/扫描/任务触发、外星人/公司/debug、具体渲染、公开 API 或 AI 策略正文。
- `randomizer/app/render-runtime.js`：承接卡牌 hover、玩家/对手面板、手牌/保留牌、数据板、状态读出、火箭/marker、棋盘坐标转换与引用贴图适配；`app.js` 只保留渲染调度和跨 flow 刷新组合。

## 仍需拆分的高耦合区

- AI 自动机已通过 `createAiController(context)` 迁入 `randomizer/app/ai-controller.js`，但它仍通过一组显式回调调用 app 的 UI 流程。后续若要继续解耦，应优先把“读取局面”“列出候选”“执行选择”下沉为更窄的决策总线，而不是在 AI 模块里直接新增 DOM 选择逻辑。
- `randomizer/app/aliens/species-runtime.js` 当前 4,367 行，边界是八物种共用机会队列、dialog、followup 与面板运行域；后续应按物种或 rewards/dialogs/render 子域继续拆，并保持共用队列单一所有者。
- `randomizer/app/ai-controller.js` 约 22,960 行，是既有超大控制器；终局板块估值已迁至 `final-score-ai-runtime.js`，后续按 observation/candidates/decision/batch analytics 拆分。
- 行动日志状态与 DOM 展示已经由 `action-log-runtime` 接管，恢复快照与持久化包由 `game-recovery` 接管；`app.js` 仍保留跨全部 pending 状态的恢复清理与全 UI 刷新调度。
- 卡牌、收入、扫描和任务触发的 `pending*` 已按 runtime/flow 收口；新增相关选择应扩展所属 runtime，并通过 `app.js` 注入跨域 continuation，避免重新把具体确认/取消分支堆回总装配层。

## 后续拆分原则

- 保持无构建、全局命名空间风格，除非一次性迁移计划明确覆盖全部脚本加载顺序和测试方式。
- 从 `app.js` 抽代码时优先选择低耦合边界：静态配置、DOM 注册、事件绑定、公开调试 API、日志渲染、AI 自动机适配层。
- 规则语义仍落在 `randomizer/game/**` 或对应机制文档；`app.js` 只负责把 UI 操作路由到规则模块并把结果展示出来。
- 抽出的 app 模块应采用 `window.SetiApp*` 命名，必要时同时支持 `module.exports`，方便 Node 语法检查或后续单测。
- 大块迁移不要顺手改规则、文案或常量值。先做无行为移动，通过回归后再做功能性调整。

## 验证要求

- 修改 `randomizer/app/**` 或 `randomizer/app.js` 后，至少运行对应 `node --check`。
- 若变更影响脚本加载、DOM 查询、事件绑定或首屏初始化，需要用本地静态服务器做浏览器烟测。
- 跨流程拆分时运行 `randomizer/**/*.test.js` 全量 Node 回归。
