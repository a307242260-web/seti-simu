# SETI-55 Gate B：RL 环境整改后放行复验

> 复验时间：2026-07-19（Asia/Shanghai）
> 基线：`dev@c7aca66` 纯净工作树
> 结论：**O01–O22 全部 PASS，放行正式训练、checkpoint 横向评测和常驻 worker 采样。**

本报告取代 SETI-44 的初始 Gate B 结果。初审发现的 10 个 FAIL、5 个 UNKNOWN 已由 SETI-46～54、SETI-57、SETI-58、SETI-63 修复或补齐与量词匹配的证据；性能与终局率只作为附加门槛，不替代硬契约。

## 1. O01–O22 最终结果

| ID | 结果 | 最终证据 |
|---|---|---|
| O01 reset/seed/config/episode 隔离 | **PASS** | `headless-env.test.js` 覆盖同 env A/A、A/B/A、fresh env 与 replay；SETI-53 清理模块级 seed/episode 遗留，重复 reset 的 opening/legal/checkpoint 一致。 |
| O02 observation/viewer 隔离 | **PASS** | `headless-env.test.js` 的 schema/key 与 viewer canary；对手私有牌、牌堆和异族私有字段不泄露，非 owner legal 为空。 |
| O03 decision owner 真值 | **PASS** | `headless-decision-owner.test.js` 覆盖 pending → effect owner → current player 真值链，SETI-49 移除按 decisionType 猜 owner 的旁路。 |
| O04 legal 稳定/版本/mask | **PASS** | `headless-legality.test.js`、`headless-env.test.js`：同 checkpoint 重复枚举稳定，actionId 唯一；wrong owner、unknown、stale version 均拒绝。 |
| O05 legal→executable 全称合约 | **PASS** | SETI-57/58 将所有顶层 family 收敛到标准 action registry；`standard-action*.test.js` 对注册、可执行、transition/replay 负责，`headless-legality.test.js` 与 worker 全局轨迹验证 legal mask 只由该 registry 产出。 |
| O06 15 顶层 family 行为覆盖 | **PASS** | `standard-action.test.js`、`standard-action-reference.test.js`、`standard-action-stage2.test.js` 与 `actions.test.js`/`rockets*.test.js`/`industry*.test.js`/`runezu.test.js` 覆盖 launch、orbit、land、research、scan、analyze、play、pass、move、quick_trade、industry、card_corner、place_data、runezu、end_turn 的独立执行路径。 |
| O07 7 conditional family 行为覆盖 | **PASS** | `headless-conditional-drain.test.js` 明确运行 7 个 family；SETI-47 为 `choose_final_scoring` 增加真实 producer、多选 fixture 与最终分数行为断言。 |
| O08 唯一项自动推进 | **PASS** | `headless-conditional-drain.test.js` 证明 choiceCount=1 由 deterministic drain 自动推进，不再作为 policy action 外显。 |
| O09 deterministic drain/禁 policy fallback | **PASS** | `headless-effect-failure.test.js` 注入 executor 失败并断言原错误直接抛出、无 skip/recover；SETI-51 删除失败后自动 skip 的掩盖路径。 |
| O10 禁浏览器/DOM/UI 依赖 | **PASS** | `headless-no-browser-globals.test.js` 对 document/localStorage/Image 安装 poison getter，完整 reset/step/terminal 访问计数为 0；SETI-48 切断 final UI 读取。 |
| O11 未迁移/未知 fail-closed | **PASS** | `headless-fail-closed.test.js` 对未知 pending/family/type/owner 逐类断言稳定结构化错误；inventory 与 enumerator 同源。 |
| O12 reward/terminal score 真值 | **PASS** | `headless-final-scoring.test.js`、`end-game-scoring.test.js`、`final-scoring.test.js` 以非零终局公式 oracle 核对 finalScore/scoreBreakdown；step reward 为前后状态增量，训练端另消费最终总分，二者职责无重算。 |
| O13 terminal/round/turn/非法终局动作 | **PASS** | `headless-terminal.test.js` 运行真实终局，断言 terminal 后 legal=[]、任意 step 拒绝且 checkpoint/cursor/RNG 不变。 |
| O14 非法动作原子性 | **PASS** | `headless-env.test.js` 对 wrong owner、unknown actionId、stale version 比较完整 checkpoint/replay/RNG/cursor，均无变化。 |
| O15 非零 replay 恢复 | **PASS** | `headless-env.test.js` 与 `headless-worker.integration.test.js` 在真实 action 后 loadReplay，observation/legal/cursor 完全一致。 |
| O16 非零 checkpoint 恢复 | **PASS** | 同上，在非零 cursor loadCheckpoint 后 observation/legal/checkpoint/RNG/cursor 完全一致。 |
| O17 worker/direct parity | **PASS** | `headless-worker.integration.test.js` 核对 opening、step reward、observation/legal、非零 checkpoint/replay 的 direct/worker parity。 |
| O18 timeout/crash/恢复/跨 episode | **PASS** | `worker-pool.test.js` 覆盖 timeout/journal；`headless-worker-resilience.test.js` 强制 terminate 真实 worker，generation 重建后 observation/legal/完整 checkpoint/RNG/cursor/replay 全一致。SETI-63 固定 headless Date 元数据。 |
| O19 背压 | **PASS** | `headless-worker-resilience.test.js` 在真实 worker 队列填满 maxPending 后断言 backpressure；`worker-pool.test.js` 覆盖释放与后续请求。 |
| O20 determinism/metamorphic | **PASS** | `headless-env.test.js` 的 fresh A/A、同 env A/A、A/B/A、checkpoint/replay；`headless-worker-resilience.test.js` 再验证崩溃恢复后的完整状态确定性。 |
| O21 长轨迹/单多 worker 可靠性 | **PASS** | `python3 tools/rl_worker_client.py --workers 4 --episodes 100`：100/100 在 200 decisions 上限内终局，illegal=0，无协议错误或 worker 恢复失败。 |
| O22 单/多 worker 性能 | **PASS** | 1 worker×10 局：1006 decisions，130.135/s；4 worker×10 局：4045 decisions，336.205/s，均超过 50 decisions/s。 |

统计：**22 PASS / 0 FAIL / 0 UNKNOWN**。

## 2. 可复跑命令与结果

### 2.1 语法与全量回归

```bash
node --check randomizer/app.js
for test_file in $(rg --files randomizer -g '*.test.js' | sort); do
  node "$test_file" || exit
done
```

结果：`randomizer` 下全部 `.test.js` 逐个通过，包含标准行动、条件链、fail-closed、终局、重放、真实 worker 恢复及训练协议。

### 2.2 100 局持久 worker smoke

```bash
python3 tools/rl_worker_client.py --workers 4 --episodes 100
```

```json
{
  "episodes": 100,
  "illegalActions": 0,
  "maxSteps": 200,
  "ok": true
}
```

### 2.3 性能

```bash
node tools/benchmark_rl_workers.js --workers 1 --games-per-worker 10 --max-steps 200
node tools/benchmark_rl_workers.js --workers 4 --games-per-worker 10 --max-steps 200
```

| 模式 | 局数 | decisions | aggregate decisions/s | 50/s 门槛 |
|---|---:|---:|---:|---|
| 1 worker | 10 | 1006 | 130.135 | PASS |
| 4 workers | 40 | 4045 | 336.205 | PASS |

## 3. 整改闭环

- SETI-46：唯一 conditional 自动推进。
- SETI-47：7 类 conditional 与真实终局计分选择。
- SETI-48：headless 禁止 DOM/UI 读取。
- SETI-49：decision owner 真值链。
- SETI-50：未知 pending/family 结构化 fail-closed。
- SETI-51：effect 失败不再自动 skip。
- SETI-52：smoke/benchmark 采用可配置 200 步预算与可定位失败诊断。
- SETI-53：同 env 重复 reset 的 seed/episode 隔离。
- SETI-54：terminal 后 legalActions 为空且 step 原子拒绝。
- SETI-57/58：15 类顶层动作收敛到标准 action registry，并补齐 family 行为契约。
- SETI-63：真实 worker 崩溃恢复的完整 checkpoint parity 与真实背压。

## 4. 放行判断与残余风险

Gate B 硬契约及性能门槛全部通过，环境可用于正式训练、checkpoint 横向评测和常驻 worker 采样。当前没有已知阻断项。

残余风险属于持续工程监控：规则扩展时必须同步标准 action registry、conditional inventory 与对应行为 fixture；性能数字受机器负载影响，但本次最低单 worker 结果仍为门槛的 2.6 倍。
