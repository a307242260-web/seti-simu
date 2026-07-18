# CommittedGameState 与 StateStore 契约

## 结论与边界

`CommittedGameState` 是浏览器、headless 与训练环境共同使用的唯一“已经成立的游戏事实”。它是按领域分片的根对象，不是巨型平面对象。`StateStore` 是替换该根对象的唯一入口；Action、Effect Session、UI、AI、history 和宿主环境只能读取隔离快照，或在工作副本上计算候选状态。

Stage 0/1 已冻结 reference schema、所有权、版本、验证、序列化与 compare-and-commit 语义。Stage 2 由 `randomizer/game/state/legacy-state-adapter.js` 在 recovery/headless 持久化边界把旧 12 个可变切片一次性转换为 v1。Stage 3 由 `randomizer/game/state/low-coupling-slices.js` 净化 match/turn、solar、planet、nebula/data、alien 与 final scoring，并为这些切片提供领域 invariant 和 working-copy bridge；Action/Effect 的生产提交调度仍留给 Stage 6，不在本阶段提前双写旧权威。

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

领域切片 v1 只强制为普通对象，内部字段由对应领域 adapter 与 invariant validator 渐进冻结。这样允许逐域迁移，但根边界、版本和提交语义从第一阶段起保持稳定。

## Stage 3 低耦合切片 ownership

`low-coupling-slices.js` 是以下字段分类的可执行版本。旧模块需要继续运行时，由 `mutateLegacyLowCouplingSlices()` 从 committed snapshot 生成一次性 legacy projection，在同一 working copy 上执行领域函数，再净化并 compare-and-commit；projection 不是第二份 committed authority，也不会被长期保存。

| 旧字段 | v1 ownership | 净化 / 投影规则 |
|---|---|---|
| `solarState.rotation/sectorBySlot/aomomoActive` | committed `solarSystem` | 原样保存规则事实 |
| `solarState.wheelSteps` | derived | 保存时删除，由 `rotation` 重建 |
| `turnState.*` + `playerState.currentPlayerId` | committed `turn` | 当前玩家只进入 `turn.currentPlayerId`；自动化与 view flag 禁止进入 |
| 已确认 setup / 终局触发 | committed `match` | setup 选择过程、终局弹窗仍属 session/host |
| `planetStatsState.*Markers` | committed `planets` | 数组顺序是事实顺序；owner 必须指向现有玩家 |
| `orbits/landings/sequence/displayed/displaySlot/forceDisplaySlot/referenceOffsetTokenWidths` | derived / host-only | 保存时删除，legacy projection 从 marker 数组重建计数和顺序 |
| `nebulaDataState.nebulae.*.tokens` | committed `data` | token id、slot、替换 owner 等规则字段保留 |
| `playerTokenCounts/lastReplaced*` | derived | 从 token 数组重建 |
| token 的 label、asset、percent 坐标、wall-clock | host-only / derived | 保存时删除；布局与文案由宿主重新投影 |
| `sectorExtraMarks/sectorSettlements` | committed `data` | owner 必须指向现有玩家 |
| 揭示池、外星人槽位、痕迹、额外标记、物种永久事实 | committed `aliens` | `extraCount` 必须和 `extraMarkers.length` 一致 |
| 外星人 marker 的 label、asset、display 字段 | host-only / derived | 保存时删除 |
| thresholds、tiles、tileVariants 与已确认 marks 规则字段 | committed `finalScoring` | mark id 唯一；固定槽位唯一；玩家每板块最多一次 |
| mark label、asset、`placedAt` | host-only / derived | 保存时删除 |
| `finalScoringState.pendingMarks` | session-owned | 永不提交；legacy projection 只给空 session 容器 |

Stage 3 不净化 `players/pieces/cards/tech` 的内部字段；它们由 Stage 4 接管。`pieces` 仅作为本阶段跨切片引用的只读一端，用于校验棋子 id/owner、active rocket 和 planet reference。

## API 与失败语义

| API | 契约 |
|---|---|
| `getSnapshot()` | 每次返回独立的深冻结副本；任何调用方都拿不到 committed 引用。 |
| `beginWorkingCopy(baseVersion)` | 版本匹配时返回可变深拷贝；冲突返回 `STATE_VERSION_CONFLICT`。 |
| `validate(candidate)` | 精确根 schema、meta、普通数据图、可序列化性及注入的领域不变量全部通过才 `ok`。 |
| `compareAndCommit(baseVersion, candidate)` | 先隔离克隆、再校验；成功时整根替换并把 `stateVersion` 加一；任一失败时原状态逐字节等价。 |
| `serialize(candidate?)` | 校验后按 key 排序生成确定性 JSON；不读 localStorage。 |
| `deserialize(input)` | 只负责解析、显式 migration chain 和最终校验；损坏/未知版本 fail-closed。 |
| `migrate(candidate)` | 只运行调用方注册的 `schemaVersion -> next state` 迁移；无迁移器、循环、异常或无效输出均拒绝。 |
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

## 版本和迁移策略

- schema 变化使用新的常量 id；禁止原地改变旧 id 的含义。
- migration 是逐版本、纯数据、显式注册的函数；不得读取 DOM、Policy、localStorage、模块随机源或当前运行时状态。
- 旧 recovery/headless checkpoint 先由后续兼容 adapter 映射到某个已知 schema，再进入 `deserialize/migrate`；未知版本不猜测。
- migration 输出必须通过当前 schema 和全部不变量；失败不替换 store。
- 新存档只写 `serialize()` 的 committed snapshot；Effect queue、DecisionEffect 和 journal 由各自协议持有。

## Stage 0 proof obligations

| 验收条款 | 可证伪命题与最小反例 | 唯一责任点 | 证据 |
|---|---|---|---|
| 不暴露可变引用 | 修改任一 snapshot 深层字段后再次读取不变；反例是第二次读到 `99` | `getSnapshot` / commit event | 深冻结与隔离引用测试 |
| 多切片原子提交 | 同时改 players/cards/tech 时全量可见；任一 invariant 失败时所有切片逐字节不变 | `compareAndCommit` | 成功 proof case + 每类失败前后 canonical bytes |
| 版本冲突只允许首写 | 两个 working copy 同基线时第二个明确冲突 | baseVersion check | 并发双副本测试 |
| schema/不变量/序列化 fail-closed | 缺切片、负资源、函数、Map、环、NaN 均拒绝，版本不增 | `validate` before root replacement | 负向矩阵测试 |
| 确定性状态进入边界 | 去掉 rngState 或使用不可恢复 counter 时校验失败 | meta schema + domain adapter | meta 测试；后续闭包审计阶段补 trace |
| 版本迁移不猜测 | 损坏 JSON、未知旧版本或无效 migration 均不返回 state | `deserialize/migrate` | round-trip、v0、损坏、missing migrator 测试 |
| 宿主隔离 | import/create/commit 不访问 document、localStorage、Policy 或 Action/Effect 类型 | 独立 state module | Node 直接测试 + 依赖结构检查 |

## Stage 3 proof obligations

| 验收条款 | 可证伪命题 | 最小反例 | 责任点 | 证据 |
|---|---|---|---|---|
| 每个旧字段有 ownership | 六组低耦合切片的 committed/session/host/derived 分类均可查询 | `pendingMarks` 或 `wheelSteps` 进入 serialized bytes | `FIELD_OWNERSHIP` + purifier | ownership/净化断言 |
| 已迁移路径不双写 | 领域行为只取得 snapshot 派生 projection 和一个 working copy；成功只替换一次 root | mutator 修改 legacy 对象后 committed 在 compare 前已变化 | 两层 mutation bridge | 提交前 snapshot 不变、成功 version +1 |
| 盘面/回合/外星人/终局 parity | 同一基线执行太阳轮转、星球 marker、回合推进、外星人揭示和 final mark 后，serialize→recover→project 的规则事实一致 | 恢复后 marker count/order、current player 或 reveal 丢失 | domain bridge + recovery adapter | 真实领域函数组合 trace 测试 |
| invariant 失败零污染 | 玩家引用、active count、token slot、trace count、final slot 或 host field 任一非法时 bytes 不变 | 缺失 player、重复 slot、额外 marker 计数漂移 | Stage 3 validator + StateStore commit | 逐类失败前后 canonical bytes |
| 版本只成功递增 | 两份相同 baseVersion working copy 仅首份可提交 | stale writer 覆盖新 turn | StateStore CAS | winner version=1、loser conflict、事实保持 winner |

固定行为 trace 位于 `randomizer/game/state/low-coupling-slices.test.js`。它调用现有 solar、planet、alien、final-scoring 领域函数，而不是只检查静态 schema；浏览器装配仍由 recovery adapter 的脚本顺序和真实 Chrome smoke 验证。

## 分阶段覆盖矩阵与删除条件

| 阶段 | 旧来源 | 单向 adapter 目标 | 删除/切换条件 |
|---|---|---|---|
| 2 | recovery/headless `state` 12 切片 | v1 root（明确排除 runtime 与 cardTask 派生索引） | round-trip、旧版/缺字段/损坏恢复通过；没有双向双写 |
| 3 | solar/turn/planet/nebula/alien/final scoring | `low-coupling-slices.js` 纯领域切片与 legacy working-copy bridge | 已完成：行为 parity、跨切片 invariant、失败零污染与恢复测试 |
| 4 | players/rockets/cards/tech | players/pieces/cards/tech | UI 字段、`statusNote`、task index 迁出；实例 id 纳管 |
| 5 | `Math.random`、模块序列、cache | meta.rngState/sequences 或派生层 | 同实例 A/A、A/B/A 和非零 checkpoint fork parity |
| 6 | Effect Session working state | `beginWorkingCopy` + `compareAndCommit` | 已迁移 session 不再直接替换旧切片 |
| 7 | browser/headless/RL 读写入口 | projection/observation from same schema | 已迁移路径旧直写、UI/AI resolver 调用为 0 |
| 8 | 遗留 adapter 与旧存档 | current schema | inventory 全部 deleted/store-owned/host-only/有到期日 adapter |

阶段 2 开始前必须把每个旧字段标成 `committed`、`session-owned`、`host-only`、`derived` 或 `legacy-adapter`，并为 adapter 写唯一 source/target 与到期条件。任何双写方案都不得作为长期兼容策略。

## Stage 2 recovery/headless adapter

唯一 source 是 recovery snapshot v1 的 `state` 12 切片，唯一 target 是 `seti-committed-game-state-v1`。新 recovery snapshot v2 和 headless checkpoint 的 `coreState` 只保存 `StateStore.serialize()` 产生的 `committedState` JSON；旧 `state` 不随新格式双写。删除条件是所有受支持持久化产物均已升级到 committed schema，且不再需要读取 v1 存档。

| 旧字段 | 分类 | v1 target / 处理 |
|---|---|---|
| `solarState` | committed | `solarSystem` |
| `nebulaDataState` | committed | `data` |
| `alienGameState` | committed | `aliens` |
| `finalScoringState` | committed + session-owned | 永久事实进 `finalScoring`；`pendingMarks` 排除 |
| `playerState` | committed + legacy-adapter | 玩家资产进 `players`；`currentPlayerId` 归 `turn` |
| `turnState` | committed | `turn` |
| `rocketState` | committed + host-only + legacy-adapter | 棋子进 `pieces`；`statusNote` 排除；`nextRocketId` 归 `meta.sequences.rocket`；`Set` 显式转排序数组 |
| `planetStatsState` | committed | `planets` |
| `techGameState` | committed + host-only | `board` 等永久事实进 `tech`；`ui` 排除 |
| `cardState` | committed + host-only | 牌实例/牌序进 `cards`；`ui` 排除 |
| `cardTaskState` | derived | 排除；由卡牌事实/任务协议重建 |
| `setupSelectionState` | session-owned | 排除；只保留已写入玩家/对局事实的确认结果 |
| `runtime.aiControl` | host-only | 不进入 committed state；仍由宿主协议独立持有 |

读取路径先按 recovery version 分流：v1 调用 adapter 后进入 `StateStore.deserialize/migrate`，v2 直接反序列化 `committedState`；缺版本、未知版本、损坏 JSON、缺切片或非法 Set/序列均在修改旧可变切片前拒绝。headless checkpoint 的 replay journal 仍是独立协议：有 journal 时通过 reset+replay 重建 session-owned 决策状态，无 journal 的稳定 core checkpoint 则经同一 recovery 反序列化路径恢复。
