# SETI 机器玩家设计

本文描述 Browser 与 Simulation 当前共用的机器玩家生产契约。旧 AI 自动对战 controller、pending resolver、candidate selector、valuation/route/demand/pressure、battle report 与 tuning 架构已物理删除，不是兼容层或未来扩展点。

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
  **修复前 Browser 机器席位 `projection.state` 是 UI 展示视图（resident 被读模型替换）
  → observation 失明（players/hand/assets 全空）→ 启发式决策静默退化为 pass**，属
  隐藏失败，不得回退到"壳替换芯"的装配方式。详见
  `docs/browser-simulation-unification.md` §信息层统一。

- **决策方案**（decision scheme）是一个可插拔接口：输入当前 viewer-safe observation
  与完整 legalActions，输出**至少下一步 `actionId`**；有完整计划时附带
  `plan = { nextActionId, continuation[], dependency, revealedCount }`
  （`plan-continuation.js#buildPlanFromSnapshot`），供 simulation 复用判断。
  当前实现：`heuristic-decision-function.js`（反事实搜索 + 直调启发式 Policy，
  从 winning leaf 构建 plan）；Learned Policy 实现同一输出契约即可参与复用。
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

- `game/ai/policy-port.js`：`DecisionContext -> PolicyDecision` 契约、公共 validator、请求失效语义。
- `game/ai/machine-player-coordinator.js`：机器人玩家协调器（Browser/Simulation 共用一份实现）——席位决策函数注册表、裸调共享 composition 读边界（合法集原生 + 观察直接 createDecisionObservation(projection.state)）、计划复用（`planReuseCheck`）、调用决策函数、execute 提交共享 inputPort、recordStep 记账钩子（sim 训练补记 replay/reward，browser 空操作）；失败直接抛错。
- `game/ai/heuristic-decision-function.js`：Heuristic 决策函数（AI 类型）——统一反事实搜索（目标引导 + 需求引导单一路径）+ 直调启发式 Policy + 从 winning leaf 构建 plan；实现 `(ctx) => ({ actionId, plan? })` 接口。开关（completeTargetCatalog / traceCounterfactualGoalClusters 等）经同一 config 源透传，Browser/Simulation 一份装配。
- `game/ai/heuristic-policy.js`：Browser、teacher 与冻结 opponent 共用的版本化启发式 Policy。
- `game/ai/outcome-model.js`：从 viewer-safe observation 投影已兑现分、科技、收入、资源事实和
  固定大小的探测器目标摘要，以及本席数据轨到下一次正式扫描、放置或分析所需的
  viewer-safe `dataAnalyzeRequirements`。
- `game/ai/expected-score-evaluator.js`：只从真实标准叶读取已兑现分数、科技和收入变化，
  按剩余轮次计算版本化战略价值。
- `game/ai/plan-continuation.js`：计划延续复用的纯逻辑——决策方案输出的计划结构
  （`buildPlanFromSnapshot`/`advancePlan`）、simulation 侧复用判定
  （`planReuseCheck`）、计划依赖事实提取（`planDependencyFromPlan`/
  `currentDependencyFromStore`）、外星揭示基线（`countRevealedAliens`）。诊断工具
  `tools/diagnose_plan_continuation.js`（record-once/analyze-many）与
  `tools/verify_plan_continuation_fastpath.js`（同 seed A/B）共用同一套纯函数；
  单元测试登记 `policy/plan-continuation`。
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
- `app/ai/browser-bootstrap.js`：Browser 机器席位端口——与 Simulation 共用同一协调器与
  Heuristic 决策函数（唯一差异：recordStep 记账钩子，browser 空操作）；只保留席位判定、
  决策前稳定化、同 decision 去重、lifecycle 失效重建与 fail-closed 结果转写。内联反事实
  搜索拷贝已删除，开关（completeTargetCatalog / traceCounterfactualGoalClusters 等）经
  同一 config 源透传（URL 参数，见 §3.4）。

`game/ai/index.js` 聚合器已删除（无消费方，Browser 装配直接经 index.html 逐个加载模块）。不得恢复 SetiAI 聚合或 legacy valuation、candidate、planner、analytics、controller adapter。

## 3. 决策方案输出契约与计划延续复用（simulation 侧）

决策点两层流程见 §1；本节给出方案输出契约与复用判定的细节。

### 3.1 方案输出契约

- simulation 只依赖方案的输出契约，不关心方案内部（启发式搜索 / learned policy
  可插拔）；
- 方案输出**至少包含下一步 `actionId`**；若有完整计划（winning leaf 链条 ≥ 2 步），
  附带 `plan = { nextActionId, continuation[], dependency, revealedCount }`
  （`plan-continuation.js#buildPlanFromSnapshot`），供复用判断；
- 当前方案：`heuristic-decision-function.js`（统一反事实搜索——目标引导 + 需求引导
  单一路径 + 直调启发式 Policy + 从 winning leaf 构建 plan）；协调器
  `machine-player-coordinator.js` 编排 readBoundary/复用/调用/提交；
- 装配：`app/simulation-env.js#runHeuristicPolicyDecision`（复用判断先行，未命中才
  走 outcome 生成 + 方案；`config.planContinuationFastPath` 开关，默认开
  （显式传 `false` 可关）。

### 3.2 搜索时机与复用判定（用户口径，2026-08-20 机制化）

名词定义见 `docs/mechanics-reference.md`：**轮次（round，R1/R2）**、**回合（turn，玩家每一次主要行动圈）**。

**搜索时机机制**：搜索只在**本方回合（一动）开始时**执行一次；回合内无新信息 → 按计划逐步骤执行，不重新搜索。搜索只发生在：无计划 / 计划耗尽 / 下一步不在合法集 / 新回合 planReuseCheck 未命中。**回合内出现新信息需重新决策 → TODO（暂不实现，回合内始终按计划走）**。

- **本回合内**（协调器回合门控：计划记录的 round/turn == 当前决策的 round/turn）：按计划下一步直接执行（仅校验合法性），不调用 planReuseCheck、不搜索。`end_turn`/`pass` 是回合自然结束，属计划内正常推进，同样复用。
- **新回合**：`planReuseCheck` 判定——**新信息只有两类**，无新信息则复用上回合决策链：
  - 开关 `planNewTurnReuse`（sim 经 `resetConfig.planNewTurnReuse`，默认开；`false` 关闭后新回合一律重新搜索，用于 A/B 评估"忽略非依赖变化而复用"的影响）。
  - **控制动作特例（control-step-redecide）**：下一步是 `end_turn`/`pass` → 无条件重新决策，不盲从计划。主行动选择是每次决策最核心的评估，而 end_turn/pass 评估最便宜（control 路径 maxDepth=1）——winning leaf 链穿过回合边界（end_turn）rollout 时，新回合计划下一步为 end_turn 被盲目复用会跳过当前盘面上更有价值的主行动（同状态搜索选 place_data，fast-path 直接 end_turn，白方掉分）。48f0af3e 曾移除该特例（实测免电盘面 219 决策即终局、均分暴跌 AVG 27.3），已恢复 1d063418 口径。**注意区分**：本回合内（回合门控分支）end_turn 仍按计划正常推进；特例只作用于新回合的 `planReuseCheck`。
  - **① 揭示外星人**：已揭示槽位数 > 计划假设值 → 无条件重新决策（隐藏信息揭示）；
  - **② 计划依赖环节变化**（计划依赖的具体盘面事实变了）→ 重新决策：
    - 路线：目标奖励格被占（终点行星标记数变化，不局限第一格，如奥陌陌登陆 3 格）/ 路线变长（移动步数增加）；
    - 科技：计划要拿的科技 tile 被拿走（供应 remaining/bonus 变化）；
    - 扇区：目标扇区标记状态变化（赢不了了）；
    - 外星槽：目标外星痕迹槽被占；
    - 公共牌：计划要用的公共牌被买走。
  - 不算新信息（可复用）：其他玩家移动/资源变化、无关扇区变化、无探测器移动的旋转、计划内自己的推进（含顺序执行第二条路线）。
- **防呆兜底**：下一步不在合法集（若因依赖变化 → 归入②；否则计划自身缺陷）→ 重新决策；缺揭示基线 / 缺依赖 → 保守重新决策。
- 依赖事实：`planDependencyFromPlan` / `currentDependencyFromStore`（形状对齐才可比较）按下一步动作提取依赖：路线（`endpointTargetId` + `movementSteps` + `endpointMarkerCount`）、科技（`tileId` + 供应状态）、扇区（候选快照）、公共牌（存在性）、外星槽（占用）。
  - 路线终点 id 来源：primaryAgentSearch 叶用 `probeRoute.candidate.endpointTargetId`
    （routeCheckpoints 摘要生成）；secondary-agent 搜索叶不携带 routeCheckpoints
    （rule-composition addLeaf 对 secondaryAgentSearch 置空）→ candidate 恒为 null，
    此时从叶的 `rootRouteTargetId`（搜索绑定的 orbit:/land: 路线终点，与
    production-kernel targetId 同构）补出路线依赖。
- 多步消费：命中后 `advancePlan` 前进一步，链条耗尽或判定失败才重新调用方案。

### 3.3 边界与约束

- 复用层属于协调器决策流程（§1）的一部分：命中的决策来自**计划缓存**而非
  policy 的 decide，不经过决策函数/反事实搜索链；提交经协调器 execute
  （合法集/authority 重验）与 recordStep 记账（sim 补记，计数进 diagnostics：
  `planContinuationHitCount` / `MissReasons`）。判定空间变更需保持搜索空间与
  近似不变（同 `targetSchedulerPrunedCount` 文化）。
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

- `expected-score-evaluator#requiresRootCounterfactual`：**目的型动作需求门控**
  （2026-08-21 迭代：card_corner 与 quick_trade 对称化）：quick_trade / card_corner
  本身不产生价值（资源负向），做它们是因为要达成某个目标但资源调配有问题——把
  当前资源转成目标需要的资源；门控只放行"产出能缩小当前目标/行动缺口"的动作
  （prepares*：探测/数据/扇区/收入支付缺口、分析能量缺口、研究宣传门槛；
  card_corner 另按弃牌收益（数据/宣传/支付资源）与 move 型（探测移动达成步骤）
  判定）。**注意：门控只保证"贡献>0"，不保证"贡献比例"**——leafValue 是整链
  价值不按动作分摊，小缺口吃全链的搭便车由 quick 根截断与出口目的检查继续兜底
  （A/B 实测：删除截断+出口检查后均分 64.5→53.75，已回滚恢复）；
- `expected-score-evaluator#selectSecondaryAgentRootActions`：返回**目标绑定动作 +
  需求放行的目的型动作**（`UNIFIED_PURPOSE_FAMILIES` = quick_trade/card_corner/
  industry，凭需求进搜索，不平铺全部候选）；
- `rule-composition#evaluate`：`allowUntargetedRootActions` 恒 true，需求动作以
  targetId=null 进初始 frontier（L4a 放开）；未绑定 origin 展开 ≤3 层
  （`MAX_UNTARGETED_DEPTH`）即收束 pruned（浅尝，防无限深挖）；
- `expected-score-evaluator#selectSecondaryAgentSuccessors`：`!routeTargetId` 分支
  返回 targeted + 未绑定后继 top-K（`MAX_UNIFIED_SUCCESSORS`=4，按 family 基础
  价值 + 净资源收益排序）+ controls；未绑定分支的 choose_payment（弃牌/移动支付）
  与交易选牌视为纯结算直接不展开；绑定分支弃牌折叠的 `targetUsesFungibleResources`
  扩展覆盖探测行动目标（orbit:/land:/move: 前缀），card:/decision: 卡牌身份目标
  仍保留全部 choice；弃牌会话延续层（actionChain 末尾已是 choose_payment）直接
  收束（toggle 振荡防死）；
- **quick 根截断**（`QUICK_ROOT_FAMILIES` = move/quick_trade/industry/card_corner/
  runezu_face_symbol/complete_task）：目的型/铺垫型 quick 根未绑定时，下一个主行动
  决策只给 control（end_turn/pass）→ 叶 = 立即效果，不搭后续主行动便车
  （leafValue 是整链价值，不按动作分摊；全放行时 quick_trade 87/card_corner 65
  虚高导致乱做；2026-08-21 尝试删除（含出口目的检查）A/B 均分 64.5→53.75，已回滚）；
- **bounded 桶已删除**：play_card 经目标绑定进入搜索（income:card 收入牌 /
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
可用数据数、下一正式步骤及其信用/能源缺口；扫描费用和分析减免分别来自正式 scan effect 与公司被动。
用于续算的完整 checkpoint 只存在于隔离 fork 内，投影时物理删除，不复制太阳系、星云、token
或扫描结构。

启发式搜索的一级评估轴是当前正式分数、收入和科技；叶节点当轮剩余资源不参与最终估值。
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

环绕/登陆目标在进入执行搜索前，先使用 Production Kernel 按真实太阳系拓扑算出的最短路径、
移动点数和钱/电总成本排序。主星目标只保留第一奖励格尚未被占领的最近环绕与最近登陆各一个；
卫星登陆在前三轮只保留木星、土星，最后一轮再加入天王星、海王星。没有橙4时卫星不属于当前
合法目标；若当前能研究橙4，则先把橙4作为前置科技目标，取得后再从新状态生成卫星路线。
同一具名终点的多条路线再做目标级 Pareto；不得给行星或卫星目标增加固定估值。
每次科技等效果旋转太阳系后，子状态重新生成路线 requirement 并按新距离调度，不复用旋转前
距离。该阶段使用规则投影的路径和奖励，不以 action 展开次数代替行星距离。

若既定环绕/登陆路线下一步需要移动，而本行动圈已经用过主行动，手中可负担的移动牌仍是跨
行动圈的有效路线：规划器可以先结束行动圈，再在本席下一次行动机会打牌。对同一个移动缺口，
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
  + Σ(每块新科技的独立轮次价值 × 取得后剩余轮数)
  + (新增信用收入 + 新增能源收入) × 5 × 取得后尚未发生的轮初收入次数
```

当轮剩余信用、能源、宣传、数据、公共扫描和手牌均不计分；同一一级结果再按快速转换次数和
已完成目标数排序。信用与能源收入每格每个未来轮初窗口计 5 分，第 1/2/3/4 轮行动阶段新增收入
分别计算 3/2/1/0 次，其他收入轨暂不计分。科技每个剩余轮次的价值为：橙2=7，橙3=5，
紫2/紫4/蓝1/蓝2=10，蓝3/蓝4=5；橙1/橙4/紫1/紫3=0。终局叶的收入与科技机会价值归零，
只保留正式终局分；科技若能在当轮继续帮助行动，必须由后续真实路线兑现价值，不能重复计分。
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
- 通过 fallback、alias 或全局模块恢复旧 controller。
- 保存或应用按 family 调参的 strategy weights。

终局板块、初始选择、弃牌、支付、科技与外星人选择都必须作为标准 Decision 进入同一 Policy 输入链；没有单独的 final-score AI runtime。

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
