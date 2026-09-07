# 普通移动需求入口：实施前核对（2026-09-07）

状态：设计核对中，尚未修改生产代码。公司未来额度9968644b正在独立固定局验证，
不混入本项行为。目的不是关闭合法移动，而是普通move只经明确需求进入AI搜索。

## 已确认问题

77d36854完整局4372个普通移动物理节点，满额子集3597（96e60c14为3569）。
executedOriginCountByTargetAndDecisionKind中未绑定move有1571次归属，金星环绕1618、
金星登陆839、火星登陆676；归属可重叠，不能直接除以物理节点当互斥占比。
来源：reports/research/14114d45.77d36854.full.json，逐search诊断求和，无AI重跑。

expected-score-evaluator的根动作经目标目录；树内无routeTargetId时先构造targeted，
再把其他正式动作作为untargeted补回。排除集合只有quick_trade/card_corner；
另排除寰宇与公司/卡牌方向Decision，但普通move仍可补回。结果是目标目录已经
拒绝的方向又无目标进入搜索。绑定路线本身的actionAdvancesProbeGoal不能约束该入口。

旧strategic-goal-evaluator.test.js在约1060/1107处明确要求高成本/远目标的移动
仍以未绑定后继返回。此要求已被用户需求式原则替代；不能为旧断言恢复无目标入口。
资源可达、旋转后重新计算、不同目标真实路线等业务义务仍须保留并验证。

## 边界矩阵与待核对项

| 边界 | 现有owner/primitive | 本项义务 |
|---|---|---|
| 正式合法集 | probe-turn-session及Production inputPort | 不删正式move，不改费用、移动事件、支付choices |
| 根AI候选 | enumerateSecondaryAgentRootTargets/selectSecondaryAgentRootActions | 仅有目标目录兼容身份的move；保持target/plan/source |
| 无目标树内入口 | selectSecondaryAgentSuccessors的targeted/untargeted | 移动只能从targeted进入，不在未绑定后继补回 |
| 绑定探测路线 | actionAdvancesProbeGoal/movementNextSteps | 等付费成本及等步数的真实不同首步仍保留，不slice成一个 |
| 收入/数据来源 | 各自probe acquisition plan | 核对其正式路线复用，不把“不是orbit/land名字”误判为无需求 |
| 移动支付及后续奖励 | 现有conditional与正式Session | 移动发起后正常支付、访问、奖励及结束，不把结算动作当无目标move删除 |
| 计划与隐藏信息 | 既有plan-continuation及投影 | 原输入证据、来源、主次目标和未知牌边界不变；完整计划正式重放 |
| RNG/id/事务 | 正式执行链 | 不合并状态或伪执行；实际输入经过原primitive，记录不得缺输入 |
| 去重与费用 | 当前完整状态/origin区分及路线图 | 本项不新增等价合并；合法不同前态不因终点相同被合并 |
| 预算与性能 | 原全局4096和时间期限 | 不改上限/beam/time，不用截断冒充完成；单点实际耗时≤30秒 |

尚需在生产patch前核对收入/数据probe与根条件/树内支付的完整调用闭包，并冻结具体
行为用例。不扩大为目标目录、访问奖励或启发式偏好的重构。

## 验收计划

1. 复用真实42等既有检查点，先只读候选证明无目标move泄漏，再验证修复后的每个move
   均有明确target/plan；保留正式合法集与最低成本的所有等价首步。
2. 覆盖无目标目录、资源不可达、旋转更新、其他来源与收入/数据需求；测试实际行为，
   不让已失效的结构断言驱动恢复旁路。
3. 独立单决策记录物理节点、正式输入数、实际用时、失败分类及完整计划重放。
   单点不过门槛不跑全局；不预言节点减少必然使完整局均分提升。
4. 实施后同步设计/接口/迭代说明，中文独立提交，research --list和robot_iterate唯一
   固定局验证；已通过对照109.5，失败版100.5不是新门槛。所有截断继续逐项记录。
