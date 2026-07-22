# CommittedGameState 与 StateStore 契约

## 结论与边界

`CommittedGameState` 是浏览器、simulation 与训练环境共同使用的唯一“已经成立的游戏事实”。它是按领域分片的根对象，不是巨型平面对象。`StateStore` 是替换该根对象的唯一入口；Action、Effect Session、UI、AI、history 和宿主环境只能读取隔离快照，或在工作副本上计算候选状态。

Browser 由 `app/rule-composition.js` 持有唯一 StateStore、Standard Action registry、Effect runtime 与 active Session。启动时各领域 factory 只用于构造 composition 的首个 working candidate；`app.js`、turn flow 和 AI reset 不再各自创建长期切片。传统规则函数收到的同名对象是 composition 当前 working root 的窄引用，不是另一份 committed owner。Action、Quick 与 conditional descriptor 统一经 `inputPort` 进入并在 Effect runtime 的工作副本上原子提交；Browser caller 不取得 serialize/deserialize/restore/raw CAS。保存与恢复统一使用 composition lifecycle envelope，旧 StateStore-only schema 直接拒绝；恢复校验通过后由 composition 内部原位水合窄引用，以保持已装配 callback 的对象 identity，宿主不执行 slices 回灌。

Stage 0/1 已冻结 reference schema、所有权、版本、验证、序列化与 compare-and-commit 语义。Stage 3/4 由 low/high coupling purifier 冻结各领域切片与跨切片 invariant。Stage 6 把 StateStore 作为 Effect Session 的一等端口：store-backed session 只从 `beginWorkingCopy()` 建立 base/working state，并且只有 queue 清空、无等待输入且 runtime 校验通过后才调用一次 `compareAndCommit()`。Stage 8 已删除旧 10/12-slice adapter；recovery/simulation 只接受当前 committed schema。

```text
StateStore (唯一 committed owner)
  getSnapshot() ───────────────> readonly isolated snapshot
  beginWorkingCopy(version) ───> mutable candidate + baseVersion
  compareAndCommit(base,candidate)
                 │ validate schema / invariants / serializability
                 └─────────────> one atomic root replacement + version event

Effect Session owns queue / decision / journal / working-copy lifecycle.
Browser and training hosts own projections, observations and policy/UI state.
```

## v1 根 schema

当前 schema id 为 `seti-committed-game-state-v1`。根级字段采用精确白名单，禁止把 pending、overlay、history、observation、缓存或宿主对象临时塞进权威根。

| 切片 | 唯一所有者与事实范围 | 不得进入 |
|---|---|---|
| `meta` | schema/state version、game/ruleset id、seed、`rngState`、确定性唯一编号序列 | Policy 状态、wall clock、模块闭包 counter |
| `match` | 玩家顺序、对局状态、已确认 setup 结果、终局触发事实 | setup 选择过程、终局弹窗 |
| `turn` | round、turn、action cycle、当前玩家、active/passed/finished、规则访问记录 | automation timer、按钮 enable 状态 |
| `players` | 资源、收入、分数来源、牌/科技/公司归属、棋子和标记资产 | AI 估值、格式化名称、渲染资产 |
| `solarSystem` | 轮盘、旋转、扇区槽位和当前几何局面 | 画布坐标缓存、高亮 |
| `pieces` | 探测器/其他棋子的 id、归属、规则位置和确定性序列引用 | `statusNote`、拖拽态 |
| `planets` | 环绕、登陆、卫星登陆占位及已确认统计事实 | DOM reference、tooltip |
| `data` | 数据 token、计算机/额外标记、星云与扇区控制、已确认结算 | 渲染统计缓存 |
| `cards` | 实例牌、牌库顺序、公共牌、手牌归属、弃牌、PASS 预留及永久变化 | 选择/弃牌 UI、`cardTaskState` 查询索引 |
| `tech` | 科技供应板、槽位、剩余 tile、玩家取得与永久 tile 变化 | `ui`、pending tile、状态文案 |
| `aliens` | 揭示池、槽位、痕迹归属、额外标记与物种永久事实 | picker、奖励 continuation |
| `finalScoring` | 板块配置、variant、阈值和已确认 marks | `pendingMarks` decision 流程 |

领域切片 v1 先由根 schema 强制为普通对象，再由对应 purifier 与 invariant validator 固化内部字段。根边界、版本和提交语义在 Browser/Simulation 中完全一致。

## 低耦合切片 ownership

`low-coupling-slices.js` 是以下字段分类的可执行版本。它只提供净化与不变量；规则事务统一由 Rule Composition 的 Effect Session 执行并提交，没有第二份 StateStore 构造、committed authority 或切片级 CAS 入口。

| 旧字段 | v1 ownership | 净化 / 投影规则 |
|---|---|---|
| `solarState.rotation/sectorBySlot/aomomoActive` | committed `solarSystem` | 原样保存规则事实 |
| `solarState.wheelSteps` | derived | 保存时删除，由 `rotation` 重建 |
| `turnState.*` + `playerState.currentPlayerId` | committed `turn` | 当前玩家只进入 `turn.currentPlayerId`；自动化与 view flag 禁止进入 |
| 已确认 setup / 终局触发 | committed `match` | setup 选择过程、终局弹窗仍属 session/host |
| `planetStatsState.*Markers` | committed `planets` | 数组顺序是事实顺序；owner 必须指向现有玩家 |
| `orbits/landings/sequence/displayed/displaySlot/forceDisplaySlot/referenceOffsetTokenWidths` | derived / host-only | 保存时删除，由 marker 数组或 BrowserProjection 重建计数和顺序 |
| `nebulaDataState.nebulae.*.tokens` | committed `data` | token id、slot、替换 owner 等规则字段保留 |
| `playerTokenCounts/lastReplaced*` | derived | 从 token 数组重建 |
| token 的 label、asset、percent 坐标、wall-clock | host-only / derived | 保存时删除；布局与文案由宿主重新投影 |
| `sectorExtraMarks/sectorSettlements` | committed `data` | owner 必须指向现有玩家 |
| 揭示池、外星人槽位、痕迹、额外标记、物种永久事实 | committed `aliens` | `extraCount` 必须和 `extraMarkers.length` 一致 |
| 外星人 marker 的 label、asset、display 字段 | host-only / derived | 保存时删除 |
| thresholds、tiles、tileVariants 与已确认 marks 规则字段 | committed `finalScoring` | mark id 唯一；固定槽位唯一；玩家每板块最多一次 |
| mark label、asset、`placedAt` | host-only / derived | 保存时删除 |
| `finalScoringState.pendingMarks` | session-owned | 永不提交；由当前 Decision Session 持有 |

Stage 3 不净化 `players/pieces/cards/tech` 的内部字段；它们由 Stage 4 接管。`pieces` 仅作为本阶段跨切片引用的只读一端，用于校验棋子 id/owner、active rocket 和 planet reference。

## 高耦合切片 ownership

`high-coupling-slices.js` 管理 `players/pieces/cards/tech`，并校验 `planets` 中棋子转环绕/登陆标记的跨切片引用。它只提供净化、不变量、StateStore 构造与派生任务索引；cards、rocket、planet、tech 领域变更必须在 Rule Composition 的同一 Effect Session working state 中完成，模块不再暴露外部 CAS mutator。

| 旧字段 / 行为 | v1 ownership | 净化 / 不变量 |
|---|---|---|
| `playerState.players` 资源、手牌、预留牌、科技归属 | committed `players` | 玩家 id/颜色唯一；资源非负；`handSize` 与 hand 一致；展示 label/asset 排除 |
| `rocketState.rockets/activeRocketId/playerRocketSequences` | committed `pieces` | 棋子 id 唯一；owner、active、玩家序号有效；`Set` 保存为排序数组 |
| `rocketState.nextRocketId` | committed `meta.sequences.rocket` | 必须覆盖现有领域 id；`statusNote`、token asset、label 排除 |
| 星球转换的 `pieceId/sourcePieceId` | committed `planets` cross-reference | 保留棋子的 marker 必须引用现有 piece；消费棋子的 marker 要求 source piece 已从 pieces 移除 |
| 卡实例、公共牌、弃牌、PASS 预留、牌库顺序 | committed `players/cards` | 实例 `id` 全局唯一；同一 `cardId` 只能位于一个容器；牌库不得与 live/discard 重叠 |
| `cardState.ui/selection*` | session/host-owned | 保存时删除，直接提交时 fail-closed |
| `cardTaskState` | derived | 由 committed snapshot 或 working candidate 的 reserved cards + card effect protocol 调用 `rebuildCardTaskIndex()` 重建，永不序列化 |
| 科技 supply stack 与玩家 `techState` | committed `tech/players` | stack id、remaining/depleted、首拿 owner、owned tile 与蓝槽唯一性一致 |
| `techGameState.ui/pending/selected/allowed*` | session/host-owned | 保存时删除，直接提交时 fail-closed |
| `setupSelectionState` | setup session-owned | 仍只由 setup session 持有；确认后的玩家/对局事实才进入 committed state |

新存档和 recovery v2 统一经过低/高耦合 purifier；`tech` 规则事实只保存在 committed slice，选择态与展示态只来自 Effect Session 和 Browser Host。

## API 与失败语义

| API | 契约 |
|---|---|
| `getSnapshot()` | 每次返回独立的深冻结副本；任何调用方都拿不到 committed 引用。 |
| `beginWorkingCopy(baseVersion)` | 版本匹配时返回可变深拷贝；冲突返回 `STATE_VERSION_CONFLICT`。 |
| `validate(candidate)` | 精确根 schema、meta、普通数据图、可序列化性及注入的领域不变量全部通过才 `ok`。 |
| `compareAndCommit(baseVersion, candidate, metadata?)` | 先隔离克隆、再校验；成功时整根替换并把 `stateVersion` 加一；可把 session id/journal 的纯数据副本随 commit event 发布；任一失败时原状态逐字节等价。 |
| `serialize(candidate?)` | 校验后按 key 排序生成确定性 JSON；不读 localStorage。 |
| `deserialize(input)` | 只解析当前 schema 并完成最终校验；损坏、缺版本或未知版本 fail-closed。 |
| `subscribe(listener)` | 只接收深冻结 commit event；listener 属于宿主，异常不能回滚已成立的提交。 |

StateStore 明确拒绝函数、`undefined`、Symbol、BigInt、循环引用、`Map`/`Set`/Date/DOM 等非普通对象、getter/setter、隐藏字段、稀疏数组和非有限数字。`rngState` 必须是可恢复的普通对象。领域层必须先把历史 `Set`、模块级序列和 UI 字段转换为显式的 JSON 数据。

## 状态不变量

reference core 直接强制以下不变量：

1. 根切片完整且没有未知根字段；所有领域切片为普通对象。
2. `meta.schemaVersion` 等于当前 schema；`stateVersion` 和所有唯一编号序列均为非负安全整数。
3. `gameId`、`rulesetVersion` 非空；seed 和 `rngState` 可恢复、可序列化。
4. 整个候选状态是无环、无行为对象的 JSON 数据图。
5. candidate version 必须等于 compare-and-commit 的 baseVersion；成功提交只由 store 递增版本。

跨领域不变量由 `invariantValidators` 注入，例如：玩家资源不得为负、科技 tile 只能位于供应板或一个玩家处、棋子与星球占位一致、牌实例只能位于唯一容器。validator 只读取隔离副本，不能修改 candidate 或 committed state。

Stage 3 在 reference core 之上追加：

1. turn 顺位、active、passed、completed、start/current 玩家引用存在且集合无重复；`activePlayerCount` 与 active 数组长度一致。
2. 棋子 id 唯一，active rocket 必须存在，棋子与星球标记的 owner/planet reference 必须指向现有实体。
3. 同一星云 token id 全局唯一、槽位不重复；所有已确认 data owner 引用有效。
4. alien trace 的额外标记计数守恒，痕迹 owner 有效。
5. final marks id 唯一，同一玩家不能重复占同一板块，固定第 1/2 槽不能重复占用。
6. 任一低耦合提交写入 session、host 或 derived 字段都会 fail-closed；mutator 越界修改 players/pieces/cards/tech 会以 `STATE_SLICE_OWNERSHIP_VIOLATION` 拒绝。

## 版本策略

- schema 变化使用新的常量 id；禁止原地改变旧 id 的含义。
- StateStore、recovery 与 simulation checkpoint 只接受当前 schema；旧、缺失或未知版本直接拒绝。
- 新存档只写 `serialize()` 的 committed snapshot；Effect queue、DecisionEffect 和 journal 由各自协议持有。

## Stage 0 proof obligations

| 验收条款 | 可证伪命题与最小反例 | 唯一责任点 | 证据 |
|---|---|---|---|
| 不暴露可变引用 | 修改任一 snapshot 深层字段后再次读取不变；反例是第二次读到 `99` | `getSnapshot` / commit event | 深冻结与隔离引用测试 |
| 多切片原子提交 | 同时改 players/cards/tech 时全量可见；任一 invariant 失败时所有切片逐字节不变 | `compareAndCommit` | 成功 proof case + 每类失败前后 canonical bytes |
| 版本冲突只允许首写 | 两个 working copy 同基线时第二个明确冲突 | baseVersion check | 并发双副本测试 |
| schema/不变量/序列化 fail-closed | 缺切片、负资源、函数、Map、环、NaN 均拒绝，版本不增 | `validate` before root replacement | 负向矩阵测试 |
| 确定性状态进入边界 | 去掉 rngState 或使用不可恢复 counter 时校验失败 | meta schema + domain adapter | meta 测试；后续闭包审计阶段补 trace |
| 版本拒绝不猜测 | 损坏 JSON、旧/缺失/未知版本均不返回 state | `deserialize` | round-trip、v0、缺版本、损坏测试 |
| 宿主隔离 | import/create/commit 不访问 document、localStorage、Policy 或 Action/Effect 类型 | 独立 state module | Node 直接测试 + 依赖结构检查 |

## Stage 3 proof obligations

| 验收条款 | 可证伪命题 | 最小反例 | 责任点 | 证据 |
|---|---|---|---|---|
| 每个领域字段有 ownership | 六组低耦合切片的 committed/session/host/derived 分类均可查询 | `pendingMarks` 或 `wheelSteps` 进入 serialized bytes | `FIELD_OWNERSHIP` + purifier | ownership/净化断言 |
| 正式路径不双写 | 领域行为只取得 snapshot 派生 projection 和一个 working copy；成功只替换一次 root | mutator 修改输入后 committed 在 compare 前已变化 | working-copy mutator | 提交前 snapshot 不变、成功 version +1 |
| 盘面/回合/外星人/终局 parity | 同一基线执行太阳轮转、星球 marker、回合推进、外星人揭示和 final mark 后，serialize→recover→project 的规则事实一致 | 恢复后 marker count/order、current player 或 reveal 丢失 | domain mutator + recovery port | 真实领域函数组合 trace 测试 |
| invariant 失败零污染 | 玩家引用、active count、token slot、trace count、final slot 或 host field 任一非法时 bytes 不变 | 缺失 player、重复 slot、额外 marker 计数漂移 | Stage 3 validator + StateStore commit | 逐类失败前后 canonical bytes |
| 版本只成功递增 | 两份相同 baseVersion working copy 仅首份可提交 | stale writer 覆盖新 turn | StateStore CAS | winner version=1、loser conflict、事实保持 winner |

固定行为 trace 位于 `randomizer/game/state/low-coupling-slices.test.js`。它调用现有 solar、planet、alien、final-scoring 领域函数，而不是只检查静态 schema；浏览器装配由 recovery port 与真实 Chrome smoke 验证。

## Stage 4 proof obligations

| 验收条款 | 可证伪命题 | 最小反例 | 责任点 | 证据 |
|---|---|---|---|---|
| players/cards/tech 多切片原子提交 | 研究科技与卡牌移动在同一版本同时可见；任一不变量失败则全部 bytes 不变 | supply 已减但玩家未取得，或手牌已移出但弃牌未进入 | 高耦合 working-copy bridge + StateStore CAS | 现有 tech/cards 领域函数组合 trace、失败前后 canonical bytes |
| 棋子与星球一致 | piece 转 marker 后 source piece 不再存在；保留 piece reference 时目标必须存在 | marker.sourcePieceId 与 pieces 同时存在 | pieces/planets cross invariant | removeRocket + addPlanetOrbitMarker 单提交 trace；负向 mismatch |
| 实例与领域编号唯一 | card instance、piece id 以及玩家棋子序号在各自领域全局唯一，sequence 覆盖已知 id | 同一实例复制到 hand/discard，或重复 playerSequence | purifier + high-coupling validator | 容器遍历反例与 meta sequence 断言 |
| UI/选择/派生索引不持久化 | tech/card UI、rocket statusNote、setup session、card task index 不出现在 serialized bytes | working candidate 注入 pendingTileId 或 readyType2Tasks | ownership purifier + direct validator | 净化断言、直接提交 fail-closed、序列化字符串检查 |
| 任务索引可重建 | 对 committed snapshot 与未提交 working candidate，索引分别反映各自 reserved cards 且不修改 committed | working 删除 reserved card 后索引仍沿用 committed cache | `rebuildCardTaskIndex` | committed/working 双输入测试 |
| 恢复与并发稳定 | serialize→deserialize 完全等价；同基线仅首个 writer 成功 | stale writer 覆盖资源/科技/牌位置 | high-coupling store + recovery port | round-trip + stale writer trace |

固定 trace 位于 `randomizer/game/state/high-coupling-slices.test.js`。它刻意调用现有 `tech/board-state`、`tech/player-tech`、`cards/deck`、`rockets` 与 `planet-stats` 领域函数，证明的是行为组合和一次根提交，不以静态 ownership label 代替执行证据。

## Stage 6 Effect Session 原子提交

`randomizer/game/effects/session-runtime.js` 的 `stateStore` 模式是唯一生产提交边界。`dispatchStoredAction()` 不接受宿主拼出的第二份权威状态，而是调用 `beginWorkingCopy()` 捕获同 schema candidate 和 baseVersion。确定性 Effect、DecisionEffect、quick interrupt、journal 与 barrier 都只修改 session working copy；只有稳定提交边界调用 CAS。

CAS 成功返回的递增版本 snapshot 同时成为 `session.committedState`，随后 session 才进入 `completed`。commit event 的 `metadata.sessionId/journal` 是提交当刻的稳定审计副本，因此 event snapshot、session committedState 与 journal 可直接对齐。版本冲突、schema/invariant 拒绝、不可序列化 metadata、executor/decision 失败与 barrier failure 都不得调用旧切片替换入口；屏障前恢复 base working copy，屏障后保留 working/journal 进入 `irreversible_locked`，两者均不污染 StateStore。

行为矩阵在 `randomizer/game/effects/state-store-session.test.js`：同版本双 session、研究科技/卡牌/盘面多切片、逐步骤 poison、invariant、barrier、commit event/journal 和旧直写 spy。浏览器 UMD 装配由 `state-store-session.browser-smoke.html` 验证。

## 分阶段覆盖矩阵

| 阶段 | 边界 | 目标 | 完成证据 |
|---|---|---|---|
| 3 | solar/turn/planet/nebula/alien/final scoring | `low-coupling-slices.js` 纯领域切片 | 行为 parity、跨切片 invariant、失败零污染与恢复测试 |
| 4 | players/rockets/cards/tech | players/pieces/cards/tech | 已完成：UI 字段、`statusNote`、task index 迁出；实例 id、领域 sequence 与跨切片 invariant 纳管 |
| 5 | `Math.random`、模块序列、cache | meta.rngState/sequences 或派生层 | 同实例 A/A、A/B/A 和非零 checkpoint fork parity |
| 6 | Effect Session working state | `beginWorkingCopy` + `compareAndCommit` | session 不直接替换 committed root |
| 7 | browser/simulation/RL 读写入口 | projection/observation from same schema | UI/AI resolver 规则调用为 0 |
| 8 | recovery/simulation 持久化 | current schema only | 非当前 schema 读取统一 fail-closed |

## Recovery / Simulation 零兼容边界

recovery snapshot v2 和 simulation checkpoint 的 `coreState` 只保存 `StateStore.serialize()` 产生的 `committedState` JSON。version 1、缺版本、未知版本和未知 `state` root 均在调用 restore port 前 fail-closed；没有转换或双写入口。

读取路径只接受 v2 并直接反序列化 `committedState`；缺版本、未知版本、损坏 JSON、缺切片或非法序列均在修改 runtime 前拒绝。simulation checkpoint 的 replay journal 仍是独立协议：有 journal 时通过 reset+replay 重建 session-owned 决策状态，无 journal的稳定 core checkpoint 经同一 recovery 边界恢复。

## 当前持久化边界

新 recovery 写路径直接调用 StateStore 生成 v2 `committedState`；`cardTaskState` 与
`setupSelectionState` 不属于 committed root。inventory 只列正式 owner/source/target，不含过渡字段。

跨 app/effect/AI/simulation/RL/mechanics 的边界以本文件为准；唯一 owner、隔离快照、
单次 CAS 与恢复拒绝由 StateStore/Effect Session 行为单元测试和固定完整流程验证。
