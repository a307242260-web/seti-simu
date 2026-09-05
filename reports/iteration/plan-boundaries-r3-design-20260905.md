# 第三轮计划依赖设计与开工审计（2026-09-05，设计已冻结、实现未验收）

结论：当前计划不是逐步假设模型。直接把新回合的检查接入同回合，会把错误基线带到
每一步，并可能误报计划自身推进；需要先闭合执行步与假设状态的对应关系。
以下开工审计发生在生产修改前；当前按文末冻结设计实现中，尚无第三轮固定盘面实验。

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

## 复合依赖映射与真实输入缺陷（2026-09-05）

已核对production-kernel正式目标生产者：probe的targetId/requirementId，
`sector:win:<sectorId>:<nextSettlementNumber>`，`tech:gain:<tileId>`，
`data:analyze`，`income:gain:<六轨基线>`。收入的probe计划另带probeRequirementId，
不能把所有income目标都当作没有外部依赖的数据动作。

| 目标或具体选择 | 必须引用的事实 | 不得使用的替代 |
|---|---|---|
| probe或income的probe计划 | 当前routePlan对应的正式候选、终点标记与路线移动步数 | 整叶根目标、任意同终点候选或最终叶观察 |
| tech:gain及研究条件选择 | 具名tile供应remaining/bonus/depleted、指定blueSlot | 只看research_tech主行动target（正式主行动本身不一定指定tile） |
| sector:win及具名扫描选择 | 指定sector的结算编号、标记/排名、剩余槽位 | 全部无关扇区一起比较，或只比动作是否还合法 |
| data:analyze、income数据计划 | 本席计算机/蓝槽布局及对应计划前置；正常推进按逐步预测基线比较 | 第一条计划开始时的布局、把自己填数据当外部变化 |
| income卡牌/公司、私有牌准备 | 当前具体牌/能力的正式可用性；嵌套目标另加其依赖 | 给全部私有动作无条件套generic，或重新实现收费规则 |
| 公共选牌/扫描用牌 | 计划指定的公共槽位与卡实例；目标可能在后续conditional才明确 | 只检查play_card是否来自公共牌（不能覆盖真实choose_card/choose_target） |
| 外星痕迹选择 | 正式alienSlotId + traceType；首痕迹/额外标记及指定位置合法性 | 按物种名字定位槽位、读取槽顶层firstPlaced |

同一步可能同时服务probe目标并处理科技/选牌/痕迹条件选择，依赖集合必须取并集，
不能用旧单kind优先级把其中一项覆盖。若目标在后继条件选择中才具体化，采集层应先
保存该边界必要的小型公共事实，计划提取再按同一目标段内实际后继选择确定依赖；
不能在当前尚未知目标时猜默认项，也不能因此整体比较所有无关盘面。

### 已复现的外星观察契约缺陷

`simulation-contract.sanitizeAlienPublicState`用Object.values丢掉正式槽键1/2，输出
只有revealed/alienId/traces；旧findAlienSlot按id/slotId/alienId匹配正式数字target，
无法定位。即使补编号，firstPlaced/ownerPlayerColor实际在traces[traceType]内，
旧planDependencyFromPlan/currentDependencyFromStore仍读错层级。

`r3-alien-dependency-input-20260905.json`使用已有真实canonical存档，经正式sanitize
生成观察，2槽×3痕迹均被旧依赖读取成present=false、firstPlaced=null。没有手工给
观察补字段，也没有重跑搜索；这是输入/读取缺陷的直接证据，不是完整游戏行为证明。

完整方案必须同步修正公共观察：保留正式公开槽编号，不暴露assignedAlienId；依赖按
编号和traceType读真实痕迹对象。隐藏信息遮蔽、outcome-model、Browser/Simulation共用
观察与RL字段说明一起核对。该问题属于第三轮依赖输入的必要修正，不称为本轮新引入。
旧手工fixture里补id或把firstPlaced放顶层的断言不能作为正式形状验收证据。

本项新输入契约已回填设计，未开始生产patch。下一步集中落实上述复合依赖的采集/提取
接口与失败契约，尤其是“后继选择确定目标”的目标段切分；不在接口未闭合时零散改旧检查。

## R3实现设计冻结（2026-09-05）

本节取代前文待定的采集/提取接口。所有正式执行入口仍是上文三处；不增加规则执行器。

- 搜索接收`capturePlanStep`只读回调，由Heuristic装配计划模块的事实采集函数。
  每次真实提交前获取完整同viewer观察，沿既有信息屏障遮蔽后立即提取小型事实；只有
  提交成功才累计到节点局部`planSteps`。失败分支不产出成功计划。未安装回调的非计划
  counterfactual使用方不新增采集，不能凭空生成可复用计划。
- 每条证据包含原生action语义/actor、前置事实，以及origin当时的目标深度、routeTargetId/
  routePlanId；宏节点内折叠步骤逐条记录。节点共用的事实只读共享，各origin的目标归属
  分开保存。旧actionChain/executionStepCount/routeActions保持原义，元数据不参与去重。
- 事实包含当前可见的路线候选及终点标记、具名科技供应、具名扇区状态、公共卡实例、
  本席数据布局和具名痕迹。不是全状态快照；不保存资源余额作为外部变化、不保存隐藏牌。
  外星sanitize保留正式slotId，痕迹读取位于traces[traceType]，不得隐式用数组下标定位。
- winning leaf提取独立步骤序列：按目标深度和当时routeTargetId/routePlanId划分连续目标段。
  每一步依赖为其当前目标及该段剩余具体选择所需事实的并集；后继选牌/科技/痕迹/扇区
  已在赢家步骤中具名，所以不猜未知选择、不比较无关扇区。当前段结束后不继承已完成
  段的依赖。收入probe计划按正式probeRequirementId映射，私有牌/能力可用性沿正式合法集。
- 对每一步只比较执行前假设，而非最终叶或根settled观察。计划结构版本化，包含当前
  步证据与剩余步骤；advance同时推进动作、依赖和揭示基线。旧单依赖计划不再获得复用。
- 协调器统一调用planReuseCheck；sameTurn只控制控制动作例外。任何步先校验合法性与
  actor，再比较揭示/复合依赖。无变化同回合end_turn/PASS正常复用；新回合控制动作仍
  必须重决策，newTurnReuseEnabled=false仍生效。reset/load仍清空瞬态计划，执行失败
  不前移缓存；正式owner/CAS/stale/late/wrong-owner校验不变。
- 缺少必需事实/旧证据版本/动作与证据不对应时显式miss并记录原因，重新决策；采集
  回调抛错为明确counterfactual失败，不吞错、不补generic。已知无外部依赖的私有/控制
  步可拥有显式空依赖集合，仍检查actor/合法性/揭示；不把未知作用域视为空集合。
- Browser/Simulation都在现有Heuristic函数安装同一回调；outcome-model透传证据，
  诊断工具不另建执行或估值路径。AI/RL、测试义务和受影响注释同步更新；旧sameTurn
  合法性旁路与生产中的单依赖提取/推进入口删除。旧诊断输出若仍有消费者，仅作历史
  比较，不供生产复用。

验证集中覆盖：三提交入口一一对应、折叠支付不跳/重付、连续数据状态逐步更新、跨目标
依赖不串、同回合揭示、无关变化复用、目标变化失效、控制动作两种回合语义、未知证据
显式失效、正式外星观察与隐藏信息、根状态/RNG隔离。先行为反例与单步性能≤10秒，再
干净提交的固定盘面200步→终局（106.75基线），实现和效果双门禁；不新增预算或权重。

### 实现进展（尚未验收）

已接入三类正式提交前的事实采集、成功后入链、origin 目标归属和叶透传；协调器同回合
与跨回合使用同一检查，计划缓存按解析后的 seat owner 保存，失败提交不前移。公共外星
槽保留正式编号，数组输入缺编号时不猜下标。缺少具名依赖事实显式 miss，不把两份缺失
值当作未变化。协调器 unit 已迁移到逐步证据接口，并补同回合揭示/依赖变化反例。

当前仅完成语法与 diff 空白检查，尚未运行行为验证。剩余：计划纯函数及正式 fork 路径
测试、具名路线/目标段依赖复核、诊断消费者与受影响文档完整同步、集中回归、单步性能、
提交后固定盘面及版本登记。此工作树仍是第三轮中间实现，不是可验收版本。

### 第一批行为证据与设计复核

逐步计划与协调器两组 unit 已通过。`plan-steps-r3-profile-20260905.json` 记录现有真实
开局的一次生产决策：2083.96ms、651节点、选择 launch；143叶/2111条真实提交证据，
123叶包含折叠步骤，逐叶证据数等于 executionStepCount。没有运行全盘。

同时暴露36条 `plan-target-scope-unknown`，因此尚未通过完整映射验收。复核正式目标
生产者 `enumerateSecondaryAgentRootTargets` 发现原矩阵漏掉 `decision:<actionId>`：
这是为当前 conditional choice 建立的结构目标，不是一个另有资源/奖励定义的战略目标。
其 owner、合法性与动作语义仍由当前正式 Decision 与协调器检查；外部依赖须由本目标段
的具名科技/扇区/痕迹/公共牌/数据选择提取，不能给未知 target 通配 generic。冻结矩阵
补入该已知类型后再继续实现，未识别的其他目标仍显式 miss。旧profile未保存36条的
逐条目标名，不能把36条全部归因于该类型；下一版采集必须保留目标/planId与失效原因。

### 具名路线来源复核与设计补全

第二版 checkpoint `plan-steps-r3-profile-20260905-589f5bea.json`：2161.36ms、651节点，
同样143叶/2111步骤，未知依赖归零；真实移动、支付、end_turn 三个同回合边界均命中。
集中回归72个unit通过、2个用户排除的旧失败（原断言与行号不变），唯一full-flow通过，
V输入审计通过。以上不能覆盖路线来源粒度问题。

代码复核发现 route 事实按 targetId 收集同终点全部候选，超出了“当前路线”的依赖范围。
正式来源集合由 production-kernel 给出：`sourceId=launch` 或 `rocket:<id>`；同终点可有
多个 source。未绑定根的 selectRouteTarget 还可能只返回终点（routePlanId=targetId），
不能假定每条计划都带 `probe:<requirementId>`。移动后的支付仍须定位刚移动的探测器。

修订后的有限映射：采集正式候选 sourceId/rocketId；每个origin步骤同时携带当前或最近
probe行动（只读原生描述符，不执行规则）。编译当前目标段时，优先从当前/最近probe
及该段后继probe行动的rocketId定位当前已存在的source；若尚未发射、该实体尚不存在，
使用原origin具名probe requirement对应的launch候选。没有原生行动来源、也没有具名
requirement时显式缺证据失效，不取任意首候选或同终点全量候选。scope固定为终点与
sourceId二元组，比较该来源的移动步数和奖励标记；无关探测器变化不能使它失效。
收入probe采用同一映射。该修订不改目标选择、搜索分支、费用、RNG或实际行动顺序。

来源细化已实现，新增“同终点其他探测器变化仍复用”的unit通过。第三版checkpoint
`plan-steps-r3-profile-20260905-09dd888d.json`：2087.10ms，真实同回合三个边界仍命中；
有20条 `choose_card` 步骤缺路线来源，全部属于 `orbit:venus:planet:` /
`probe:rocket:1:orbit:venus:planet:`。不能以显式miss为由宣称映射验收通过。

下一项必须闭合的语义是“正式目标结果已达成、奖励Decision尚未排空”。搜索已有
`goalCompletionPending`，在 `currentCompletesRouteTarget` 后记录、直到结算排空才推进
目标深度；当前计划证据没有携带它，仍给后续选牌套未完成路线依赖。需复核它在全部
origin分叉、节点折叠与跨回合路径的归属后，确定如何让已完成目标仅保留奖励选择依赖；
不得因候选消失就猜目标完成，也不得简单忽略所有 choose_card 的路线依赖。暂不进入
全盘或提交；上一轮72/2回归早于来源细化，不能作为当前精确代码快照的全量证明。

### 目标完成后的奖励阶段（2026-09-06，补全设计）

已复核conditional分支：`currentCompletesRouteTarget`先设置`goalCompletionPending`，
conditional子origin原样携带；只有session排空后才推进proxyDepth并给下一目标重置。
计划证据直接携带该既有布尔值，不另做完成判定，不改搜索时钟。pending=true的步骤
不再依赖已完成的战略目标，但仍提取该奖励段后续实际选择的具名依赖，并检查合法性、
actor、语义和揭示。未完成目标的choose_card仍保留原目标依赖，不按family特判。
目标段切分增加该阶段位，防止未完成段与奖励段混为同一预测边界。

同时复核最近probe证据：不能直接复用全搜索历史的lastProbeAction（它跨目标存活）。
只从同目标深度、同target的上一条逐步证据继承；新目标优先其原生动作/后继动作或
具名requirement。两项均为证据归属修订，不修改正式提交、目标完成规则或搜索预算。

### 候选提交前验证（2026-09-06）

上述奖励阶段与来源归属已实现。最终代码指纹`d2f49e3e`的单决策记录为
`plan-steps-r3-profile-20260905-d2f49e3e.json`：2291.44ms、651节点、143叶、2111条提交
证据，123叶有折叠步骤，失效映射为空；真实移动、支付与end_turn三个同回合边界命中。
这只证明该样本与列明的unit边界，不外推为全盘或无bug保证。

- 最终集中回归：unit 72通过/2旧失败，唯一full-flow通过；两项失败仍分别为
  simulation-counterfactual-outcome.test.js:365与strategic-goal-evaluator.test.js:348，
  按用户要求不处理。V输入审计通过，diff空白检查通过。
- 已同步AI设计、RL观察/计划契约、仓库AGENTS导航、四轮计划、测试清单与受影响注释。
  README与PROJECT_MEMORY已核对，运行入口/架构导航/长期workspace口径不变，无需修改；
  仓库无CLAUDE.md和PROGRESS.md。没有移动runtime、修改浏览器脚本顺序或UI装配，
  本轮不新增Chrome迁移smoke；Browser/Simulation使用同一协调器与采集函数。
- 旧单依赖字段只在非light历史诊断快照计算，不再参与生产计划构建与复用；同回合
  合法性旁路已删除。实验未增加预算、改变估值或恢复旧执行器。
- 下一步提交候选后按研究去重执行200步与同版本完整终局，对照R2e的106.75。
  在终局和结果归因完成前，不登记第三轮通过，不启动第四轮。
