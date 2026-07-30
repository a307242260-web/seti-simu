# SETI 目标优先路线调度设计（2026-07-30）

## 目标与成功标准

改造前的次级搜索已经保存 `routeTargetId`，但目标目录建立时仍把所有“能缩小缺口”的快速转换
展开为同一目标的多个首步；最低损耗转换 DP 也会保留多个并列终态。结果是确定性的资源准备被
计为横向候选，`maxLeaves=8` 随后截断大量中间 origin。

本轮把搜索顺序固定为：

1. 枚举结果导向的具体次级目标；
2. 对每个目标计算当前正式资源缺口；
3. 直接目标动作已经合法时执行该动作；
4. 否则保留最低损耗、最少步数转换方案形成的非支配下一步集合；
5. conditional/followup 正式结算后继续同一目标；
6. 完成目标后才重新枚举下一批目标。

成功标准：

- 同一目标不会展开被其他方案严格支配的快速转换首步；
- 已锁定目标只返回直接推进动作与非支配资源/卡牌路线，不返回所有“稍微缩小缺口”的动作；
- 快速转换、发射、移动、放置数据、单次扫描仍不计入 15 个次级目标深度；
- 非等价卡牌、科技、支付和其他正式 conditional 仍完整执行；
- 固定盘面单次决策不触发 4096 物理失控保护，且不超过 10 秒；
- secondary search 的 `maxLeaves`、`maxNodes` 与 beam 截断均为零影响。

## Owner 与状态矩阵

| 状态 | 唯一 owner | 允许后继 | 禁止 |
|---|---|---|---|
| target-selection | Expected Score Evaluator | 从具体探测器终点、赢得扇区、分析数据、取得收入、具体科技/卡牌/能力结果中建立有限 `goalId`，并为每个结果建立非支配 `planId` | 按 action family 建目标、为未知 action 自动建立目标、把 8 个扇区全部展开 |
| target-bound | Expected Score Evaluator | 按当前 `planId` 返回正式 `nextStep`、服务该计划的卡牌路线，或同一计划的最低损耗下一步 | 切换 goal/plan、通用 legal fallback、随机转换 |
| target-conditional | Effect Session + Evaluator | 保留所有非等价 choice；数据分析路线按当前资源缺口选择直接补缺口的蓝科位，否则计算机位 | 按字典序固定任意卡牌/科技/支付 choice |
| target-completion-pending | Rule Composition origin | 等待同一 Session 的 conditional/followup 完整提交 | 提前枚举下一目标 |
| target-completed | Rule Composition + Evaluator | 从结算 observation 重新进入 target-selection | 复用旧缺口或旧目标 |

## 确定性资源计划

正式 quick trade 目录是资源图的边。对指定 target 的信用/能源要求，动态规划按以下顺序形成
非支配方案集：

1. 总资源损耗最小；
2. 转换步数最少；
3. 相同损耗与步数下保留不同终态资源向量；
4. 完全相同的终态才按首个 `actionId` 稳定去重。

每次正式 outcome 后以新 observation 重算剩余方案；因此奖励、conditional 或被动能力改变
资源后不会机械执行旧计划。重算仍满足最优子结构。

同一目标允许保留成本结构不同的较优路线。例如“支付 2 能源移动到火星”和“支付 1 信用打出
提供 2 移动的卡牌”都保留；如果“先支付 4 信用换 2 能源再做相同移动”没有额外分数、科技、
收入、卡牌效果或更优终态，则由同目标完成态的机会成本/资源可兑换支配删除。不同卡牌身份、
额外效果或不可互换的资源终态不能仅为性能固定删除。

打牌、研究科技和扫描只有在兑现已选结果目标时才是路线步骤；不能仅凭 action family 成为
目标。科技、卡牌效果和奖励分支等会改变分数、收入、科技或资源数量的 conditional 仍由正式
规则执行。资源路线中的弃牌支付组合，以及同一目标/同一扇区扫描后取得等量普通牌的选择，在
本版“分数、资源数量、收入、科技”状态抽象下视为等价，只稳定提交一个正式 Decision。

该等价是明确的性能折损：它不保留普通手牌身份对更远未来卡牌能力的差异，因此本版是对用户
指定终点评估事实完备的启发式搜索，不是对完整 committed state 的完备搜索。诊断必须单独报告
这类目标内部等价收敛次数；不得把它计作规则等价或宣称无损。

同一 root、当前 `goalId + planId`、完成深度和下一正式 action 下，目标内部 Pareto 可以在目标
完成前应用相同身份抽象。context 仍必须包含盘面、公开牌、RNG、科技布局、数据进度、回合 owner
和其他玩家完整状态；只遮蔽焦点玩家普通/外星手牌的具体身份、弃牌堆具体身份，以及已单独作为
Pareto 轴比较的分数、资源数量和收入。不同手牌类别数量、不同下一 action 或任一保留 context
不同均不得合并。

## 有限目标目录

次级目标描述明确的结算结果，不描述操作手段。目录只允许：

- 指定探测器在指定星球/卫星完成环绕或登陆；
- 本席赢得一个由启发式调度器选出的普通具名扇区；
- 完成正式数据分析；
- 本席任一收入轨总量增加；
- 取得一个具体科技结果；
- 兑现一张具体卡牌或公司/物种能力的独立结果；
- PASS 作为路线终止，不计目标深度。

`launch`、`move`、`quick_trade`、`place_data`、单次 `scan`、`card_corner`、支付和所有
conditional choice 都是已选目标内部步骤。打移动牌可以服务登陆目标；研究或放数据可以服务
收入目标；不得再建立通用 `card:play`、通用 `research_tech` 或 `action:${actionId}` fallback
目标。同一 action 是否完成目标由结算 observation 的结果差量判断，不能只看 family。

搜索 origin 必须拆分结果与路线：

- `goalId` 唯一描述完成结果和选择时的正式基线；
- `planId` 描述当前采用的达成路线及其正式 requirement；
- `resultGoalIds` 描述该计划正式结算时可能同时兑现的结果集合，首项是决定路线完成的
  `goalId`；
- 同一 `goalId` 可以同时保留多个非支配 `planId`；
- 同一 `planId` 若同时兑现具体环绕/登陆、收入或卡牌结果，只建立一条物理搜索路线；
  不得按结果类别复制相同的 action/Decision 闭包；
- 15 步只在 `goalId` 的结果证据完整结算后增加；
- 后继选择由 `planId` 驱动，不能用最近执行的 action 反猜路线；
- 同一 `goalId` 的不同 `planId` 只在完成态比较，不因首动作不同而互相误剪。

例如“获得收入”可以由 `probe:orbit:mars`、`data:computer-slot-4` 和
`card:<instanceId>` 三个计划兑现。环绕与打牌计划同时具有更具体的正式结果，因此分别以
具体环绕/卡牌结果作为首个 `goalId`，并在 `resultGoalIds` 中附带收入结果；数据第 4 槽只以
收入为结果。这样三种来源都进入收入结果目录，但环绕和打牌不会因同时属于另一个结果类别而
复制物理搜索树。生产 origin 以 `routeTargetId + routePlanId + routeResultTargetIds` 分别保存
这三类语义。

### 搜索字段迁移矩阵

| 边界 | `goalId` owner/语义 | `planId` owner/语义 | 失败边界 |
|---|---|---|---|
| requirement projection | Production Kernel 从 committed state 生成结果基线 | Production Kernel/纯 Evaluator 从正式 effect/route requirement 生成路线 id | 缺正式来源则不建立计划 |
| root catalog | Evaluator 输出有限结果 id 与该计划的 `resultGoalIds` | 每个 compatible action 绑定一个具体计划；同 plan 只出现一次 | action 不属于 legal set 时 fail-fast |
| origin identity | Rule Composition 保存当前及 root goal | 保存当前及 root plan；参与 origin、virtual root、dominance key | 不得只按 goal 合并不同未完成计划 |
| conditional successor | 继承当前 goal | 继承当前 plan，只保留相容 choice | 实际 choice 不支持计划时该 origin fail-closed |
| completion | Rule Composition 在 Effect Session 结算 observation 上调用 Evaluator | plan 只用于验证完成路径，不决定结果真假 | 仅 action family 命中不得完成 |
| depth | 计划的首个 goal 从未完成变为正式完成时 `+1`；同时兑现多个结果仍只加 1 | 不计深度 | pending/followup 未结束不得增加 |
| completed frontier | 按 goal 汇合同一结果的完成态 | plan 作为来源诊断，允许同 goal 跨 plan Pareto | 未完成计划不得跨 plan 支配 |
| leaf/report | root goal 解释机器人意图 | root plan 解释采用路线 | 报告不得把 plan 名冒充结果目标 |

RNG、实体 id、Decision version、Session owner、CAS 与 journal 都仍由 Production
Composition 持有；`goalId/planId` 只存在 counterfactual origin 元数据，不写 committed state，
不消费 RNG，也不改变正式 Decision choice identity。

Simulation 的 `buildObservation` 是本仓唯一显式可信、只读且自行复制输出字段的
counterfactual projection reader；Production Kernel 可在该窄装配下省略进入 reader 前的整树
重复克隆。Browser 和其他未声明可信 reader 继续先克隆，宿主回调隔离契约不变。

反事实 reusable fork 的 StateStore 与 Effect Runtime 使用
`trustedIsolatedOwnership/allowTrustedForkLifecycle`，其 working state 没有外部 listener 或
共享写 owner。该路径的提交验证固定为：

1. Effect Runtime 不重复调用 `store.validate`；
2. StateStore 核对 base/candidate version 后先写入唯一 next version；
3. StateStore 对该最终 candidate 执行一次完整 schema + invariant validation；
4. 失败时恢复 candidate version 并拒绝提交，成功后转移并冻结独占 candidate。

普通 Store、Browser canonical、外部 candidate、listener snapshot 与 restore 仍保留原有复制和
双阶段校验。各 Effect domain 的 `commitWorkingState` 在可信 fork 内返回同一独占 state；普通
路径仍复制，不能把此优化扩散为公共可变引用。

可信 reusable fork 内的 registry enumerate/validate、Effect Group factory、effect executor 与
Decision resolver 同样可以原位消费该分支独占 working state。若 executor 在抛错前已修改
working state，该反事实分支必须整体失败，并由下一次 `resetBranch + restore` 恢复 checkpoint；
不得尝试在该失败分支内 undo。checkpoint 保存/恢复、其他 frontier、canonical Store 和正式
Browser 提交均不共享此可变引用。

内部反事实 fork 不暴露 undo 输入，因此可信 Session 不创建 undo frame；否则 frame 与原位
working state 形成别名，既不能恢复执行前状态，也会污染 checkpoint identity。普通 Session
继续逐 Effect 保存 undo frame，并保持既有不可逆屏障语义。

可信节点保存完成后，本次 fork 不再继续修改 active Session；Rule Composition 将该独占
Session 直接冻结并转移给 immutable envelope，避免 `createCheckpoint` 与 envelope 装配各复制
一次。restore 仍必须复制 checkpoint Session，因为同一 envelope 可能被多个后继复用。

## 赢得扇区

正式状态 owner 是 `data.sectorSettlements`、`data.nebulae` 与
`data.sectorExtraMarks`。Policy observation 必须投影：

- 每个普通具名扇区的容量、未替换槽数；
- 各玩家当前标记数和最近一次 `replacementOrder`；
- 本席 `winsByPlayerId` 的 `{sectorId, settlementNumber}` 记录；
- 奥陌陌不产生赢家，因此不进入赢得扇区目录。

扇区 target id 是 `sector:win:<sectorId>:<nextSettlementNumber>`。完成条件必须是同一
`sectorId + settlementNumber` 新增到本席胜场记录；单次扫描、参与结算、获得数据或宣传都不
算完成。

目标目录不枚举 8 个扇区。调度器先用正式排名和平局后标获胜规则，对每个扇区计算“从当前
状态到下一次结算并由本席获胜”的最少新增本席标记数：

1. 当前未替换槽位必须全部被填满；已满扇区的后续扫描形成额外标记；
2. 本席最终标记数必须不低于所有对手；
3. 同标时，本席最后一个标记必须晚于同标对手；
4. 不能在剩余槽位与当前可达扫描上界内满足时证明不可达。

默认只保留最少新增标记数、再比较最低完整资源下界后的非支配候选；完全并列时按
`sectorId` 稳定选择一个，避免横向展开 8 个 root。除此之外，当前合法卡牌、科技或能力若能
定向额外触达某个扇区（例如观测比邻星），该扇区作为“专属触达候选”保留，即使它不是全盘
最低要求。进入反事实后只展开能扫描已选扇区或严格补足其扫描成本的步骤；每次正式结算后重算，
不预先枚举扫描排列。

扇区 `planId` 必须标明正式触达来源：标准扫描中的地球/相邻/公共牌/科技扫描、具体卡牌效果，
或具体环绕/登陆奖励。条件选择只保留已选扇区；一个来源实际不提供该扇区时该计划 fail-closed，
不得切换到另一个扇区继续。

## 获得收入

正式状态 owner 是 `player.income`。目标基线保存六条收入轨
`credits/energy/publicity/availableData/handSize/additionalPublicScan`，target id 为
`income:gain:<baselineHash>`。任一轨在 Effect Session 完整结算后高于基线即完成一次目标；
一次效果同时增加多轨仍只计一个次级目标。

收入目标不绑定 action family。打牌、放置数据、环绕、登陆、科技、公司或物种能力，只要其
正式效果存在可达的收入增量，都可以建立独立 `planId`；没有收入效果证据的普通 action 不进入该目标。
候选动作的收入可达性来自正式效果 descriptor/卡牌模型与当前 Decision 闭包，不能给动作设置
固定分。收入的一级估值仍只读取实际叶上的 income delta，并按剩余尚未发生的轮初收入次数
递减；收入目标本身没有附加奖励。

## 数据放置

`data:analyze` 的目标是推进到正式分析。放置 Decision 按当前
`dataAnalyzeRequirements.nextGap` 选择：

- 缺信用且存在可用 `blue1` 附加位：放到该位；
- 缺能源且存在可用 `blue2` 附加位：放到该位；
- 两者都能补缺口时，按缺口减少量、choice identity 稳定选择一个；
- 没有直接补当前缺口的蓝科位：放到计算机第一排，推进分析；
- 其他蓝科奖励不是当前资源缺口的确定性准备，不在该目标内随机探索。

蓝科奖励仍由正式 Place Data Effect 结算；Evaluator 只选择 legal descriptor。

## 等价、剪枝与预算

- 中间 action、conditional、资源缺口和次级目标完成事件都不产生固定估值。搜索先完整推进到
  本席真实 PASS，或完成 15 个结果目标，再比较终点。
- 终点只读取四类正式事实：当前正式分数、剩余资源向量、收入轨、已拥有科技及其当前能力状态。
  路线内部已经兑现的分数、收入和科技自然包含在终点状态中，不重复奖励。
- 完成态收敛先使用原始事实的 Pareto 支配：分数、收入、科技能力和可兑换后的剩余资源均不差，
  且至少一项更好时，才能删除另一完成态。权重不参与安全剪枝。
- 终点最终排序才使用估值公式。首个完整版本沿用“分数价值固定、收入与科技按剩余轮次下降、
  剩余资源按机会成本折算”的现有口径；终局叶仍以正式终局得分为准，本轮仍能产生效果的科技
  通过后续真实路线兑现价值。
- 只有目标目录、路线闭包、完成态收敛和单次决策性能全部验证后，才进入权重实验。权重候选使用
  相同固定盘面与固定种子完整对局，以最终正式得分均值为主指标；均分不上升则回退。调权重不得
  改变目标可达性、路线枚举、节点预算或剪枝集合。
- 状态等价、RNG、Decision、Session、resource dominance 与现有
  `seti-no-beam-search-design-20260730.md` 相同，本轮不放宽等价条件。
- 目标不可达仍只使用乐观资源上界证明；无法证明不可达就保留目标。
- `maxProxyDepth=15` 只统计正式完成的结果目标；发射、移动、转换、放数据、单次扫描、
  打辅助牌、研究辅助科技和 conditional 都不计深度。
- `maxNodes=128` 只约束普通 counterfactual，不参与次级目标搜索；次级目标语义预算只有
  `maxProxyDepth=15`。`maxExecutionNodes=4096` 仅作为显式物理失控保护，触顶必须返回
  incomplete，不得把 frontier 包装成完整叶。
- `maxLeaves` 只约束普通 counterfactual；次级目标搜索完成目标内等价与完成态 Pareto 后不再
  使用逐虚拟根 leaf cap。若 Pareto 前沿仍导致物理保护触顶，必须报告真实前沿和性能折损，
  不得恢复 cap 获得性能数字。
- secondary search 保持 no-beam；`beamPrunedOriginCount` 必须为 0。

## 可证伪义务

| 命题 | 最小反例 | 证据 |
|---|---|---|
| 同目标只保留非支配准备首步 | 钱换电、牌换电都能缩小同一缺口 | 删除损耗更高且无额外结果者；不同非支配终态都保留 |
| 资源计划不采用单步局部贪心 | 第一步换牌不补能源，但第二步牌换能源形成最低损耗完整路线 | 仍选择换牌首步 |
| 不制造其他资源缺口 | 钱换电会导致信用不足，牌换电不会 | 选择牌换电 |
| 直接动作优先 | 目标 `nextStep` 已合法且同时存在转换 | 只返回直接动作 |
| 数据奖励服务当前缺口 | 同时有计算机、blue1、blue2 位，当前只缺能源 | 只选 blue2 |
| 结果不同的 conditional 不丢失 | 两个科技、两种奖励或资源数量不同的支付 | 全部正式执行 |
| 资源路线身份抽象显式可查 | 同量弃牌组合、同扇区等量取牌 | 只执行稳定代表，并增加目标内部等价诊断 |
| 目标完成后才换目标 | 主行动后仍有 pending Decision | Decision 提交前不出现新 target |
| 辅助目标不误释放主目标 | 分析路线中的扫描，或登陆路线中的移动卡 | 代理深度增加，但 `data:analyze` / 登陆 target 继续绑定 |
| 扫描不冒充扇区目标 | 扫描一次但扇区尚未结算，或由对手获胜 | target 保持绑定且深度不增加 |
| 扇区只在正式胜场完成 | `sector_finish_scan` 完整结算并新增本席胜场 | 对应 target 完成且深度增加一次 |
| 扇区目录不横向枚举 | 8 个普通扇区均可扫描 | 只保留最低胜利要求候选与专属触达候选 |
| 收入来源无 family 偏见 | 打牌、放数据、环绕分别增加收入 | 都能服务同一收入结果目标 |
| 收入只按真实差量完成 | 执行动作但 income 未增加 | target 不完成，也不获得固定代理分 |
| 中间节点没有估值捷径 | 一条先付成本、后得高分的完整路线 | 不因中间资源下降被权重裁掉 |
| 权重不改变搜索空间 | 对同一批完整终点调整资源/收入/科技权重 | 终点集合与 Pareto 剪枝结果完全相同 |

## 集成结果与保留近似

生产实现已经完成 `goalId + planId + resultGoalIds` 迁移，并修正了“任意计深度 action 都释放
当前 target”的错误。目标在同一 Effect Session 的 conditional/followup 完整结算前保持绑定；
发射后探测器取得正式 id 时，`planId` 从 launch requirement 更新为该探测器 requirement，
不会丢失原结果目标。

固定开局的 12 次重复基准覆盖完全一致：

- 6 个战略 root action、20 个结果目标绑定；
- 每次执行 2538 个物理节点，frontier 自然耗尽；
- `beamPrunedOriginCount=0`、`executionLimitReached=false`；
- 完成 331 次结果目标转换，最大完整目标深度为 6；
- 完成态 Pareto 删除 208 个被支配来源，目标内部等价 choice 收敛 344 个；
- 资源下界调度省略 2140 个“完成首目标后的下一目标绑定”；
- 单次完整 Policy 中位数约 6.96 秒、P90 约 7.00 秒、最大约 7.29 秒。

完整目标顺序排列在 8192 个物理节点后仍不能自然耗尽，单次超过 20 秒。因此当前保留一项明确
性能近似：首个结果目标及其非支配路线全部搜索；完成首个目标后，只选择正式资源下界最小的
下一结果目标。该下界来自探测器 requirement、分析数据的下一缺口、赢得扇区的最少标记与扫描
成本，或目标 action 的正式 payload cost，不使用固定选项分。

该近似会漏掉“先做较贵目标，后续组合反而更优”的顺序，因此不能称为目标顺序完备搜索。
`targetSchedulerPrunedCount` 必须持续公开；后续若优化底层投影与执行足以承载完整排列，应以
同一固定盘面恢复全目标顺序并重新验证，而不是提高 beam、降低节点 cap 或隐藏未耗尽 frontier。
