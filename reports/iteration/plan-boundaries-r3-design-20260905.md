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

## 执行闭包审查补充（2026-09-05）

已完整读取rule-composition.executeNode（含finally清理）。搜索的正式提交集合只有
下列三处；这是本轮逐步证据采集的有限集合，不另建执行器：

| 正式提交位置 | 覆盖语义 | 采集边界与失败处理 |
|---|---|---|
| current提交 | 普通Standard Action，或当前session正式Decision choice | 提交前采集；沿原owner/decisionVersion提交；失败不得进入成功步骤链 |
| settleChoice提交 | 正式弃牌点选/确认、唯一支付、唯一交易选牌、计算机强制选位 | 每次真实submitDecision各一项；不能只记录宏节点结算后状态 |
| nextPlaceData提交 | 上一次计算机选位结算后连续提交下一次place_data | 每次submitAction各一项；保留其后独立选位证据，不重复扣费或假造合并动作 |

正式effect自动执行不经以上inputPort提交时，不另造可供协调器提交的步骤；它造成的
状态变化体现在下一次真实提交的前置证据中。folded executionStepCount包含以上三类，
现有actionChain仅含current：R3不能修改既有actionChain含义来顺带影响估值、长度排序、
预算或目标完成计数，必须增加独立的计划执行证据链。

### 已排除的方案

- 搜索结束后重放赢家补状态：executeNode每节点调用resetBranch(branchIdentity)，
  且end_turn通过专用单席位时钟推进；普通actionChain重放既缺折叠步骤，也不保证相同
  RNG边界。禁止另写重放执行器或借canonical状态冒充原fork证据。
- 用cheap观察直接补空字段：共享rule-observation明确省略planets/data/solarSystem/
  finalScoring，路线标记依赖不能把缺失planets当作0或null再宣称未变化。必须读取完整
  viewer-safe投影并即时提取所需小型事实；不能长期持有cheap可变引用。
- 只记录一次revealedCount：rootActionSettledObservation在多个条件步骤后才形成，
  不是每个前置边界；不能继续作为所有后续步骤的统一揭示基线。

### 已确定的采集方向

沿上述原提交路径、在提交前采集独立的只读计划证据；提交成功后才加入当前节点局部
步骤链。执行owner、RNG、id、费用、drain规则、剪枝和节点数均不改。完整投影经现有
隐藏信息遮蔽后，立即提取小型事实，不保存每原子步整份大观察。原子步骤携带actor与
action语义，origin将步骤链和当时routeTargetId/routePlanId一起持有；禁止使用共享节点
的某个任意根目标替其他origin建立依赖。叶输出与outcome-model透传必须保留该对应关系。

同席位规划时钟推进本身不是计划动作。end_turn之后与延迟FINAL_MARK排空后的推进
都必须使下一条前置证据来自推进后的真实fork；不生成对手步骤。隐藏信息barrier在current、
settleChoice及连续place_data后各自按实际产生时机生效，不能等宏节点结束才决定此前
步骤是否有权看见新牌；不改变现有搜索动作遮蔽和分支执行范围。

### 冻结前最后两项（尚不写生产代码）

1. 依赖提取映射：probe终点/当前routePlan，tech:gain，sector:win，data:analyze，
   income:gain以及条件动作目标（科技/外星槽/公共牌）；必须覆盖折叠步骤与同一步可能
   同时依赖目标路线和当前条件选择的情况，不能再靠单个kind优先覆盖其他依赖。
2. 性能与缺证据语义：完整投影采集的开销须计入单步门槛；确定元数据callback契约、
   失败返回与旧计划结构删除证据。不得为了省时跳过折叠步骤、补generic、每步重搜，
   也不得扩充搜索预算掩盖开销。设计冻结后统一修改采集、传递、提取、消费及文档。
