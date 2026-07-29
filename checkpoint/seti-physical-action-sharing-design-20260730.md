# SETI 虚拟目标间共享物理反事实执行设计（2026-07-30）

## 目标

同一反事实 envelope、同一 Standard Action、同一规则深度的执行结果与虚拟
`routeTargetId` 无关。搜索应只提交一次真实 Action/Decision，再把同一 observation、
successors、Session checkpoint 与 RNG 结果分发给所有兼容的虚拟目标 origin。

这是无损公共子表达式消除，不是结果缓存，也不减少目标或路线。

## 当前问题

v46 为控制耗时，每个 legal action 只绑定排序第一的探测器目标；节点等价键又包含
`routeTargetId`。若恢复同一 launch/move/trade 对多个目标的探索，同一规则分支会被重复提交。

当前 secondary beam 仍是“每个 root action 只保留一个后继节点”。本批把公平单元修正为
`root action + root target`，但每个虚拟目标仍只保留一个 frontier 节点；这是既有的有损 beam，
不是本批声称解决的完整路线探索。它会在物理共享 benchmark 后单独移除，不能把本批结果描述成
完备搜索。

## 完整设计矩阵

| 语义 | owner / primitive | 状态等价 | RNG / id / Decision | 事务边界 | 本批处理 | 证据 |
|---|---|---|---|---|---|---|
| 物理节点 | Rule Composition counterfactual fork | `envelope bytes + session checkpoint + actionId + rule depth` 相同才等价 | branch key 不含虚拟目标；同一物理 action 只消费一次派生 RNG | 仍提交正式 Action/Decision，并建立一个正式 child checkpoint | 一个 node 持有多个 origins | physical execution diagnostics |
| 虚拟 origin | Expected Score target catalog | `rootActionId + rootRouteTargetId + currentRouteTargetId + proxyDepth` 区分规划语义 | 不创建规则 id、不消费 RNG | 只携带 chain/目标/深度/成本 metadata | merge 时不得覆盖不同目标 origin | unit |
| 根目标 | Evaluator 正式 requirement | 同一 action 可兼容所有正式 probe targets | 不变 | 仅目标目录 | 从 `matchedGoals[0]` 恢复为全部 matched goals | catalog unit |
| 后继选择 | Evaluator per-origin selector | 每个 origin 用自己的 routeTarget 选择 compatible successor | 不变 | 共享执行后才按 origin 分叉 | 不共享 selector 结果 | integration |
| 叶 | Outcome 按 root action 聚合 | leaf identity 必须含 root target，不能因 actionChain 相同相互覆盖 | 不变 | observation 可共享只读值，路线 metadata 独立 | leaf/frontier id 加 root target | evaluator |
| beam | Rule Composition | 公平 key 改成 `root action + root target` | 不变 | 仍标记 pruned/low confidence | 不再让同一 action 的不同目标互相淘汰；每目标一条的损失明确保留 | diagnostics |
| 搜索预算 | Rule Composition | physical execution 计一次；每 origin 的 15 目标深度独立 | 不变 | 128/512/8 不变 | 不通过缩预算换性能 | benchmark |

## Proof obligations

| 验收 | 最小反例 | 期望 |
|---|---|---|
| 所有正式目标进入目录 | 一个 launch 同时可去两个星球 | 两个 target 均绑定该 action |
| 物理执行共享 | 同一 action 有两个 root target | executed node +1，不是 +2；两个 origin 均继续 |
| RNG 等价 | 共享 action 消费随机 | 两目标看到同一正式随机 outcome；canonical RNG 不变 |
| 目标不互相覆盖 | 同 action、同 chain、不同 target | 两个 leaf/rootRouteTargetId 均存在 |
| beam 损失透明 | 同一虚拟目标存在两条后继路线 | 本批仍只保留一条并计入 pruned；不得宣称完备 |
| 性能判断 | root target 增加后仍低于 10s | 同时报告 rootTarget、origin reuse、executed/pruned；只看耗时不算通过 |

## 后续门槛

本批完成后先跑单决策 benchmark：

1. 若多目标覆盖增加，且物理共享使决策仍稳定低于 10 秒，下一批移除每目标单路线 beam，
   以 exact transposition 与资源支配关系替代。
2. 若共享后仍因事务克隆接近或超过 10 秒，再评估 copy-on-write；在此之前不做。

## 单决策结果

12 次固定 checkpoint benchmark：

- root target 由 11 增至 42；同一物理节点累计服务 293 个额外虚拟 origin；
- transposition/物理合并 337 次，实际执行 512 次；不共享至少需要约 805 次提交；
- 复跑后的正式结果为 median 4629.13ms、p90 4704.20ms、max 4711.66ms；
- 原始/保留 frontier 76/40，最大 origin 数 96；
- 触发 `maxExecutionNodes=512`，仍有 5 个 frontier 节点未执行，因此本结果不是完备探索。

结论：物理共享有效且必须保留；但恢复 42 个目标后已经打满执行保护。若直接把执行上限扩大到
1024，按当前每节点成本将接近或超过 10 秒；后续移除每目标单路线 beam 还会继续扩大。因此进入
copy-on-write 设计是合理的，但不能用跳过状态校验或 Session 事务换速度。
