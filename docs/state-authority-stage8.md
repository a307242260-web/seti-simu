# StateStore 阶段 8：统一权威状态收口

## 结论

新 recovery/headless checkpoint 的唯一已提交游戏事实是
`seti-committed-game-state-v1`。新存档写路径不再构造 version 1 的旧 12-slice
snapshot，而是把当前 10 个规则 working projection 交给严格边界，排除
`cardTaskState`、`setupSelectionState` 以及 card/tech/rocket 的 UI/展示字段，随后只由
StateStore 校验并序列化。

旧 v1 存档仍可单向读取，但不会被新写路径生成。浏览器尚未直接消费共享 working
copy 的规则域被登记为有期限 adapter；它们不是第二份 persisted committed state。

## App / recovery

- `app.js` 的 recovery 输入只包含 solar/data/alien/final/player/turn/rocket/planet/tech/card
  十个规则切片；task 查询索引与 setup 选择过程不再进入输入或恢复目标。
- `game-recovery.js` 只调用 `serializeCurrentRuntimeStateSlices()` 生成 v2
  `committedState`；生产写路径不调用 `serializeLegacySnapshot()`。
- v1 restore 只经过显式 legacy read adapter；v2 restore 只反序列化 committed JSON，
  未知版本、损坏 JSON、缺切片和不可序列化数据 fail-closed。

## State / Effect Session

- StateStore 仍是 committed root 的唯一替换者；snapshot 隔离、working copy、schema / invariant
  验证和 compare-and-commit 语义不变。
- 已迁移 Standard Action/Effect Session 只在 working state 上执行，并在稳定完成边界做一次
  CAS。Decision、queue、journal 与 quick interrupt 不进入 CommittedGameState。
- `cardTaskState` 是由 cards/players working candidate 重建的查询索引；setup 选择是 setup
  session 状态，只有确认结果进入 match/players。

## Browser / AI / headless / RL

- BrowserProjection、ViewState、DOM、Policy context、legal actions、headless observation、replay
  和训练 feature 都是 committed/working source 的派生物，不能反向成为提交输入。
- AI 与玩家共用 Standard Action/Decision 提交端口；Policy 不写 StateStore、不 drain Effect。
- headless checkpoint 的 `coreState` 是 recovery v2 committed schema；非零 Decision checkpoint
  的 choices/journal 由 Effect Session 协议独立恢复。

## Mechanics 与确定性状态

资源、牌、科技、棋子、盘面、外星人和终局规则事实继续按领域分片保存；RNG 与影响续跑的
唯一序列位于 `meta`。展示 label、asset、layout、status note、UI picker、任务缓存和 setup
草稿均不属于规则事实。

## 残余 adapter 与机械门禁

`randomizer/game/state/authority-inventory.js` 记录最终 inventory；
`tools/audit_state_authority.js` 阻断：

- 新 recovery 再次调用 v1 serializer；
- 新 recovery 输入重新持久化 cardTask/setup；
- 未版本化的 `options.state` 写入口；
- adapter 缺 owner、到期日或已经过期。

当前两项残余 adapter 均由 SETI-71 负责、到期日为 2026-08-31：

1. legacy recovery v1 的只读迁移；删除条件是支持窗口内不再存在 v1 产物。
2. browser runtime working projection；删除条件是剩余浏览器规则域直接消费共享
   StateStore working copy。

完整可证伪矩阵与最终验证记录见 `checkpoint/seti-88-proof-obligations.md`。
