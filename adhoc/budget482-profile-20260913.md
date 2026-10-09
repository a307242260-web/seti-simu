# 最慢决策耗时剖析：第 482 步（2026-09-13）

对象：合回 CARD-TERMINAL-VALUE-01 后的完整局 `card-terminal-value-20260913`（578 步，均 113.5）
中最慢的一次决策——**step 482 白席 `industry:e887dc52`（深空探测 1x 行动）**，完整局记录 29375ms。

临时目录：`/tmp/seti-budget-time-20260913.NkMouN`，起点 `dfc06418`。
输入：`adhoc/budget482-input-20260913.json`（前 481 步纯重放逐步核对 action/after；
比较前对 action 做 JSON 归一，因为存档会丢弃 `undefined` 字段）。

## 1. 时间分桶（同一输入的冷决策）

| 版本 | wall | total | fork | execution | projection | checkpoint | frontier | identity | orchestration |
|---|---|---|---|---|---|---|---|---|---|
| 开目标簇跟踪 | 27553ms | 22450ms | 6% | 13% | 9% | 7% | 3% | ~0% | **62%** |
| **生产口径（不开跟踪）** | **21723ms** | 16837ms | 6% | 13% | 9% | 8% | 2% | ~0% | **62%** |

即：诊断开关本身要 ~6 秒（22%）；生产口径下 21.7 秒里有 **10.4 秒是 orchestration（未计入任何桶的部分）**。

## 2. CPU profile（`adhoc/budget482-notrace.cpuprofile`，17933 采样）

| 自耗时 | 函数 | 说明 |
|---|---|---|
| **37.96%** | `structuredClone` | 深拷贝状态 |
| 9.27% | (garbage collector) | 大量临时对象的回收压力 |
| 4.94% | `stableSerialize @ state-store.js` | 状态序列化（哈希键） |
| 3.78% | `deepFreeze @ rule-composition.js` | 冻结拷贝 |
| 3.41% | `canShare @ heuristic-decision-function.js` | |
| 2.27% | `envelopeHash @ rule-composition.js` | 分支键哈希 |
| 2.23% | `copySerializable @ policy-port.js` | |
| 1.91% | `stableSerialize @ rule-composition.js` | |

按文件：`js_transferable`（structuredClone 实现）37.96% > `rule-composition.js` 13.54% >
native 9.63% > `state-store.js` 5.78% > `heuristic-decision-function.js` 5.06% > `production-kernel.js` 4.86%。

## 3. structuredClone 的调用路径（自耗时归因）

| 采样 | 调用链 | 性质 |
|---|---|---|
| 1284 (19%) | `clone @ rule-composition.js:22` ← `projectionInner` ← `projection` ← **`captureStep`** ← `executeNode` | 每次正式输入捕获计划证据时全量深拷贝+冻结观测 |
| 902 (13%) | `clone @ outcome-model.js:34` ← **`projectOutcomeObservations`** ← `run @ heuristic-decision-function.js` | 搜索结束后为每个 outcome 重投影并深拷贝 |
| 724 (11%) | `clone @ session-runtime.js:18` ← **`restoreCheckpoint`** ← `restore` ← `executeNode` | 每节点 fork 恢复（隔离契约） |
| 586 (9%) | `plan-continuation.js:750` ← **`capturePlanStep`** ← `captureStep` ← `executeNode` | 每个计划步骤抽取时再深拷贝投影/路线/扇区/科技 |
| 440 + 363 (12%) | `clone @ rule-observation.js:31` ← `buildRuleObservation` ← `buildObservation` ← `projectCounterfactualState` | 构造观测 |
| 333 + 145 (7%) | `cloneShared @ outcome-model.js:540` ← `buildOutcomeProjection` / `publicStateOf` | 结果投影的共享对象克隆 |
| 235 (3%) | `clone @ state-store.js:35` ← `beginWorkingCopy` ← `dispatchStandardAction` | 每次提交开工作副本 |
| 160 | `clone @ outcome-model.js:34` ← `createStrategicFacts` | 策略事实 |

## 4. 结论与可做的无损优化（按证据强度）

1. **`captureStep` 的全量投影克隆（1284＋586＝10.4% CPU，另加 GC）**：
   `projectionInner` 已有 `viewer.cheap` 分支（cheap 时跳过 `deepFreeze(clone(observed))`），
   但 `captureStep` 走的是完整路径。计划步骤抽取（`capturePlanStep`）本身已对自己保留的字段
   做结构化拷贝，因此把它切到 cheap 投影、由抽取方持有数据，是可以验证的无损方向
   （需覆盖 `sanitizeHiddenInformationObservation` 与"抽取是否需要 decision.choices"两个边界）。
2. **搜索结束后的 `projectOutcomeObservations`（902＋333＋145＝7.7%）**：
   按 outcome/叶重复深拷贝共享对象；可改为一次冻结后结构共享。叶数量大时收益线性增长。
3. **`restoreCheckpoint`（724，4%）**：fork 恢复的隔离契约，需谨慎；可评估"只恢复会变的部分"。
4. 诊断聚合本身也重：`traceGoalClusters` 开启要多 6 秒，属于调研成本，生产运行不承担，
   但说明 `deepFreeze/stableSerialize` 的路径值得收敛。

**边界**：以上都是性能方向，不改变搜索语义、预算或估值；但任何"去掉克隆"的改动都必须证明
不引入可变引用共享（否则会污染隔离 fork 或冻结状态），需按 §2.1 走独立小目标＋单决策门槛＋
完整局验证，不能用"省了时间"代替正确性证明。
