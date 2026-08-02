# SETI 机器玩家设计

本文描述 Browser 与 Simulation 当前共用的机器玩家生产契约。旧 AI 自动对战 controller、pending resolver、candidate selector、valuation/route/demand/pressure、battle report 与 tuning 架构已物理删除，不是兼容层或未来扩展点。

## 1. 唯一输入链

机器席位只经过以下链路：

```text
Rule Composition
  -> Machine Player Host
  -> Policy Port
  -> Heuristic / Learned Policy
  -> PolicyDecision
  -> Standard Action/Decision input adapter
  -> Rule Composition
```

- Browser 由 `app/ai/browser-bootstrap.js` 读取 Rule Composition boundary，构造当前机器席位的只读 observation 与 legal descriptors。
- Simulation 使用同一 Policy Port、Machine Player Host 语义与 Standard Action/Decision identity。
- Host 在 Policy 请求前通过 Rule Composition 的 `counterfactualPort` 为可能直接命中当前
  估值目标的 legal action 建立隔离 fork；明确不可能命中目标的 action 仍保留在完整 legal set
  中，并以 structured unresolved outcome 对齐。Policy 只收到裁剪后的 root/leaf observation、
  标准行动链、合法后继和 unresolved 状态，仍只返回一个 legal `actionId`。
- Policy 不执行规则、不点击 DOM、不读取 canonical root，也不持有 StateStore、Effect Session、
  registry 或 executor。
- Host 在提交前复核 seat、stateVersion、decisionVersion、deadline、generation 与 legal identity；未知、过期、重复或非法响应一律 fail-closed。
- conditional choice 必须由 Rule Composition 暴露为标准 Decision。Host 不允许 resolver、recover/skip 或“取第一项”旁路。

## 2. 当前模块

- `game/ai/policy-port.js`：`DecisionContext -> PolicyDecision` 契约、公共 validator、请求失效语义。
- `game/ai/machine-player-host.js`：固定席位、deadline/取消、generation、去重与 fail-closed 提交协调。
- `game/ai/heuristic-policy.js`：Browser、teacher 与冻结 opponent 共用的版本化启发式 Policy。
- `game/ai/outcome-model.js`：从 viewer-safe observation 投影已兑现分、科技、收入、资源事实和
  固定大小的探测器目标摘要，以及本席数据轨到下一次正式扫描、放置或分析所需的
  viewer-safe `dataAnalyzeRequirements`。
- `game/ai/expected-score-evaluator.js`：只从真实标准叶读取已兑现分数、科技和收入变化，
  按剩余轮次计算版本化战略价值。
- `game/ai/heuristic-evaluator.js`：优先选择 `settled + selectable` 的战略目标路径；失败或
  unresolved 候选不可进入排序，同值时只按稳定 actionId 决胜。
- `game/rule-composition.js#counterfactualPort`：Host-owned 隔离反事实执行。每条分支仍使用同一
  Standard Action registry、Effect Session、Decision 与 commit 语义。
- Simulation setup 选择也进入隔离规则 fork：提交标准 setup Decision、执行正式初始结算，再以同一
  `DecisionObservation -> OutcomeProjection -> target/gap/next-step` 口径选择。每个 setup
  反事实叶从同一正式随机状态结算，并按正分探测器目标的当前盘面价值、实际分和信用/能源
  缺口依次排序；语义相同才保留原始发牌顺序。旧
  `selection-evaluator.js` 及其开局静态分值已删除。
- setup 不消费对局 RNG 之外的未来随机数；probe-goal Policy 改变初始选择语义时，唯一 full-flow
  必须提升 schema/policy provenance，并通过公共 setup Decision 验证真实选择、结算和恢复结果，
  不能用历史发牌实体或 checkpoint hash 固化旧随机轨迹。
- `app/ai/browser-bootstrap.js`：Browser Machine Player Host、席位判断、Rule Composition boundary 与 PolicyInputAdapter 的窄装配 owner。
- `app/browser-host/policy-input-adapter.js`：把已验证 PolicyDecision 映射回玩家共用的 Standard Action/Decision input port。

`game/ai/index.js` 只聚合以上 Policy/Host/evaluator 模块。不得向其中重新加入 legacy valuation、candidate、planner、analytics 或 controller adapter。

## 3. Policy 契约

Policy 输入只包含：

- `requestId`
- `seatId`
- `stateVersion`
- `decisionVersion`
- 当前席位可见的只读 `observation`
- 完整、同版本的 `legalActions`
- 与 legal set 同版本、按 `actionId` 对齐的 `actionOutcomes`
- 可选 deterministic context

Policy 输出只包含版本化 provenance、所选 `actionId` 与诊断。Policy 不读取 DOM、Effect Session、StateStore、Browser app closure 或对手隐藏信息。

`actionOutcomes` schema 为 `seti-action-outcome-v1`：`status` 为 `settled`、
`unresolved`、`failed` 或 `stale`；`confidence` 为 `high`、`low` 或 `none`；
`rootObservation` 是当前 viewer 边界内的根观察；`leaves[]` 只包含真实到达的叶观察、
完整 `actionChain` 与 `legalSuccessors`；`code/reasonCodes` 解释失败、分支上限或随机样本。

Decision 链只通过 active Effect Session 暴露的标准 choice 继续。主 Action 产生的必要 Decision
必须沿同一生产提交链结算到下一稳定策略边界；`awaiting_decision` 不是 leaf，不进入估值。
分支数/深度超过安全上限时返回 `unresolved`，不把已结算一半的状态伪装为 leaf。Simulation 随机
分支从 root identity 与 actionId 派生独立 RNG；一旦消费随机数，outcome 标为
`low-confidence/COUNTERFACTUAL_RANDOM_SAMPLE`。Browser 无法安全聚合随机期望时同样返回
low confidence。固定 RNG 只用于让规则结果可复现，不授权 Policy 读取本局未来信息：公共牌补牌、
盲抽、外星揭示等隐藏信息出现后，反事实仍继续搜索，但新身份在后续 observation、目标 requirement
和 legal successor 中保持 opaque。搜索可以继续使用已兑现的分数、资源与牌张数量，也可以把未知牌
用于身份无关的通用支付；不得用其牌面建立打牌、卡角、定向扫描或物种能力路线。
公共扫描与 Quick Trade 精选牌都必须在正式 executor 补牌时上报同一隐藏信息 barrier；盲抽上报
`hidden_card_draw`。不得因入口属于通用 Standard Action Decision 而绕过信息边界。

每个 root/leaf observation 使用 `seti-decision-observation-v2`，其中
`outcomeProjection` 为 `seti-outcome-projection-v2`。projection 只增加以下
viewer-safe 窄字段，不暴露 executor 或隐藏 root。`progress.probeRoute` 最多列两枚本席在途
探测器的标识/坐标；候选 leaf 只额外携带 `nextActionId/family/summary`、目标行星与
`orbit/land` outcome 引用、已兑现目标分、沿途宣传 delta、终点即时 delta、标准路线实耗、
移动余步和叶后钱/电。`dataAnalyzeRequirements` 只投影计算机已放置数、可用数据数、下一正式
步骤及其信用/能源缺口；扫描费用和分析减免分别来自正式 scan effect 与公司被动。
用于续算的完整 checkpoint 只存在于隔离 fork 内，投影时物理删除，不复制太阳系、星云、token
或扫描结构。

启发式搜索的一级评估轴是当前正式分数、收入和科技；剩余资源用于比较这些收益相同或接近的
完整终点。一级目标不是路线终点。搜索在中途取得一级收益后继续，直到本席真实 PASS，或正式
完成 15 个结果目标。

次级目标只描述结算结果：

- 指定探测器在指定星球或卫星完成环绕/登陆；
- 赢得启发式选出的普通具名扇区；定向额外触达的卡牌或能力可保留额外扇区计划；
- 完成正式数据分析；
- 任一收入轨相对选择目标时的基线上升；
- 获得具体科技；
- 兑现具体卡牌、公司或物种能力结果；
- 根 conditional 的具名 Decision 结果。

单次扫描、发射、移动、快速转换、放置数据、卡角、支付和其他 conditional 都只是既定目标的
达成步骤。任何 action family 单独都不能证明目标完成。`goalId` 保存结果，`planId` 保存达成
路线，`resultGoalIds` 记录同一物理路线可同时兑现的结果；只有 Effect Session 完整结算后的
正式 observation 证明目标结果出现，目标深度才增加一次。

根搜索只执行能绑定上述结果目录的 action。普通扫描先按正式扇区胜利要求选择最好赢的扇区，
不会遍历八个扇区；具有定向额外触达能力的来源单独保留。选定目标后，只执行其正式下一步或
严格补足当前资源缺口的最小损耗转换。直接移动与移动牌等资源结构不同的非支配路线可以同时
保留；纯亏损且不提供额外结果的转换不会作为独立探索方向。

研究科技同样先做启发式候选生成，不把全部 12 块科技及四个蓝槽交给路线搜索。持有数据时优先
考虑蓝1/蓝2；已经绑定扫描用途时考虑紫2/紫4；发射、移动并准备访问小行星或行星时考虑橙2；
橙1、橙3/4、蓝3/4是次一档候选。紫1只在路线确实需要补两数据时加入，紫3只服务扇区获胜。
蓝科技只选择当前计算机进度下最快能开放附加数据格的一个槽。宣传不足时先执行同时推进数据轨
的计算机放置，再按下游结果能力保留科技、发射、收入、扫描和移动牌，只弃一个能力最低的宣传
卡角；等价的卡角与放置排列不再全排列。上述规则只收敛候选，不给科技或中间行动增加固定分，
最终仍由完整终点事实比较。

环绕/登陆目标在进入执行搜索前，先使用 Production Kernel 按真实太阳系拓扑算出的最短路径、
移动点数和钱/电总成本做目标级 Pareto。同类终点中，若一条路线更远、总成本不低且正式即时
收益也不高于另一条路线，则不再为它建立执行分支；距离更远但分数、收入、数据或沿途宣传更高
的非支配路线仍保留。该阶段使用规则投影的路径和奖励，不以 action 展开次数代替行星距离。

若既定环绕/登陆路线下一步需要移动，而本行动圈已经用过主行动，手中可负担的移动牌仍是跨
行动圈的有效路线：规划器可以先结束行动圈，再在本席下一次行动机会打牌。对同一个移动缺口，
`1 张移动牌` 会支配 `弃 2 张牌换 1 能量再移动`；花信用点换能量与保留手牌则属于资源结构不同
的非支配方案，继续交给完整终点评估比较。

扫描行动附带的公共牌扫描若能触达已绑定扇区，必须优先推进该扇区；若当前公共牌均不能触达，
只选择正式胜利要求最低的其他可达扇区中的稳定代表，不展开所有无关公共牌组合。该启发式会
忽略“故意扫描较难扇区以改变后续公共牌供应”的远期分支，是为避免目标内奖励组合爆炸而接受
的显式性能近似。

`data:analyze` 只有在“计算机已放数据数 + 当前可用数据数 ≥ 4”、即当前库存足以填满第一行时
才进入目标目录。第一行尚未可达时，不为了分析主动扫描、移动探测器、打牌或快速转换；放数据
仍可服务收入等其他正式目标。第一行已经可达后，分析路线可以选择正式效果证明会获得数据的
扫描、具名环绕/登陆、直接数据卡牌和数据弃牌角标；选定来源后才补其资源缺口。任一其他正式
路线实际获得数据并使门槛成立后，也可以继续锁定分析。数据放置优先选择能直接补当前缺口的
蓝科技位，否则放入计算机推进分析。

搜索跨本席的多个行动机会，但当前阶段完全不预测对手策略。白色 `end_turn` 先执行正式规则，
清理本回合效果；随后可信反事实 fork 的单席位规划时钟直接进入白色下一行动圈。规划器不执行
对手 Standard Action、PASS 或 conditional，不读取对手手牌，也不改变对手资源、PASS 预留牌堆、
太阳系或其他公开盘面。该近似不预测抢位和公共供应变化，结果会偏乐观。

白色未来选择 PASS 时，搜索在第一个正式 PASS Decision 边界形成叶，不提前查看或选择预留牌；
真实游戏已经进入该 conditional Decision 后，Policy 才能基于当时可见选项作答。搜索不进入
新轮，因此不会把轮初收入误算成 PASS 的价值。

完整终点先保存以下正式事实并做 Pareto 收敛：

- 当前正式分数与已锁定终局分；
- 信用、能源、宣传、可用数据、额外公共扫描、普通牌和外星牌数量；
- 六条收入轨；
- 计算机已放置数据数与是否已到分析格；
- 已拥有科技集合。

完成态 Pareto 以 `根行动 + 已完成目标深度 + 具体次级目标` 分组；同一目标的不同路线可以互相
支配，不同次级目标不得互相删除。目标入口数、不同入口状态、目标内完成路线族与被支配数量均
写入 counterfactual diagnostics，用于区分目标目录规模和单目标路线爆炸。
收入目标 ID 保存的是建立目标时六条收入轨的基线，因此不同父路线可能同时显示“继续提升收入”，
但其完成条件是分别超过各自基线，并不是两种收入目标。报告必须把基线写入标题；这些父状态只有
在完整终点事实上构成支配时才能合并，不能因为中文目标名相同就删除。

最终排序使用：

```text
Primary(leaf)
  = 实际分数变化
  + 新科技数 × 取得时所在轮的剩余轮次价值
  + 新增收入的每轮资源价值 × 取得后尚未发生的轮初收入次数
```

`Primary` 不扣资源成本；随后比较剩余资源机会成本、快速转换次数和已完成目标数。收入换算使用
`1 信用 = 1 能源 = 2 数据 = 2 宣传 = 2 普通牌 = 5 分`，只估算尚未发生的轮初收入：
第 1/2/3/4 轮行动阶段新增收入分别计算 3/2/1/0 次。终局叶的收入与资源机会价值归零，只保留
正式终局分；科技若能在当轮继续帮助行动，必须由后续真实路线兑现价值，不能另加固定分。
任何中间 action、goal 或 family 都没有固定奖励。

次级搜索使用精确最小堆维护 frontier，不使用 beam、`maxLeaves` 或普通 `maxNodes=128`。
`maxProxyDepth=15` 只限制已经正式完成的结果目标数。物理执行另有
`maxExecutionNodes=4096` 失控保护；触顶必须返回 incomplete，不能把剩余 frontier 包装成
完整叶。当前固定盘面在该保护前自然耗尽。

为了把单次决策控制在 10 秒内，当前保留一项明确的策略近似：首个结果目标及其非支配路线全部
探索；完成首个目标后，下一目标只选择正式资源下界最小者，目标内部仍保留非支配路线。这不是
beam、节点 cap 或固定选项分，但会漏掉“先完成较贵目标，反而改善后续组合”的目标顺序。诊断
以 `targetSchedulerPrunedCount` 单独报告被省略的目标绑定；优化权重前必须保持这项近似和搜索
空间不变，不能把调权重与改路线覆盖混为一次实验。

反事实执行复用一个 Composition 级可信隔离 fork。每个候选从同一 checkpoint 恢复
StateStore、Effect Session 和分支 RNG，再调用生产 registry/executor；Simulation 的可信
projection reader 可读取该隔离 state，Browser 与普通公共路径仍保留复制。可信 fork 省略重复
undo frame、重复输入克隆和中间 validation，但最终 candidate 仍执行完整 schema/invariant
验证，异常分支由下一次 restore 整体恢复。canonical root、正式 RNG、journal 和其他 frontier
不共享可变引用。

完整 future state、Session、RNG、Decision owner 和下一 action 相同的分支可以共享一次物理
执行；不同奖励、手牌身份、科技、收入或盘面不能作为规则等价合并。仅在资源目标内部，等量弃牌
支付和终局 PASS 后只影响未纳入终点评估的普通牌身份 choice 会稳定保留一个代表，并通过
`targetEquivalentChoicePrunedCount` 显式报告。这是终点事实抽象，不得描述为规则无损。

未揭示外星槽的痕迹选择在执行前使用正式痕迹奖励做支配比较：即时收益被另一槽严格支配时直接
剪枝；即时收益完全相同时稳定保留一个代表。若玩家已打出且尚未完成的任务会区分痕迹所在槽位，
例如要求每个外星人都有某色痕迹或要求痕迹集中在同一外星人，则保留全部相关选择。已经揭示的
物种痕迹位置仍由物种规则逐项执行，不适用这项合并。

已经正式触发且只提供“结算奖励/跳过奖励”的 residual card settlement 在搜索中稳定选择立即
结算，并把 skip 计入等价选择省略数。该策略不改变真实 Decision 或奖励规则，但会漏掉“当前
资源接近上限，故意保留 trigger 到以后再领”的时机选择；保留此近似是为了避免未消耗 trigger
在后续每个匹配事件上重复形成指数分支。

运行诊断至少记录候选与根目标数、物理执行节点、actor 分项、对手执行数、单席位时钟推进数、
PASS Decision 边界叶、最大 frontier、状态共享、完成态支配、
完成目标次数/最大深度、目标调度省略数、不可达路线数、beam/执行保护状态，以及
fork/执行/投影/checkpoint/frontier/编排耗时。耗时仅用于性能验证，不参与候选排序。
固定盘面报告可通过 `--focus-decision N` 只重放到指定决策，并按“第 1 层结果目标 → 目标内
完成路线 → Pareto 最终保留路线 → 下一层结果目标”输出单节点搜索树。父子目标与中文行动摘要
只在该报告开关启用时记录，不进入普通 Browser/Simulation 搜索；trace 不参与排序、状态等价、
节点预算或终点估值。单节点报告的太阳系、外围扇区及行星环绕/登陆区直接复用 Browser Web 的
正式底图、token 图片与坐标函数；四块扇区板按 Web 的盘位和旋转围绕太阳系，行星区不再重复
输出文字版。搜索树之前必须展示最终优胜叶的正式分数、锁定终局分、剩余资源、收入、科技、
数据计算机进度、完整目标链及相对起点变化，区分“最终搜索结果”和“当前只提交的第一步”。

## 4. Browser 调度与规则边界

Browser bootstrap 可以：

- 标记哪些 seat 由机器控制；
- 在 Rule Composition lifecycle 后失效旧 Policy 请求；
- 调度下一次 Machine Player Host 请求；
- 在 Policy/Host 失败时暂停。

Browser bootstrap 不可以：

- 枚举或评分候选；
- 解析 pending；
- 执行 Standard Action/Decision；
- 保存 battle report/tuning history；
- 持有规则 working root；
- 通过 fallback、alias 或全局模块恢复旧 controller。
- 保存或应用按 family 调参的 strategy weights。

终局板块、初始选择、弃牌、支付、科技与外星人选择都必须作为标准 Decision 进入同一 Policy 输入链；没有单独的 final-score AI runtime。

## 5. 验证

最低验证：

```sh
node randomizer/game/ai/policy-port.test.js
node randomizer/game/ai/machine-player-host.test.js
node randomizer/game/ai/heuristic-evaluator.test.js
node randomizer/game/ai/heuristic-policy.test.js
node randomizer/app/ai/browser-machine-player.test.js
node tools/run_node_tests.js
node tools/run_browser_smokes.js
```

验收证据必须同时覆盖：

- legal descriptor 经 PolicyDecision 回到公共 input port；
- 每个 legal action 的 outcome 等于同根标准执行，交换枚举顺序结果不变；
- 执行全部 fork 后 canonical bytes、RNG、sequence、active session、journal、history 与 replay 不变；
- 随机候选只使用独立分支并显式 low-confidence；
- stale/deadline/duplicate/illegal response 零提交；
- Browser 与 Simulation 不加载旧模块；
- legacy 全局 export、script、resolved module、context binding、fallback、alias 与测试依赖归零；
- 唯一 full-flow 和真实 Browser smoke 通过。

## 6. 维护原则

- 新策略能力优先扩展 viewer-safe observation 或 outcome schema，不把 root/executor 权限扩张给 Policy。
- 新 conditional family 先进入 Rule Composition Decision，再补 Policy 可观测估值。
- Learned Policy 与 Heuristic Policy 必须共享 Policy Port、Host、input adapter 和 action identity。
- 不以兼容、诊断或未来可能使用为由恢复旧 AI 文件；需要新能力时按当前 owner 重新设计并提供真实 caller。
