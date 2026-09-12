# FRONTIER-MATERIALIZATION-01：删除无人消费的中途结果构造

状态：设计冻结；预算/耗时专项首个实现小目标，2026-09-12。
基于37409cbb，在当前预算临时目录实施。

必要性证据：188步CPU样本中addFrontierLeaf自身771ms，其直接clone约634ms，此外
还有完整观测构造及排序。该函数唯一调用位于secondaryAgentSearch分支，最终输出却
只读state.leaves；frontierLeaves既不进入战略输出，也不参与诊断、优先级、去重或队列。
非战略调用无法写入frontierLeaves，因此删除整个中途结果容器及构造函数。

| 边界 | 唯一负责位置/语义 | 本项变化与证据 |
| --- | --- | --- |
| 未完成且仍有后继 | rule-composition选后继并mergeNode | 不构造废弃结果，后继入队保持 |
| 已完成且继续搜索 | completedEndpoint → addLeaf | 完成收益、计划与来源保持 |
| 截断无真实叶 | markPruned / searchCompleteness | unresolved、原因和实际frontier诊断保持 |
| 既有真实叶后截断 | state.leaves | settled及incomplete并存保持 |
| 条件支付/奖励/PASS | 原独立处理分支 | 不改Decision owner、合法集或结算 |
| 非战略/control | 从未调用中途构造 | 输出移除恒空数组拼接，真实叶保持 |
| 状态/RNG/id/session | 正式fork及executor | 不改正式提交，删除纯派生观测及复制 |
| 去重/可达性/预算 | 原state/origin身份、资源下界、4096/256/30秒 | 全部不变，不降低深度或leaf数 |

删除证据：全仓不再有addFrontierLeaf/frontierLeaves生产引用；通用search_frontier
schema若有独立消费者不随意删除。文档不能再称未完成路线结果被保留用于诊断。

PASS：相关search unit和唯一full-flow通过（既有失败单列）；验证未完成无叶、完成后
继续入队、已完成但截断、非战略输出及根隔离。188步同输入单决策成功、节点仍4096、
动作和截断口径不变，正式搜索耗时低于原记录21172ms；CPU诊断不再用于公平墙钟对比。
若仅一次耗时通过，不外推稳定百分比。满足单决策门禁后再做新版本完整局。
本项只能减少无用处理，不能当作节点预算专项完成。
