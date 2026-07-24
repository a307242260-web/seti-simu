# SETI RL Simulation Env 契约

Simulation 是 Production Composition 的无 DOM 宿主。它与 Browser 共用 StateStore、
Standard Action、Decision、Effect Session 和 Machine Player Host，不加载 `index.html`、
`app.js`、Browser projection、overlay、localStorage 或 Browser 恢复适配器。

## 正式入口

- `randomizer/app/simulation-env.js`：单局环境 API。
- `randomizer/app/simulation-contract.js`：Action/Observation schema 与可见性净化。
- `randomizer/training/simulation-rule-composition.js`：Simulation Composition 装配。
- `randomizer/game/rule-composition.js`：Browser/Simulation 共用的规则生命周期。
- `randomizer/training/worker-protocol.js`、`simulation-worker.js`、`worker-pool.js`：常驻采样。

## 环境 API

`createSimulationEnv()` 暴露：

- `reset(config)`：按 seed 创建当前 schema 的新局并推进到首个策略边界。
- `observe(viewerPlayerId?)`：返回 viewer-safe observation。
- `legalActions(viewerPlayerId?)`：返回当前 owner 的完整、稳定排序 Action descriptor。
- `step(action)`：复核 schema、identity、owner、state/decision version 后提交 Action 或 Decision。
- `isTerminal()`：读取 Production Composition 的终局事实。
- `getReplay()` / `loadReplay()`：读写已确认策略输入与环境事件。
- `createCheckpoint()` / `loadCheckpoint()`：保存和恢复当前 composition envelope、RNG 与 replay cursor。
- `evaluateActionOutcomes()`：在同根状态的隔离 fork 中执行标准 Action，用于策略评估。
- `runHeuristicPolicyDecision()` / `runOfflineTeacherDecision()`：经公共 Policy Port 和 Machine Player Host 选择，再调用同一 `step()`。
- `getDiagnostics()` / `getCounterfactualDiagnostics()`：只读性能诊断。
- `dispose()`：释放单局环境。

环境没有 pending inventory、resolver、recover、skip、DOM callback 或第二套规则 executor。
未知 family、非法 descriptor、stale、wrong-owner 和版本不匹配都零副作用失败，失败输入不进入
confirmed replay。

## Action 与 Decision

Simulation Action schema 为 `seti-rl-action-v2`。候选 identity 来自
`seti-standard-action-v1`，环境只增加训练所需的 `maskIndex`、`actionFeature` 与当前
authority version，不重新推导合法性。

顶层 family：

`launch / orbit / land / scan / analyze / research_tech / play_card / pass / move /
quick_trade / industry / card_corner / place_data / runezu_face_symbol / end_turn`

conditional family：

`choose_card / choose_target / choose_payment / choose_reward / choose_branch /
choose_final_scoring / accept_optional_effect`

两个以上非等价结果必须暴露为独立 Decision 和 policy step。确定性 Effect 与唯一等价选择由
Composition drain，不伪装成策略动作。

## Observation

Observation schema 为 `seti-rl-observation-v1`：

```js
{
  schemaVersion,
  seed,
  perspectivePlayerId,
  publicState,
  selfState,
  decision,
  actionHistorySummary,
  probeRouteRequirements,
  terminal,
}
```

- `publicState` 只包含回合、公开玩家资源/计数、公开棋子、星球、太阳系、公共牌、弃牌数量、
  科技供应、已揭示外星人与终局板块。
- `selfState` 才包含该 viewer 的手牌、保留牌、公司私有状态、外星人牌和任务状态。
- 对手手牌、牌库顺序、未来 RNG、未揭示外星人、executor、callback、recovery snapshot、
  Policy/heuristic score 和 Browser ViewState 不得进入 observation。
- `actionHistorySummary` 是公开行动日志的计数摘要，不是旧事务 history owner。

## State、Checkpoint 与 Replay

Simulation 只读取 Composition 的 committed snapshot 或 active Session working state。唯一
持久化根是当前 `CommittedGameState` schema；不得重建传统 slice root。

Checkpoint schema 为 `seti-rl-checkpoint-v1`，保存：

- Composition lifecycle envelope；
- 可恢复 RNG state；
- confirmed replay cursor 与环境事件；
- episode/policy/opponent/seat provenance。

恢复只接受当前 schema。未知 schema、损坏 envelope、RNG 不可恢复、journal/cursor 不一致或
stale Decision 一律 fail-closed，不迁移、不猜测、不续跑旧 pending。

Replay schema 为 `seti-rl-replay-v1`。每个成功的外部 Action/Decision恰好增加一个 policy
step；确定性结算进入对应 Effect Session journal/environment events。失败、超时、取消和迟到
PolicyDecision 不进入 replay。

## Reward 与策略评估

Reward 和价值评估只比较标准执行前后的 viewer-safe observation。反事实叶必须调用与真实
`step()` 相同的 Production Action/Decision/Effect 链，使用隔离 fork，不能用 Browser helper、
旧 selector 或手写资源变化代替。

策略模块只负责从 legal set 中选择 `actionId`。它不得提交规则、代替多选 owner、读隐藏信息
或改变 reward 事实。详细契约见 `docs/policy-port-contract.md` 与 `docs/ai-design.md`。

## 常驻 Worker

Python/PyTorch 通过版本化 JSONL 与常驻 Node worker 通信：

```bash
node tools/run_rl_worker_server.js --workers 4 --timeout-ms 120000
python3 tools/rl_worker_client.py --workers 2 --episodes 2 --max-steps 1000
```

worker 必须有有界队列、request deadline、backpressure、crash replacement 与 confirmed
journal recovery。每个 worker 独占 isolate 和环境实例；reset 必须清空 episode 状态，并通过
fresh A/A、同实例 A/A、同实例 A/B/A 与非零 checkpoint fork 证明隔离。

## 训练与评测

```bash
node tools/run_self_play_training.js \
  --episodes 2 \
  --seed baseline-v1 \
  --checkpoint checkpoint/self-play/baseline-v1.json \
  --log checkpoint/self-play/baseline-v1.jsonl

node tools/run_rl_evaluation.js \
  --checkpoint checkpoint/self-play/candidate.json \
  --report checkpoint/evaluation/candidate.json
```

冻结评测协议是 `randomizer/training/evaluation/stable-200-v2.seeds.json`：20 局、4 席、
每局最多 1000 次 policy 决策。通过条件为 20/20 正常终局、80 席均分不低于 200、P25
不低于 180、P50 不低于 200、非法动作率和阻塞率均为 0。修改 seed、样本数、分位数、
步数上限或门槛必须发布新协议 id。

## 性能门禁

```bash
node tools/benchmark_simulation_env.js --games 3 --max-steps 1000
node tools/benchmark_rl_workers.js --workers 1 --games-per-worker 5 --max-steps 1000
node tools/benchmark_rl_workers.js --workers 4 --games-per-worker 5 --max-steps 1000
```

常驻 worker aggregate 目标为 `>= 50 decision/s`。报告必须分列 boot、legality、transition、
effect drain、observation、serialization 与 inference idle；不得通过省略 observation、owner
校验、replay、自动结算或扩大等待窗口制造吞吐提升。历史机器实测不写入长期契约，以命令
生成的版本化报告为准。

## 验证

- unit：Action/Observation schema、隐私、stale/owner、checkpoint/replay、worker isolation。
- full-flow：唯一版本化完整流程。
- parity：Browser/Simulation 对同 descriptor、Decision、journal 和 committed checkpoint 等价。
- 性能：固定命令输出可追溯报告；性能测试不替代规则正确性证据。
