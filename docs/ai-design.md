# SETI 机器玩家设计

本文描述 Browser 与 Simulation 当前共用的机器玩家生产契约。

## 1. 决策流程

机器人每个决策点的生产由**协调器**（`machine-player-coordinator.js`，Browser/
Simulation 共用一份实现）编排：**复用优先**，未命中才调用**决策方案**。

```text
协调器（决策点，每个机器人座位）
  -> readBoundary：裸调共享 composition —— enumerateActions 原生合法集 +
     createDecisionObservation(projection.state)（观察一份实现，零训练包装）
  -> planReuseCheck(上次方案输出的 plan, 当前观测, 合法集)
  -> 命中：提交 plan.nextActionId（计划前进一步，多步消费）
  -> 未命中：调用决策方案 -> { actionId, plan? }
       -> plan 存回（供下一次复用判断）
  -> execute：actionId 直接提交共享 inputPort（零转换）
  -> recordStep(action, result)：协调器内部记账钩子
       sim 训练：补记 replay/reward（原生 action，不做形状转换）
       browser：空操作
```

- **机器席位观察同源（host-unify 修复）**：`projection.state` 对 Browser/Simulation
  都必须是**规则观察信息层**形状——顶层 `publicState.players/board`、`selfState.hand`
  、requirements。Simulation 由 `projectCounterfactualState = buildRuleObservation`
  产出；Browser 由 `projectBrowserState` 附加同源信息层（`rule-observation.js` 同一份
  实现 + 同一 sanitize 纯函数），UI 渲染壳只作为 `resident.ui` 附加、不覆盖信息字段。
  详见
  `docs/browser-simulation-unification.md` §信息层统一。

- **决策方案**（decision scheme）是一个可插拔接口：输入当前 viewer-safe observation
  与完整 legalActions，输出**至少下一步 `actionId`**；有完整计划时附带
  `plan = { schemaVersion: "seti-action-plan-v4", nextActionId, steps[] }`
  （`plan-continuation.js#buildPlanFromSnapshot`），供 simulation 复用判断。
  当前实现：`heuristic-decision-function.js`（反事实搜索 + 直调启发式 Policy，
  从 winning leaf 构建 plan）；Learned Policy 实现同一输出契约即可参与复用。
- 观察中的`publicState.players[].mainActionCompleted`直接来自正式玩家标记，区分
  主行动前后；不能从目标枚举收到的合法子集是否包含end_turn猜测阶段。该公开字段
  不改变动作合法性或强制Decision流程；QUICK-TIMING-01用该事实统一判断时机。
- 主行动后的普通移动目录提供`moveTiming`：同一探测器同一目标，比较下一次转动
  后再走的移动点与先走一步再转动的总移动点。此为只读风险事实，不是额外估值；
  不预测对手，不把丢失路线换成虚构收益。候选筛选及计划复用共用该风险事实。
- **方案内部链路**（未命中时才走）：`heuristic-decision-function` 经
  composition.counterfactualPort 生成 actionOutcomes -> Policy Port -> Policy
  -> PolicyDecision -> 提交。Browser 与 Simulation 完全同一份实现（同一协调器、
  同一决策函数）；唯一差异是协调器的 `recordStep` 记账钩子——sim 训练补记
  replay/reward，browser 为空操作。复用命中时不经这条链路，提交由协调器的 execute
  直接进共享 inputPort（零转换）。
- 复用判定与计划结构细节见 §3。Browser 机器席位与 Simulation 一样走协调器复用层
  （`planContinuationReuse`，默认开，URL 参数 `?planReuse=0` 关闭，与 Simulation
  默认装配一致）。
- 反事实搜索在决策函数内经 `counterfactualPort` 隔离 fork：同根状态、同一
  Standard Action registry / Effect Session / Decision 与 commit 语义；Policy 只收到
  裁剪后的 root/leaf observation、标准行动链、合法后继和 unresolved 状态，仍只返回
  一个 legal `actionId`。
- Policy 不执行规则、不点击 DOM、不读取 canonical root，也不持有 StateStore、Effect
  Session、registry 或 executor。
- 提交前复核（seat、stateVersion、decisionVersion、合法集、authority）由协调器
  execute（Browser 经与人类共用的 Action/Decision input port）承担；未知、过期、
  重复或非法一律失败直接抛错；Browser 端口把抛错转成显式 fail 结果（非静默）。
- conditional choice 必须由 Rule Composition 暴露为标准 Decision。协调器
  readBoundary 在 awaiting_input 时读 `session.decision.choices`；不允许 resolver、
  recover/skip 或"取第一项"旁路。

## 2. 当前模块

指定公共牌获取目标为`card:acquire:<实例id>`：根绑定有正向现有牌面潜力的公开牌和
合法取牌交易或任务中继站、芬威克、深空、未来跨度、宇宙战略的取牌公司行动；
取得该id才完成，不用`card:resolve`的离手规则。支付期间保持目标，
公共选牌只保留目标id，盲抽不能替代。叶目的检查读取根交易完整结算后的入手证据，
计划从支付前就依赖该公共牌身份，牌消失或被替换会失效。牌面潜力复用V的
ordinaryCardEffectValue，数值不变；普通牌入手不新增primary收益，仍须后续实际用途
或原有预期支持，完成后可继续形成其他目标。根、后继及复用均使用统一时机门控。
公司公共选择按正式slotIndex/cardInstanceId识别，深空交换手牌保留不同手牌候选；
目标已入手后的角标奖励、额外选牌及免费移动不再过滤为原公共牌，仍按正式条件链结算。
取牌计划每步检查同席公司状态、资源和手牌，覆盖公司额度、停放目标分与奖励槽变化。
没有合法直接取牌来源时，公共牌目标可使用单次即能补足宣传缺口的资源角标；缺口
取3宣传交易与本席未用任务中继站/芬威克费用的较低者。角标收益读取正式手牌奖励及
合法描述符的倍增值。已有直接来源、宣传足够、单次收益不足或目标牌消失时不准备。
两张手牌已可直接精选，不额外排列多次弃牌；角标目的仍检查真实直接解锁，不新增分值。

主行动后的普通候选共用`allowsQuickActionTiming`：根目录、绑定/未绑定后继和
计划复用都检查当前目标的机会证据。移动须匹配同探测器、同计划的方向，且先走
能降低下一次转动场景的总移动点；寰宇能力须为该路线的正式首步。移动角标读取
本席实际手牌奖励和合法descriptor的倍增值，点数足够同目标窗口首步时允许；
正式额外分仍由角标规则结算，不视为普通移动弃牌付款的等价路径。角标进入条件
方向选择后沿用同一探测器目标及计划身份，已开启奖励不重复施加普通行动门控。资源交易只补
当前机会首步的能量缺口，不为未来环绕/登陆囤资源。指定公共牌仍公开时允许取牌
交易或上述公司取牌行动；其余普通准备延后，绑定后继保留目标并通过合法end_turn继续下一自己turn。
conditional付款/奖励和control不受该准入裁剪。计划步骤保存目标与计划身份，重新
检查时机，并将moveTiming纳入路线依赖；窗口消失返回quick-timing-no-current-window。
扫描容量准备已接入根与绑定后继：标准scan合法时，并列扫描和合法place_data，
绑定同一扇区目标，条件放置复用原选位函数。搜索执行真实扫描链，不另预测所得。
完整叶及最终动作在primary相同时先比较同席根叶的dataDiscardDelta（越少越好），
再按既有交易数/目标深度排序，非终局最后优先执行步骤更少的方案；终局不使用
数据浪费作为优先项。无主要收益仍不可选，不为防溢出增分。所有准备分支共用
现有全局搜索预算；单决策、完整局及必要准备的验收证据见
[QUICK-TIMING-01验收](../reports/iteration/quick-timing-acceptance-20260912.md)。
数据溢出的正式累计事实通过publicState.players[].dataProgress.discardedCount进入
标准progress与strategicFacts；用于区分同样装满数据池的不同真实结果。它不参与
当前V或primary计分，不将历史丢弃重复扣分；后续准备比较须取同席前后增量。
计划的data依赖包含availableData，池数量变化使旧准备步骤失效，不仅检查已填位置。
仍存在于正式候选目录的sector:win目标在准备过程中保留原targetId/planId，不能
因放数据或获得数据被通用分析启发式改绑。目录中的结算身份失效后返回null；完成
仍由正式wins及settlementNumber判定，不以一次准备或一次扫描冒充赢得扇区。

- `game/ai/policy-port.js`：`DecisionContext -> PolicyDecision` 契约、公共 validator、请求失效语义。
  输入复制在单次调用内复用已完整校验的副本，先检查祖先循环，再查询副本缓存；不跨请求
  缓存，不绕过校验。返回图深冻结且与来源隔离，内部相同事实可以共享只读引用。
  祖先集合在本次遍历内维护，进入节点时加入、退出时在finally移除，不再逐层复制Set。
  Heuristic决策函数传入Policy的叶视图不携带仅供计划续用的`planSteps`；其他字段继续
  全量校验复制。原actionOutcomes保留完整证据供计划提取和对外返回，不减少搜索叶。
  该内部视图在单次调用内共享完整值相同的冻结叶观察（含viewer/authority/路线摘要/
  遮蔽结果）。只对严格普通JSON树生成键；accessor、toJSON、特殊对象、循环、稀疏
  数组、undefined、非有限数及负零不共享，原样进入既有校验。不是搜索状态去重，
  不共享叶/来源/计划，也不改变对外actionOutcomes或跨请求缓存。
- `game/ai/machine-player-coordinator.js`：机器人玩家协调器（Browser/Simulation 共用一份实现）——席位决策函数注册表、裸调共享 composition 读边界（合法集原生 + 观察直接 createDecisionObservation(projection.state)）、计划复用（`planReuseCheck`）、调用决策函数、execute 提交共享 inputPort、recordStep 记账钩子（sim 训练补记 replay/reward，browser 空操作）；失败直接抛错。
- `game/ai/heuristic-decision-function.js`：Heuristic 决策函数（AI 类型）——统一反事实搜索（目标引导 + 需求引导单一路径）+ 直调启发式 Policy + 从 winning leaf 构建 plan；实现 `(ctx) => ({ actionId, plan? })` 接口。开关（traceCounterfactualGoalClusters 等）经同一 config 源透传，Browser/Simulation 一份装配。
- `game/ai/heuristic-policy.js`：Browser、teacher 与冻结 opponent 共用的版本化启发式 Policy。
- `game/ai/outcome-model.js`：从 viewer-safe observation 投影已兑现分、科技、收入、资源事实和
  固定大小的探测器目标摘要，以及本席数据轨到下一次正式扫描、放置或分析所需的
  viewer-safe `dataAnalyzeRequirements`。
  标准结果投影只复制一次剩余元数据图；root/leaf观察仍由正式投影重建，原始
  routeCheckpoints仍移除。避免复制随后被覆盖的字段，不减少逐步计划证据。
- `game/ai/expected-score-evaluator.js`：只从真实标准叶读取已兑现分数、科技和收入变化，
  按剩余轮次计算版本化战略价值。
  rollout v20将正式角标奖励表中gain.score>0的合法card_corner按实例绑定到已有
  card:resolve目标；数据/移动附带选择排空后才形成完成叶，不给目标额外加分。
  非得分角标仍须其他目标绑定。Browser/Node共用cards/deck奖励API，不维护第二份表。
- `game/ai/plan-continuation.js`：计划延续复用的纯逻辑——决策方案输出的计划结构
  （`buildPlanFromSnapshot`/`advancePlan`）、simulation 侧复用判定
  （`planReuseCheck`）、逐步事实采集与编译（`capturePlanStep`/`compilePlanSteps`）、
  外星揭示基线（`countRevealedAliens`）。旧单依赖函数仅用于历史诊断，不供生产复用。诊断工具
  `tools/diagnose_plan_continuation.js`（record-once/analyze-many）与
  `tools/verify_plan_continuation_fastpath.js`（同 seed A/B）共用同一套纯函数；
  单元测试登记 `policy/plan-continuation`。
- `game/ai/heuristic-evaluator.js`：优先选择 `settled + selectable` 的战略目标路径；失败或
  unresolved 候选不可进入排序，同值时只按稳定 actionId 决胜。
- `game/rule-composition.js#counterfactualPort`：Host-owned 隔离反事实执行。每条分支仍使用同一
  Standard Action registry、Effect Session、Decision 与 commit 语义。
  `selectCardRevealChoices(actions)`为手牌展示的纯贪心选择：整组counted-move-reveal
  选择中固定顺序展示一张合格牌，无牌则结束；其他动作原样返回。真实决策根先收敛
  再构建Policy候选；搜索自动结算和后继先过滤未知牌再用同一方法，保留目标绑定。
  每次展示仍正式提交并计物理输入，展示顺序与子集不穷举；结束后按已展示张数移动。
  排空在提交下一项前保存已有隐藏屏障，公开展示不能覆盖此前盲抽的信息限制。
  展示超过自动排空批次后回原队列继续；同一展示阶段不算条件根的“下一策略决策边界”，
  不能在未结束展示时标记搜索完成。排空保护及全局执行/队列上限均保持不变。
- 初始选择（setup）**不跑反事实**（2026-08-21 迭代，审查清理项 1）：setup 决策
  由 heuristic-policy 的 `selectInitialSetupAction` 直接决策——固定用户开局按
  `USER_INITIAL_PICKS` 硬编码精确复刻；**插收入**（弃 1 张手牌插收入轨，牌的
  income 码决定哪条收入轨每轮 +1）按**资源单位价值表**选牌（钱 10 / 电 8 / 牌 6 /
  数据 6 / 宣传 4，钱/电逐轮贬值 R1全价→R4半价）。资源单位及发放窗口由
  expected-score-evaluator 的 `RESOURCE_UNIT_VALUES`、`resourceUnitValue` 和
  `incomeFutureValue` 唯一提供；插收入计立即领取与各次未来发放，行业/初始牌即时
  效果与未来收入分别估值，不虚构末轮收入。**为什么插收入不用反事实**：插收入是简单逻辑判断（"我需要哪条
  收入轨"），反事实搜不出价值；v2 时代反事实在插收入上实际也没起作用（退化为
  选第一个），删除 setup 反事实后曾误落入"初始牌价值打分"分支（语义错位，
  插牌选择改变导致全盘分叉），现已用价值表显式修复。setup 动作的 outcome 由
  completePolicyOutcomeSet 标 STRATEGIC_GOAL_NOT_EVALUATED 补齐。
- setup 不消费对局 RNG 之外的未来随机数；probe-goal Policy 改变初始选择语义时，唯一 full-flow
  必须提升 schema/policy provenance，并通过公共 setup Decision 验证真实选择、结算和恢复结果，
  不能用历史发牌实体或 checkpoint hash 固化旧随机轨迹。
- `app/ai/browser-bootstrap.js`：Browser 机器席位端口——与 Simulation 共用同一协调器与
  Heuristic 决策函数（唯一差异：recordStep 记账钩子，browser 空操作）；只保留席位判定、
  决策前稳定化、同 decision 去重、lifecycle 失效重建与 fail-closed 结果转写。
  开关（traceCounterfactualGoalClusters 等）经
  同一 config 源透传（URL 参数，见 §3.4）。

## 3. 决策方案输出契约与计划延续复用（simulation 侧）

决策点两层流程见 §1；本节给出方案输出契约与复用判定的细节。

### 3.1 方案输出契约

- simulation 只依赖方案的输出契约，不关心方案内部（启发式搜索 / learned policy
  可插拔）；
- 方案输出**至少包含下一步 `actionId`**；若有完整计划（winning leaf 链条 ≥ 2 步），
  附带 `plan = { schemaVersion: "seti-action-plan-v4", nextActionId, steps[] }`
  （`plan-continuation.js#buildPlanFromSnapshot`），供复用判断；
- 当前方案：`heuristic-decision-function.js`（统一反事实搜索——目标引导 + 需求引导
  单一路径 + 直调启发式 Policy + 从 winning leaf 构建 plan）；协调器
  `machine-player-coordinator.js` 编排 readBoundary/复用/调用/提交；
- 装配：`app/simulation-env.js#runHeuristicPolicyDecision`（复用判断先行，未命中才
  走 outcome 生成 + 方案；`config.planContinuationFastPath` 开关，默认开
  （显式传 `false` 可关）。

### 3.2 搜索时机与复用判定（用户口径，2026-08-20 机制化）

名词定义见 `docs/mechanics-reference.md`：**轮次（round，R1/R2）**、**回合（turn，玩家每一次主要行动圈）**。

**搜索时机机制**：无计划、计划耗尽或下一步检查未命中时搜索；有有效计划时，同回合与新回合均检查对应步骤的执行前证据。揭示和具名依赖变化在同回合也会触发重新决策。

- **本回合内**：调用 `planReuseCheck(plan, observation, legalActions)`；合法性、actor、动作语义、揭示与依赖全部通过后复用。`end_turn`/`pass` 不因动作身份单独重搜。
- **新回合**：使用同一检查——**新信息只有两类**，无新信息则复用上回合决策链：
  - 开关 `planNewTurnReuse`（sim 经 `resetConfig.planNewTurnReuse`，默认开；`false` 关闭后新回合一律重新搜索，用于 A/B 评估"忽略非依赖变化而复用"的影响）。
  - **结束与退出**：正式新turn尚未完成主行动时，`end_turn`不合法，旧步骤先由合法性拒绝；不以强制重搜掩盖回合错位。PASS检查独立`pass-decision`依赖：本席公开/私有状态、轮次、已有逐步机会事实和五类完整目标要求（保留资源缺口）。不比较对手资源、turnNumber或全局版本。事实变化即重搜，缺退出证据返回`pass-decision-evidence-missing`。退出证据不向前传播至普通动作，其他具名依赖规则不变。
  - **① 揭示外星人**：已揭示槽位数 > 计划假设值 → 无条件重新决策（隐藏信息揭示）；
  - **② 计划依赖环节变化**（计划依赖的具体盘面事实变了）→ 重新决策：
    - 路线：正式终点奖励、费用、己方标记或移动路线变化；他人追加标记但这些事实相同不重搜；
    - 科技：计划要拿的科技 tile 被拿走（供应 remaining/bonus 变化）；
    - 扇区：目标扇区标记状态变化（赢不了了）；
    - 外星槽：目标外星痕迹槽被占；
    - 公共牌：计划要用的公共牌被买走。
  - 不算新信息（可复用）：其他玩家移动/资源变化、无关扇区变化、无探测器移动的旋转、计划内自己的推进（含顺序执行第二条路线）。
- **防呆兜底**：下一步不在合法集（若因依赖变化 → 归入②；否则计划自身缺陷）→ 重新决策；缺揭示基线 / 缺依赖 → 保守重新决策。
- 逐步证据：搜索在 current、折叠 settleChoice、连续 nextPlaceData 三类正式输入前，
  读取当前 fork 的完整同 viewer 观察，立即按信息屏障遮蔽并提取事实；成功提交后才
  加入 `leaf.planSteps`。既有 actionChain 和 executionStepCount 不改含义。
- 数据布局的blueSlots由公共观察生产者按物理slot排序，保存恢复造成的对象键序
  变化不算布局变化；占用、解锁和科技位置变化仍触发依赖失效。
- 公共依赖按每个 origin 当时的目标深度、routeTargetId及完成阶段的单向边界分段；
  未完成步骤继承同目标后续明确奖励选择依赖，避免投入后才发现奖励变化；
  已进入goalCompletionPending奖励阶段后，遇到未完成步骤即切断，不跨入下一次投入。
  同目标切换routePlanId（如分析目标从卡牌取数据转为扫描）不切断公共依赖，但路线
  来源仍限制在当前routePlanId子段。每步事实取该步执行前观察；每步取当前
  目标及该段后继具名选择所需事实的并集，包括路线、科技、扇区、数据布局、公共牌、
  外星痕迹、终局计分板块。`tileId`不是科技类型标记：正式`final:<tile>`选择依赖
  具名终局板块的占位与变体，科技选择依赖公共科技目录；未知身份或缺失事实显式miss。
  终局选择的依赖同样传递到同段前置end_turn，其他板块变化不使它失效。
  自由决策（main/quick且非goalCompletionPending）另存`futureDependencies`：
  从剩余真实步骤汇集具名scope，但每项事实取当前步骤开始时的预测状态，而非未来状态。
  当前尚不存在的未来来源显式记录`present:false`；当前存在则记录`present:true,value`。
  相关后续事实变化报`future-step-affected`；自己推进使用下一步的新基线。
  conditional和目标完成后的强制奖励不扩大到后续目标；奖励排空后开始的下一次投入
  也不倒灌旧目标。后续无效步骤使当前自由决策计划显式无效；旧v2/v3计划拒绝。
  探测器扫描来源选择（target.probeScanSource）还依赖实际所选探测器的位置、
  owner、存在性及扇区布局；可选择对手探测器的牌同样检查其变化。无关探测器
  移动不使该计划失效。这些事实不替代后续正式合法集与Decision版本检查。
  不能用整叶根目标或最终观察代替下一步状态。外星痕迹按 `slotId` 与
  `traces[traceType]` 定位，不按物种名称或数组下标定位。
- 路线限定终点与正式sourceId（launch或具名rocket）；来源取当前/同目标最近probe、
  当前routePlanId子段的后继原生动作或具名requirement，不由后续另一来源覆盖当前来源。
  搜索标记`goalCompletionPending` 后当前步释放已达成目标依赖，只检查剩余奖励；
  这不阻止完成前的步骤提前检查同目标奖励。
  公司第二艘的`movementPreparation`单独绑定其目标、planId和sourceId，不覆盖主路线。
  当前移动输入还检查正式来源位置和移动阶段；路线依赖包含等成本首步、付费点与总资源成本，
  避免公司额度用尽或路线费用改变后误复用。条件后继保留每个origin的绑定，不能以
  actionId字典覆盖同一正式动作的不同目的；物理节点仍共享。
  路线目录的`endpointFacts`来自正式奖励构建器、能力成本与终点己方标记及其位置；
  奥陌陌读取自身面板。后续`REMOVE_PLANET_MARKER`还按planetId/kind/index建立具名依赖。
- 多步消费：`advancePlan` 同时推进动作、依赖与揭示基线；旧结构、缺失事实或语义
  不对应显式 miss。计划只驻留协调器，reset/load 清空，失败提交不消费。
- 探测来源（rollout v18）：`probe:<requirementId>`在根、后继、选靶及资源下界中精确
  对应同一来源。`advanceRoutePlan`仅用本席正式首次launch事件把launch占位转换为
  实际rocketId；后续发射不替换已绑定火箭。每个提交前记录当前绑定，提交后更新后续
  步骤；收入探测共用同一选择链。来源不存在即结束路线，不换用同终点另一枚火箭。
- 正式land入口为`target.select=true`，只有绑定需求的下一步已是land才匹配；多目标
  `choose_target`严格匹配火箭、行星和主星/卫星。目标完成依靠当前执行新增的正式
  orbit/land事件，不把请求选靶当作完成。完成后奖励步骤释放路线依赖，但继续检查
  奖励选择。单目标直连、多目标选靶及卡牌触发共用正式结算事件。
- 标准扫描首步：同目标段剩余步骤含`scan`时，扫描及前置准备步骤检查公开
  `sectorWinRequirements.standardScanEarthSource`（`scan-earth`依赖）。正式队列创建后，
  无未来scan的段不再依赖地球位置；来源缺失显式miss。来源计算与正式science扫描队列
  共用`getPlanetScanSource`，不以全部可扫描扇区的并集代替首步来源。本项不覆盖
  独立卡牌/奖励/外星人扫描的全部前置依赖。

### 3.3 边界与约束

- 复用层属于协调器决策流程（§1）的一部分：命中的决策来自**计划缓存**而非
  policy 的 decide，不经过决策函数/反事实搜索链；提交经协调器 execute
  （合法集/authority 重验）与 recordStep 记账（sim 补记，计数进 diagnostics：
  `planContinuationHitCount` / `MissReasons`）。判定空间变更需保持搜索空间与
  近似不变；搜索空间的独立变更单独归属版本。
- 计划 store 是 per-env 瞬态（`reset`/`loadCheckpoint` 清空，不入 checkpoint）：
  当前 simulation 每 env 固定单一 policy，store 的身份隐式等于该 policy；若未来
  支持同席多 policy 切换，store 必须按 policyType/version/modelChecksum/
  configChecksum 分键（checkpoint 红线）。
- Browser 与 Simulation 同一份装配（同一协调器 + 同一决策函数 config 源）：
  计划延续复用默认开（与 Simulation 一致），sim 经 `resetConfig.planContinuationFastPath`
  （`false` 关闭），browser 经 URL 参数 `?planReuse=0` 关闭。
- 延后不实现：tier3 内部的部分复用（原一步登陆变两步，可能仍去登陆只是少 1 电
  或多打一张移动牌）；tier2 的「可能出现更优选择」；多步链的跨路线续用。

### 3.4 统一搜索（唯一机制）

反事实搜索 = **目标引导 + 需求引导**（用户口径"需要了再做"；第一版"预算内全动作
尝试"实测全体玩家变弱——动作平铺进搜索树稀释主行动深搜，任何长链都规划不出来，
已废弃）。**搜索机制为单一路径**：去掉 bounded 分桶与 `unifiedSearch`
开关，off 分桶语义（strategic/bounded/control 三桶 + 目标门控）删除，以下行为恒生效：

- `expected-score-evaluator#requiresRootCounterfactual`：仅区分 control 与非 control；
  end_turn/pass 返回 false，其他动作返回 true，不在此按资源缺口筛选；
- `expected-score-evaluator#selectSecondaryAgentRootActions`：仅返回**目标目录
  compatibleActionIds 绑定的合法动作**。quick_trade/card_corner/industry 同样必须
  经目标准入，资源准备由目标目录负责，不存在按 UNIFIED_PURPOSE_FAMILIES 额外放行；
- `rule-composition#evaluate`：`allowUntargetedRootActions` 恒 true，但不绕过上述
  调用方根准入；内核对传入动作绑定目录目标，未绑定 origin 展开 ≤3 层
  （`MAX_UNTARGETED_DEPTH`）即收束 pruned（浅尝，防无限深挖）；
- `expected-score-evaluator#selectSecondaryAgentSuccessors`：`!routeTargetId` 分支
  返回 targeted + 合格未绑定后继（按 family 基础价值 + 净资源收益排序）+ controls，
  统一交全局搜索预算。普通move与quick_trade/card_corner仅经targeted进入；目录
  未选中的移动不再作为无目标后继补回。正式合法集、同成本路线首步及支付不变。
  未绑定分支的 choose_payment（弃牌/移动支付）
  与交易选牌视为纯结算直接不展开；绑定分支弃牌折叠的 `targetUsesFungibleResources`
  扩展覆盖探测行动目标（orbit:/land:/move: 前缀），card:/decision: 卡牌身份目标
  仍保留全部 choice；弃牌会话延续层（actionChain 末尾已是 choose_payment）直接
  收束（toggle 振荡防死）；
- **quick 根截断**（`QUICK_ROOT_FAMILIES` = quick_trade/card_corner/industry/place_data/
  runezu_face_symbol/complete_task，不含 move）：在未绑定后继分支，根动作属于该集合、
  到达主行动决策且没有 targeted 后继时，只返回 control（end_turn/pass），
  不继续展开后续主行动
  （leafValue 是整链价值，不按动作分摊；全放行时 quick_trade 87/card_corner 65
  虚高导致乱做）；
- **打牌目标准入**：play_card 经目标绑定进入搜索（income:card 收入牌 /
  tech:research 免费科技 / probe:免费发射 / sector:观测 / data:卡牌），未绑定目标
  的打牌保持 `STRATEGIC_GOAL_NOT_EVALUATED`。**不全部放行 play_card**——实测全部
  放行让单决策 8.9s/4096 撞顶且全盘行为退化（白色 86→17，纯效果牌评估虚高、
  打牌链未兑现），靠目标绑定识别"值得打的牌"（对齐用户 405 档：打牌都是
  有目的的——免费登陆/外星链/免费发射→探测/收入牌）；

## 4. Policy 契约

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
未绑定目标分支的`selectRouteTarget`可正常返回null，但抛错必须终止本次搜索并向调用方
保留原始错误，不能静默退回旧目标继续形成叶。该错误边界释放复用fork，正式root不变；
若释放同时失败，用AggregateError保留两个错误。不改变正常目标解析、排序或预算。

Decision 链只通过 active Effect Session 暴露的标准 choice 继续。主 Action 产生的必要 Decision
必须沿同一生产提交链结算到下一稳定策略边界；`awaiting_decision` 不是 leaf，不进入估值。
阿米巴区域奖励属于确定性Effect：结算开始时区域内每个符号领奖一次后固定移动，不再
生成排列搜索或重复领奖；卡牌单符号奖励保留真实Decision。计划只记录痕迹/卡牌等
正式输入，区域奖励随该输入结算并保留真实事件及盲抽屏障，不构造虚假的choose_target。

移动需求的规则读取（2026-09-07）：Residual提供共享只读
`describeEventBonusProgress({bonus,event,ownerId})`，区分无关事件、重复目的、已领取、
仅推进进度与可领奖，正式奖励也消费此判定。路线原型不再另算访问阈值/领取资格；
只有正式提交才能写进度和发奖励。此接口是需求式移动的前置，生产根目标与移动
候选尚未接入访问需求，不代表已消除无目标展开。

分支数/深度超过安全上限时返回 `unresolved`，不把已结算一半的状态伪装为 leaf。Simulation 随机
分支从 root identity 与 actionId 派生独立 RNG；一旦消费随机数，outcome 标为
`low-confidence/COUNTERFACTUAL_RANDOM_SAMPLE`。Browser 无法安全聚合随机期望时同样返回
low confidence。固定 RNG 只用于让规则结果可复现，不授权 Policy 读取本局未来信息：公共牌补牌、
盲抽、外星揭示等隐藏信息出现后，反事实仍继续搜索，但新身份在后续 observation、目标 requirement
和 legal successor 中保持 opaque。搜索可以继续使用已兑现的分数、资源与牌张数量，也可以把未知牌
用于身份无关的通用弃牌支付；移动牌支付和开局插收入牌依赖牌面，不享有该豁免。
普通后继与唯一支付自动结算共用此信息边界；不得用未知牌面建立打牌、卡角、
定向扫描或物种能力路线。
计算机第4格收入由science_domain_income在真实盲抽成功后上报hidden_card_reveal；
钱电等不抽牌收入不增加此屏障。盲抽失败显式返回SCIENCE_INCOME_DRAW_FAILED，不提交缺失奖励的收入。
正式science普通精选奖励可将未知公共牌按数量入手，候选牌面展示继续遮蔽，入手后
仍不能使用未知牌面能力；不因此放开扫描或收入选牌。除独立条件根/PASS的显式交接
边界外，条件流程没有安全后继时记录`conditional-no-successor`剪枝，不生成未结算结果叶。
公共扫描与 Quick Trade 精选牌都必须在正式 executor 补牌时上报同一隐藏信息 barrier；盲抽上报
`hidden_card_draw`。公共牌区扫描的补牌延后到本次扫描流程结束时统一进行：放置后空位保持留空
（公共区留空待扫描结束补牌），同一扫描内后续放置只能选择剩余可见牌，补牌
时才上报 `hidden_card_reveal` 并消费随机数。不得因入口属于通用 Standard Action Decision
而绕过信息边界。

每个 root/leaf observation 使用 `seti-decision-observation-v2`，其中
`outcomeProjection` 为 `seti-outcome-projection-v2`。projection 只增加以下
viewer-safe 窄字段，不暴露 executor 或隐藏 root。`progress.probeRoute` 最多列两枚本席在途
探测器的标识/坐标；候选 leaf 只额外携带 `nextActionId/family/summary`、目标行星与
`orbit/land` outcome 引用、已兑现目标分、沿途宣传 delta、终点即时 delta、标准路线实耗、
移动余步、主星第一奖励格是否空置和叶后钱/电。`dataAnalyzeRequirements` 只投影计算机已放置数、
可用数据数、下一正式步骤及其信用/能源缺口，以及补数据acquisitionPlans；扫描费用和分析减免分别来自正式 scan effect 与公司被动。
单一“精选并获得角标”效果的打牌补数据计划按打出实例与公共数据角标实例成对绑定：
`data:card:<打出实例>:pick:<精选实例>`，kind仍为card，selection.cardInstanceId记录精选来源。
隐藏信息过滤同时检查该嵌套来源；精选阶段只执行该计划绑定的实例，不能换成无数据收益的牌。
没有数据缺口时不额外生成此类打牌准备；正式规则合法集和其他目标的精选不受影响。
用于续算的完整 checkpoint 只存在于隔离 fork 内，投影时物理删除，不复制太阳系、星云、token
或扫描结构。

启发式搜索的一级评估轴是当前正式分数、收入和科技；叶节点库存不统一按固定单价加分。
蓝槽资源只计有正式来源且尚未消费的留存；数据只计当前已解锁、未占用槽位的可用机会，
不把整条路线的资源净增长归到蓝槽，也不把超出可用槽容量的库存继续加值。
一级目标不是路线终点。搜索在中途取得一级收益后继续，直到本席真实 PASS，或正式
完成 15 个结果目标。

次级目标只描述结算结果：

- 指定探测器在指定星球或卫星完成环绕/登陆；
- 赢得启发式选出的普通具名扇区；定向额外触达的卡牌或能力可保留额外扇区计划；
- 完成正式数据分析；
- 任一收入轨相对选择目标时的基线上升；
- 获得具体科技；
- 兑现具体公司或物种能力结果；
- 根 conditional 的具名 Decision 结果。

单次扫描、发射、移动、快速转换、放置数据、卡角、支付和其他 conditional 都只是既定目标的
达成步骤。任何 action family 单独都不能证明目标完成。`goalId` 保存结果，`planId` 保存达成
路线，`resultGoalIds` 记录同一物理路线可同时兑现的结果；只有 Effect Session 完整结算后的
正式 observation 证明目标结果出现，目标深度才增加一次。

根搜索只执行能绑定上述结果目录的 action。普通扫描先按正式扇区胜利要求选择最好赢的扇区，
不会遍历八个扇区；具有定向额外触达能力的来源单独保留。选定目标后，只执行其正式下一步或
严格补足当前资源缺口的最小损耗转换。直接移动与移动牌等资源结构不同的非支配路线可以同时
保留；纯亏损且不提供额外结果的转换不会作为独立探索方向。

打出卡牌本身不是次级目标。卡牌只有在已经绑定具体结果时才进入搜索，例如为具名登陆/环绕
补移动、为科技补宣传或直接研究对应科技、为收入或分析补数据。牌离开手牌不能单独证明路线
完成，也不会占用一个目标深度。

研究科技同样先做启发式候选生成，不把全部 12 块科技及四个蓝槽交给路线搜索。持有数据时优先
考虑蓝1/蓝2；已经绑定扫描用途时考虑紫2/紫4；发射、移动并准备访问小行星或行星时考虑橙2；
橙1、橙3/4、蓝3/4是次一档候选。紫1只在路线确实需要补两数据时加入，紫3只服务扇区获胜。
蓝科技只选择当前计算机进度下最快能开放附加数据格的一个槽。宣传不足时先执行同时推进数据轨
的计算机放置，再按下游结果能力保留科技、发射、收入、扫描和移动牌，只弃一个能力最低的宣传
卡角；等价的卡角与放置排列不再全排列。上述规则只收敛候选，不给科技或中间行动增加固定分，
最终仍由完整终点事实比较。

计算机第4格收入路线的资源转换要求保有一张收入牌（`nextCost.handSize=1`），
最小转换方案的终点同时满足钱、能量和手牌要求；允许中途耗牌后再补回来。
转换器原有未作为支付容量的外星手牌可计入留存下界，不扩大其他目标的支付探索。
缓存键包含手牌目标，其他路线默认要求0；正式扫描扣费、直接行动和收入计分不变。
资源准备结果缓存同时包含规范化的tradeId/actionId映射，因为同成本终态代表按
actionId排序；不同玩家动作编号不能沿用先调用者的代表。命中后从当前合法集取
descriptor，不缓存旧authority。固定交易图的资源距离缓存不依赖动作编号，保持共享。

环绕/登陆目标在进入执行搜索前，先使用 Production Kernel 按真实太阳系拓扑算出的最短路径、
移动点数和钱/电总成本排序。主星目标保留最近环绕与最近登陆各一个（后续奖励格同样可选）；
卫星登陆在前三轮只保留木星、土星，最后一轮再加入天王星、海王星。没有橙4时卫星不属于当前
合法目标；若当前能研究橙4，则先把橙4作为前置科技目标，取得后再从新状态生成卫星路线。
同一具名终点的多条路线交给全局队列预算选择；不得按终点评分摘要合并未来状态，
不得给行星或卫星目标增加固定估值。
每次科技等效果旋转太阳系后，子状态重新生成路线 requirement 并按新距离调度，不复用旋转前
距离。该阶段使用规则投影的路径和奖励，不以 action 展开次数代替行星距离。

移动手段由同一主要目标需求生成：`movementNextSteps`保留最低付费点、最少移动
次数下的全部等成本正式首步，包含普通移动、开启寰宇动力、当前公司/卡牌移动选择
或结束阶段。路线状态区分坐标、当前卡牌点、当前来源的公司额度、公司选择阶段及
首步；同坐标但阶段/额度不同不去重。地形与占位读取共享正式能力，图完全展开后按
上述成本支配，不新增隐藏截断；结构缓存包含移动阶段，资源缺口在缓存外重算。
寰宇每艘至多一点，未发射来源不能预支免费点；不能按全付费路线先排除免费可达目标。
公司未绑定主要目标的入口不展开。当前主来源使用后，第二艘只保留推进另一已有
主要目标的方向及结束；不建立彗星4分或双行星3分的独立绕路目标。不同等成本首步
保留，由实际规则兑现沿途收益，不在路线图给卡牌奖励预加分。
已绑定且仍存在的卡牌或公司移动目标，其结束选项也必须匹配`movementNextSteps`，不能
无条件放弃免费点再付费走相同路线。剩余点无法使用或已到终点时，由路线图的结束
阶段首步保留skip；公司主来源已用后，保留图中结束首步与第二艘的独立目标准备。
不改变未绑定根、隐藏阶段或目标缺失时的退出语义。
未开启的公司额度由Residual的`getCompanyMovementAllowance`共享读取公司身份、
PASS、active前置和1x标记；不以当前位置能否立即启用来推断未来额度。暂时没有
合法1点方向时，路线可先付费移出、再用公司点；正式启用仍检查当前几何。当前
Session剩余额度继续只取remaining/usedRocketIds，不能重复发放。

若既定环绕/登陆路线下一步需要移动，而本行动圈已经用过主行动，没有当前移动窗口时
先结束行动圈，再在本席下一次行动机会比较手中的移动牌。有当前窗口时按统一时机判断
选择当前可兑现的首步及必要能量准备，不用下一turn的移动牌否定当前可能错过的机会。
主行动前，对同一个移动缺口，
`1 张移动牌` 会支配 `弃 2 张牌换 1 能量再移动`；花信用点换能量与保留手牌则属于资源结构不同
的非支配方案，继续交给完整终点评估比较。

扫描行动附带的公共牌扫描若能触达已绑定扇区，必须优先推进该扇区；若当前公共牌均不能触达，
只选择正式胜利要求最低的其他可达扇区中的稳定代表，不展开所有无关公共牌组合。该启发式会
忽略“故意扫描较难扇区以改变后续公共牌供应”的远期分支，是为避免目标内奖励组合爆炸而接受
的显式性能近似。

公共牌扫描获得“结束”选项后，额外公共扫描只在三种情况下继续：绑定的数据路线仍缺数据、
下一落点会立即得分，或这一扫会填满并结算扇区。2026-08-14 用户裁决（B3a）：数据已足够且
没有立即得分/结算放置时，不再强制结束，允许继续放置（仍只保留通用扇区代表，不展开全部
牌×扇区组合）；避免只为用掉额外公共扫描标记而展开无关组合的约束不变。赢得扇区路线继续按绑定扇区判断。

`data:analyze` 只有在“计算机已放数据数 + 当前可用数据数 ≥ 4”、即当前库存足以填满第一行时
才进入目标目录。第一行尚未可达时，不为了分析主动扫描、移动探测器、打牌或快速转换；放数据
仍可服务收入等其他正式目标。第一行已经可达后，分析路线可以选择正式效果证明会获得数据的
扫描、具名环绕/登陆、直接数据卡牌和数据弃牌角标；选定来源后才补其资源缺口。任一其他正式
路线实际获得数据并使门槛成立后，也可以继续锁定分析。**数据放置需求驱动（2026-08-21
用户裁定：结算不搜索，按"我需要什么"直接选）**——blue 槽奖励 blue1=+1信用 /
blue2=+1能量 / blue3=精选1张 / blue4=+2宣传，computer 槽位奖励 第2格=+1宣传 /
第4格=收入；需求优先级：宣传缺口（研究科技，pub < 研究成本）→ blue4/computer第2格 →
收入目标 → computer第4格 → 钱/电缺口 → blue1/blue2 → 牌 → blue3 → **无需求时
收束不填**（没需求做不做都一样，place_data 是手段动作），除非可用数据 ≥ 6 溢出才
computer 推进腾位。搜索遇 data:analyze 放置决策按此贪心折叠为单个代表（其余槽
targetEquivalentChoiceCount 报告），**不再展开全部 blue 槽**——此前只认 blue1/blue2
的 gap 资源、blue3/blue4 奖励被滤掉导致折叠失效，白色 R3 决策 5555 个 choose_target
节点全展开（42s/16384 触顶），需求驱动后收敛（9.9s、2637 执行、不再 PRUNED）。

搜索跨本席的多个行动机会，但当前阶段完全不预测对手策略。白色 `end_turn` 先执行正式规则，
清理本回合效果；随后可信反事实 fork 的单席位规划时钟直接进入白色下一行动圈。规划器不执行
对手 Standard Action、PASS 或 conditional，不读取对手手牌，也不改变对手资源、PASS 预留牌堆、
太阳系或其他公开盘面。该近似不预测抢位和公共供应变化，结果会偏乐观。

白色未来选择 PASS 时，搜索在第一个正式 PASS Decision 边界形成叶，不提前查看或选择预留牌；
真实游戏已经进入该 conditional Decision 后，Policy 才能基于当时可见选项作答。搜索不进入
新轮，因此不会把轮初收入误算成 PASS 的价值。

完整目标结果保留真实观察供终点评分；评分摘要不再用于淘汰后续搜索。不同火箭位置、
手牌、公共盘面、RNG或实体序号不能因为当前分数相同而互相支配。
状态共享仅按完整envelope/session、动作与剩余条件深度，
不同origin继续保留各自目标/计划和来源义务。

收入目标ID保存建立目标时六条收入轨基线；同一中文目标不等于同一状态。
报告保留不同入口状态与目标内完成路线；旧支配计数字段只用于读取历史版本。

最终排序使用：

```text
Primary(leaf)
  = 实际分数变化
  + 科技未来价值F(叶)-F(根)
  + Σ(各新增收入轨 × 每个尚未发生的发放轮单价)
  + Δ外星人牌价值 + 宣传研究预期
```

外星人牌价值F=(我方未揭示首痕迹数+已持有外星牌数)×统一外星牌单价12。
主评分和轻量搜索优先级都计F(叶)-F(根)，V的alienValue计F本身。揭示发牌时待获得减1、
持有加1，不增加或丢失12分；用牌时扣回持牌预期再计实际效果。V手牌效果估计复用
outcome-model.isAlienCard排除外星牌，防止第二次计值；普通牌不变。
额外标记、公共揭示和三色齐没有固定溢价，正式即时分与已有终局计分只计一次。
不读取隐藏物种身份；揭示后的特殊奖励按正式结果更新，不凭假设生成持牌事实。
12为2026-09-11用户确认的现行牌价值，进一步数值调优不属于本阶段。

当轮库存不是正式分，附加项是启发式预期而非已兑现得分。资源单位为信用10、能源8、普通牌6、
宣传4、数据6、移动5、外星牌12，额外公共扫描仍视为手段计0。只有钱电乘
`1 - 0.5 × (发放轮 - 1)/(终止轮 - 1)`，单轮游戏全价；第1/2/3/4轮新增收入分别计算
第2–4/3–4/4/无发放窗口。例如第1轮新增1信用收入价值20，1能源收入16；
手牌收入映射普通牌，宣传/数据/手牌收入不折价。`incomeFutureValue`只算未来窗口，
实际立即领取不会在此重复计入。V的收入项使用同一窗口再乘原复利系数1.4，流动性项为
固定0，科技项使用同一F；未打出牌的钱电效果按共享单价×兑现概率0.25，再乘原手牌/保留牌位置折扣。
这些折扣是预期实现概率，不是第二套资源单价。非蓝科技每个剩余轮次的价值为：橙2=7，
橙3=5，紫2/紫4=10；橙1/橙4/紫1/紫3=0。蓝科技只用下述正式奖励公式，
TECH_UNIT_VALUES中的蓝1至4固定项为0，不再额外叠加旧每轮10/10/5/5。
科技未来能力仅计未失效的已拥有板块：完整projection与轻量strategicFacts从公共
techState同源提供disabledTechIds，经infrastructure传给共享科技potential，因此
V、叶评分与搜索优先级都扣除失效能力。ownedTechIds、科技数量、已研究目标完成及
正式计分仍按所有权处理；失效片不能重新研究同编号。

宣传研究预期不再使用固定6宣传门槛与60价值。`outcome-model` 从同viewer的正式
`techGainRequirements` 派生 `progress.researchOptions`（科技标识、正式宣传费用），轻量
strategicFacts携带同样字段。`P(state) = 0.5 × max(可研究科技未来价值 × min(宣传/费用,1))`，
其中科技未来价值与真正取得同一科技时的函数共用。只计算最好的一次机会，不把库存同时许给
多块科技；免费研究、已拥有科技、没有候选或没有未来科技窗口时为0，不能猜背面即时奖励。
叶评分的 `publicityResearchValue = P(leaf)-P(root)` 允许负值，消费宣传或候选失效时扣回
旧预期；拆开的“攒宣传→研究”不会重复奖励。V的 `researchOptionValue` 分项使用同一P。
正式候选缺少科技标识/费用或费用为负时显式失败，不以缺省值隐藏错误。

蓝槽归因由正式资源owner维护：`players.blueBonusResources.{credits,energy}`仅随science
蓝槽奖励入账，任意正式支付优先扣减这部分留存。这是奖励归因约定，
不改变费用或可支付判断；其他来源入账不会复活已经消费的蓝槽奖励。蓝3精选成功后给真实
卡实例记录`blueBonusOwnerId`，来源卡数量只统计当前手牌；离手扣回、同实例返回恢复，
重洗产生的新实例不继承标记。普通科技背面精选不标记；蓝4通过宣传P兑现，不另加库存单价。
来源仅供解释，不直接计入Primary或V；所有普通手牌按相同卡面和位置估值，不因蓝3来源排除。

蓝槽当轮取得的钱电、牌和数据不另加库存或空槽预期分，消费也不按来源单独扣分。
其用途通过同一反事实内核执行后继行动，体现为正式分、科技、收入或宣传研究机会的变化。
扫描主行动根不再在附带选牌等条件决策未结算时提前成叶，而沿用通用条件决策与后继路线；
独立条件决策根、PASS边界、隐藏信息遮蔽和后继过滤仍保持原契约，不执行对手动作。
F的蓝槽部分只计算当前轮之后的窗口：每未来轮4/3次名义使用×0.5兑现率×该轮正式奖励
资源单价；当前轮不在F内。非蓝槽科技基础轮次价值保留既有表。科技候选预排序的
蓝槽单次奖励、橙3省电也用共享单价，不保留钱8/电10副表。`techValue`展示F差，可为负值。

公司收入终局口径（2026-09-08）：a1/a2只计相对公司默认收入的增长量。共享计分函数
根据玩家initialSelection.industry从initial-cards正式目录取得默认收入，正式终局、
待放置标记预估和依赖同一公式的终局牌共用此来源；不要求玩家保存额外baseIncome副本。
未选公司按无基础收入，已选但无法识别的公司显式报错，不以空对象漏扣。既有显式基数
接口保持不变；初始牌和游戏中增加的收入仍计入增长量。

**终局契约（2026-09-05）**：终局叶价值只保留正式终局分减去根状态已兑现与已锁定分；
收入、科技、蓝槽、数据、痕迹、外星与宣传研究预期全部归零。V 的终局绝对值同样仅为正式
终局分，不解析剩余手牌效果；搜索优先级清空目标完成、路线和库存项，只保留正式分差。
同正式分终局叶沿用稳定 tie-break，资源变化、V 开关和候选枚举顺序不能改变赢家。
终局正式分已包含板块与卡牌分，不再叠加 securedEndGameBonus。优胜叶的到达动作链仍供
计划提取消费。非终局科技若能在当轮继续帮助行动，必须由后续真实路线兑现价值，不能重复计分。

位置型终局卡（如b82小行星探测器13分）在正式计分函数内经
`rockets.buildProbeLocationData` 读取当前盘面，正式结算、AI观察与页面一致；
不依赖调用方选装位置索引，不在启发式层另加分。该读取与卡牌任务共用普通探测器、
当前旋转位置的契约；缺少必需盘面显式失败。

四轮迭代的范围与验证义务见 `docs/ai-iteration-plan-20260905.md`。第二轮三个批次已实现，
首候选`4f994f86`固定盘面终局均分82，低于基线99.75，未通过验收，仍需复盘重设计；
上一通过版本为第一轮。第二轮替换候选c1b7bd49续跑支付循环；后续fda901b9已消除循环，
完整终局均分81.75仍未通过。估值与搜索改动已分开审计，见
`reports/iteration/resource-r2-scope-audit-20260905.md`；搜索结果保留按独立修复S1登记，
不归入第二轮估值，不认定其为第二轮引入。两项原有测试失败按用户2026-09-05指示
暂不处理，不作为本轮阻断项。
S1提交`e80ca9e7`固定盘面终局均98.5，较修复前提高16.75，仍低于通过基线99.75；
随后R2e提交`20feca27`去掉蓝科技未来价值中重复叠加的旧固定轮次项，正式终局均106.75，
较S1提高8.25、较R1提高7，第二轮通过固定盘面验收。搜索S1独立留档；计划依赖与搜索
预算/裁剪仍待第三、四轮，不以本轮得分提升宣称这些问题解决。
任何中间 action、goal 或 family 都没有固定奖励。

次级搜索使用精确最小堆维护frontier和全局beam：物理执行最多4096节点、队列最多
保留256物理节点。根首步优先执行；每轮合并后先为每个仍有frontier的根动作保留最优
一个节点，再按统一顺序填满容量，共享节点只占一格且保留全部origin。淘汰来源明确
记为beam-budget，不伪称无损剪枝。普通control浅评估的独立预算不变。

2026-09-11：每次搜索诊断增加 `budgetLimits`，分 `leaves/frontier/execution` 记录
`enabled/limit/reached/truncated`。战略搜索虽传入 maxLeaves=8，但叶限制未启用；
control 按实际叶上限记数。队列另记保留峰值 `peak` 与实际裁剪次数 `trimCount`，
叶限制另记丢弃来源次数 `prunedOriginCount`，执行预算另记 `used` 与
`remainingFrontierNodeCount`。触顶与截断分开：自然满额但没有剩余工作不算截断。
字段经决策函数 `searches[].diagnostics` 进入调研日志和复盘报告；不改变搜索或评分。

次级maxLeaves饱和、资源/完成评分摘要支配、只留最便宜下一目标和未绑定top-4均已
删除。资源下界只用于准入目标排序，全部准入后继交给全局beam；已有“手段需要
目标”和未绑定quick根不借主行动收益的边界保留。目标/条件深度与未绑定深度边界
仍是显式有损截断，不等于完整穷举。

outcome.status仍表达真实结果可用性；searchCompleteness独立报告complete、
incomplete、not-evaluated及原因。已有真实叶且截断仍为settled，可评分/提取计划；
无叶截断为unresolved，frontier不可冒充收益。
未完成路线只保留实际搜索队列及统计，不构造不参与输出的中途结果副本；完成目标的
真实叶仍独立保留，即使后续继续入队或遭预算裁剪也不丢弃。
完整性覆盖声明的单席策略范围，不表示全多人游戏最优。元数据经投影与Policy契约校验，不改变估值权重。

每次次级搜索期限30000ms，宏步前后检查；超时显式抛COUNTERFACTUAL_SEARCH_TIMEOUT，
清理隔离fork，不返回部分策略或提交真实根。同步宏步不能中途抢占，因此不承诺严格
实时中断。完整决策还含结果投影、Policy与计划提取。2026-09-06用户允许适度放宽
模拟耗时：初次棕方样本总决策10.42秒、搜索8.39秒不再单独阻止全盘验证；仍需报告
整局实测耗时及慢决策，不扩大节点预算、不移除搜索超时保护，也不宣称性能已优化达标。
后续快速验证触发原10秒搜索超时，期限独立放宽为30秒；若仍超时须定位，不自动加码。

Heuristic每次决策的`searches`只含本次实际evaluate（control/strategic各自一项），
不进入Policy输入或计划。每项保留内核原始`beamPrunedOriginCount`，大于0表示该次搜索
发生队列裁剪；与`executionLimitReached`分别统计及取并集，不把缺失字段当作零。
诊断`attemptedNodeCountByFamily`包括失败宏节点；原
`executedNodeCountByFamily`仍只计成功宏节点，二者差异按`failedNodeCountByFamily`
与`failedNodeCountByCode`解释。`successfulInputSubmissionCount`计每次成功正式输入，
包含折叠提交及其后宏步失败之前已成功的输入，不含单席位规划时钟推进。
`executedNodeCountByDecisionKind` 从节点首个正式输入的提交前上下文分类：
`family:phase`；conditional 追加 `/decision=…/effect=…`，以及 Effect payload
实际存在的 step、kind、abilityId（key 为 ability）、cardEffect.type（cardEffect）、
decisionContext.kind（context）。不再读取可选的 target.kind；缺少必需 Decision kind
或 Effect type 显式失败。目标交叉统计使用同一 key，不把折叠输入计为额外节点。
此分类不包含实例 ID 或完整 payload，不进入游戏状态、RNG、Policy 与计划。

反事实执行复用一个 Composition 级可信隔离 fork。每个候选从同一 checkpoint 恢复
StateStore、Effect Session 和分支 RNG，再调用生产 registry/executor；Simulation 的可信
projection reader 可读取该隔离 state，Browser 与普通公共路径仍保留复制。可信 fork 省略重复
undo frame、重复输入克隆和中间 validation，但最终 candidate 仍执行完整 schema/invariant
验证，异常分支由下一次 restore 整体恢复。canonical root、正式 RNG、journal 和其他 frontier
不共享可变引用。

Production的地球坐标、探测路线context及正式Action context直接读取太阳系内核
`collectPlanetLocations`；它也是完整太阳系快照的行星字段来源。只需行星坐标时不生成
未消费的可视格子与星云数组，不增加缓存或改变旋转、奥陌陌激活、排序与规则语义。

移动费用统一由AbilityRocket读取该玩家有效的当回合movementModifiers（如b124
忽略小行星限制），枚举、提交与路线预读共用`ignoresAsteroidRestriction`判定。
探测拓扑缓存键包含该判定，开启或清除修正时结构缓存同步失效，不能沿用旧移动费用。

探测候选结构键除永久techState外，还包含正式登陆费用读取者的有效橙3、请求玩家
的有效橙4，均按正式回合上下文读取。临时借用建立、替换、清除或到期后，不得沿用
旧登陆费用或旧卫星目录；无需清空拓扑缓存，钱电资源缺口仍在结构缓存外重算。

图灵借科技的根目录和树内后继按当分支公开techState排除已拥有且未失效的橙/紫科技。
供应中全是重复能力时不启用公司；已进入强制借用Decision且全重复时保留一个正式选择。
刚完成借科技选择时不搜索同席立即`end_turn`的分支；正式合法集、人类操作、PASS及
穿插行动后的结束不变。这两项是搜索支配剪枝，不是牌效偏好或完整用途绑定。

扇区目录缓存按完整data、玩家id/color及每次正式计算的扫描来源/基础费用建立键，
不再仅按data/tech/hand复用整个目录。旋转、公共牌、借用科技时点和公司费用变化
都会反映到目录。水星来源从正式行星数组查找；accessSources表示潜在能力，不等于
即时合法动作或免费收益，紫2追加宣传仍由正式扫描队列收费/跳过。基础费用是下界，
不是包含所有可选科技追加支付的总价。

标准扫描的绑定目标以完整`sector:win:扇区:结算序号`验证仍在正式候选目录中。
当前行动及奖励排空后，过期目标不再生成扫描、资源准备或等待下一回合的后继；
不能在旧来源中偷换成下一次结算。当前条件/奖励链仍完整执行，缺失候选目录显式报错。

已处理来源与frontier合并共用完整originKey，包括根行动、根目标/路线、当前目标/路线、
目标深度、PASS、待结算完成与信息遮蔽状态；不能因另一个根先到同一物理节点而删除后到
根的收益归属。正常行动边界无选中后继时保留已结算实际状态，并以`route-unreachable`
标明目标路线停止，不增加目标深度或未兑现收益；条件决策未完成时不使用此结束方式。
目标已完成但没有后继统一标为`goal-completed`。`route-unreachable`非终局叶只保留实际
结果，不参与优胜计划排序；全为不可用路线时返回`route-target-not-completed`。

已完成目标且附带Decision全部排空后，如果还要继续搜索下一目标，先把该真实状态
保存为`goal-completed`叶，再按原顺序展开。未完成目标仍只保存frontier诊断，不能冒充
完成结果。后续预算耗尽不会抹掉此前已完成收益，但outcome保留pruned标记/低置信度，
不宣称搜索穷尽。叶使用同一origin的行动链、提交数、目标深度和遮蔽后的完整观察；
不新增目标固定奖励，不改变正式状态、RNG或费用。

弃牌结算读取当前正式Effect的`decisionContext.count/selected`，不按decisionId另建
已选牌缓存，不硬编码2张。每次点选更新正式Decision后重新读取状态，选满才确认；正式
上下文缺失或选择状态不一致时显式失败。原有排空上限与隐藏信息捕获仍生效。
快速交易未选满时不生成确认输入；排空以正式弃牌上下文识别阶段，不依赖确认项
提前存在。选满后缺确认输入报`COUNTERFACTUAL_DISCARD_CONFIRM_MISSING`。
除正式弃牌代表路线和计算机唯一选位外，仅单项支付/交易精选可直接排空；多个费用或牌面
选择回到selector分组排序后执行，composition不固定取首项。弃牌/交易的手牌代表选择仍为
既有策略近似，不等于完整枚举全部手牌用途。

连续放数据的普通Action不是强制结算。每次选位结算后，仅所有合并来源均有未完成的
绑定目标，且原目标后继选择器唯一返回同一个place_data、目标/计划/结果目标不变时
才在当前节点续填；没有目标、出现其他选择、目标完成/改绑或隐藏信息屏障都回到
统一搜索边界。唯一选位/付款仍按正式Decision提交，每一步保留计划证据和提交计数。
因此扫描准备允许在放一次后扫描，不被“仍可合法放置”强制替换成填满计算机。

叶的`executionStepCount`计入每次成功的正式Action/Decision提交，包括节点内折叠的支付和
连续放置，但不改变搜索节点预算或actionChain/plan结构。同价值、同既有次级排序的
非终局条件决策优先更少实际提交；叶内选择和跨候选排序一致。它只消除取消再重选等无效
绕行，不增加动作分，不能压过收益，也不改变终局正式分的稳定排序。

完整 future state、Session、RNG、Decision owner 和下一 action 相同的分支可以共享一次物理
执行；不同奖励、手牌身份、科技、收入或盘面不能作为规则等价合并。仅在资源目标内部，等量弃牌
支付和终局 PASS 后只影响未纳入终点评估的普通牌身份 choice 会稳定保留一个代表，并通过
`targetEquivalentChoicePrunedCount` 显式报告。这是终点事实抽象，不得描述为规则无损。

未揭示外星槽的痕迹选择在执行前使用正式痕迹奖励做支配比较：即时收益被另一槽严格支配时直接
剪枝；即时收益完全相同时稳定保留一个代表。若玩家已打出且尚未完成的任务会区分痕迹所在槽位，
例如要求每个外星人都有某色痕迹或要求痕迹集中在同一外星人，则保留全部相关选择。已经揭示的
物种痕迹位置不适用这项未揭示合并。

rollout v21按2026-09-07用户确认对普通痕迹选位贪心：阿米巴、虫族粉黄、九折、异常点
按每个外星人/颜色保留最下面的合法位置；半人马3–5、奥陌陌2–4同样处理，付资源换分
位保留搜索。符文族3位淘汰2位，其余符号位、虫族全部蓝位保留。方舟整套机制后续
独立迭代，本轮不筛选其正面、解锁和state额外位。其他纯溢出3分位在本次已有合法
正面候选时排除，未揭示带宣传的首痕迹仍保留。根目标目录与绑定/未绑定后继共用
同一纯筛选函数，不读取summary或隐藏奖励，不改变正式合法集和动作身份。
这属于用户授权的候选策略近似，不是等价去重；九折威胁与异常点上位收益不额外建模。
最后一轮仍默认牌优先；只有已正式PASS或已终局才取消普通位置筛选，交正式搜索比较
结果，不以主行动已用或缺钱判定无行动。未PASS但实际已无行动的更强可达性判断未实现。
不新增剪枝计数冒充执行减少，物理节点/提交数保持原口径，不计入targetEquivalentChoiceCount。

在上述选位之后，已揭示虫族同槽位的粉黄纯分数奖励，按正式getTraceReward保留即时分
最高的一项，同分按actionId稳定选择。仅筛当前观察席位；存在未完成普通任务或已打
外星牌时保留颜色选择。蓝色化石、附带卡牌、其他物种和未揭示首痕迹不受本层影响。
此为局部贪心，会放弃尚未打出或未来抽牌产生的颜色机会，不属于无损去重，也不修改
正式合法集、估值权重或首痕迹外星牌12分预期。

同一筛选层对已揭示、首痕迹已存在的同色state额外位按正式额外奖励稳定保留一项。
只处理当前席位，方舟槽、解锁与正面位置不纳入；有未完成普通任务或已打外星牌时
不作本层筛选。额外标记归属仍不同，可能影响未来牌的槽位条件，因此是贪心而非等价
去重，不增加等价省略计数，不改变正式合法动作。

外星拿牌Decision的根目录与后继共用公开展示优先的局部贪心：只有当前观察席位、
同物种完整拿牌选项才筛选；有展示牌取展示牌，否则保留盲抽，仅取消时仍保留取消。
后继限于未绑定或现有资源/探测目标；目标、计划或结果目标含具体card/decision身份，
以及未知目标时，仍保留展示与盲抽。未来出现多张展示牌也保留全部非取消选择。
固定外星牌12分不证明牌面与后续状态等价；此策略可能放弃盲抽的未来机会，不计等价
省略、不修改正式合法集、规则或估值，也不读取隐藏牌序。

已经正式触发且只提供“结算奖励/跳过奖励”的 residual card settlement 在搜索中稳定选择立即
结算，并把 skip 计入等价选择省略数。该策略不改变真实 Decision 或奖励规则，但会漏掉“当前
资源接近上限，故意保留 trigger 到以后再领”的时机选择；保留此近似是为了避免未消耗 trigger
在后续每个匹配事件上重复形成指数分支。

运行诊断至少记录候选与根目标数、物理执行节点、actor 分项、对手执行数、单席位时钟推进数、
PASS Decision 边界叶、最大 frontier、状态共享、
完成目标次数/最大深度、搜索完整性、不可达路线数、beam/执行保护状态，以及
fork/执行/投影/checkpoint/frontier/编排耗时。耗时仅用于性能验证，不参与候选排序。
固定盘面报告可通过 `--focus-decision N` 只重放到指定决策，并按“第 1 层结果目标 → 目标内
完成路线 → 实际保留结果 → 下一层结果目标”输出单节点搜索树。父子目标与中文行动摘要
只在该报告开关启用时记录，不进入普通 Browser/Simulation 搜索；trace 不参与排序、状态等价、
节点预算或终点估值。单节点报告的太阳系、外围扇区及行星环绕/登陆区直接复用 Browser Web 的
正式底图、token 图片与坐标函数；四块扇区板按 Web 的盘位和旋转围绕太阳系，行星区不再重复
输出文字版。搜索树之前必须展示最终优胜叶的正式分数、锁定终局分、剩余资源、收入、科技、
数据计算机进度、完整目标链及相对起点变化，区分“最终搜索结果”和“当前只提交的第一步”。

## 5. Browser 调度与规则边界

Browser bootstrap 可以：

- 标记哪些 seat 由机器控制；
- 在 Rule Composition lifecycle 后失效旧决策（重建协调器/决策函数、清计划 store）；
- 调度下一次机器席位 runOnce（经协调器 readBoundary -> 复用/决策 -> execute）；
- 在协调器/决策失败时把抛错转成显式 fail 结果并暂停。

Browser bootstrap 不可以：

- 枚举或评分候选；
- 解析 pending；
- 执行 Standard Action/Decision；
- 保存 battle report/tuning history；
- 持有规则 working root；
- 保存或应用按 family 调参的 strategy weights。

终局板块、初始选择、弃牌、支付、科技与外星人选择都必须作为标准 Decision 进入同一 Policy 输入链。

## 6. 验证

最低验证：

```sh
node randomizer/game/ai/policy-port.test.js
node randomizer/game/ai/machine-player-coordinator.test.js
node randomizer/game/ai/heuristic-evaluator.test.js
node randomizer/game/ai/heuristic-policy.test.js
node randomizer/game/ai/plan-continuation.test.js
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

## 7. 维护原则

- 新策略能力优先扩展 viewer-safe observation 或 outcome schema，不把 root/executor 权限扩张给 Policy。
- 新 conditional family 先进入 Rule Composition Decision，再补 Policy 可观测估值。
- Learned Policy 与 Heuristic Policy 必须共享 Policy Port、Host、input adapter 和 action identity。
- 不以兼容、诊断或未来可能使用为由恢复旧 AI 文件；需要新能力时按当前 owner 重新设计并提供真实 caller。
