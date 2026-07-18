# SETI-44 Gate B：RL 环境正向验收结果

> 审计时间：2026-07-19（Asia/Shanghai）
> 基线：`dev@c3e4cc2` 加共享工作树现状
> 结论：**不放行训练/评测。** 22 项中 PASS 7、FAIL 10、UNKNOWN 5；所有硬契约必须 PASS，性能和终局率不能覆盖 FAIL/UNKNOWN。

## 1. 结果总表

| ID | 结果 | 证据与可复跑命令/依据 |
|---|---|---|
| O01 reset/seed/config/episode 隔离 | **FAIL** | 同 env `seti44-repeat` 第一次 opening+legal digest `10c293...33b`，第二次 `774a79...8a7f`；fresh env 恢复第一次 digest。同 env A/B/A 还漂移牌、轮盘、火箭、痕迹和 choiceCount。见 SETI-53。 |
| O02 observation/viewer 隔离 | **PASS** | core snapshot 注入 `SETI44_OPPONENT_SECRET`、`SETI44_DECK_SECRET`、`SETI44_ALIEN_SECRET`；当前 viewer observation 三者均不出现，对手自己的 selfState 可见自己的 canary；非 owner legal=[]。现有 `headless-env.test.js` 同时通过 schema/key 检查。 |
| O03 decision owner 真值 | **FAIL** | cursor 22 的 conditional 输出 `source=effect_owner` 但 `effectOwnerPlayerId=null`；源码 `buildDecision()` 按 decisionType 近似推断，而非 pending→effect→current 真值链。见 SETI-49。 |
| O04 legal 稳定/版本/mask | **PASS** | seed `seti44-mask-property` 连续 106 个决策点重复 legal 完全相同、actionId 无重复；wrong owner/unknown/stale 均拒绝。 |
| O05 legal→executable 全称合约 | **UNKNOWN** | seed `seti44-all-legal` 在 40 个连续 checkpoint 对 356 个 legal action 做 fresh restore+fork，0 失败；但只触达 12 个 family，不能外推所有 family/状态。 |
| O06 15 顶层 family 行为覆盖 | **UNKNOWN** | 本轮真实轨迹触达 launch/orbit/scan/analyze/research/play/pass/move/trade/industry/card-corner/place-data/end-turn 等，但未形成 15 family 各自的独立 reachable fixture、execute、transition、replay 全链证据；land/runezu 尤其缺证据。 |
| O07 7 conditional family 行为覆盖 | **FAIL** | `choose_final_scoring` 仅有契约常量，未找到行为 producer；其余 family 也未全部形成多选 fixture。见 SETI-47。 |
| O08 唯一项自动推进 | **FAIL** | seed `seti44-coverage` cursor 22 暴露唯一 `choose_payment:8d5507ea551a5a0f`，`choiceCount=1` 且仍为 policy legal action。见 SETI-46。 |
| O09 deterministic drain/禁 policy fallback | **FAIL** | 禁用 heuristic/resolver 的现有源码断言通过，但 effect executor 返回失败时 drain 会调用 `skipHeadlessActionEffect()` 并在 skip 成功后继续，违反失败不得 recover/skip 掩盖。见 SETI-51。 |
| O10 禁浏览器/DOM/UI 依赖 | **FAIL** | 对 `document/localStorage/Image` 安装访问即抛错 getter，reset 在 `randomizer/app/final-ui-runtime.js:15` 读取 `root.document`。现有“未安装 fake document”不足以证明调用为 0。见 SETI-48。 |
| O11 未迁移/未知 fail-closed | **FAIL** | 未知路径只有通用文案，错误不稳定包含 state/family/type/owner；pending detection 与 conditional enumerator 不是同一 exhaustive inventory，无法证明未知 key 不穿透。见 SETI-50。 |
| O12 reward/terminal score 真值 | **UNKNOWN** | 快速终局最后一步 reward 与基础分未出现矛盾，但没有构造“终局公式产生非零增量”的 oracle，也没有逐 family reward delta 证据；不得按 PASS。 |
| O13 terminal/round/turn/非法终局动作 | **FAIL** | 两个快速终局 seed 在 `isTerminal()=true` 后 `legalActions()` 仍返回 9/10 个动作（含 pass）；step 仅因 actor=null 偶然拒绝，cursor 未增。见 SETI-54。 |
| O14 非法动作原子性 | **PASS** | wrong owner、unknown actionId、stale version 三类 step 前后 checkpoint 完全相同，replay/RNG/cursor 未变。 |
| O15 非零 replay 恢复 | **PASS** | seed `seti44-nonzero` 执行 1 个真实 `choose_payment` 后，fresh `loadReplay()` 的 observation/legal/cursor 与源完全一致。 |
| O16 非零 checkpoint 恢复 | **PASS** | 同一非零轨迹 cursor=1，fresh `loadCheckpoint()` 的 observation/legal 与源完全一致，恢复 cursor=1。 |
| O17 worker/direct parity | **PASS** | `node randomizer/app/headless-worker.integration.test.js`：同 config opening、一次真实 step、reward/observation/legal、非零 checkpoint/replay parity 全通过。 |
| O18 timeout/crash/恢复/跨 episode | **UNKNOWN** | fake worker 的 crash/timeout/action journal 测试通过，但真实 env 没有故障注入；且 O01 已证明常驻同 env reset 污染，不能把 fake 恢复当真实 PASS。 |
| O19 背压 | **UNKNOWN** | 代码存在 `maxPending`/`backpressure`，但现有测试没有并发填满真实或 fake worker 队列的精确断言；不得仅凭源码标 PASS。 |
| O20 determinism/metamorphic | **FAIL** | fresh env 同 seed 的完整 94 步轨迹/replay 完全一致，非零 replay/checkpoint parity 也通过；但同 env 同 seed reset 不一致（O01），所以总体 determinism 失败。 |
| O21 长轨迹/单多 worker 可靠性 | **FAIL** | 官方 `python3 tools/rl_worker_client.py --workers 4 --episodes 100` 首批即因 100 步上限失败；相同 4 seed 提高审计上限到 200 后分别 98/99/94/103 步终局。工具假阴性见 SETI-52；常驻 reset 污染见 SETI-53。 |
| O22 单/多 worker 性能 | **PASS** | 使用不截断合法局的 `--max-steps 200`：1 worker×10 局 1006 decisions，aggregate `140.672/s`；4 worker×10 局 4045 decisions，aggregate `284.559/s`，均 ≥50/s。默认 100 步命令仍因 SETI-52 失败。 |

统计：契约项严格计数为 **7 PASS / 10 FAIL / 5 UNKNOWN**。全量回归是工程基线，不计入 22 项契约，也不替代任一 FAIL/UNKNOWN。

## 2. 关键可复现证据

### 2.1 唯一 conditional 错误外显

```text
seed=seti44-coverage
cursor=22
actionId=choose_payment:8d5507ea551a5a0f
decisionType=conditional_choice
choiceCount=1
summary=消耗 1 能量
```

### 2.2 同 env reset 污染

```text
seed=seti44-repeat
same env reset #1 digest = 10c293544f5f777abab01397440d2d011b78bee937fda7bd370d2fb36a21333b
same env reset #2 digest = 774a79fda3bcbcefccf20f56373e1b3c092dba08c3d9e3f5755d8885ffb08a7f
fresh env digest         = 10c293544f5f777abab01397440d2d011b78bee937fda7bd370d2fb36a21333b
```

### 2.3 terminal 仍有 mask

```text
seed=seti44-determinism: 94 steps, terminal=true, terminalLegalCount=9
seed=seti44-terminal-actions: 106 steps, terminal=true, terminalLegalCount=10
terminal 后第一个动作 family=pass；step 因 expected actor=null 被拒绝，cursor 保持 106
```

### 2.4 worker 默认 smoke 假失败与真实步数

```bash
python3 tools/rl_worker_client.py --workers 4 --episodes 100
# RuntimeError: episode did not finish within 100 decisions
```

同一首批 seed 用相同 fast policy、审计上限 200：

```text
python-ipc-smoke:0 = 98 steps terminal
python-ipc-smoke:1 = 99 steps terminal
python-ipc-smoke:2 = 94 steps terminal
python-ipc-smoke:3 = 103 steps terminal
```

### 2.5 性能

```bash
node tools/benchmark_rl_workers.js --workers 1 --games-per-worker 10 --max-steps 200
node tools/benchmark_rl_workers.js --workers 4 --games-per-worker 10 --max-steps 200
```

结果：单 worker `140.672 decision/s`，四 worker `284.559 decision/s`；serialization/inference idle 均为百万级/s，瓶颈仍在环境但已过 50/s 门槛。

## 3. 工程回归

```bash
node --check randomizer/app.js
tests=(${(f)"$(rg --files randomizer | rg '\.test\.js$' | sort)"})
for test_file in $tests; do node "$test_file" || exit $?; done
```

结果：`randomizer` 下全部 `.test.js` 逐个通过。该结果只说明现有回归未退化；已被本审计的 singleton、DOM poison、repeat reset、terminal mask 反例证明，现有测试集不足以作为训练放行证据。

## 4. 缺陷子 issue

- SETI-46：唯一 conditional 自动推进。
- SETI-47：`choose_final_scoring` 行为 family。
- SETI-48：切断 headless `document` 读取。
- SETI-49：decision owner 真值链。
- SETI-50：未知 pending/family 结构化 fail-closed。
- SETI-51：effect 执行失败不得自动 skip。
- SETI-52：worker smoke/benchmark 过期 100 步上限。
- SETI-53：同 env 重复 reset 的 seed/episode 隔离（urgent）。
- SETI-54：terminal 后 legalActions 必须为空。

## 5. 放行判断

当前环境**不得用于正式训练、checkpoint 横向评测或宣称可复现的常驻 worker 采样**。最优先阻断项是 SETI-53（同 env reset 污染），随后是 SETI-46/47/49/54 的决策与终局语义；SETI-48/50/51 是架构禁区与 fail-closed 门槛。SETI-52 只修验证工具假阴性，不能改变环境正确性结论。

重新放行必须满足：上述高优先级子 issue 修复并为 O01–O22 全部补齐与量词匹配的 PASS 证据；不得以 284.559 decision/s、全量 Node 回归或 200 步内终局替代硬契约。
