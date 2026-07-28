# SETI 项目进度：启发式搜索交接（2026-07-28）

## 当前结论

新架构迁移与旧代码清理的主阶段已经完成，当前工作重心已转为启发式机器人。v11 第一批五轮
只采用“全局 beam 2→4”，v12 第二批五轮只采用 `play_card` successor rank `200→420`。
固定盘面均分从 29.50 经 33.25 升到 33.75，但仍远低于新手约 100 分的验收基准。

## 代码基线

- 分支：`dev`
- 2026-07-28 本轮开始时工作树与 index 均干净。
- 反事实搜索继续使用 Production Rule Composition 的单一 fork、标准 Action/Decision 和
  canonical checkpoint，不恢复旧 AI 规划与自动推进设施。
- 本轮完整设计与验收边界见
  `checkpoint/seti-heuristic-policy-performance-matrix-20260728.md`。

## 已确定的策略模型

### 两级目标

终极目标只有三类：

- 获取分数；
- 获取科技；
- 增加收入。

次级手段包括：

- 扫描以获取资源或分数，不要求一定赢得扇区；
- 赢得扇区；
- 环绕或登陆行星；
- 分析数据；
- 打牌获得痕迹、分数、科技或收入；
- 放置数据获得收入；
- 获取橙色科技；
- 为上述目标执行移动、支付、快速资源转换和选择。

### 搜索与价值

- 一级目标是整条路线的叶估值轴，不是取得即停止的路线终点。
- 最多探索 15 个本席次级代理，或在本席本轮实际 PASS 后停止；15 不包含代理内部的支付、
  选目标等 conditional Decision，也不包含 `end_turn`。
- 分数价值不随轮次变化；科技和收入按实际取得轮的剩余生效窗口估值，随轮次下降。
- 叶子价值：

  `V = 实际得分增量 + 科技的剩余轮次价值 + 收入的剩余轮次价值`

- 收入换算只用于“新增收入能力”，不用于把当前库存直接虚构成分数：
  - 1 信用 = 5 分；
  - 1 能源 = 5 分；
  - 2 数据 = 5 分；
  - 2 宣传 = 5 分；
  - 2 普通牌 = 5 分；
  - 1.5 外星人牌 = 5 分。
- 外星人痕迹价值必须读取实际盘面和标准执行结果，不能固定写死黄色痕迹价值。外星人未开启、无合法标记位置和首次痕迹奖励都会改变结果。
- 科技暂时只重点考虑橙色科技：
  - 橙 1：降低发射成本；
  - 橙 2：降低移动成本；
  - 橙 3：降低登陆成本；
  - 橙 4：增加卫星选择。

## 已修正或已验证

- 火星环绕链属于正式 DecisionEffect，不是旧 旧路径。
- 反事实执行会通过标准 action/decision port 执行，不应另写一套规则。
- 已定位收入 resolver 的返回值契约误判：`players.gainIncome()` 返回收入表，不是 `{ok: true}`；当前工作树已有对应修正。
- 已加强嵌套反事实失败传播，避免把真正的执行失败错误归类为 branch limit。
- 已增加火星环绕后选择公共牌、扫描、收入的行为覆盖。
- 卡牌域通用 Decision choice 已统一规范化为 conditional Standard Action；`b_11.webp`
  的移动 Decision 不再误走主 Action 提交并触发 `RULE_COMPOSITION_SESSION_ACTIVE`。
- 达到 `maxLeaves` 的 root 会立即停止执行剩余兄弟节点；固定 scan 从 50 个执行节点降到
  16 个（`maxLeaves=8`）。
- 旧 v9 曾跳过无法在单 Action 闭包直接命中一级目标的 `quick_trade` 根；v10 路线搜索已撤销
  该剪枝，快速转换作为次级代理执行，只有后续真实叶转化出的一级目标进入最终价值。
- `pass/end_turn` 不跳过反事实执行；最后一个 PASS 进入新一轮后，收入在新轮开始时结算。
  `gainIncome` 增加收入轨时对新增部分的即时奖励属于效果自身，不是本轮或轮末收入阶段。
- v11 全部 root legal action 仍进入首层；后续先按 root 合并同源 conditional 分支，再保留
  4 个全局路线节点，全局 node cap 为 128。2 秒保留为记录目标，固定盘面实验只在单次决策
  超过 10 秒时中止，不通过收紧 node cap 换时延。被剪枝 outcome 保持 low confidence，稳定策略
  边界可作为显式 `search_frontier`，但不会伪装成 PASS 或 15 代理终止叶。
- 反事实恢复不再重复解析同一 Session checkpoint；可信冻结 committed snapshot 可在内存 fork
  中复用，Action working copy 仍独立克隆。反事实 branch seed 明确升级为 v2，canonical RNG
  不变。
- benchmark 初始选择已改为每位玩家显式完成 1 公司、2 初始牌与确认，不再重复点击首个公司。
- 验证结果：
  - `randomizer/game/ai/strategic-goal-evaluator.test.js`
  - `randomizer/game/ai/heuristic-policy.test.js`
  - `randomizer/app/simulation-counterfactual-outcome.test.js`
- `node tools/run_node_tests.js`：61 unit + 1 full-flow 全部通过。
- `node tools/benchmark_probe_policy.js`：12 次固定首 Decision，中位数约 `1063ms`、
  P90 约 `1102ms`、最大约 `1137ms`；实际评估 18 个 legal root。
- 五轮实验记录：`checkpoint/seti-heuristic-auto-optimization-20260728.md`。
- 第二批五轮实验记录：`checkpoint/seti-heuristic-auto-optimization-rounds-6-10-20260728.md`。
- v11 固定盘面完整局报告：
  `checkpoint/seti-heuristic-auto-optimization-v11-20260728-action-log.html`。
- v12 固定盘面完整局报告：
  `checkpoint/seti-heuristic-auto-optimization-v12-20260728-action-log.html`。
- Browser runtime 当前没有可用浏览器实例，真实 Chrome smoke 未执行；这项不能用 Node
  回归替代。

## 当前性能边界

- 固定首 Decision benchmark 仍在 2 秒记录目标内，但约 1.06 秒中位数明显高于 100ms 理想目标。
- v11 固定盘面完整局为 53、37、34、9，均分 33.25。提交了 9 次发射、33 次移动、
  8 次环绕、2 次登陆、4 次科技和 24 次快速转换。
- 相比 v10，均分提高 3.75、最高分提高 6，但最低席从 20 降到 9；改善明显不均衡。
- v11 每候选平均 `283.98ms`，最慢单候选 `1308.61ms`，候选集整步最大 `2434.93ms`；
  2 秒记录目标仍未全程满足。
- benchmark 与完整局均以 10 秒作为实验失控保护；2 秒只是必须显式报告的优化目标，不能通过
  收紧 node cap 或提前中止样本伪装通过。
- v11 固定首决策 12 次 benchmark：中位 `1992.94ms`、P90 `2008.76ms`、最大
  `2059.87ms`，18 个 legal root。
- 候选实验中的定向交易只解决单个策略边界内的排列，没有保证跨边界剩余缺口单调下降，因此
  快速转换反而回升并导致均分下降，已物理撤销。
- v12 候选局为 43、37、35、20，均分 33.75；相对 v11 均分只提高 0.50，最低席恢复到 20，
  但最高席从 53 降到 43。实际提交打牌仍为 0，采用结论属于低置信固定盘面结果。
- v12 正式复现与候选局的四席分数和行动族完全一致；每候选平均 `275.00ms`、最慢单候选
  `1559.15ms`、候选集整步最大 `2466.11ms`。
- v12 固定首决策 12 次 benchmark：中位 `1860.99ms`、P90 `1869.69ms`、最大
  `1899.52ms`，本次样本全部回到 2 秒观察线内。
- transposition 和状态恢复的分项收益仍需重新 profile；不能从首 Decision benchmark 推断
  后续单候选决策的瓶颈。

## 下一步实施方案

1. 对完整局最慢的单候选和多候选决策做分项 profile，区分 clone/restore、规则执行、合法行动
   枚举和 evaluator 成本。
2. 审计 45 次快速转换是否都服务于随后得分路线；对无后续转化的分支增加状态等价或资源下界剪枝。
3. 在不降低 128 node cap 的前提下优先消除重复工作，再把完整局所有决策压回 2 秒记录目标内。
4. 分析没有登陆及后三席偏低的原因，再决定是否调整路线优先级或一级价值权重。

性能目标：平均单次决策保持毫秒级，优先控制在 100ms 内；任何常规决策不得进入秒级。

## 尚未交付

- 100ms 量级的常规决策时延；
- 无效快速转换与登陆缺失的策略修正；
- 当前环境下的真实 Chrome smoke。

## 启动下一会话时的首要动作

读取本文件、`docs/ai-design.md`、次级代理搜索矩阵和 v10 HTML 报告，从最慢单候选决策的
分项 profile 开始；每次新优化仍按“单次 Decision benchmark → 固定盘面 → 完整局报告”的顺序推进。
