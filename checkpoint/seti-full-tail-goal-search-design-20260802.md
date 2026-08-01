# SETI 完整尾部目标搜索设计冻结（2026-08-02）

## 目标与成功标准

完成首个次级目标后，不再按资源下界只保留一个后续目标。每个非支配完成态必须把全部当前可达
目标重新加入正式反事实 frontier，并继续执行到本席 PASS 或完成 15 个结果目标。最终仍只比较
正式叶子的实际分数、科技、后续轮初收入与剩余资源机会成本。

本轮不引入固定 top-K、beam、目标固定分或更高 node cap。若完整目标目录在现有 4096 物理执行
保护内不能自然耗尽，必须保留 `executionLimitReached` / incomplete 证据并先优化精确剪枝，不能
运行完整固定局或把截断结果称为完备搜索。

## 设计矩阵

| 语义 | 正式来源 / 唯一 owner | 搜索表示 | 状态与 Decision | 精确剪枝 / 失败语义 |
|---|---|---|---|---|
| 次级目标目录 | `expected-score-evaluator.enumerateSecondaryAgentRootTargets` | 每个 `targetId + planId` 一条目标绑定 | 只读取 branch observation 与正式 legal descriptor | 正式资源上界不可达时删除；不得按最低成本只留一个目标 |
| 目标内支付路线 | 各规则 projection、正式 action / Decision | 同一目标可保留多个资源支付 origin | 支付、奖励、RNG、followup 全走 Production fork | 相同目标下被另一状态完整支配才删除 |
| 目标完成态 | `completesSecondaryAgentRouteTarget` 与正式 branch observation | `proxyDepth + completion facts` Pareto frontier | 分数、资源、收入、科技来自正式 projection | 同根 action、同目标深度，事实逐项不差且至少一项更好才支配 |
| 后续目标展开 | 完成态重新调用目标目录 | 全部可达目标绑定进入全局 frontier | 已完成目标释放 route binding；新目标重新绑定 | 资源下界只作可达性与稳定顺序，不作目标删除 |
| 状态等价 | Counterfactual envelope、Session、RNG、action identity | transposition key / shared origin | Decision owner、stale、sequence 保持正式语义 | 完整规则状态和下一 action 相同才能共享执行 |
| 搜索优先级 | 正式 branch 的战略事实差值 | 精确最小堆 | 不改变叶子价值公式 | 优先级只影响执行顺序；不得以优先级当作删除依据 |
| 搜索终点 | focal PASS、15 个已完成结果目标、正式 terminal | settled leaf | PASS 不窥视预留牌；不模拟对手 | 4096 保护触发时保持 low confidence / pruned，不得伪装完成 |
| 最终选择 | `expected-score-evaluator.evaluateOutcome` | 每个根 action 的最佳正式叶 | Primary 后比较资源、转换数和目标深度 | 不给 action / goal / family 固定分 |

## 执行闭包

1. 根层仍完整建立 `action × target plan` origin。
2. 目标内部只执行与既定目标直接相关的正式 action、必要转换和 conditional。
3. 正式动作证明目标完成后，先将完成态送入既有 Pareto frontier。
4. 未被支配的完成态释放旧 target binding，重新枚举全部当前可达目标，并同时保留 PASS。
5. 每个新目标的非支配路线继续执行；standard action 数不计入 15，只有正式目标完成增加深度。
6. 叶子评价和 Policy 排序保持不变，以便把分数变化归因于搜索空间而不是权重调参。

## 验收义务

1. 单元测试构造同一完成态下“低成本低价值”和“高成本高价值”两个可达目标，二者都必须进入
   successor，不得产生 `targetSchedulerPrunedCount`。
2. 目标内部仍只允许与绑定目标相关的动作，不恢复无目标遍历。
3. completion dominance、transposition、等价 Decision 合并继续生效。
4. 固定开局单次 Decision 在 4096 节点前自然耗尽，`executionLimitReached=false`；未满足前不跑
   完整固定局。
5. 单次 Decision 仍以 10 秒为性能门禁；失败时记录节点分布与最深目标层，不提高 cap。
6. 行为与性能门禁通过后，才生成新固定盘面 HTML，并与 v20 的 62 分基线比较。

## 实验结果与结论

候选改动仅移除了深度大于 0 时的最低成本单目标截断，未修改估值权重、15 目标上限、
Pareto 支配、transposition 或 4096 物理执行保护。

- 定向行为测试通过：同一完成态下两个不同成本的可达目标都会进入 frontier。
- 固定开局六个根行动：`4096` 个物理节点触顶，单次约 `10.47–10.75s`；仍剩 `884` 个
  frontier 节点、`1488` 个 origin，分布在目标深度 1/2/3，最大完成深度只有 3。
- 单独只保留 `launch` 根行动并把诊断预算临时放宽到 `16384`：在 `7223` 个唯一物理节点、
  `17.25s` 后自然耗尽，形成 321 个叶，最大完成深度 6；该放宽仅用于容量测量，没有进入生产。
- 六根样本已发生 706 次完成态支配与 2035 次 transposition 命中，说明爆炸发生在既有精确剪枝
  之后，不能靠删除重复状态直接压回 4096 内。
- 最主要的 origin 是赢得扇区路线（1724），其次为分析数据（523）与多个探测器终点；正式卡牌、
  痕迹和支付 Decision 使目标顺序组合继续分叉。

结论：完全展开所有后续目标无法通过当前单次决策门禁。本候选生产改动已撤回，继续保留 v11 的
最低成本尾部调度；没有运行完整固定局，也没有把触顶结果作为策略得分。该调度只是回退状态，
不是目标设计：后续实现不得把“选择最便宜目标”或“跨目标保留 top-K”作为正式剪枝。

## 口径修正：按目标收敛路线（2026-08-02）

所有当前可建立的次级目标都必须进入搜索。资源下界只用于证明某个目标当前无法达成、生成该目标
的必要支付路线和安排执行优先级，不得用于删除另一个更贵的目标。有限保留发生在同一个
`targetId + planId` 内部：等价路线合并，被另一条同目标路线完整支配的路线删除；不同目标之间
不互相支配。最终仍由所有目标链正式叶子的分数、科技、收入和剩余资源统一比较。

首个真实容量样本固定为开局的 `sector:win:sector-2-b:1`。完整尾部实验中它产生了 1724 个待执行
origin，是最大的单目标来源。下一阶段先把该目标隔离，记录每层的扫描来源、支付方案、公共牌
选择、扇区进度、奖励 Decision 和完成态；然后冻结该目标的状态等价、不可达下界和同目标 Pareto
事实。只有这个单目标能在有限路线集内自然耗尽后，才恢复所有目标完整展开。

首次隔离复现纠正了上述样本描述：`sector-2-b` 并非固定开局可建立的目标，而是前置目标完成后的
分支目标。固定开局真实目标是 `sector-3-a`；将搜索限制为这个目标且目标深度为 1 后，搜索在
9 个物理节点、1 个完成叶内自然耗尽，并合并了 2 个等价奖励选择。由此不能再把
`executedOriginCountByTarget=1724` 解释为“一次进入目标后有 1724 条路线”。它也可能表示大量不同
前置完成态各自建立一次短路线。

在修改剪枝前，先增加行为不变的目标入口诊断：

| 诊断 | 唯一计数时点 | 用途 |
|---|---|---|
| `bindingOriginCount` | 初始目标绑定，或上一目标完成后为下一目标建立的每个正式首 action | 一个目标累计建立了多少条入口 origin |
| `distinctEntryStateCount` | 同上，按正式 counterfactual envelope hash 去重 | 区分“同一状态多路线”和“许多前置状态重复进入” |
| `maxBindingsPerEntryState` | 同一 `targetId + planId + envelope` 下的入口 action 数 | 找出单个真实状态是否确有目标内路线爆炸 |
| `completedTransitionCount` | 目标完成并越过最后一个 followup 的稳定边界 | 对照入口与完成路线数量 |

诊断只读取已有 envelope、target/plan 和完成事件，不参与排序、等价、支配或预算。若
`maxBindingsPerEntryState` 很小而 `distinctEntryStateCount` 很大，应优化前一目标的同目标完成态
frontier；不得在当前目标内虚构 top-K。若单一入口确有多条路线，再按该目标正式进度和后续状态
定义同目标支配。

完整目标实验的入口诊断结果进一步确认：`sector-2-b` 的 1724 个执行 origin 来自 68 次目标入口、
60 个不同正式 envelope，单一入口最多只有 2 个首 action；该目标产生 294 次完成尝试，现有完成态
frontier 只保留 18 次。因而下一性能候选不能删目标，也不应扩大 node cap，而应把完成态支配限定
在目标内，并研究能否在同目标的稳定中间边界提前证明路线支配。任何忽略卡牌身份、公共盘面或
后续可达性的状态抽象都属于性能折损，必须单独声明并以固定场景验证，不能伪装成精确剪枝。

| 剪枝对象 | 允许依据 | 明确禁止 |
|---|---|---|
| 尚未完成的同一目标路线 | 正式剩余目标缺口、仍可用的目标相关来源、实际资源、相同规则后续状态 | 仅因目标贵、搜索顺序靠后或固定路线数量而删除 |
| 已完成的同一目标路线 | 当前分数、收入、科技、剩余资源及影响后续目标的正式状态逐项支配 | 用固定目标分、固定 action 分替代正式终点比较 |
| 不同目标 | 仅分别证明各自当前不可达 | 跨目标 Pareto、最便宜目标唯一化、目标 top-K |

现有完成态 frontier 原本只按 `rootActionId + goalDepth` 分组，会让不同次级目标的完成态互相支配。
这不是允许的路线剪枝。正式分组改为 `rootActionId + goalDepth + targetId`；同一目标的不同 plan
可以在完成后比较，但不同 `targetId` 必须各自保留非支配路线。诊断同时按目标归因被支配数量。

### 真实场景修复：目标外公共牌扫描组合

目标专属行动族诊断确认，`sector-2-b` 的 294 次完成尝试全部来自同一主行动路线：
`scan -> quick_trade -> scan`。分叉不是支付方案或主行动路线，而是第一次正式扫描不能用公共牌
触达 `sector-2-b` 时，selector 回退为全部公共牌扫描选项；第二次扫描再次组合这些选择。

候选修复遵守既有扇区启发式：公共牌能扫描绑定扇区时优先绑定扇区；不能时只保留正式
`minimumOwnMarks/openSlotCount` 最低的其他扇区代表。完整目标诊断中，`sector-2-b` 的执行 origin
从 1724 降到 62，完成尝试从 294 降到 5，保留完成态从 19 降到 5。全局仍在 4096 节点触顶，
新的最大来源变为 `data:analyze`（1115 origin），因此该修复解决了扇区真实场景，但不能宣称全目标
搜索已自然耗尽。

这是显式性能近似：被删除的是不能推进当前绑定扇区、但可能通过改变公共牌供应影响更远目标的
旁路扫描。它不删任何次级目标，也不改变目标终点评价；风险由定向测试固定为“目标可触达时必须
选目标，否则选最容易赢的额外扇区”，后续固定盘面评分仍需单独验证。

## 隐藏信息边界修正（2026-08-02）

公共牌补牌、盲抽、外星揭示和科技 bonus 翻开在当前决策时均未知。固定 RNG 只保证正式执行可
复现，不授权反事实 Policy 提前读取结果。搜索不得因 reveal 停止，而应在后续节点持续使用当前
决策的信息集：新身份保持 opaque，已发生的资源、分数和数量变化仍可继续参与规划。

| 语义 | 唯一 owner / 正式来源 | 反事实处理 | 禁止行为 |
|---|---|---|---|
| reveal 发生 | Effect executor 返回 `irreversible`，Session runtime 写 `irreversibleBarrier` | 已选择动作与 reveal 前后无需输入的确定性 effect 正常结算 | 用 seed 预测牌面后继续选目标或 action |
| reveal 后新 Decision | Session 的正式 `awaiting_input` | 过滤依赖新身份的 choice；身份无关的结束、支付等 choice 可继续 | 读取新 Decision choice 身份并替玩家选择 |
| reveal 后直接完成 | Session commit 的 terminal result 保留 barrier | 后续 observation 持续遮蔽新身份，但继续枚举已知信息可证明的行动 | 用新公共牌、手牌、外星人或 bonus 建立后续目标 |
| RNG / journal | Session、domain RNG cursor 与 journal | 保留正式 outcome 和 checkpoint 证据；canonical root 仍零污染 | 重抽、替换假牌或把未知结果当期望值 |
| Browser / Simulation 正式执行 | Production Composition | 不改变；玩家和机器席位在 reveal 后收到新的真实 Decision/Action 请求 | 把 counterfactual 截止误用于真实规则提交 |

执行闭包：

1. executor 仍负责抽取/补充并标记 barrier；不修改牌堆规则。
2. Rule Composition terminal result 必须保留 barrier，避免 Session commit 时丢失证据。
3. counterfactual 单节点执行完成后从 active inspection 或 terminal result 读取 barrier。
4. 一旦识别隐藏信息 code，为该 origin 持久标记 information mask；后续 projection、branch
   priority、successor selector 与目标目录只消费遮蔽后的 observation。
5. 新公共牌、新手牌与新外星身份不得生成具体 play/card-corner/public-scan/物种路线；已知卡牌
   目录与正式标量状态继续搜索。未知牌若只作为身份无关的通用支付资源，可以按数量使用。
6. 诊断按 barrier code 计数，并报告因未知身份过滤的 action 数。

验收义务：固定开局扫描选择一张当前可见公共牌后，搜索必须继续，但任何后续 action、目标
requirement、叶 observation 和 trace 都不得包含补出牌的实例或牌面；新牌数量可作为普通资源计数。
canonical checkpoint 与 RNG 不得被污染。非 reveal 路线、正式实际执行和全量 Node 回归保持原行为。

不得把本次失败解释为估值权重问题，也不得通过提高 `maxNodes` 宣称搜索优化完成。

实现验证：固定扫描反事实在 `hidden_card_reveal` 后仍形成至少 4 项 action chain；所有遮蔽叶、目标
requirement、trace 与 successor 中出现的 `cardInstanceId` 均属于根观察已知集合。未知牌仍按 opaque
牌张保留，可进入通用支付，但不能形成具名卡牌路线。61 个 unit 与唯一 full-flow 全部通过。

12 次固定开局 Policy 基准均自然耗尽：每次 1966 个物理节点、191 次目标完成、最大目标深度 5，
共识别 23 次公共补牌和 12 次科技 bonus 隐藏边界，过滤 537 个依赖未知身份的 successor；
`executionLimitReached=false`、`remainingFrontierNodeCount=0`、`beamPrunedOriginCount=0`。中位 Policy
耗时 6151ms，P90 6207ms，最大 6288ms，低于 10 秒门禁。该结果证明继续搜索没有依赖提高 node cap，
但隐藏身份过滤本身是保守信息集约束，不代表全目标尾部搜索已经取代现有最低成本回退调度。

### Quick Trade 补牌执行闭包（2026-08-02）

固定局第 51 次决策复现出遗漏的隐藏信息入口：`3宣传 → 精选1张牌` 取走当前公开牌后，Production
Quick Trade Decision 使用正式牌堆补牌，但没有把 `hidden_card_reveal` 传回 Effect Session。
反事实因此连续利用补出的 b49 等未知牌，`orbit:mars` 路线触发 1321 次相同快速转换和 2652 次
卡牌移动选择，在 4096 节点触顶，耗时 16.52 秒。

唯一修复位于 Quick Trade card selection executor：公开牌补牌返回 `hidden_card_reveal`，盲抽返回
`hidden_card_draw`。搜索继续执行，已知被选公开牌仍可使用；补出的新牌只保留数量，不能按身份
建立打牌或卡角路线。相同 checkpoint 修复后自然耗尽于 1828 节点，单次 6.59 秒，选择从错误的
截断 PASS 恢复为正式移动；对手执行仍为 0。没有改变 node cap、beam、15 目标深度或估值权重。
