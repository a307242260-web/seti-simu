# SETI 次级代理目标优先搜索 v46 设计冻结（2026-07-29）

## 目标与成功标准

- 把搜索入口从“先执行 legal action、再从结果绑定目标”改成“先枚举次级代理目标，再为目标选择
  compatible legal action”。
- 虚拟目标选择不修改 committed state、不执行规则、不消费 RNG/sequence/Decision、不计入
  15 个次级代理目标，也不占 128 个已完成目标节点。
- 首个行为闭环必须证明：
  `data:analyze -> 必要快速转换 -> scan -> 正式扫描 Decision -> place_data -> analyze`。
- 不给目标、扫描、分析或快速转换固定分。最终选择仍只比较真实叶的实际分、科技和未来轮初收入；
  资源成本仅在一级收益相同时比较。
- 固定盘面必须高于当前 v41 均分 66.25，正常扫描大于 0、分析不少于 4，单次决策不超过 10 秒；
  否则不保留行为策略，但规则正确性与失败结论必须记录。

## 有限目标目录

| 目标种类 | 机械来源 | targetId | compatible 根动作 |
|---|---|---|---|
| 探测器终点 | Production `probeGoalRequirements.candidates` | 正式 orbit/land targetId | requirement `nextStep`，或严格缩小其钱/电 gap 的转换 |
| 数据分析 | Production `dataAnalyzeRequirements` | `data:analyze` | analyze、place_data、支付已满足的 scan，或严格缩小下一正式支付 gap 的转换 |
| 打牌 | 当前合法 `play_card` 与现有手牌准备路线 | `card:play` | play_card，或直接增加手牌且不消耗手牌的正式转换 |
| 已合法单步代理 | 当前 legal descriptor 且不是内部路线 family | `action:<actionId>` | 该 descriptor 本身 |
| 根 conditional | active Effect Session 的正式 legal choices | `decision:<actionId>` | 对应 choice；虚拟目标不计代理深度，执行后继续正式规则链 |
| 控制 | PASS 独立正式 outcome；end_turn 维持一层控制 outcome | 不进入目标目录 | 现有控制路径 |

内部路线 family 为 `launch/move/quick_trade/place_data/card_corner`。它们不得获得
`action:<actionId>` 兜底目标；无法绑定正式目标时不进入反事实 frontier。

## 完整设计矩阵

| 语义 | 唯一 owner / primitive | 状态归属与等价 | RNG / id / Decision | 事务与失败语义 | 预算 / 剪枝 | 证据 |
|---|---|---|---|---|---|---|
| 根目标枚举 | Expected Score Evaluator 只读 observation 与 legal descriptors | 输出稳定 `targetId + compatibleActionIds`；targetId 已进入 node key | 不消费 RNG，不创建 actionId，不代替 Decision | 未知目标或非法 actionId fail-closed，不进入 frontier | 虚拟选择不计 15/128/4× execution | evaluator unit + Rule Composition 合约 |
| 根 frontier | Rule Composition counterfactual search | 同一 envelope/action/depth/routeTargetId 才等价；不同目标不得合并 | 沿用 action descriptor id 与 branch RNG seed | 仍从可信 checkpoint 执行 Standard Action；canonical root 必须字节不变 | 每个真实 root action 在执行前只绑定按正式可达性、目标收益和资源/移动下界排序后的最佳探测器目标；不同 root action 全部保留；无 target 的内部动作 unresolved | composition test |
| 根 conditional | Effect Session / Decision owner | 每个 choice actionId 独立；`decision:<actionId>` 只作搜索 metadata | stale/late/wrong-owner 仍由 Decision input port 拒绝；非等价 choice 不自动取第一项 | 选择通过同一 counterfactual fork 执行确定性规则闭包，抵达下一个外部 Policy Decision 或 Session idle 时形成叶；下一 Decision 不在本根内代选 | conditional 不计 15/128，规则闭包实际执行计 4× guard；不得为每个 choice 再滚 15 个新目标 | 17 选科技不打满 512；任务确认/跳过不被 beam 剪空 |
| 数据 requirement | Production Kernel 投影本席 data track、availableData、标准扫描/分析支付 | `data:analyze`；remaining placements、data needed、当前 next payment gap | 扫描费用来自 `SetiScanEffects.getStandardScanCost`；分析免能来自正式公司被动 | 只读 viewer-safe projection；字段缺失时数据目标不可启动 | 每次只处理下一正式支付，下个 committed 叶重新投影 | projection/evaluator unit |
| 数据路线 | Standard scan/place_data/analyze domains | routeTargetId 在 analyze 提交前保持；analyze 后释放 | 扫描内所有非等价选择仍由 focal Policy Decision；不取第一项 | 每一步真实付费、得数据、放置、分析；无合法 gap reduction 时仅控制结束，整条无收益路线淘汰 | scan/analyze 各完成一个次级代理；转换/放置不计 | 短链 + fixed-board trace |
| 数据路线 conditional | Science Session 正式 choices | 仅在已锁定 `data:analyze` 时，扫描选择排除 skip 后稳定取一项；放置选择优先 `computer`，不得先放蓝附加槽 | 仍提交原 choice actionId；不手工获得数据或放置 | selector 在创建 counterfactual node 前裁成一个 compatible choice；未知 choice 形状 fail-closed 到原完整集合 | 不增加目标深度；避免“先展开全部 choice 再 beam 取首项” | scan frontier / place-data 反例 |
| 快速转换 | Quick Trade Production Domain | 完整 cost/gain；转换后同目标 gap 必须严格下降 | 弃牌/选牌 Decision、RNG 与 sequence 全部沿正式 fork | cost/gain 缺失、制造另一支付缺口或 gap 不降即拒绝 | 每次只保留 reduction 最大、机会损失最小、actionId 稳定的一项 | 双资源反例 |
| 15 目标预算 | Rule Composition `countsGoal` | 虚拟目标选择不在 action chain；完成 scan/analyze 等才 +1 | conditional 不计 | 达到 15 后真实叶结算，不伪造 PASS | maxNodes=128、maxExecutionNodes=512 保持 | diagnostics/unit |
| 一级评价 | Expected Score Evaluator | 实际分恒值；科技/收入只计未来窗口；库存不计分 | 只读实际 leaf projection | terminal 只比较官方终局分 | 一级收益优先，成本同值 tie-break | 现有 strategic tests |
| Browser/Simulation | 各自 Host 只装配相同 evaluator hooks | 同版本 observation/legal set/target catalog | Host 不执行规则、不读取 canonical root | 未知/stale/late/wrong-owner 沿 Policy Port fail-closed | 两端均使用同一 128/15 配置 | Node + Browser smoke |

## 状态 × owner × fallback

| 状态 | 当前玩家 | 对手冻结推进 | 环境确定性结算 | 禁止 fallback |
|---|---|---|---|---|
| opening | 原 setup Decision，不启用目标目录 | 不参与 | 唯一项按现有流程 | 静态目标分 |
| turn | 先枚举目标，再执行 compatible Standard Action | 正式 PASS 与必做 Decision | 无选择事件自动推进 | 从转换结果反推新目标 |
| focal conditional | 所有合法 choice 保留 | 不适用 | 唯一项仍可由规则闭包推进 | selector 取第一项 |
| opponent turn/conditional | 不预测策略，只正式 PASS；必做 choice 用版本化冻结选择 | owner | 唯一项自动推进 | 篡改 currentPlayerId |
| focal PASS | PASS 必做链后形成叶 | 不再推进 | 正式效果 | 把下轮收入算给 PASS |
| terminal | 官方终局分 | 不参与 | final scoring owner | 科技/库存残值 |
| unknown/stale | 不提交 | 不提交 | 不恢复猜测 | recover/skip |

## Proof obligations

| 验收条款 | 可证伪命题 | 最小反例 | 实现落点 | 验证 |
|---|---|---|---|---|
| 先目标后动作 | 第一执行节点已有非空 routeTargetId，且 internal family 只能来自 compatible 集 | quick_trade 节点 routeTargetId=null | Rule Composition frontier 初始化 | composition observable trace |
| 虚拟目标不计步 | 同一 action chain 与 v45 相比不增加 action、proxyDepth、executedNodeCount | target 被伪造成 Standard Action | frontier metadata | diagnostics/unit |
| conditional 不重复规划 | committed conditional choice 执行到下一外部 Decision/idle，leaf `secondaryAgentDepth=0`；不得代选下一 Decision 或继续规划 15 个后续目标 | 17 个科技选择各自滚到 512；任务确认/跳过后继续替下一 Decision 选项 | Rule Composition root closure | conditional integration + fixed-board timing |
| 动作×目标不重复执行 | 同一 launch/move/trade 根最多绑定一个最佳可达 probe target；已绑定 data target 的 scan 不再重复建立直接 action target | 26 action 展开 52 根并打满 512 | root target catalog | diagnostics：rootTargetCount 接近 candidateCount |
| 数据 conditional 前置选择 | `data:analyze` 路线的扫描/放置 Decision 在建 node 前只保留目标 compatible choice | 全部星云 choice 先进入 frontier，扫描决策偶发 47 秒 | evaluator selector + Rule Composition | fixed-board max decision <10s |
| 数据目标可启动 | 无数据、0 电、足够信用时，root quick_trade 归属 `data:analyze`，并连续换到 scan 合法 | quick_trade 被过滤为 unresolved | Production projection + requiresRoot + root catalog | evaluator + fixed-board |
| 转换不随机 | 钱换牌若不缩小 scan/analyze payment gap，不得进入数据目标 | 同时保留钱换牌和钱换电 | compatible action selector | unit |
| 扫描后继续分析 | 扫描真实获得数据后 routeTargetId 仍为 `data:analyze`，优先 place_data | 扫描后转去 launch | route target continuity | short-chain integration |
| 目标完成才释放 | analyze 提交后释放 data target；place_data/scan/conditional 均不释放 | 第一个扫描 choice 后 routeTarget=null | target transition | unit |
| canonical 隔离 | 搜索前后 committed bytes、RNG、session、journal、history、replay 完全相等 | 虚拟目标写入 state | existing counterfactual invariant | full-flow/composition |
| 性能预算不偷缩 | 128/15/512 与 10s 门槛不变 | maxNodes 降低换速度 | Simulation diagnostics | benchmark/report |

## 实现批次

1. Production 投影 `dataAnalyzeRequirements`，只含本席数据进度与正式下一支付。
2. Evaluator 根目标目录、compatible action 选择、数据 gap reduction。
3. Rule Composition 在执行首个动作前绑定 routeTargetId；Browser/Simulation 同时装配 hook。
4. 集中补 evaluator 与 composition 行为测试，再做单决策 benchmark。
5. 性能通过后运行完整固定盘面；根据行为与均分保留或回退。

实现中若发现新的状态 owner、Decision/RNG 或事务边界，立即停止生产 patch并更新本矩阵。

## 实验结果

2026-07-29 在固定盘面 `seti-104-official-v1` 完成一次全局回归：

- 四席终局分为 67 / 54 / 48 / 47，均分 54；低于 v41 基线 66.25，也远低于长期目标 100。
- 正式提交 6 次扫描、4 次分析、40 次放置数据、8 次打牌和 33 次快速转换；数据路线不再是
  “只放置、不分析”的完全断链。
- 347 个实际行动记录中最慢决策 7210.36ms，0 次超过 10 秒；12 次超过 5 秒。独立首决策
  benchmark（12 次）为 median 5019.43ms、p90 5089.65ms、max 5110.46ms。
- 17 选科技、任务确认/跳过以及数据放置 conditional 均能抵达下一个正式 Policy boundary，
  未再次触发 512 执行节点失控保护。

结论：先目标后动作、数据 requirement、条件选择闭包与 10 秒性能门槛成立，可作为后续搜索
底座；“均分必须超过 66.25”的策略提升标准未通过。本批不宣称提分。下一轮应在不恢复
action-first 的前提下，针对同一个目标保留若干资源开销不同的可达路线，并分析 40 次放置数据
仅转化为 4 次分析、终局宣传/数据/手牌残留及目标完成后的再规划损失。不能通过缩小 128/15/512
预算制造表面性能提升，也不能给选项或快速转换固定分。
