# 第三轮计划依赖开工审计（2026-09-05，设计未冻结）

结论：当前计划不是逐步假设模型。直接把新回合的检查接入同回合，会把错误基线带到
每一步，并可能误报计划自身推进；需要先闭合执行步与假设状态的对应关系。
本次没有修改生产代码，也没有新固定盘面实验。

## 已证实的问题

1. `machine-player-coordinator.runDecision`的sameTurn分支只检查actionId合法性，
   不检查揭示或依赖。窄协调器反例保持round/turn不变，仅将外星槽从未揭示变为揭示，
   仍返回`plan-reuse/planned`，没有再次调用决策函数。
2. `advancePlan`只移动continuation，把dependency/revealedCount原样复制到下一步。
   反例从研究前进到扫描后，依赖仍为blue1科技供应，而非扫描时的扇区状态。
3. `planDependencyFromPlan`优先取整叶的rootRouteTargetId，会将根探测路线依赖套在
   之后的其他路线动作上；`rootActionSettledObservation`优先作为chain[1]假设状态，
   但它可能位于多项conditional结算之后，与chain[1]前置边界并不相同。
4. 搜索当前只输出根行动后/根结算后/最终叶观察，没有与完整执行链逐项对应的观察。
   既有真实棕色诊断76叶中52叶executionStepCount大于actionChain.length，不能把
   chain索引当作实际提交索引；secondaryAgentTrace又只含非conditional、非控制动作。

证据：`plan-boundaries-r3-audit-20260905.json`；生成器
`adhoc/audit-plan-boundaries-r3-20260905.js`。前两项是直接使用真实协调器/计划纯函数的
窄边界反例，不冒充完整游戏；后两项结合代码与既有真实叶形状审查，不重跑AI。

## 完整设计必须解决的边界

| 边界 | 已知唯一owner | 下一步必须闭合的义务 |
|---|---|---|
| 普通动作/条件选择 | rule-composition的可信fork执行，正式Decision owner不变 | 每个可复用步骤有对应执行前的viewer-safe事实，不使用最终叶替代 |
| 折叠支付/放数据/唯一项排空 | 现有counterfactual执行中的正式submitAction/drain路径 | 区分协调器可提交步骤与内部已自动结算步骤；不能按长度猜、不能重放已扣费用 |
| 跨回合/跨路线 | 搜索的同席规划时钟与origin目标链；计划纯函数消费 | 依赖和目标随当前步骤更新，不能一直绑定rootRouteTargetId |
| 新信息 | 逐步假设的外星揭示与所依赖事实 | 同回合也检查；预期内自身推进不误判，预期外揭示不因较晚settled基线漏判 |
| 控制动作 | 协调器统一复用门控 | 无变化同回合end_turn/PASS仍可按计划；新回合控制动作必须重决策，保留既有防退化规则 |
| 缺失/隐藏/分叉 | 搜索已有information barrier、fullLeafObservation及origin归属 | 未知依赖显式失效，不伪造generic或补默认观察；不读取隐藏牌，不借其他根状态 |
| 提交/恢复 | 协调器execute及resetPlans，正式内核保留authority/CAS | stale/late/wrong-owner继续正式拒绝；计划仅瞬态，不进入存档，不改RNG/id/sequence |
| Browser/Simulation | 同一协调器与Heuristic函数 | 不恢复第二套复用路径；诊断工具与计划接口文档同步 |
| 性能/搜索语义 | 原节点、目标、费用与剪枝不变 | 元数据记录不增搜索节点；先单步性能门槛，再干净提交的快速/完整终局 |

不能用“每步都重新搜索”代替逐步依赖复用，也不能只保存第一步证据后声称完整计划
迁移完成。完整矩阵闭合前不写生产patch；下一步具体审查counterfactual执行里所有
折叠submit与隐藏信息边界，推导可复用步序列和元数据owner，再集中实现。

## 验收与排除项

实现符合上述边界后，固定盘面终局对比第二轮通过版本`20feca27`（106.75）；逻辑和效果
双门禁按`docs/robot-iteration-registry.md` §2.1执行。第三轮不改估值、目标选择、预算、
正式规则或用户明确暂不处理的两项旧测试。不因设计复杂要求用户确认技术实施顺序。
