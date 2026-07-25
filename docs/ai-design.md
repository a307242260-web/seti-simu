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
- Host 在 Policy 请求前通过 Rule Composition 的 `counterfactualPort` 为每个 legal action
  建立隔离 fork；Policy 只收到裁剪后的 root/leaf observation、标准行动链、合法后继和
  structured unresolved 状态，仍只返回一个 legal `actionId`。
- Policy 不执行规则、不点击 DOM、不读取 canonical root，也不持有 StateStore、Effect Session、
  registry 或 executor。
- Host 在提交前复核 seat、stateVersion、decisionVersion、deadline、generation 与 legal identity；未知、过期、重复或非法响应一律 fail-closed。
- conditional choice 必须由 Rule Composition 暴露为标准 Decision。Host 不允许 resolver、recover/skip 或“取第一项”旁路。

## 2. 当前模块

- `game/ai/policy-port.js`：`DecisionContext -> PolicyDecision` 契约、公共 validator、请求失效语义。
- `game/ai/machine-player-host.js`：固定席位、deadline/取消、generation、去重与 fail-closed 提交协调。
- `game/ai/heuristic-policy.js`：Browser、teacher 与冻结 opponent 共用的版本化启发式 Policy。
- `game/ai/outcome-model.js`：从 viewer-safe observation 投影已兑现分、资源事实和固定大小的
  探测器目标摘要。
- `game/ai/expected-score-evaluator.js`：只从真实标准叶识别正分环绕/登陆终点、路线实耗、
  缺口和唯一下一步，并计算当前探测器策略的版本化 V/Q。
- `game/ai/heuristic-evaluator.js`：优先选择 `settled + selectable` 的目标步骤；失败或 unresolved
  候选不可进入排序。同一目标分才按实耗与稳定 actionId 决胜。
- `game/rule-composition.js#counterfactualPort`：Host-owned 隔离反事实执行。每条分支仍使用同一
  Standard Action registry、Effect Session、Decision 与 commit 语义。
- Simulation setup 选择也进入隔离规则 fork：提交标准 setup Decision、执行正式初始结算，再以同一
  `DecisionObservation -> OutcomeProjection -> target/gap/next-step` 口径选择。每个 setup
  反事实叶从同一正式随机状态结算，并按正分探测器目标的净等价价值、实际分和信用/能源
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

探测器初版使用以下单步重规划公式，不在每次决策中展开整条路线：

```text
A(s) = 已兑现分
     + 5 × 信用 + 5 × 能源
     + 2.5 × 宣传 + 2.5 × 普通牌 + 10/3 × 外星人牌

Vprobe(s) = max路线 {
  终点直接奖励等价分 + 沿途实际宣传等价分
  - 路线剩余信用/能源成本等价分
}

Q(s, a) = A(s') - A(s) + Vprobe(s')
```

`s'` 必须来自同根 fork 对该候选执行真实 Standard Action/Decision 后的盘面，不允许策略手工模拟
资源或奖励。路线目标来自当前正式太阳系拓扑，覆盖四个移动方向、环绕和登陆；科技减免直接反映
在 `s'` 的剩余成本中。主行动次数、路径步数和 tempo 不扣分。完成终点后不再叠加该目标的未来
价值；PASS/结束回合固定为控制动作，不继承未完成路线价值。

数据库存权重固定为 0；只有数据链真实解锁蓝色痕迹并已经增加的分数，才通过 `A(s)` 的
“已兑现分”进入 Q。沿途到达行星的宣传、终点直接资源/普通牌、当前仍可取得的首枚黄色痕迹
奖励按上述等价关系进入路线预计价值；扫描、收入和未实际兑现的未来数据收益不估值。

Policy 只展开发射、移动、环绕、登陆、能填补当前钱/电缺口的快速交易、与探测器/钱电/橙色科技
直接相关的打牌和研究橙色科技。打牌或科技只有在真实标准叶降低路线成本、填补缺口或启用新的
正分路线时才可选；其他扫描、产业、放数据等合法行动仍保留在输入中，但标为本策略范围外。
每次只提交 Q 最高的当前动作，然后从新盘面重新规划。多探测器候选按各自的
`targetId + rocketId + path` 独立匹配，其他行星或其他槽位的得分叶不能冒充当前目标完成。
若目标估值暂时没有可选路线，Policy 只能从已有 `settled` 标准执行结果中确定性降级；
`failed/unresolved/stale` 结果仍不可选。该降级只保证机器席位经统一基础架构继续推进，
不把资源库存或猜测收益伪装成 Q。完成主要行动后规则要求的 PASS/结束回合不继承探测器目标收益。

反事实执行复用一个 Composition 级内存 fork 容器：每个候选从同一可信 checkpoint 恢复
StateStore、working state、Effect Session 与独立分支 RNG，再调用生产 registry/executor。
禁止逐候选或逐 Decision 创建 `SimulationEnv`、加载 replay，或调用领域 helper 手工结算。
运行报告记录候选数及 fork/执行/投影/估值分项耗时；耗时是诊断数据，不属于 outcome 语义，
不得影响候选等价性或排序。

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
