# 启发式机器人结构迭代 6～10 设计（2026-07-29）

## 固定实验边界

- 固定盘面 `seti-104-board-v1`，固定 seed `seti-104-official-v1`。
- 沿用 `maxNodes=128`、全局 beam 4、最多 15 个本席次级代理；不通过缩小预算制造结果。
- 一级评价轴仍只有实际分数、科技和收入。分数恒值；科技与收入按剩余可利用轮次下降。
- 扫描、登陆、环绕、填数据、分析、打牌等只是达成一级收益的次级代理，不获得虚构一级价值。
- 每个候选先通过反例和定向测试，再跑完整固定盘面。行为义务失败即放弃；非规则修复若均分不升则放弃。

## 完整设计矩阵

| 语义 | 正式 owner / primitive | observation 与状态等价 | Decision / RNG / 事务边界 | 搜索义务 | 反例 |
|---|---|---|---|---|---|
| 数据进度 | `game/data/state.js` 的 computer/blue bonus placement 与 `isAnalyzeReady` | 只公开自己的池数量、已占 computer slot 和 analyze ready；不暴露隐藏牌或 fork 内部 | `place_data` 的目标选择、slot bonus、精选牌仍走 Science Session | 数据进度只能用于 beam 保留路线；最终 selectable 仍需真实分数/科技/收入 | 第 5 格填入后通往分析的分支因无即时一级收益被裁掉；反向反例是“仅填满但没有一级收益”不得入选 |
| 分析与痕迹 | Science Session `ANALYZE → ALIEN_TRACE` | 痕迹来自公共 alien state；按玩家 owner 计数 | 分析是主行动；痕迹位置的非等价选择保留为正式 Decision | 分析/痕迹可作为中间代理继续搜索，但痕迹数量本身不折算分数 | 给蓝痕迹直接估 5 分；或分析后立即截断而看不到后续真实奖励 |
| 快速放置目的 | `place_data` quick action | 比较 root 与路线中第一个非 quick 代理的合法性/进度 | 不跳过放置目标和奖励 Decision | 连续放置必须减少明确数据目标缺口，或自身产生一级收益；不得只把很远的无关收益归因给当前放置 | 已经可做的环绕前无目的填数据仍被选择 |
| 卡角目的 | Card Session `card_corner` 与正式卡牌实体 | 用完整 action semantic key；手牌实例不同不等价 | 弃牌与角标效果在同一事务；隐藏补牌/RNG 不预测 | 卡角是支付/铺路手段；必须解锁紧随的非卡角代理或自身完成一级收益 | 为了很远的收入先烧掉一张与路线无关的牌 |
| 手牌路线 | Card Play Domain 的正式 `play_card` 与支付 Decision | 自己手牌可见；公共对手只见数量 | 非等价卡、支付、目标保持 Decision；stale fail-closed | 同一一级结果比较机会成本和代理深度；保留能在 15 代理内结算的实际卡牌收益 | 低价可打的得分/科技牌被无目的卡角抢先弃掉 |
| PASS | Turn owner / round lifecycle | focal PASS 后立即成叶 | PASS 必做链正式结算；不观察下一轮收入 | 没有正一级路线才 PASS；quick 铺路不能把 PASS 后收入冒充当前收益 | 第 4 轮收入或下一轮轮初收益被记到 PASS |
| 探测器路线 | launch/move/orbit/land 与 probe requirements | rocket id、坐标和 target id | 每步走 Standard Action；旋转/RNG 沿 fork state | 已锁定目标只走匹配 next step；其他代理不得劫持路线 | 火星探测器报告成金星环绕；为移动弃牌但场上无探测器 |
| 报告 | fixed-board turn report | action before/after、正式 evaluation breakdown | 只读，不影响 Policy | 每轮记录四席分数、均分、数据/分析/卡角/打牌数量和保留结论 | 只报最高分或把路线总价值写成当前动作得分 |

## 五个候选与验收顺序

1. **数据路线可见性**：把公开的数据槽进度加入标准 observation，并用“距分析的真实缺口缩短”保住 beam 分支。
2. **分析链连续性**：分析 ready 时优先保留 `analyze → trace Decision → 后续代理`，但叶选择仍只看一级收益。
3. **快速放置目的性**：没有缩短数据目标、没有即时一级增量且没有解锁后续正式代理的放置路线不可归因。
4. **卡角目的性**：把 `card_corner` 与 `quick_trade` 一样约束为目的手段；无直接解锁/一级收益的卡角不可选。
5. **综合路线支配**：同一一级结果优先实际机会成本更低、quick 手段更少、代理更短的路线，并复核打牌没有被支付手段误杀。

若实现中发现新的 owner、隐藏状态、RNG、Decision 或不可逆边界，停止 patch，先更新本矩阵。

## 实施中补充口径

- 数据路线从首批 2 数据开始，不从第 6 格才开始：登陆或初始卡取得 2 数据后，放置推进；
  扫描或其他正式代理再取得数据，跨过第 4 格收入；再取得剩余数据并准备 1 能量，最后分析。
- 选项不得按 family 获得固定分。旧 successor family rank 在本批删除；beam 使用无权重的
  字典序证据（一级真实收益、正式目标收益、目标缺口、数据缺口、机会成本），完全相同才按
  action id 稳定排序。
- 一次被终止的候选曾尝试给 `analyze` 固定 successor rank；该候选未跑完、未计入迭代，
  代码已删除。
- 全局 beam 4 会在长路线兑现一级收益前删除候选。一次改成全局单路 best-first 的实验又把
  预算集中在少数未完成数据路线，固定局均分降到 10，已否决。本批改为按 root 代理目标分组：
  每个目标每层只保留其正式目标收益最高、缺口更小、实际资源机会成本更低的一条路线；不同
  目标不互相挤掉。`maxNodes=128`、15 个本席代理和 deadline 只限制总成本，不作为选项价值。
- 旧 `executedNodeCount` 把唯一 conditional、`end_turn` 和冻结 opponent 推进也算作搜索节点，
  长路线在回到本席前就耗尽预算。第 4 轮把 `maxNodes` 改为只约束本席真正有代理选择的节点；
  所有正式执行仍计 `executedNodeCount`，另有 `maxExecutionNodes=4×maxNodes` 物理保护。
- 当前阶段先不规划对手行动：反事实遇到其他席时直接提交正式 PASS（以及其必做 conditional），
  只推进合法回合与生命周期。它不预测抢位或公共供应变化，规划会偏乐观；等自身路线闭环稳定后
  再评估是否恢复 opponent model。
- v17 报告中多次“宣传 +1、手牌 -1”的卡角把数回合后的分析/登陆收益归因给当前弃牌。第 5
  轮要求卡角必须满足之一：即时产生一级收益；移动角标推进正式探测器路线；获得数据推进分析
  路线；或直接让原本不合法的下一代理成为合法。仅在遥远叶出现收益不算目的证据。
- 非终局 observation 原先只公开即时 `resources.score`，导致已预留的终局计分牌仍估值为 0。
  第 6 轮直接调用正式 `computePlayerFinalScore`，只加入当前局面已经锁定的终局 bonus；不预测
  未来完成条件，不为卡牌设分表，terminal 时仍以官方总分为唯一口径并避免重复计算。
- 第 5 轮目的证据只附在 completed leaf，达到 node 上限时保存的 frontier leaf 漏字段，导致所有
  此类卡角 fail-closed 为 `card-corner-immediate-outcome-missing`。第 7 轮统一两种 leaf
  schema；不改变目的判定条件。
- frontier 证据修复后的复跑在第 195 次 `end_turn` 搜索耗时 13.5 秒触发保护。Simulation
  原有 `requiresCounterfactualOutcome` 入口未接入决策装配，而且旧集合错误排除了需要路线
  证明的 quick trade。第 8 轮接通入口，只让 `end_turn/pass` 走控制 fallback；quick trade
  与其他真实代理照常搜索。
- v20 完成后 quick trade 增至 22 次，报告显示大量转换只借用了数回合后的分析/登陆。第 9
  轮记录 root action 完成全部 mandatory conditional 后的 legal successors；转换必须直接
  解锁下一代理。唯一跨回合例外是计算机第 6 格已完成、当前缺 1 能量时为分析准备能量。

## 资源使用阶段的方向纠正

v21 将 quick trade 收紧到“一次转换后直接解锁下一代理”，虽然消除了借用遥远收益的转换，
但终局仍剩余 51 份钱、电和手牌。一个被中止的 v22 候选尝试允许同一 quick-trade 根继续
第二、第三次转换；这仍是从转换向外探索，方向错误，固定局未跑完且代码已撤销。

冻结后的规划顺序如下：

1. Production projection 先列出正式次级代理目标。探测器目标复用
   `buildProbeRouteRequirements`；打牌、扫描和分析只公开本席实体、正式费用、资源缺口与
   `nextStep`，不预先给收益分。
2. 每个目标由正式规则列出当前可用的 `preparationOptions`。快速转换直接复用
   `QuickTrades.TRADE_ACTIONS` 的 cost/gain；蓝科技数据放置直接复用
   `Data.listPlaceDataChoices/getBlueBonusPlacementReward`。只有 gain 命中目标正缺口的选项
   才进入目录。
3. 搜索初始化时先冻结 `goalId`，再把根动作绑定到该目标；未绑定目标的快速转换不得随机
   扩展。后续每一步只保留目标本身的 `nextStep`，或该目标此刻正式列出的前置动作。
4. 多次转换不是 beam 猜测：每次正式结算后重新投影同一 `goalId` 的剩余 gap，再确定下一
   个前置动作；gap 清零后只能执行目标动作。
5. 数据放置的 `choose_target` 必须匹配目标目录中的具体 computer/blue slot；不得先随便放置
   再观察拿到了什么。
6. 最终是否选择这条路线仍只由实际分数、科技、收入减真实资源机会成本决定。目标目录、
   缺口和前置动作都不获得固定分。

| 新语义 | 唯一 owner | 状态等价 / Decision | 剪枝与验收 | 反例 |
|---|---|---|---|---|
| 次级代理目标目录 | Production Kernel projection | `goalId + family + entity target + required/gap`；手牌实例、火箭来源不同不等价 | 目标存在但资源不足时仍可见；收益只能由反事实正式执行产生 | 因为当前付不起牌费，搜索完全看不到这张牌 |
| 快速转换前置 | Quick Trades cost/gain | 每次交易仍是正式 Standard Action；精选/弃牌保留 Decision | gain 必须命中锁定目标的正缺口；结算后同一目标 gap 必须继续存在或已清零 | 先钱换牌、牌换宣传，再借用数回合后的登陆收益 |
| 蓝科技放置前置 | Data placement choices / blue tile bonus | 锁定具体 placement kind 与 blue slot；奖励走正式 Effect | 只有正式奖励命中目标缺口才可作为前置 | 目标缺电，却选择奖励信用点的蓝科技槽 |
| 目标完成 | 各 Standard Action domain | 以 entity target 匹配，不按 family 粗略等价 | gap 清零后只执行目标 nextStep；完成后解除 goalId | 两张费用相同的牌被当成同一目标 |

### 固定盘面结果与保留结论

| 版本 | 四席终局分 / 均分 | 关键行为 | 钱+电+手牌 | 结论 |
|---|---:|---|---:|---|
| v13 基线 | 49/38/30/30 / 36.75 | 分析 0、打牌 2、卡角 23、快速转换 2 | 未记录 | 基线 |
| v14 数据进度可见 | 49/38/32/30 / 37.25 | 分析仍为 0 | 未记录 | 只保留 observation 能力 |
| v15 全局 best-first | 10 均分 | 探测器路线归零 | 未记录 | 否决 |
| v16 每 root 路线 | 38/37/35/4 / 28.5 | 分析 3、打牌 5 | 未记录 | 否决 |
| v17 节点语义纠正 | 79/50/46/46 / 55.25 | 分析 4、打牌 7、卡角 22 | 未记录 | 强度上升，但卡角行为不合格 |
| v18/v19 卡角与终局分 | 57/42/31/31 / 40.25 | 卡角降至 1；接入已锁定终局分 | 未记录 | 规则能力保留，策略结果不保留 |
| v20 frontier/control 修复 | 61/48/40/34 / 45.75 | 快速转换 22、卡角 8 | 未记录 | 转换借用遥远目标，否决 |
| **v21 直接目的证明** | **59/50/47/46 / 50.5** | 快速转换 5、卡角 6、打牌 9、分析 3 | **51** | **本批保留基线** |
| v22 连续转换正向扩展 | 未完成 | 从转换向外找目标 | — | 方向错误，中止并撤销 |
| v23 所有行动按目标分支 | 45/43/37/25 / 37.5 | 快速转换 12；目标分支挤占节点 | 49 | 否决并撤销 |
| v24 仅资源前置绑定目标 | 50/44/43/31 / 42 | 快速转换 11；绿色探测器分 0 | 58 | 否决并撤销 |

v23/v24 证明，只给 `quick_trade/place_data` 加目标标签仍不能闭合资源路线。绿色 v24 终局有
23 钱、1 电、5 数据、4 手牌；能打出的资源/数据牌因为自身没有一级收益被裁掉，而规划器又没有
把“打牌取得资源/数据 → 分析或探测器目标”表达成同一目标的正式状态转移。下一阶段若继续解决
资源用不完，必须让目标成为搜索根，并由卡牌、扫描、数据放置、转换等所有资源手段统一提供
`state -> gap` 转移；不得继续在 action-root 搜索上叠 quick/data 特判。
