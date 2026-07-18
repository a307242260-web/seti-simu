# CommittedGameState 与 StateStore 契约

## 结论与边界

`CommittedGameState` 是浏览器、headless 与训练环境共同使用的唯一“已经成立的游戏事实”。它是按领域分片的根对象，不是巨型平面对象。`StateStore` 是替换该根对象的唯一入口；Action、Effect Session、UI、AI、history 和宿主环境只能读取隔离快照，或在工作副本上计算候选状态。

本阶段冻结 reference schema、所有权、版本、验证、序列化与 compare-and-commit 语义，但不把旧 12 个可变切片立即双写到新存储。旧切片接入、领域净化和宿主迁移必须在后续阶段通过单向 adapter 渐进完成；在 adapter 覆盖矩阵完成前，`StateStore` 不是生产热路径的第二事实源。

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

## 分阶段覆盖矩阵与删除条件

| 阶段 | 旧来源 | 单向 adapter 目标 | 删除/切换条件 |
|---|---|---|---|
| 2 | recovery/headless `state` 12 切片 | v1 root（明确排除 runtime 与 cardTask 派生索引） | round-trip、旧版/缺字段/损坏恢复通过；没有双向双写 |
| 3 | solar/turn/planet/nebula/alien/final scoring | 对应纯领域切片 | 行为 parity、跨切片 invariant 与恢复测试通过 |
| 4 | players/rockets/cards/tech | players/pieces/cards/tech | UI 字段、`statusNote`、task index 迁出；实例 id 纳管 |
| 5 | `Math.random`、模块序列、cache | meta.rngState/sequences 或派生层 | 同实例 A/A、A/B/A 和非零 checkpoint fork parity |
| 6 | Effect Session working state | `beginWorkingCopy` + `compareAndCommit` | 已迁移 session 不再直接替换旧切片 |
| 7 | browser/headless/RL 读写入口 | projection/observation from same schema | 已迁移路径旧直写、UI/AI resolver 调用为 0 |
| 8 | 遗留 adapter 与旧存档 | current schema | inventory 全部 deleted/store-owned/host-only/有到期日 adapter |

阶段 2 开始前必须把每个旧字段标成 `committed`、`session-owned`、`host-only`、`derived` 或 `legacy-adapter`，并为 adapter 写唯一 source/target 与到期条件。任何双写方案都不得作为长期兼容策略。
