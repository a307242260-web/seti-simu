# SETI 新架构完成账本

本账本记录全仓新架构迁移的可核对证据。已知残留只是审计起点，不是验收白名单；后续发现的任何旧架构实现、适配器、兼容入口、重复 owner、死亡接线或过时资料都必须纳入同一个收口目标。

## 最终完成条件

1. 生产规则只在 Effect Session canonical working state 上运行，并且只由 StateStore 提交 committed state。
2. Browser、Simulation、训练和 Policy 共用同一 Action、Decision、Effect、状态与恢复协议。
3. Browser 只持有 ViewState、服务和 viewer-safe projection，不持有规则事实或规则流程。
4. 全仓不存在旧架构实现、适配器、旁路、兼容 fallback、重复 owner、死亡生产接线或维护旧结构的测试和文档。
5. Node 行为测试、唯一 full-flow、真实 Chrome 动态交互、保存恢复和 Browser/Simulation parity 均由真实行为证据证明。
6. 最终从生产代码、测试、工具、文档、HTML、CSS 和入口清单重新执行独立全仓审计，审计结论不是“未发现明显问题”，而是逐项证明上述义务成立。

## 可重复基线

运行：

```sh
node tools/report_architecture_residuals.js
```

该报告只负责持续量化已识别的残留族群，不单独构成完成证明。2026-07-25 的初始审计还确认：

- 生产 JavaScript 均可由 Browser script 或 Node 生产入口到达；“被加载”不能代替真实生产消费者证明。
- Standard Action registry 当前登记 22 个 family，Effect Session 当前登记 5 个 production domain。
- Node 当前 61/61 unit、1/1 full-flow 通过；Chrome smoke 最近一次为 3/3，但 smoke 中部分展示检查只验证静态容器或空 DTO 存在，M4/M5 仍需重做动态证据。
- `randomizer/app/dom.js` 的 160 个顶层 DOM key 中，有 131 个在生产 JavaScript 中没有静态消费者。

## 里程碑账本

| 里程碑 | 审计基线 | 完成证明 | 当前状态 |
|---|---|---|---|
| M1 canonical state | 长期旧 `workingState`、`stateAdapter/projectWorkingState`、旧 root slice 名和模块级序列仍在生产路径 | 规则 domain 直接消费 Session canonical state；上述设施物理删除；恢复、反事实与提交只操作同一 schema | 已完成：5 个已识别残留族群均为 0；61/61 unit、1/1 full-flow |
| M2 Session / ViewState | `pendingDecision`、`initialIncomeQueue`、card/tech UI selection、规则层 `statusNote` 仍存在 | 所有流程状态归 Effect Session Decision/queue；展示状态只归 Browser ViewState/Projection | 进行中：并行决策状态已从 28 处清到 0；规则层展示状态候选仍有 40 处 / 5 文件 |
| M3 旧执行设施 | Action History、History Commands、Ability Chain、无消费者 readout、`actionEffectFlow` 仍被加载或导出 | 文件、script、import/export、调用、专属测试和文档接线全部删除 | 未完成 |
| M4 Browser 外延 | 多组 projection DTO 为空；大量旧 DOM/HTML/CSS 无生产消费者 | 真实盘面、数据、科技、外星人、卡牌、计分均由新 projection 动态呈现和输入；旧 UI 物理删除 | 未完成 |
| M5 验收与资料 | 当前 Chrome smoke 存在静态容器假阳性；当前文档仍描述已删除或尚未成立的边界 | 动态行为、恢复、parity 和负向 owner 证据成立；当前文档与代码一致；最终全仓审计通过 | 未完成 |

## 实施记录

### 2026-07-25：建立基线并删除第一批旧执行设施

- 新增可重复残留报告 `tools/report_architecture_residuals.js`；它是量化工具，不是完成门禁。
- 物理删除 `game/abilities/chain.js`、`game/history/action-history.js`、`game/history/commands.js` 及旧设施专属测试。
- 删除 Browser script、production kernel、abilities index 和 Node test inventory 中的全部生产接线。
- 删除规则结果中的 undo closure；Standard Action 的纯数据 `history` 现在进入 Effect Session journal，不再被旧兼容过滤器丢弃。
- 删除无意义的 `meta.sequences.historyStep`，并更新固定 full-flow checkpoint。
- `legacyExecutionFacilities` 从 16 处 / 10 文件下降到 1 处 / 1 文件；剩余项是 `actionEffectFlow`。
- 生产 JavaScript 从 118 个下降到 115 个；`legacyRootSlices` 从 1476 处 / 36 文件下降到 1399 处 / 35 文件，其中本轮下降来自旧 commands 实现删除，不代表 M1 已迁移。
- 完整回归通过：62/62 unit、1/1 full-flow、3/3 真实 Chrome smoke。

### 2026-07-25：删除剩余已知旧展示桥与 readout API

- 删除 `actionEffectFlow -> actionEffectPresentation -> effectPresentation` Browser 兼容投影链；Effect/Decision 展示只允许来自当前 Session inspection。
- 删除终局计分、宇宙战略集团、赫利昂和扇区结算中无生产消费者的文本 readout API，以及对应导出和结构型测试断言。
- `legacyExecutionFacilities` 从 1 处 / 1 文件下降到 0；这只证明已识别的旧执行设施族清零，M3 仍需完成全生产导出消费者审计后才能关单。

### 2026-07-25：删除模块级实体编号 owner

- 新增唯一 `game/state/sequences.js`，所有生产实体编号只从当前 canonical `meta.sequences` 读取和递增。
- 删除卡牌、数据 token、星云 token/替换顺序、终局标记、手牌占位和火箭的模块闭包序列，以及全部 get/restore 接口和恢复接线。
- 删除 `pieces.nextRocketId`；火箭编号不再同时存在于 pieces 和 committed metadata。
- 删除已经失去测试对象的 `deterministic-sequences.test.js`；checkpoint、反事实 fork 和 full-flow 现在直接验证 canonical 序列。
- 已识别模块闭包编号 owner 从 90 处 / 12 个生产文件下降到 0；全仓审计同时新增识别出 standalone/recovery 的本地编号 fallback，已单列为 `localIdentityFallbacks`，因此 M1 仍未完成。
- 完整 checkpoint 结构差异仅为删除无消费者的 `meta.sequences.handCard`，最终权威盘面逐字段无变化；固定 checkpoint hash 已据此更新。
- Node 回归通过：61/61 unit、1/1 full-flow；真实 Chrome smoke 3/3 通过。

### 2026-07-25：删除无 canonical root 的本地编号 fallback

- 卡牌 deck 不再扫描现有容器自行生成 `card-local-*`；所有规则卡牌必须取得 canonical root 或由调用方提供绑定该 root 的 factory。
- 修复 `initializeDeck()` 未向起手牌和公共牌创建继续传递 canonical factory 的生产缺口。
- 数据 token 不再从局部 token 数组推导下一编号，也不再根据 `resources.availableData` 静默合成 `data-token-recovered-*`。
- 星云 token、星云替换顺序和终局标记不再从局部领域状态推导编号；缺少 canonical root 时直接失败。
- `localIdentityFallbacks` 从 12 处 / 3 个生产文件下降到 0；此外删除了此前未被该模式捕获的 1 个星云通用 fallback。
- 新审计发现正式发牌前仍会创建并立即丢弃一批 PASS 牌来维持历史 RNG 轨迹，已单列为 `redundantInitializationCompatibility`，因此 M1 仍未完成。
- Node 回归通过：61/61 unit、1/1 full-flow；真实 Chrome smoke 3/3 通过。

### 2026-07-25：规则域直接切换到 Effect Session canonical state

- `createInitialState()` 现在直接创建唯一 canonical root；物理删除 session/committed 双结构转换、`stateAdapter`、`projectWorkingState` 和长期额外 working root。
- 生产规则、Effect domain、恢复、反事实 fork、Standard/Quick Action 统一直接读写 `meta/match/turn/players/solarSystem/pieces/planets/data/cards/tech/aliens/finalScoring`。
- 修复旧事件增强钩子覆盖 executor canonical `nextState` 的真实缺陷：后续卡牌触发现在继续作用于同一个 `nextState`，快速交易 11 信用/3 能量可正确提交为 9 信用/4 能量。
- 星云 token 只保存 owner、槽位和替换顺序；删除坐标、玩家标签、图片、时间戳、bucket 统计、旧位置修改与回滚 API。统计与排名改为按 canonical token 派生。
- 星球 marker 删除派生计数、展示序号和旧 piece 转换字段；特殊奖励槽只保存规则字段 `rewardSlot`，Browser 展示槽与碰撞偏移由读取时派生。
- 太阳系规则状态只保存 `rotation`；删除所有生产 `wheelSteps` 写入，Browser projection 从 rotation 派生。
- `legacyWorkingRoot` 从 87 处 / 2 文件下降到 0；`legacyRootSlices` 从 1391 处 / 35 文件下降到 0。
- `ruleOwnedPresentationState` 从 126 处 / 17 文件下降到 40 处 / 5 文件；剩余项必须逐个区分真实规则层展示状态和用于拒绝旧字段的门禁定义，不能把模式计数直接当作完成。
- `parallelDecisionState` 从 29 处 / 7 文件下降到 28 处 / 7 文件；该族属于 M2，尚未开始正式迁移。
- 本批修改 66 个文件，新增 1757 行、删除 2298 行，净删除 541 行；未新增 adapter、兼容 fallback 或第二状态 owner。
- 固定 full-flow 最终业务盘面逐字段不变；权威版本 8→7 是删除一次无状态变化的旧 adapter 提交，checkpoint hash 已更新为新的 canonical bytes。
- 验证通过：全部生产 JavaScript `node --check`、61/61 unit、1/1 full-flow、`git diff --check`。

### 2026-07-25：删除无业务消费者的 RNG 兼容初始化

- 删除正式卡牌初始化前创建并立即丢弃整套 PASS 牌堆的旧逻辑；随机源不再为维持历史 fixture 偏移而消耗。
- `redundantInitializationCompatibility` 从 1 处 / 1 文件下降到 0；至此 M1 的 `legacyWorkingRoot`、`legacyRootSlices`、`moduleLocalIdentityOwners`、`localIdentityFallbacks`、`redundantInitializationCompatibility` 全部为 0。
- 固定 seed 的实际牌局、起始资源和 Action identity 因删除无意义随机消耗而按新 RNG 轨迹变化；重新从真实合法集合固化 19 次输入的竖切，而非保留旧 actionId：10 个开局 Decision、发射、4 次移动及支付。
- 两个依赖旧随机偏移的测试改为行为断言：opening 选择当前真实 canonical 手牌实体；黄色痕迹在同根两个槽位同时证明“首枚 +1 宣传/+1 外星人牌”和“非首枚零奖励”。
- 本批生产代码净删除 11 行；连同 fixture 和测试共修改 4 个文件，新增 107 行、删除 97 行。
- 验证通过：61/61 unit、1/1 full-flow；最终 `blocked=false`、Effect Session 清空，19 次输入对应 19 份 journal。

### 2026-07-25：开局与快速交易切换到 Session Decision 队列

- `parallelDecisionState` 从 28 处 / 7 个生产文件下降到 0；全仓生产与测试均不再读写 `pendingDecision` 或 `initialIncomeQueue`。
- 开局收入的剩余支付项只保存在当前 `standard_action_session_decision` Effect payload；每次提交生成下一项具备新 `decisionId`/`decisionVersion`/owner 的 DecisionEffect，不再写入 `match`。
- 初始公司/资源牌选择在同一个 opening Session working state 内完成；最后一项收入结算后物理删除 `match.initialSetup` 和 `match.initialSetupConfig`，committed state 不保留 UI 选择或流程进度。
- 快速交易的弃牌、公共牌选择和盲抽通过 Effect payload 的 `decisionContext` 接力；资源交易、弃牌交易和弃牌后精选卡牌仍共用同一 Production registry/executor。
- 删除 probe、science、company、card-corner、runezu 等 domain 对 `match.pendingDecision` 的旧阻塞判断；活动 Session 本身是唯一输入互斥边界。
- Simulation 决策 owner 从当前 Session action descriptor 派生，不再从规则状态读取 pending owner。
- 真实 Chrome 首轮发现此前 Node 未覆盖的两个 canonical 切换缺口：终局九折威胁计算把玩家域对象误当数组；Browser 初始选择把卡面 `label/src` 写入 `player.initialSelection`，导致 StateStore 拒绝提交并回滚。现分别改为读取 `players.players`，以及只保存规则身份 `id`。
- 固定 full-flow 的业务盘面与 19 次输入不变；checkpoint hash 仅因删除 committed `initialSetup` 流程状态、Session journal/Effect payload 变化而更新。
- 验证通过：61/61 unit、1/1 full-flow、3/3 真实 Chrome smoke、`git diff --check`；opening 队列逐项缩短、下一 Decision identity 更新、stale 提交拒绝、最终 Session 和初始流程状态清空均有行为断言。

## 每轮更新格式

每轮实现后必须记录：

- 本轮触及的架构义务。
- 修改前残留数量、修改后残留数量及完整文件清单。
- 实际物理删除的文件、入口、字段、导出和调用。
- 新增的生产能力及其唯一 owner。
- 运行的行为验证、失败项和残余风险。
- 对应提交与推送状态。

不得用入口文件行数、提交数量、测试总数或“继续收口”等表述代替上述证据。
