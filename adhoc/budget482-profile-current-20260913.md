# 482 最慢决策：当前代码的耗时基线（2026-09-13，A 阶段重测）

主仓库 `618501e0`（无桥、无配额），同一 482 输入，机器当前负载下 **31782ms**（此前同代码测得 25247ms，
更早 20363ms —— 单次绝对耗时不可比，只看占比）。

## CPU profile（25840 采样）

| 自耗时 | 位置 |
|---|---|
| 29.7% | `structuredClone` |
| 12.8% | GC |
| 4.1% | `stableSerialize @ state-store` |
| 4.0% | `canShare @ heuristic-decision-function:107` |
| 3.4% | `deepFreeze @ rule-composition` |
| 2.2% | `envelopeHash` |
| 2.1% | `copySerializable @ policy-port` |
| 1.9% | `findParentPackageJSON @ package_json_reader`（模块解析） |
| 1.8% + 1.8% | `stableSerialize @ rule-composition` / `deepFreeze @ outcome-model` |
| 1.3% | `stableHashSerialized` |

## structuredClone 归因（自耗时）

| 采样 | 调用链 | 占比 |
|---|---|---|
| 1342 | `clone @ outcome-model` ← `projectOutcomeObservations` ← `run`（搜索后处理） | 5.2% |
| 970 | `clone @ session-runtime` ← `restoreCheckpoint` ← `restore` ← `executeNode` | 3.8% |
| 756 | `plan-continuation` ← `capturePlanStep` ← `captureStep` | 2.9% |
| 537 | `clone @ rule-composition` ← `projectionInner` ← `projection` | 2.1% |
| 510 | `clone @ outcome-model` ← `cloneShared` ← `buildOutcomeProjection` | 2.0% |
| 476 | `clone @ rule-observation` ← `buildRuleObservation` ← `buildObservation` | 1.8% |

## 结论（A 阶段的目标必须修正）

- 上一份 profile 测到的 `captureStep` 19% 已经通过 planEvidence（合并版 `8badab3e`）消掉：structuredClone
  从 38% 降到 **29.7%**。
- 剩余可动项加起来约 **25~30%**（后处理投影 7%、restoreCheckpoint 3.8%、计划捕获 2.9%、
  projectionInner 2.1%、观测构造 1.8%、GC 12.8%、策略契约序列化 6%、模块解析 1.9%）。
- 即使把这 25~30% 全部吃掉，482 也只能从 ~31.8s 降到 **~22~24s**，**达不到 A 自己定的 ≤15s**，
  更达不到最终 ≤5s。
- 因此"最慢决策 ≤5s"必须由 **B 的节点削减**承担主要部分（无损上界剪枝把 4096 节点砍到几百），
  A 的贡献是给它腾出安全余量并降低每节点成本。
- 另外 `findParentPackageJSON` 占 1.9% 说明有热路径在做运行时 require，属于可以直接消除的白拿项。
