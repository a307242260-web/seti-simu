# P2：需求确定的数据选位结算方案（2026-09-06）

生产基点06738145，证据HEAD33299335。目的：省掉已经由需求选择器确定的数据
选位重入队列及fork恢复成本，不统一不同目标的资源取舍，不调整搜索预算或权重。
第一验收输入为棕52。全局数据选位仅1.75%，若局部实耗收益不足，不扩成搜索框架重写。

## 有限语义目录与owner

| 条目 | 唯一语义来源 | 合并要求与停止边界 |
|---|---|---|
| 分析目标 | expected-score-evaluator的data:analyze条件后继分支、selectDataPlacementChoice | place_data/选位不完成目标；analyze才完成。保留钱电牌宣传需求选择 |
| 数据收入目标 | income:gain:*且plan=income:data:computer-slot-4 | 只选computer。第4格后的收入选牌仍为真实边界，不能代选 |
| 科技目标 | tech:gain:*条件后继分支 | 先复用正式selector；数据选位不授予科技，不推进probe绑定，目标不因place_data提交完成 |
| 未绑定/其他目标 | 原selectRouteTarget/selectSuccessors | 不纳入本轮新折叠，保留外层目标选择与分支 |
| 条件根/已完成待奖励 | 原rootWasConditional/goalCompletionPending边界 | 不纳入本轮新折叠，避免越过条件根下一决策或奖励待完成边界 |
| 不同来源 | 原origin.routeTargetId/routePlanId/routeResultTargetIds | 每个来源独立调用正式selector；必须均为同一个合法单选，且来源绑定未改变 |
| 空结果/多选/冲突 | 原selector语义 | 新合并返回“不适用”，完整回到现有外层判定；不固定首项、不删来源 |
| 计算机/蓝槽输入 | science-session PLACE_DATA → abilities.placeData → data规则 | 唯一inputPort提交；保留token序号、资源、槽位、分数与事件 |
| 收入选牌/精选牌 | science-session INCOME/PICK_CARD | 新合并只接受data:computer/data:blueBonus选位，不吞掉后续choose_card |
| 嵌套奖励/揭示 | 正式Effect队列及既有captureStep/retainStep | 每次正式提交前采集计划，提交后累积事件/hidden barrier；遇非data决策继续原排空判定 |
| 连续填数据 | 既有nextPlaceData循环 | 沿用现有行动合法性与规则提交；每次新数据选位重新调用需求selector，不缓存第一次的资源选择 |

## 为什么不用执行前的过期目标猜选位

新入口只用于上述有限目录、当前宏根为place_data且来源非条件根/非完成待奖励。
science-session的place_data起手只排入PLACE_DATA决策，不消耗数据或发奖；分析
目标仅analyze完成，科技目标需获得科技，收入目标需收入增长。这些目标与计划在
起手到数据选位之间不发生外层目标切换或probe来源绑定。计算机第4格会产生收入
选牌，必须退出新合并；蓝3精选同理。不得把这一证明外推到卡牌/扫描/条件根。
实现仍须逐来源验证selector返回的target/plan/resultTargets不变，变化即回原路径。

## 实现边界

1. 需求选择owner仍在expected-score-evaluator。新增窄的“数据结算共识”函数，
   只检查上述资格并调用现有selectSecondaryAgentSuccessors；不复制资源阈值或
   收入/科技选择逻辑。返回“不适用”或合法共识选择及代表裁剪证据。
2. heuristic-decision-function将该能力作为secondaryAgentSearch回调传入。
   rule-composition只在原drain判定不能处理的数据选位调用；原支付等结算保持。
3. 输入使用与外层一致的遮蔽后观察/合法集、当前动作和各来源上下文。每来源调用
   后继选择器；单个来源返回空或改变绑定不能替其他来源做决定。正式selector异常
   不吞掉：须显式暴露，不能当作“无需求”返回空。异常归属在实现前复核，不把
   单来源异常擅自扩大成静默丢弃整个节点。
4. 正式提交复用既有settleChoice与capture/retain链；原代表选择的不完整性标记和
   裁剪计数不能丢失或重复累计。诊断successfulInputSubmissionCount继续按真实提交计数。
5. 不修改Browser/Simulation协调器、计划复用、评分或规则owner。新增回调装配及
   结算语义同步AI设计/RL契约；旧“策略choose_target全部不折叠”注释按范围纠正。

## 状态、预算与行为预期

完整envelope+动作+剩余深度的既有去重关系不变，origin归属不跨目标替换。
全局4096节点/256队列/30秒不变，目标可达性与资源下界仍由正式selector负责。
不是把选择记成0节点：必须在原fork中真实连续提交，省掉中间排队/恢复/投影。
合并会改变宏深度、actionChain和预算内树覆盖，不能要求旧叶ID逐字相等或宣称
所有搜索排序不变；真实输入计划必须完整、资源及奖励正确，固定盘面均分须至少108.5。
每次随机分支种子与隐藏信息处理必须明确：原独立选位节点会resetBranch，合并后
不可未经证明改变含随机奖励路径的抽样。**RNG边界仍待闭合，尚不能写生产patch。**

## 可证伪验收

- 纯选择接口：共识单选、收入与分析冲突、空结果、多选、绑定变化、条件根/奖励
  待完成不合并；直接复用真实棕52输入，避免凭空捏资源构造误导用例。
- 规则链：computer第4格保留收入选牌；blue3保留精选；其他蓝槽真实资源/分数
  保留；所有正式动作进入逐步计划，后续逐步执行可用，根状态/RNG隔离。
- 单决策：棕52的耗时、执行节点、正式提交次数和新旧选择/计划/叶证据。若耗时
  无显著收益，先解释是否预算空间被更多真实搜索占用，不以节点变少直接通过。
- 单决策通过后提交并登记P2，再去重quick→full终局均分≥108.5；独立缺陷单列。

状态：语义目录与执行方案已收敛；独立选位的RNG重置和错误来源归属仍是生产门禁。
