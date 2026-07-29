# SETI 资源闭环目标搜索设计（2026-07-29）

## 验收基线

- 固定盘面：`seti-104-board-v1`，seed `seti-104-official-v1`。
- 保留基线 v21：四席 59/50/47/46，均分 50.5；终局 `钱+电+手牌=51`。
- 第一阶段目标：不新增资源分、不降低 node cap；终局 `钱+电+手牌` 至少下降 50%，均分不低于
  v21，并且每次快速转换都能追溯到同一正式探测器目标。
- 若第一阶段仍有大量手牌/数据，再进入卡牌与分析资源转移闭包；不得提前用固定库存负分强迫消耗。

## 根因与状态闭包

当前 `selectSecondaryAgentSuccessors` 在 `routeTargetId` 锁定探测器目标后，只保留
`probeGoalRequirements.nextStep`。当路线总能量仍有缺口、但当前下一步已因能量不足而不合法时，
selector 只返回 `end_turn/PASS`。因此搜索无法在既定环绕/登陆路线内部执行正式快速转换，
实际策略也会在发射或移动后失去目标连续性。

v25 修复上述断路后，固定局结果与 v21 完全相同。实际阻塞发生得更早：
`selectSecondaryAgentRouteTarget` 按目标收益优先锁定路线，却未把“至少需要的转换次数”计入
15 个次级代理的可达性。高收益远目标即使在预算内无法完成，仍排挤可兑现的近目标，导致
发射根最终只有无一级收益的截断叶。

## 设计矩阵

| 语义 | 来源与唯一 owner | 状态等价 / 去重 | Decision / RNG / 事务 | 剪枝与预算 | 反例 |
|---|---|---|---|---|---|
| 探测器目标 | Production Kernel `buildProbeRouteRequirements` | `requirementId` 保留火箭来源；`targetId` 用于发射前后连续性 | 只读 projection，不执行规则 | 仍受 15 个本席代理、128 搜索节点 | 同一星球不同火箭路线被错误合并 |
| 目标资源证据 | requirement `required/gap` + 当前正式资产 | 15 只计已完成的次级代理目标；发射、移动、转换和放数据是目标内部路线 | 枚举正式 2:1 信用/能量/手牌转换的当前可达性，不模拟奖励 | 当前可达优先；不可达目标仍可由前序代理补资源，不得硬删除 | 把当前付不起误判成整条跨代理路线不可达 |
| 资源缺口 | requirement `required/gap` | 只比较 credits/energy 正缺口；移动步数不伪装成资源 | 每个正式动作结算后重新投影 | 后继必须使当前目标资源缺口严格下降 | 钱换牌但目标缺的是能量 |
| 快速转换 | Standard Action descriptor `payload.cost/gain` | 完整 tradeId/cost/gain；不按 family 粗等价 | 复用 Quick Trades executor；弃牌/精选仍保留正式 Decision | 只保留缺口下降最多、净损耗最低的一项；锁定目标后的机械转换不占 128/15，仍占 4× execution guard；完全相同按 actionId | 同时允许钱换电和钱换牌随机扩展 |
| 搜索根 | 当前 legal descriptors + 一级目标 projection | 快速转换不是独立目标；只有已经 ready 的分析缺电可直接证明根转换用途 | 未评估根仍保留 unresolved outcome，不能被 Policy 误选 | 普通快速转换不占全局 128 节点；锁定目标后才作为确定性后继 | 8 个根平均分走预算，launch 在收益出现前被截断 |
| 蓝科技数据位 | Data `choose_target` 与正式 placement reward | placement kind/slot/blue slot 不等价 | 放置和奖励仍由 Science Session 结算 | 第一批先不猜奖励；后续只有正式投影能证明 gap 下降才接入 | 目标缺电却选择信用奖励槽 |
| 一级评价 | Expected Score Evaluator | 分数恒值；科技/收入按剩余轮次；库存不加分 | 只读真实叶；terminal 只读官方终局分 | 先比较一级收益；仅在非终局同收益路线间用机会成本和转换次数比较效率 | 终局科技或剩余资源仍参与评价 |
| 对手与回合 | Turn owner / Standard PASS | 对手状态不参与策略等价 | 对手仍提交正式 PASS 和必做 Decision | 不消耗本席 128 节点；物理执行仍受 4× guard | 直接篡改 currentPlayerId |

## Proof obligations

| 验收条款 | 可证伪命题 | 最小反例 | 实现落点 | 证据 |
|---|---|---|---|---|
| 先选目标再转换 | 给定已锁定 probe 目标且 energy gap>0，只有 gain.energy>0 的合法转换可作为后继 | credits-for-card 被保留 | `expected-score-evaluator.selectSecondaryAgentSuccessors` | selector unit |
| 15 只计代理目标 | 发射/移动/快速转换/放数据/卡角不增加 proxyDepth；环绕/登陆等完成节点增加 1 | 一次登陆路线被算成十余个代理 | Rule Composition + evaluator goal classifier | search unit + fixed-board depth |
| 缺口严格下降 | 转换结算后的同目标 `credits+energy gap` 必须小于结算前 | energy/credits 来回换循环 | route priority + successor contract | 两步反例与固定轨迹 |
| 不设置固定选项分 | 排序只用 gap reduction、正式 cost/gain 和稳定 identity | 给 quick_trade family 加常量 | 结构断言 / source review | evaluator test |
| 资源成本不能否决正收益 | 任意 `primaryValue>0` 的正式叶可选且胜过 0 分 PASS；同一级收益才比较成本 | 5 分-14资源被判负值 | Expected Score + Heuristic evaluator sortKey | unit + fixed-board |
| 终局只有分 | terminal 叶的科技、收入、库存和机会成本评价均为 0 | 第4轮 terminal 科技仍值5分 | Expected Score terminal branch | unit + fixed-board |
| 完成正式目标 | 转换路线只有在同一 target 最终执行 orbit/land 并产生一级收益时 selectable | 转换后 PASS | 现有真实叶 evaluator | fixed-board action chain |
| 预算不偷缩 | `maxNodes=128`、`maxProxyDepth=15`、10s 保护保持不变 | 用 node cap 50 改善耗时 | Simulation env/report | 报告 diagnostics |
| 转换不是随机搜索根 | 未锁定目标时普通 quick_trade 不进入反事实根；分析已 ready 且缺电除外 | 14 信用同时扩展换牌/换电 | Simulation/Browser root filter | unit + fixed-board root diagnostics |
| 内部路线不挤占代理预算 | launch/move/quick_trade/place_data/card_corner 不增加 proxyDepth/expandedSearchNodeCount，但仍增加 executedNodeCount，转换仍计 quickTradeCount | 7 次换电+6 次移动吃掉 13 个代理 | Rule Composition budget accounting | fixed-board chain + diagnostics |

## 失败语义

- 已锁定目标有资源缺口，但没有正式后继能缩小缺口：只允许控制动作，路线最终因无一级收益淘汰。
- 转换 descriptor 缺 cost/gain、出现未知资源或不能证明缺口下降：fail-closed，不作为目标前置。
- 同一目标转换后 requirements 消失且未执行目标：解除目标，不借用其他目标收益。
- 单决策超过 10 秒：停止完整局，先做性能定位，不通过缩小 128/15 预算绕过。

## 固定盘面结果

- 通过版本：v35。
- 四席终局分：68 / 60 / 49 / 49，均分 56.5；基线均分 50.5。
- 终局 `钱+电+手牌=12`，较基线 51 下降 76.5%。
- 正式行动：35 次快速转换、13 次发射、56 次移动、9 次环绕、6 次登陆。
- 性能：每候选平均 145.43ms；最慢单决策 8352.20ms，未触发 10 秒保护。
- 保留原因：资源下降与一级分数同时上升，并且转换根只来自正式探测器缺口、ready 分析或
  `card:play` 目标；未增加库存分，也未调整 128/15 预算。
