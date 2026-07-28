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
  固定大小的探测器目标摘要。
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
low confidence，不读取本局未来 RNG。

每个 root/leaf observation 使用 `seti-decision-observation-v2`，其中
`outcomeProjection` 为 `seti-outcome-projection-v2`。projection 只增加以下
viewer-safe 窄字段，不暴露 executor 或隐藏 root。`progress.probeRoute` 最多列两枚本席在途
探测器的标识/坐标；候选 leaf 只额外携带 `nextActionId/family/summary`、目标行星与
`orbit/land` outcome 引用、已兑现目标分、沿途宣传 delta、终点即时 delta、标准路线实耗、
移动余步和叶后钱/电。
用于续算的完整 checkpoint 只存在于隔离 fork 内，投影时物理删除，不复制太阳系、星云、token
或扫描结构。

当前启发式把以下三项作为搜索叶的累计评估轴：

- 获得实际分数；
- 获取科技；
- 增加收入。

一级目标不是路线终点。搜索在中途取得分数、科技或收入后仍继续累计后续收益，直到本席本轮
实际 PASS，或执行满 15 个本席次级代理。次级代理来自正式顶层 family：扫描、发射、移动、
环绕、登陆、放置/分析数据、打牌、弃牌角标、研究科技、快速转换、公司与物种能力；赢得扇区、
痕迹和收入是这些代理的真实规则结果。支付、选目标、选牌等 conditional Decision 属于当前
代理的规则闭包，不计入 15 个代理深度；`end_turn` 只推进真实回合 owner，也不计深度。

搜索跨本席的多个真实行动机会。中间对手由版本化冻结 rollout 通过 Standard Action 和正式
Decision 推进，不能直接篡改 turn owner；本席 PASS 的必做链结算后立即形成叶，不执行其后的
`end_turn`，因此不会把下一轮轮初收入记到 PASS 身上。每次 Policy 仍只提交获胜路线的第一个
当前 legal descriptor，真实提交后从新 committed state 重新搜索。

单个代理内部最多推进 15 个真实标准 Decision，这是独立的 Effect Session 安全上限，不是路线
深度。evaluator 不替代 Production registry/executor，也不手工结算规则。叶价值为：

```text
V(leaf)
  = 实际分数变化
  + 新科技数 × 取得时所在轮的剩余轮次价值
  + 新增收入的每轮资源价值 × 取得后尚未发生的轮初收入次数
  - 路线净资源机会成本
```

收入换算使用 `1 信用 = 1 能源 = 2 数据 = 2 宣传 = 2 普通牌 = 5 分`。这是长期收入能力的
估值，不是给当前库存加分，也不是把轮初收入错误称为轮末结算。正常收入阶段只在新一轮开始
时发生，因此第 1/2/3/4 轮行动阶段取得的收入轨只分别计算 3/2/1/0 次后续轮初收入。
`gainIncome` 提高收入轨时对新增部分的即时奖励属于该效果自身。钱、电、宣传、数据、普通牌和
外星人牌库存均不是一级目标；但 root 到 leaf 的净库存下降会作为路线机会成本扣除，避免两条
同收益路线中选择浪费资源的一条。痕迹同样不使用固定价值：
未揭示外星人时只能获得的实际分数、首标宣传、揭示后的物种奖励和后续状态，都由同一标准
执行链后的盘面决定。

若 15 个代理预算内没有正价值路线，Policy 只能从合法 PASS/结束回合中确定性降级；
`failed/unresolved/stale` 候选不可选，也不能把部分结算状态伪装成叶。

反事实执行复用一个 Composition 级内存 fork 容器：每个候选从同一可信 checkpoint 恢复
StateStore、working state、Effect Session 与独立分支 RNG，再调用生产 registry/executor。
可信且已冻结的内存 fork 可复用只读 committed snapshot，但 Action working copy 仍独立克隆；
Session checkpoint 只恢复一次，普通存档恢复仍执行完整校验。禁止逐候选或逐 Decision 创建
`SimulationEnv`、加载 replay，或调用领域 helper 手工结算。

节点等价键由 committed state bytes、Session checkpoint、actionId 与 remainingDepth 的稳定
hash 组成，反事实 RNG 使用相同紧凑 envelope identity 的 v2 seed；canonical RNG 不变。
常规机器决策的全局节点上限为 128。所有 root action 都进入首层；后续先按 root 合并同源
conditional 分支，再保留 4 个全局路线节点，按累计一级目标价值与只用于 beam 的次级路线潜力
排序，再用稳定
identity 决胜。被 beam 移除的 origin 标为 pruned/low-confidence。每个 root 另有最多 8 个叶的独立
预算；某个 root 达到叶上限后，frontier 会先移除该 saturated origin，共享节点仍为其他未
饱和 root 继续执行。beam 和叶上限都是显式近似，均不得描述成完整期望分布。

当前 v13 在 beam 中使用未扣成本的一级收益保留“先亏资源转换、后完成目标”的路线，同时仅以
较小量级扣除已发生的资源机会成本；成本不得像一级收益一样乘以 1000，否则必要快速转换会在
到达目标前被提前剪枝。无一级增量 successor tie-break 中，`play_card` 仍保留 v12 的 420
低置信排序。

路线搜索中的 `quick_trade` 是正式次级代理，必须执行真实 outcome；纯交换始终亏模，但它可
作为补足目标资源缺口的第一步或中间步骤。策略比较转换后完成的一级目标价值与路线净资源成本；
同一 committed state / 一级结果只保留转换次数更少、代理深度更短的来源。当前库存本身仍不是
一级目标。`pass/end_turn` 也必须执行
真实后继。focal PASS 叶停在 PASS 必做链之后，不观察新轮；实际对局若最后一个 PASS 后提交
`end_turn`，收入仍只在随后新轮开始时发生。运行报告记录
候选数、原始/保留 frontier、beam 剪枝数及 fork/执行/投影/checkpoint/编排总耗时；耗时是
诊断数据，不属于 outcome 语义，不得影响候选等价性或排序。

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
