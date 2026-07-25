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

## 2026-07-26 最终整改冻结矩阵

此前残留报告以历史关键词为主，出现过“报告归零，但新一轮审计又发现未登记语义残留”的假完成。
本轮已经从入口、模块可达性、状态 owner、committed schema、执行旁路、Browser 投影/UI、生产导出、
测试和当前文档八个视角完成一次只读盘点。以下矩阵是最终整改的封闭输入；实现阶段不得再按文件大小或
临时搜索结果扩大类别。若最终验证发现矩阵之外的新架构类别，必须把本轮盘点直接判为失败并说明原因，
不能把新项包装成正常增量进展。

| 编号 | 冻结基线 | 必须删除或改正 | 完成证据 |
|---|---|---|---|
| F1 committed schema 污染与重复事实 | 实际 committed snapshot 仍包含 `match.initialSetup` / `initialSetupConfig`、玩家 `aiDifficulty`、数据 token 的 `percentX/percentY`；`syncPlanetRockets()` 还把 planet marker 复制成带贴图坐标的 rocket；生产代码有 72 处 `debugOnly` | setup 过程只进 Session，Policy 配置只归 Host，布局只由投影派生；删除 planet-marker rocket 副本、坐标状态、debug bypass 与 debug-only canonical 字段 | Browser/Simulation 新局与完整局 serialized state 均不含上述字段；直接注入 fail-closed；planet marker 与 pieces 不再双写 |
| F2 非规范输入兼容 | 规则玩家对象仍有 59 处 `player.playerId/playerColor` 兼容读取；low-coupling validator 接受 map-shaped players；`createPlayerState/getCurrentPlayer` 仍通过 `players.currentPlayerId` 临时或 fallback 传递 turn owner | 规则域只接受玩家 `{id,color}` 与 canonical `players.players`；当前玩家只从 `turn.currentPlayerId` 显式传入 | 静态计数归零；旧 map/alias 输入负例被拒绝；正式完整流程不依赖兼容入口 |
| F3 canonical sequence 覆盖 | `meta.sequences` 已是唯一分配 owner，但 validator 只证明 `dataToken` 覆盖现有实体 | 对 card、rocket、alienEntity、finalMark、nebulaToken、nebulaReplacement 建立与真实 id/sequence 形状一致的覆盖校验 | 任一 sequence 落后于 committed 实体均零提交；恢复、fork 与正常完整局通过 |
| F4 旧回滚、readout 与测试旁路 API | 已确认 23 个无生产消费者的旧 API 定义，包括 industry snapshot/undo、planet remove/format、alien format、`seedDebug*`、卡牌 debug 输入与扇区 debug slot；另有 solar setup/format/report 旧 readout | 物理删除实现、导出、专属测试调用和文档接线；测试改用正式规则入口或显式 fixture | 指定 API 定义/导出/调用归零；生产模块不再为测试暴露规则绕过入口 |
| F5 过宽 Solar readout | `createSolarSnapshot()` 返回 15 个顶层域；正式规则/Browser 只消费 `planetLocations`、`visibleContents`、`nebulaLocations`，其余由无消费者的 setup/format readout 维持 | snapshot 缩成三个真实消费者字段；删除 `createSetupState/formatSolarSnapshot` 及仅服务旧报告的计算接线 | 三字段精确 schema；全部正式消费者与 Browser 动态渲染通过 |
| F6 Browser Projection 重复根 | 冻结前已在本批删除顶层 `board/players/cards/tech/aliens` 五个重复 DTO，只保留 `resident`、match、controls、decision、feedback | 不恢复重复 projection root；所有 renderer/输入只消费当前 BrowserProjection schema | schema 精确键测试、projection 隔离与真实 Chrome renderer 通过 |
| F7 行为回归基线 | 当前 61 个 unit 中 2 个因仍使用旧 map-shaped players / fake handSize fixture 失败；full-flow 业务结果通过但 checkpoint hash 待最终 schema 稳定后复核 | fixture 改用真实 canonical 玩家与卡实例；只在逐字段业务差异确认后更新 checkpoint | 61/61 unit、1/1 full-flow；不得通过恢复兼容代码让旧 fixture 继续通过 |
| F8 当前资料漂移 | `committed-game-state.md` 仍描述已删除 purifier；本账本 M1/M5 状态仍停留在上一轮 sequence/wall-clock 结论 | 当前文档只描述最终代码和可执行门禁；历史记录保留日期语境但不得冒充现状 | 当前资料路径、schema、owner、验证命令与 pushed HEAD 一致 |

### 当前验收状态

| 项目 | 当前结果 |
|---|---|
| F1–F6 | 代码与静态审计已完成；登记残留均为 0。 |
| F7 | 62/62 Node 测试通过；唯一 full-flow 已改为公共开局、行动、支付与恢复行为，不再以历史 checkpoint hash 作为验收。 |
| F8 | 当前契约文档已按最终代码更新；真实 Chrome 动态验证 3/3 通过。 |
| 矩阵外新类别 | 本轮实现与复核未发现 F1–F8 之外的新架构残留类别。 |

冻结时模块盘点结果：116 个生产 JavaScript、102 个 UMD 模块均有 Browser script 或 Node 生产入口，
不存在未消费模块 global；这只证明模块可达，不替代 F4 的导出级消费者审计。现有 12 个历史残留族群、
45 个 DOM 注册和 152 个 CSS class 报告均为 0，但只有在 F1–F8 同时归零并完成行为验证后才允许作为
最终完成证据。

## 里程碑账本

| 里程碑 | 审计基线 | 完成证明 | 当前状态 |
|---|---|---|---|
| M1 canonical state | 长期旧 `workingState`、`stateAdapter/projectWorkingState`、旧 root slice 名和模块级序列仍在生产路径 | 规则 domain 直接消费 Session canonical state；上述设施物理删除；恢复、反事实与提交只操作同一 schema | 已完成：旧 root/adapter、本地 sequence 和 fallback 均清零；card、rocket、data、alien、final、nebula 序列由 `meta.sequences` 唯一持有并校验覆盖实体 |
| M2 Session / ViewState | `pendingDecision`、`initialIncomeQueue`、card/tech UI selection、规则层 `statusNote` 仍存在 | 所有流程状态归 Effect Session Decision/queue；展示状态只归 Browser ViewState/Projection | 已完成：并行决策状态 28→0，规则层展示状态 40→0；61/61 unit、1/1 full-flow、3/3 Chrome |
| M3 旧执行设施 | Action History、History Commands、Ability Chain、无消费者 readout、`actionEffectFlow` 仍被加载或导出 | 文件、script、import/export、调用、专属测试和文档接线全部删除 | 已完成：34 个明确旧 runtime 文件不存在；Host 审计覆盖 22 family、5 个唯一 domain，旧执行设施残留为 0 |
| M4 Browser 外延 | 多组 projection DTO 为空；大量旧 DOM/HTML/CSS 无生产消费者 | 真实盘面、数据、科技、外星人、卡牌、计分均由新 projection 动态呈现和输入；旧 UI 物理删除 | 已完成：DOM 注册 160→45、静态无消费者 131→0；CSS 152 个 class、静态无消费者 0；真实 Chrome renderer 通过 |
| M5 验收与资料 | 当前 Chrome smoke 存在静态容器假阳性；当前文档仍描述已删除或尚未成立的边界 | 动态行为、恢复、parity 和负向 owner 证据成立；当前文档与代码一致；最终全仓审计通过 | 已完成：61/61 unit、1/1 full-flow、3/3 真实 Chrome 动态 smoke、当前资料与残留审计均通过 |

### 2026-07-26：冻结矩阵完成验证

- F1–F6 的生产残留、重复 owner、兼容入口、过宽 readout 与重复 Projection root 均已物理清理；
  `node tools/report_architecture_residuals.js` 中 F1–F5 和 12 个历史残留族群均为 0。
- 测试先按当前公共行为契约审查：删除只维护旧 debug、rollback、readout 和旧状态形状的断言；
  保留原子提交、合法行动、Effect Session、恢复、Projection 隔离和规则行为测试。
- 唯一 full-flow 改为通过公共 Standard Action / Decision 完成真实开局、发射、移动、支付和
  checkpoint 恢复，不再把历史随机轨迹或 checkpoint hash 当作业务正确性。
- Node 验证通过：61/61 unit、1/1 full-flow。真实 Chrome 动态验证通过：3/3，覆盖生产开始入口、
  人类开局/快速行动/主行动、机器席位 Machine Player Host、动态 renderer、保存恢复、
  renderer 异常隔离和 Browser/Simulation parity。
- 当前契约文档已删除旧 purifier、兼容状态和固定历史 fixture 口径。实现与验证阶段没有发现
  F1–F8 之外的新架构残留类别。

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

### 2026-07-25：删除规则域 card/tech UI 状态

- `ruleOwnedPresentationState` 从 40 处 / 5 个生产文件下降到 0；M2 两个残留族群均已清零。
- 删除 `cards.ui`、8 个 selection/discard/play-card UI getter/setter、对应导出和只验证旧 UI 状态的测试。
- 删除 `tech.ui`、作弊模式、选择开关、待放置 tile、蓝槽确认等无生产消费者 API；科技初始化现在直接创建 canonical board，不再创建 `{ board, ui }` 临时包装后由净化器拆包。
- Browser visibility projection 与 BrowserReadModel 不再复制空 `cards.ui`/`tech.ui`，不再输出永远为空的 clickable tech 和 industry-borrow interaction 字段。
- high-coupling 净化/校验删除 card/tech 旧字段专名黑名单；通用 host `ui` 边界仍拒绝展示状态进入 committed state，但不再维护已删除结构的字段清单。
- 本批修改 13 个文件，新增 40 行、删除 193 行，净删除 153 行；没有新增兼容 adapter、fallback 或第二状态 owner。
- 验证通过：61/61 unit、1/1 full-flow、3/3 真实 Chrome smoke、`git diff --check`；真实页面初始选择、快速行动、主行动、科技展示、projection 隔离和恢复证据保持成立。

### 2026-07-25：Browser 卡牌展示切换到 Projection 并删除旧交互界面

- 删除已被统一 Decision UI 取代的科技蓝槽、卡牌选择/弃牌、PASS 保留牌、数据放置、扫描目标、外星人痕迹、登陆目标、旧 Effect Bar 和手牌确认/取消 DOM。
- 删除没有生产处理器的开始页继续/debug/log/外星人池/公司池选项，以及 debug dock、report dock、终局旧 overlay；开始页只保留实际进入 `newGame` 的人数与机器难度。
- 同步物理删除上述界面的 DOM 注册和 CSS，并删除旧手牌选择、保留牌任务按钮、公司卡交互、旧科技选择和 hover preview 样式；本批 HTML/CSS/DOM 净删除 3304 行。
- `randomizer/app.js::createRenderPresentation` 现在从当前 viewer 的可见玩家生成资源、手牌、保留牌和公共牌 DTO；`resident-renderer.js` 只用该 DTO 重建卡牌 DOM，不绑定规则 handler。
- DOM 注册从 160 降到 63，静态无消费者注册从 131 降到 28；剩余 28 个全部进入 M4 的盘面、数据、科技、外星人和计分展示矩阵，不能在未接通 projection 前直接删除。
- 首次全量回归被源码审计误把同一行 `projection.cards...map(() => ...)` 的箭头识别为规则写入；仅调整只读 fallback 的换行后审计恢复通过，没有放宽门禁。
- 验证通过：61/61 unit、1/1 full-flow、3/3 真实 Chrome smoke、`node --check`、`git diff --check`。内置浏览器技能安装路径不存在，因此本批没有把自动 smoke 记作人工视觉截图；视觉证据留在 M4 最终动态展示验收。

### 2026-07-25：Browser 盘面、科技与数据展示切换到 Projection

- 修复卡牌实例只有 canonical `cardId` 时旧 renderer 得不到图片的真实缺口；公共牌、手牌和保留牌现在通过卡牌 catalog 生成 viewer-safe 图片 DTO。
- 科技供应、首拿 bonus、玩家已拥有科技和玩家数据 token 改由 `BrowserReadModel.render` DTO 重建；物理删除旧可拖拽数据 token、蓝色 drop zone 和旧科技选择状态对应的 CSS。
- 太阳系四层轮盘旋转、四个扇区、火箭、星球参考区火箭，以及环绕/登陆/卫星标记统一由 canonical state 派生为 `boardChrome/tokenPresentation`，renderer 不再回退读取 `projection.board.pieces.public`。
- Chrome 门禁从“存在空容器/空 DTO”加强为真实图片路径、12 个科技 bonus、4 个动态扇区，以及完成发射 Decision 后火箭具有真实图片和百分比坐标；本批首次确认旧 renderer 写入的 `--x/--y` 没有 CSS 消费者，现已改为实际 `left/top`。
- DOM 注册从 63 降到 62，静态无消费者注册从 28 降到 21；八个已识别旧架构残留族群继续保持 0。
- 本批修改 7 个生产/验证文件及本账本，新增 420 行、删除 96 行；新增代码是投影派生和动态 renderer，不新增规则 owner、兼容 adapter 或 Browser 规则状态。
- 验证通过：61/61 unit、1/1 full-flow、3/3 真实 Chrome smoke、`node --check`、`git diff --check`。M4 尚余外星人动态展示、终局板块动态状态、无消费者 DOM/CSS 清理与最终视觉证据。

### 2026-07-25：完成 Browser 外延并扩展全仓审计

- 外星人槽位、正面/state、痕迹、物种卡牌、异常点、虫族化石、符文族 symbol、奥陌陌轮盘/数据，以及扇区数据与赢家标记全部由 `BrowserReadModel.render` DTO 派生；renderer 只创建展示 DOM。
- 终局板块按 canonical variant 切换图片，并按 projection 的真实槽位、玩家颜色与 token 坐标渲染；科技首拿覆盖层、玩家科技/数据、四层轮盘、扇区、火箭和星球标记均不再读取传统 root。
- 物理删除八物种静态面板、旧拖拽/移动高亮、旧星云数据/赢家 layer、旧 marker、旧玩家统计、旧 Decision root selector 和无消费者 responsive CSS。DOM 注册从上一批 62 降至 45，静态无消费者从 21 降至 0；CSS 当前登记 152 个 class，除 3 个 renderer 动态 `is-reference-*` class 外均有静态消费者，残留为 0。
- 独立审计额外发现并删除空的 `match.actionLog`、`meta.sequences.actionLog`、Simulation `actionHistorySummary`，以及 ViewState 中从未被 UI 消费的 status/overlay/hover/tabs/scroll/layout/animation/debug 通用表面。新增两类残留门禁后均为 0；ViewState v2 只保留 Decision UI 实际消费的 focus、draft 和 projection identity。
- 当前残留报告的 10 个旧架构族群全部为 0；34 个明确旧 runtime 文件均不存在；45 个 DOM 注册无静态废项；152 个 CSS class 无静态废项；当前资料不存在指向缺失生产路径的有效引用。
- Browser/Simulation 从同一 lifecycle checkpoint 枚举完全相同的 Standard Action，并对同一 launch 产生逐字节相同的 committed state、journal 与 checkpoint。真实 Chrome 进一步覆盖人类 initial setup/quick/launch/end_turn、机器席位 Machine Player Host 输入、保存恢复和 renderer 异常隔离。
- Node 验证通过：61/61 unit、1/1 full-flow；Chrome 验证通过：3/3；`node tools/audit_host_architecture.js`、`node tools/report_architecture_residuals.js` 与 `git diff --check` 均通过。
- 随后把审计口径扩展到全部当前资料与通用 sequence/时间字段，发现七个物种文件仍有 92 处 `nextTrace/Card/Orbit/LandingSequence` 引用，以及规则实体中仍存在墙钟时间 fallback。该发现重新打开 M1/M5；上述“残留为 0”只适用于当时已登记的 10 个族群，不作为最终完成结论。

## 每轮更新格式

每轮实现后必须记录：

- 本轮触及的架构义务。
- 修改前残留数量、修改后残留数量及完整文件清单。
- 实际物理删除的文件、入口、字段、导出和调用。
- 新增的生产能力及其唯一 owner。
- 运行的行为验证、失败项和残余风险。
- 对应提交与推送状态。

不得用入口文件行数、提交数量、测试总数或“继续收口”等表述代替上述证据。
