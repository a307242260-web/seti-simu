# SETI 完整尾部目标搜索设计冻结（2026-08-02）

## 目标与成功标准

完成首个次级目标后，不再按资源下界只保留一个后续目标。每个非支配完成态必须把全部当前可达
目标重新加入正式反事实 frontier，并继续执行到本席 PASS 或完成 15 个结果目标。最终仍只比较
正式叶子的实际分数、科技、后续轮初收入与剩余资源机会成本。

本轮不引入固定 top-K、beam、目标固定分或更高 node cap。若完整目标目录在现有 4096 物理执行
保护内不能自然耗尽，必须保留 `executionLimitReached` / incomplete 证据并先优化精确剪枝，不能
运行完整固定局或把截断结果称为完备搜索。

## 设计矩阵

| 语义 | 正式来源 / 唯一 owner | 搜索表示 | 状态与 Decision | 精确剪枝 / 失败语义 |
|---|---|---|---|---|
| 次级目标目录 | `expected-score-evaluator.enumerateSecondaryAgentRootTargets` | 每个 `targetId + planId` 一条目标绑定 | 只读取 branch observation 与正式 legal descriptor | 正式资源上界不可达时删除；不得按最低成本只留一个目标 |
| 目标内支付路线 | 各规则 projection、正式 action / Decision | 同一目标可保留多个资源支付 origin | 支付、奖励、RNG、followup 全走 Production fork | 相同目标下被另一状态完整支配才删除 |
| 目标完成态 | `completesSecondaryAgentRouteTarget` 与正式 branch observation | `proxyDepth + completion facts` Pareto frontier | 分数、资源、收入、科技来自正式 projection | 同根 action、同目标深度，事实逐项不差且至少一项更好才支配 |
| 后续目标展开 | 完成态重新调用目标目录 | 全部可达目标绑定进入全局 frontier | 已完成目标释放 route binding；新目标重新绑定 | 资源下界只作可达性与稳定顺序，不作目标删除 |
| 状态等价 | Counterfactual envelope、Session、RNG、action identity | transposition key / shared origin | Decision owner、stale、sequence 保持正式语义 | 完整规则状态和下一 action 相同才能共享执行 |
| 搜索优先级 | 正式 branch 的战略事实差值 | 精确最小堆 | 不改变叶子价值公式 | 优先级只影响执行顺序；不得以优先级当作删除依据 |
| 搜索终点 | focal PASS、15 个已完成结果目标、正式 terminal | settled leaf | PASS 不窥视预留牌；不模拟对手 | 4096 保护触发时保持 low confidence / pruned，不得伪装完成 |
| 最终选择 | `expected-score-evaluator.evaluateOutcome` | 每个根 action 的最佳正式叶 | Primary 后比较资源、转换数和目标深度 | 不给 action / goal / family 固定分 |

## 执行闭包

1. 根层仍完整建立 `action × target plan` origin。
2. 目标内部只执行与既定目标直接相关的正式 action、必要转换和 conditional。
3. 正式动作证明目标完成后，先将完成态送入既有 Pareto frontier。
4. 未被支配的完成态释放旧 target binding，重新枚举全部当前可达目标，并同时保留 PASS。
5. 每个新目标的非支配路线继续执行；standard action 数不计入 15，只有正式目标完成增加深度。
6. 叶子评价和 Policy 排序保持不变，以便把分数变化归因于搜索空间而不是权重调参。

## 验收义务

1. 单元测试构造同一完成态下“低成本低价值”和“高成本高价值”两个可达目标，二者都必须进入
   successor，不得产生 `targetSchedulerPrunedCount`。
2. 目标内部仍只允许与绑定目标相关的动作，不恢复无目标遍历。
3. completion dominance、transposition、等价 Decision 合并继续生效。
4. 固定开局单次 Decision 在 4096 节点前自然耗尽，`executionLimitReached=false`；未满足前不跑
   完整固定局。
5. 单次 Decision 仍以 10 秒为性能门禁；失败时记录节点分布与最深目标层，不提高 cap。
6. 行为与性能门禁通过后，才生成新固定盘面 HTML，并与 v20 的 62 分基线比较。

## 实验结果与结论

候选改动仅移除了深度大于 0 时的最低成本单目标截断，未修改估值权重、15 目标上限、
Pareto 支配、transposition 或 4096 物理执行保护。

- 定向行为测试通过：同一完成态下两个不同成本的可达目标都会进入 frontier。
- 固定开局六个根行动：`4096` 个物理节点触顶，单次约 `10.47–10.75s`；仍剩 `884` 个
  frontier 节点、`1488` 个 origin，分布在目标深度 1/2/3，最大完成深度只有 3。
- 单独只保留 `launch` 根行动并把诊断预算临时放宽到 `16384`：在 `7223` 个唯一物理节点、
  `17.25s` 后自然耗尽，形成 321 个叶，最大完成深度 6；该放宽仅用于容量测量，没有进入生产。
- 六根样本已发生 706 次完成态支配与 2035 次 transposition 命中，说明爆炸发生在既有精确剪枝
  之后，不能靠删除重复状态直接压回 4096 内。
- 最主要的 origin 是赢得扇区路线（1724），其次为分析数据（523）与多个探测器终点；正式卡牌、
  痕迹和支付 Decision 使目标顺序组合继续分叉。

结论：完全展开所有后续目标无法通过当前单次决策门禁。本候选生产改动已撤回，继续保留 v11 的
最低成本尾部调度；没有运行完整固定局，也没有把触顶结果作为策略得分。下一候选必须显式选择：

1. 目标级 Pareto 候选近似：同时比较不同价值/成本方向的若干后续目标，并报告被省略目标；或
2. 接受单根约 17 秒、整步更高的决策时间，并重新制定物理执行预算。

不得把本次失败解释为估值权重问题，也不得通过提高 `maxNodes` 宣称搜索优化完成。
