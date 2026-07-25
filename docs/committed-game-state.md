# CommittedGameState 与 StateStore 契约

## 唯一权威状态

`CommittedGameState` 是 Browser、Simulation 与训练环境共同使用的唯一已提交游戏事实。
Production Composition 内部持有唯一 `StateStore`；规则代码只能在 Effect Session 的 working
copy 上计算，稳定后通过一次 compare-and-commit 原子替换 committed root。

```text
Browser / Simulation input
          │
          ▼
Standard Action / Decision registry
          │
          ▼
Effect Session working copy
          │ stable
          ▼
StateStore compare-and-commit
          │
          ├─ BrowserProjection ──> Browser renderer
          └─ Observation ────────> Policy / Simulation
```

Browser Host、Policy、renderer、保存服务和测试都不能取得可写 root，也不能另建长期规则状态。
Browser 只拥有 ViewState、服务和 viewer-safe projection；Simulation 不加载 Browser app。

## 精确根 schema

当前 schema id 是 `seti-committed-game-state-v1`。根字段固定为：

- `meta`：schema/state version、game/ruleset、seed、可恢复 RNG 与全局实体序列。
- `match`：玩家顺序、对局阶段和已经成立的对局事实。
- `turn`：轮次、回合、当前玩家及 active/passed/completed 状态。
- `players`：玩家资源、分数、手牌、科技、公司、棋子库存和永久标记。
- `solarSystem`：旋转、扇区槽位与当前规则局面。
- `pieces`：探测器等实体的 id、owner 与规则位置。
- `planets`：环绕、登陆和卫星登陆的已确认标记。
- `data`：数据 token、计算机、星云、扇区控制与已确认结算。
- `cards`：牌实例、牌库、公共区、弃牌区和永久卡牌变化。
- `tech`：供应板、tile、首拿归属与永久科技变化。
- `aliens`：揭示、痕迹、物种实体和永久规则事实。
- `finalScoring`：终局板块配置与已确认标记。

根和领域对象均使用精确 schema。未知字段、旧字段、展示字段、流程状态、调试旁路和重复事实
直接 fail-closed，不做清洗后接受。

## 状态所有权

- 玩家集合唯一形状是 `players.players`，玩家身份字段唯一形状是 `{id, color}`。
- 当前行动者只来自 `turn.currentPlayerId`。
- 开局选择、支付、弃牌、卡牌选择、科技选择和外星人选择只存在于 active Effect Session；
  完成结算后不会进入 committed state。
- UI 坐标、图片、标签、tooltip、overlay、高亮、动画、Policy 配置和墙钟时间只属于 Host。
- 派生计数、展示序号、传统 readout slice 和 Browser DTO 不保存回 committed root。
- 星球标记不会再复制为第二个 rocket/piece；规则实体只保存一次。

## 全局实体编号

所有规则实体 id 由 `meta.sequences` 分配：

- `card`
- `rocket`
- `dataToken`
- `alienEntity`
- `finalMark`
- `nebulaToken`
- `nebulaReplacement`

任何领域模块都不得持有本地 counter、扫描现有数组猜测下一编号，或在恢复时补造编号。
提交校验要求每条 sequence 严格覆盖 committed state 中对应实体的最大编号。恢复、反事实 fork
和正常执行使用同一分配器与同一校验。

## StateStore API

| API | 契约 |
|---|---|
| `getSnapshot()` | 返回独立、深冻结的 committed snapshot。 |
| `beginWorkingCopy(baseVersion)` | 版本匹配时返回可变深拷贝；冲突时返回 `STATE_VERSION_CONFLICT`。 |
| `validate(candidate)` | 校验精确 schema、普通 JSON 数据图、领域不变量和跨领域引用。 |
| `compareAndCommit(baseVersion, candidate, metadata?)` | 校验成功后整根替换并递增版本；失败时 committed bytes 不变。 |
| `serialize(candidate?)` | 校验后生成确定性 JSON；不访问宿主存储。 |
| `deserialize(input)` | 只接受当前 schema；损坏、缺版本、旧版本和未知版本均拒绝。 |
| `subscribe(listener)` | 发布深冻结的 commit event；宿主 listener 异常不改变已成立提交。 |

StateStore 拒绝函数、`undefined`、Symbol、BigInt、循环引用、`Map`、`Set`、Date、DOM、
getter/setter、隐藏字段、稀疏数组和非有限数字。

## Effect Session 提交语义

Effect Session 是唯一规则流程 owner。Standard Action、Quick Action 与 conditional Decision
都经公共 input port 进入 Session，并只修改当前 working copy。只有以下条件全部成立时才提交：

1. effect queue 已清空；
2. 没有等待中的 Decision；
3. Session 未 blocked；
4. working state 通过全部 schema 和 invariant 校验；
5. base version 仍是当前 committed version。

执行失败、Decision 非法或 stale、版本冲突、校验失败和不可序列化数据均不得污染 StateStore。
barrier 前失败恢复工作副本；barrier 后失败保持 Session 为明确的不可逆阻塞状态，仍不提交非法 root。

## Browser、Simulation 与恢复

- Browser 与 Simulation 共用 Production Kernel、Standard Action registry、Effect Session 和
  StateStore schema。
- Browser renderer 只消费 BrowserProjection；Policy 只消费 viewer-safe observation、
  legal actions 和标准执行产生的 outcomes。
- 反事实执行从同一根状态创建隔离 fork，并调用同一公共 action/decision 执行链；不得复制规则。
- recovery 和 simulation checkpoint 只保存当前 schema 的 committed state 与协议规定的
  Session/replay 数据。
- 恢复必须先完整校验再替换 runtime；旧 schema、未知字段、非法引用或落后的 sequence 一律拒绝。

## 必要行为证据

长期保留的测试必须证明当前公共契约，而不是维护已删除的函数、字段或文件名：

- StateStore 隔离、原子提交、版本冲突和失败零污染。
- 领域及跨领域 invariant，包括玩家、卡牌、棋子、星球、数据、科技、外星人与终局标记。
- 所有 canonical sequence 覆盖实际 committed 实体。
- Effect Session 的 Action/Decision、stale/owner、barrier 与稳定提交。
- BrowserProjection 隐私、只读 DTO 和 renderer 异常隔离。
- Browser/Simulation 对同根标准行动的 committed state、journal 与 checkpoint 一致。
- 当前 schema 的保存恢复和唯一完整流程。

只断言旧 API 存在、旧文件结构、源码字符串、迁移阶段或历史 checkpoint 哈希的测试应删除，
不能要求生产代码恢复兼容入口来让这类测试通过。
