# P2：需求确定的数据选位结算方案（2026-09-06）

最新状态：按用户指令暂停填数据，优先阿米巴。未验收生产候选已保存为
data-settlement-p2-paused-20260906.patch并移出工作树，不用于后续阿米巴实验。
下文为候选设计和历史证据，不是当前生产契约。

补证：冲突重放漏掉宏chain折叠的computer第1格提交和后继place_data；补齐后
分析选blue1、收入选computer的冲突与边界判断通过。随后RNG元数据断言失败：
1702029963→1428043238；因此仅以业务函数不直接调用random来证明RNG等价不充分。
见data-settlement-p2-contract-20260906-complete.json；未修改规则以迎合断言。

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
| 连续填数据 | 既有nextPlaceData循环 | 本轮只新增起手第一次选位的共识，后续沿用原规则，不复用第一次的资源选择 |

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
不可未经证明改变含随机奖励路径的抽样；实施前闭合见下文，不覆盖其他含随机输入。

## 可证伪验收

- 纯选择接口：共识单选、收入与分析冲突、空结果、多选、绑定变化、条件根/奖励
  待完成不合并；直接复用真实棕52输入，避免凭空捏资源构造误导用例。
- 规则链：computer第4格保留收入选牌；blue3保留精选；其他蓝槽真实资源/分数
  保留；所有正式动作进入逐步计划，后续逐步执行可用，根状态/RNG隔离。
- 单决策：棕52的耗时、执行节点、正式提交次数和新旧选择/计划/叶证据。若耗时
  无显著收益，先解释是否预算空间被更多真实搜索占用，不以节点变少直接通过。
- 单决策通过后提交并登记P2，再去重quick→full终局均分≥108.5；独立缺陷单列。

## 门禁闭合（实施前复核）

science-session PLACE_DATA的完整执行闭包为abilities/data.placeData →
data/state.placeDataToComputer → token移动/奖励描述 → appendResourceBonus或排入
INCOME/PICK_CARD。没有抽牌或随机调用；listPickCardChoices只读取publicCards。
随机补牌发生在后续choose_card提交，新合并不执行它；后继节点仍以同一正式
envelope/action重置branch RNG。新合并因此只允许“place_data起手后第一次选位”，
不扩大既有连续填数据循环的随机语义；已有循环继续按原规则执行。

为保持原selector错误逐来源归属，新合并只消费无异常的共识；选择器异常必须返回
原外层selectSuccessors路径，由原markFailure([origin])显式记录，不在执行层把它
扩大到整个共享节点。实现需明确标注这是延迟到原错误owner报告，而非忽略错误。
若后续状态不再对应异常输入，则不得继续折叠，应在当前边界退出执行。

方案按以上范围冻结；测试仍需验证正式奖励边界与RNG不消耗，未完成不宣称通过。

## 未提交候选进展

生产候选已实现共识回调与既有排空链连接。棕52单决策：动作仍为place_data:50a9ac16，
4096节点，choose_target981（旧1243），实际成功输入5837次，完整决策12197.84ms
（旧10893.95ms）。15个计划输入可连续正式执行。仅该项不证明完整计划/奖励正确，
也未通过实际提速门槛；不运行quick/full，不把节点分类减少当作提速。

预算/统计unit通过。真实来源冲突验证两次未通过预设差异断言：直接根和按旧宏
actionChain执行后，分析/收入均选computer；旧搜索诊断曾出现blue1/computer分歧。
宏actionChain不是完整正式输入轨迹，是否缺少折叠输入或遮蔽上下文仍待核对，
不能据此修改生产selector以迎合测试。失败证据保留data-settlement-p2-contract*
记录。候选仍未提交、未验收；所有后续实验必须继续如实标明该状态。
