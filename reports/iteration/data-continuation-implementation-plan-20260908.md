# 连续数据需求执行：实施设计（2026-09-08）

输入版本483fc706（生产ee3ea52f），完整局111分；本方案尚未实施。目的不是新增
填数据偏好，而是将已确定的连续放数据执行链从反复排队改为在同一fork连续提交，
减少中间恢复、观察、优先级计算与队列工作。4096物理批次、256前沿、30秒不变。
真实正式输入仍逐个计数；新代码必须有实耗证据，不能只报合并后的节点下降。

## 已有行为证据

data-successor-boundaries-20260908.json：第53步132处，每处所有来源均只选下一次
place_data，目标/计划不变，无目标完成或待完成状态；2个正式输入为放数据+选位，
结束时idle，未产生新信息屏障。全部继承原有信息遮蔽。当前键、来源集合和后继键
与旧逐节点记录一致。未证明融合后全局队列顺序或终局分数相同，必须实际验收。

## 完整边界矩阵

| 项目 | 唯一owner与实施职责 | 反例/验收义务 |
| --- | --- | --- |
| 目标准入 | expected-score-evaluator新增数据连续共识函数，复用selectSecondaryAgentSuccessors；仅data:analyze或income:data:computer-slot-4 | 混入科技/探测/无绑定来源立即留在外层，不复制资源阈值 |
| 初始边界 | 首输入仍走原executeNode；只有已成功的需求选位融合后才尝试下一place_data | 不接管旧唯一computer排空、弃牌、支付或独立条件根 |
| 所有来源 | 非空且每个来源非条件根、非待完成、非等待换回合；逐来源均只有同一合法place_data，绑定和resultTargets保持 | 来源冲突、多选、空结果、绑定改变均退出；不得只检查首来源 |
| 根观察 | 连续执行只对已有非空outer chain来源开放；仍使用首次数据选位前证据作为rootActionObservation | 首根不得把多次放数据后的状态充当首动作已结算状态；排除chain为空 |
| 目标推进 | 数据/收入目标在没有收入Decision的place_data后不会完成；已有advanceRoutePlan只在probe:launch消费发射事件 | 仍显式检查正式目标完成函数，已完成/待完成或路线改变不能连填 |
| 正式规则 | rule-composition内复用inputPort.submitAction/submitDecision，不直接改data/player/session | 每输入相同actionId、stateVersion、decisionId/version/owner；wrong-owner/stale仍正式拒绝 |
| RNG | 每个原独立边界用原branchKey(完整envelope,actionId)重设；保存必须是独立快照，禁止trustedFork冻结活动session | 与reset→restore→提交对照，逐边界完整envelope相等；不能只比资源或假设不抽牌无随机变化 |
| 选择循环 | 每次新place_data后重新计算选位共识；当前动作和“该次起手后第一个选位”状态随链推进 | 不能继续用最初action或executionStepCount===1限制导致只接一半链 |
| 奖励闭包 | 选位后有任何awaiting_input则停止：收入、精选、痕迹、科技及嵌套后续均交原搜索 | computer4、蓝3、完成蓝列等不越过Decision，不自动替奖励选牌 |
| 隐藏信息 | 每输入retainStep立即维护原masked/barrier；共识读取同一sanitize后的观察/合法集 | 已masked允许继续但绝不解除；出现新的屏障停止，保留根已知信息和来源各自标签 |
| 正式计划 | captureStep/retainStep保留每次输入，probeSteps逐输入编译，不只保留首末 | 获胜planSteps正式逐步执行；每步证据、收入、资源和最终状态核对 |
| 外层动作链 | execution记录实际连续的外层place_data序列；nextChain/routeActions/targetRouteActions/goalTraceActions按该序列推进 | 不把多个起手压成一个actionId；选位原属节点内融合，不额外伪造外层选择节点 |
| 条件深度 | 显式记录本批末端的条件深度：需求选位+1，开始下一普通place_data按原外层规则重置0 | 替代原node.depth+Boolean(dataSettlementEvidence)两处计算；不让之前选位深度污染末端奖励深度 |
| 来源裁剪标记 | 累加实际选位代表裁剪数，逐来源合并其标记；首动作观察证据只保存一次 | 不因一个来源有裁剪就给其他来源标记代表裁剪；失败/停止不提前计数 |
| 状态等价/去重 | 完整envelope、session、RNG与来源键不删除字段；只连续执行已确定链 | 不按资源摘要、动作名或结果分数合并不同路径；不恢复支配剪枝 |
| 停止与错误 | 条件/奖励/来源不一致回到原外层；选择器错误不继续执行，按原外层逐来源显式报错 | 原合法失败保持fail，不用null/default吞错；不吞掉已经提交后的错误 |
| 时间与循环 | 每次连续提交检查原deadline；总数据池与可用位置给出有限下降量，仍保留原排空保护 | 不抬30秒；记录每次实际输入与执行批次，不把截断改名为完成 |
| 装配与旧入口 | heuristic-decision-function只增加共识回调到既有secondaryAgentSearch；Browser/Simulation共用同一路径 | 无环境适配、第二执行器或独立策略；不迁移其他domain |

## 实施与验证批次

1. 在授权临时工作树中实施完整三文件方案与现行AI/RL说明；主目录继续dev。
   不在本轮改科技借用、评分、痕迹贪心或资源准备策略。
2. 在现有unit体系验证共识、混合来源、绑定/resultTargets、根边界、既有遮蔽、
   新屏障、收入/精选停止；规则仍由唯一Production执行。测试只验证该已定义方案。
3. 从同一实际根对比原独立边界与连续边界：完整envelope、分支种子、正式输入、
   计划事实、根观察、外层动作链及条件深度。异步/恢复/事务不靠资源快照代替。
4. 相关unit、唯一full-flow、V输入审计、语法和文档同步；现有失败按已知记录区分，
   不通过删通用断言求绿。一次真实单点冷验证<30秒才进入完整局。
5. 标准去重全盘：比较111基线及108.5最低线，所有降分按用户流程归因；实际节点、
   正式输入、实耗及所有截断并列报告。实现正确不等于效果通过，均分上涨不代替正确性。

## 预期与风险

预期减少连续数据链的中间执行开销，腾出的4096额度可能被其他合法分支补满。
与已有融合一样，搜索排序/beam边界可能改变；这是需验收的搜索行为变化，不能
称为纯等价性能优化。若节点下降但耗时不降或分数下降，按标准记录分析，不调权重。
132是一个根的已执行连续机会，不是全盘收益上限，也不是可保证删除的132节点。

设计检查范围：rule-composition的executeNode、来源推进、conditional/ordinary后继；
expected-score-evaluator的数据选择、完成判定、路线推进；heuristic装配；
docs/implementation-proof-obligations.md与当前AI数据融合契约。方案不修改规则或
存档schema，README/AGENTS无需调整；AI/RL当前实现说明必须随生产patch更新。
