# 启发式嵌套 Decision frontier 收敛矩阵（2026-07-28）

## 新性能案例

- 固定盘面：`seti-104-official-v1`。
- 位置：第 55 个 Policy Decision，R2/T4，`player-white`。
- legal action 20 个，按 v9 目标可达性实际评估 12 个。
- 整次决策：91 个执行节点、最大原始 frontier 326、反事实内部约 `1329ms`、墙钟约 `3336ms`。
- 唯一主要瓶颈：`play_card:b46d9f77` / `b_9.webp`。
  - 效果闭包：扫描行动 + 额外任意扇区扫描。
  - 单根：58 个执行节点、最大原始 frontier 324、内部约 `971ms`、墙钟约 `2538ms`。
  - `maxLeaves` 从 8 降到 1 仍需先执行 51 个节点，证明瓶颈是 breadth-first 在首个叶子前展开完整中间层，不能靠减少叶数解决。

## 冻结设计

| 维度 | 本轮口径 | 反例 / 验证 |
| --- | --- | --- |
| 语义 owner | Production Rule Composition 继续独占 Action/Decision 执行与事务；beam 只决定隔离 fork 中哪些尚未执行的等价层节点保留 | 不在 Policy、卡牌域或 Host 重写扫描规则 |
| 执行闭包 | 当前 root Action 及其必需 DecisionEffect，直到下一个稳定策略边界 | 不跨稳定策略边界自动选择下一主行动 |
| 控制 fallback | `pass/end_turn` 继续参与反事实执行；当该动作使所有活跃玩家均已 PASS 时，搜索可以观察随后进入新一轮并在轮初结算收入的真实后继状态。Policy 仍只在没有更高优先级路线时用既有 control fallback；仅 `quick_trade` 保留 legal identity 但不单独评估 | 不把轮初收入称为“轮末收入”，也不以术语误判为由跳过真实规则后继；conditional choice 仍必须评估 |
| 收入估值 | 正常收入阶段只在新一轮开始发生；`gainIncome` 提高收入轨时会对新增部分立即结算一次，该即时奖励属于增加收入效果本身。因此第 2 轮新增收入的窗口是“效果即时 1 次 + 第 3、4 轮轮初 2 次” | 不把即时奖励描述为本轮收入阶段，也不把新轮轮初收入归为上一轮轮末收入 |
| 状态等价 | v2 node identity 为 `hash(committedState bytes) + hash(Session checkpoint) + actionId + remainingDepth`；committed bytes 已是稳定序列化结果，不再作为 JSON 字符串二次转义 | 不合并不同 Session、RNG、version 或剩余深度；候选顺序不进入 identity |
| 根公平性 | 当前 legal set 的所有 root action 一律进入首层，不对 root legal action 做 beam 截断 | 不能因 actionId 排序让后面的合法根没有 outcome |
| Beam | 每个 root、每个 breadth 层最多保留 8 个 frontier 节点；共享节点按 key 只存一次，但分别保留各 root origin | 这是真实的逐根分层 beam，不再把 `maxLeaves` 描述成 beam |
| 目标优先级 | `expected-score-evaluator` 继续独占 v9 价值口径；用当前分支相对 root 已兑现的分数、科技、收入价值作为 beam priority | Rule Composition 不复制估值公式，当前资源库存不进入 priority |
| 稳定排序 | v9 branch priority 降序，再按 `actionId`、node key 字典序；只有战略进度相同时才由稳定 identity 决胜 | 候选输入顺序翻转不得改变 outcome；不能靠 hash 恰好保留高分叶 |
| 共享 origin | 对每个 root 独立选出前 8 个 node key；节点只移除未入选 root 的 origin，仍为其他入选 root 执行 | 一个 root 被剪枝不能误删共享节点上其他 root |
| 剪枝标记 | 被 beam 移除的 origin 标记 `pruned`，outcome 为 low confidence / `COUNTERFACTUAL_SEARCH_PRUNED`；diagnostics 单独记录 beam 剪枝数与宽度 | 不把截断结果声称为完整期望分布 |
| 叶预算 | 每 root 仍最多 8 个叶；达到叶上限后继续沿用 saturated-origin 提前停止 | beam 与 leaf cap 是两道独立预算 |
| 全局预算 | `maxDepth=15`、`maxNodes=128`、`maxFrontierPerRoot=8`；单次墙钟硬门禁仍为 1000ms | 不通过提高 node/depth/time 上限换行为 |
| RNG / identity | canonical RNG、actionId、stateVersion、decisionVersion 不变；反事实 branch seed 升级为 v2，以 canonical envelope hash、branch envelope hash、actionId 组成紧凑 identity | 候选顺序不影响 branch seed；反事实随机样本序列允许随显式 v2 provenance 改变，评估前后 canonical checkpoint bytes 必须一致 |
| Checkpoint | 只有存在 successor、后续确实需要恢复分支时才保存 child envelope；刚通过 Session commit 校验且已深冻结的 counterfactual state 使用私有 trusted serialize，避免再次 snapshot 克隆和重复全图校验；终叶不保存 child envelope | 公开 save 继续克隆并校验；trusted serialize 不接受外部 candidate，也不绕过 Action 提交前校验 |
| Fork 恢复 | trusted envelope 解析后立即递归冻结并按 bytes 缓存；StateStore 仅在显式 `trustedFrozen` 内存 fork 路径复用该只读 committed snapshot，Action 的 working copy 仍独立克隆；内部调用不再返回未使用的 snapshot 或 restore projection | 普通 restore 继续克隆、校验并返回 projection；未冻结对象不得进入 trusted 快路径 |
| Canonical 不变量 | 搜索只执行独立 fork，不再 restore 从未修改的 canonical composition；结束时用 trusted serialization 读取完整 canonical state/Session bytes，并与搜索前 envelope 做一致性断言 | trusted 路径只省克隆和重复 schema 遍历；任何 canonical 污染继续直接抛出 `COUNTERFACTUAL_ROOT_POLLUTED` |
| Decision owner | active Session 的 decisionId/version/owner 与 stale/late/wrong-owner 规则不变 | beam 不生成 choice，也不自动代选 |
| 旧设施 | 不增加旧 AI 规划、候选选择器或自动推进设施 | 全仓旧入口审计保持为零 |

## 验收义务

1. 固定 `b_9.webp`：
   - 保留 8 个 settled leaves；
   - `maxFrontierSize` 仍报告原始压力，新增 retained/beam diagnostics；
   - 执行节点显著少于 58；
   - canonical checkpoint 不变。
2. 同 checkpoint 下，beam 必须优先保留无 beam 搜索已发现的最高 v9 价值；若两者叶集合不同，
   必须明确保持 low confidence，不能声称等价。
3. 候选顺序翻转后 outcome 完全一致。
4. 现有土星登陆、火星环绕、卡牌移动等标准 Decision 全链继续通过。
5. 第 28 个固定 Decision 与第 55 个固定 Decision 墙钟均低于 1000ms。
6. 固定盘面继续运行；若出现新的首个超时点，记录新案例，不把局部通过外推为整局完成。
7. `node tools/run_node_tests.js` 全绿；真实 Chrome smoke 仍按环境可用性单独验证。

## 当前证据

- `b_9.webp` 单根：
  - 无 beam、`maxLeaves=8`：约 58 个节点，首个叶前需执行 51 个节点；
  - exhaustive 样本：352 个叶、最高 V=7；
  - beam=8：25 个节点、8 个叶，最高 V=5；现有无 beam 的前 8 叶最高 V=2。
  - 因 beam 未覆盖 exhaustive 的 V=7 叶，当前只能声明低置信近似；不能声明与完整搜索等价。
- 固定盘面第 55 次完整 Decision（包含 PASS/end_turn 的真实后继）：
  - 12 个反事实根、58 个执行节点；
  - 最大原始 frontier 84、最大保留 frontier 16、beam 剪枝 origin 118；
  - 去掉重复 Session checkpoint 恢复后的 3 次样本：反事实内部 `856–862ms`、墙钟
    `943–956ms`，fork 恢复 `52–53ms`；
  - 三次选择均为 `play_card:b46d9f77` / `b_9.webp`。
- 正常收入阶段只在新一轮开始；最后一个 PASS 只是使规则进入新轮的前置动作。增加收入轨时的
  即时奖励由 `gainIncome` 效果自身结算，不属于收入阶段。
- 固定首 Decision 12 次 benchmark：中位数约 `601ms`、P90 约 `624ms`、最大约 `631ms`，
  实际评估 10 个战略根。
- 固定盘面完整局：109 次 Policy 决策终局，候选集整步最大 `970.33ms`，每候选平均
  `25.93ms`、最大 `74.15ms`，未触发 1 秒门禁。策略质量仍有大量 PASS、四席探测器得分为
  0 的独立问题，不以提高搜索预算掩盖。
