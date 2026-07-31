# SETI 单席位启发式规划设计冻结（2026-07-31）

## 目标与边界

启发式反事实搜索只规划 `focalSeatId` 在当前轮内的连续行动机会。白色结束一次行动后，
规划时钟直接进入白色的下一次行动；不执行、预测或读取其他玩家的行动、PASS、手牌、
PASS 预留牌选择、资源变化或公开盘面变化。白色未来选择 PASS 时，搜索在第一个 PASS
Decision 边界结束；真实 Session 已经进入 conditional Decision 时，仍由 Policy 正常选择。

正式四人游戏、Browser/Simulation 的 Standard Action、回合顺序、PASS 链、收入和终局规则
均不修改。近似只存在于可信隔离 counterfactual fork。

## 设计矩阵

| 状态 / owner | 语义来源 | 唯一 owner 与状态变化 | Decision / RNG | 失败语义 | 行为证据 |
|---|---|---|---|---|---|
| focal 主行动或快速行动 | Production registry / Effect Session | 继续执行正式 action、费用、奖励和 followup | 所有非等价 conditional 仍逐项外显；沿用 fork RNG | stale/owner 错误沿用正式提交失败 | 既有 counterfactual 与全量 Node |
| focal 普通 `end_turn` | `probe-turn-session` 正式清理后，planner-only turn transition | 正式 `end_turn` 先清理 focal 本回合状态；随后可信 fork 仅修改 `turn.currentPlayerId`、`turn.completedTurnPlayerIds`、`turn.turnNumber`、`turn.actionCycleNumber`，进入 focal 下一行动圈 | 不产生 Decision，不消费 RNG，不写正式 journal/replay | 非 trusted fork、pending Session、focal 不在 active seats 时 fail-closed | 固定盘面只有 focal actor 被执行；规划推进计数大于 0 |
| opponent 顶层 action | 用户明确要求当前不预测对手 | 不可达；不得调用 Production executor | 不枚举、不固定选择、不读取隐藏状态 | `COUNTERFACTUAL_OPPONENT_ACTION_FORBIDDEN` | `opponentExecutedNodeCount === 0`；actor 分项只有 focal |
| opponent conditional | 对手隐藏 Decision | 不可达；不得调用 selector 或 resolver | 不读取 choices，不消费 PASS 牌堆或手牌 | 同上 | 固定盘面无 opponent `choose_*` |
| focal 未来 PASS（普通路线内） | 当前轮规划终点 | 执行 PASS 到首个正式 Decision 边界后立即形成叶；不提交该 Decision | 不选择 PASS 预留牌；第 4 轮无 Decision 时也直接形成叶 | PASS 提交失败沿用正式失败 | 路线 leaf 不包含 `pass-reserve-card` choice |
| focal 根 PASS | 当前真实 Policy Decision | 与上一行相同：评估到首个 Decision 边界，不窥视后续 choice | PASS 被选中并真实提交后，Host 会以新 DecisionContext 再请求 Policy | 正式 Host stale/late 语义不变 | PASS outcome 在 Decision 边界结算 |
| focal 根 conditional | 已经真实进入的可见 Decision | 正常执行所选 choice 并到下一边界 | 非等价 choice 保持独立 timestep | wrong-owner/stale fail-closed | 既有 root conditional 测试 |
| terminal / max goal depth | 正式终局或 15 个已完成结果目标 | 保持现有叶生成 | 无新增 RNG / Decision | 保持 incomplete 与保护语义 | 固定盘面 frontier 自然耗尽 |

## Planner-only turn transition

前置条件：

1. 仅允许 `allowTrustedForkLifecycle=true` 的隔离 Composition 调用。
2. Effect Session 不得处于 `awaiting_input` 或运行中的非终态。
3. focal 必须属于 `turn.activePlayerIds`，且尚未 PASS。
4. 正式 focal `end_turn` 已完成，因此 focal 的 `mainActionCompleted`、回合事件和访问记录已由
   Production owner 清理。

提交内容：

- `turn.currentPlayerId = focalSeatId`
- `turn.completedTurnPlayerIds = []`
- `turn.actionCycleNumber += 1`
- `turn.turnNumber += activePlayerCount - 1`

明确不变：

- `roundNumber`、`startPlayerId`、`passedPlayerIds`
- 全部对手 state
- PASS 预留牌堆、抽牌堆、公共牌
- 太阳系、火箭、星球、数据、科技、外星人
- RNG、sequence、Decision version

planner transition 通过隔离 StateStore CAS 提交并参与 branch envelope、状态等价和 checkpoint；
不进入正式 game journal/replay，因为它不是游戏动作。

## 旧路径删除证据

- `expected-score-evaluator` 的 opponent `PASS/end_turn/conditional first` fallback 必须删除并改为
  fail-closed。
- secondary search 在执行节点前拒绝任何非 focal actor。
- 固定盘面诊断中 opponent actor 执行数必须为零。
- 文档不得再描述为“冻结对手按规则 PASS 推进”。

## 验收

1. 固定盘面不执行任何 opponent action 或 conditional。
2. PASS 前路线不选择 PASS 预留牌，不基于隐藏牌身份估值。
3. focal 可以跨多个自己的行动机会完成结果目标，最大目标深度仍大于 1。
4. 对手资源、手牌公开计数和盘面不会由规划器改变。
5. canonical root、RNG、Session、journal、replay 保持零污染。
6. 单次 Decision benchmark 不触发 4096 保护；节点与耗时相对 2377 / 6.74s 基线下降。
