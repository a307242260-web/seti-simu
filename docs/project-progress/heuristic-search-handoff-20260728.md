# SETI 项目进度：启发式搜索交接（2026-07-28）

## 当前结论

新架构迁移与旧代码清理的主阶段已经完成，当前工作重心已转为启发式机器人和浏览器体验修复。机器人已通过新架构读取盘面、枚举标准行动、在反事实沙箱中执行候选并读取实际结果。固定盘面第 55 次高分支决策已通过逐根分层 beam 和 fork 恢复去重压到 1 秒门禁以内，但距离 100ms 理想目标和完整局策略质量验收仍有明显差距。

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

- 最多探索 15 个真实 Decision；15 是安全上限，不是强制走满。
- 移动、支付、快速转换和 conditional choice 是达成目标的中间步骤，不单独作为终极目标。
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
- 当前 v9 明确跳过无法直接命中分数/科技/收入目标的 `quick_trade` 根，仍以
  `STRATEGIC_GOAL_NOT_EVALUATED` 保留完整 legal/outcome 对齐。
- `pass/end_turn` 不跳过反事实执行；最后一个 PASS 进入新一轮后，收入在新轮开始时结算。
  `gainIncome` 增加收入轨时对新增部分的即时奖励属于效果自身，不是本轮或轮末收入阶段。
- 第 55 次固定决策的 `b_9.webp` 在首叶前产生 324 宽的原始 frontier。当前每个 root、每个
  breadth 层保留战略价值最高的 8 个节点，全部 root legal action 仍进入首层；被剪枝 outcome
  保持 low confidence。
- 反事实恢复不再重复解析同一 Session checkpoint；可信冻结 committed snapshot 可在内存 fork
  中复用，Action working copy 仍独立克隆。反事实 branch seed 明确升级为 v2，canonical RNG
  不变。
- benchmark 初始选择已改为每位玩家显式完成 1 公司、2 初始牌与确认，不再重复点击首个公司。
- 验证结果：
  - `randomizer/game/ai/strategic-goal-evaluator.test.js`
  - `randomizer/game/ai/heuristic-policy.test.js`
  - `randomizer/app/simulation-counterfactual-outcome.test.js`
- `node tools/run_node_tests.js`：61 unit + 1 full-flow 全部通过。
- `node tools/benchmark_probe_policy.js`：12 次固定首 Decision，中位数约 `601ms`、
  P90 约 `624ms`、最大约 `631ms`；实际评估 10 个战略根。
- Browser runtime 当前没有可用浏览器实例，真实 Chrome smoke 未执行；这项不能用 Node
  回归替代。

## 当前性能边界

- 单步已从历史约 179 秒和本轮修复前约 2.3 秒降到 1 秒以内，满足第一阶段硬门禁。
- 当前首决策约 601ms 中位数仍明显高于 100ms 理想目标。
- 第 55 次决策 3 次复测为反事实内部 `856–862ms`、墙钟 `943–956ms`，12 个战略根均执行
  58 个节点；同一动作始终选择 `play_card:b46d9f77` / `b_9.webp`。
- fork 恢复由约 `200ms` 降到 `52–53ms`。仍需固定盘面后续运行确认下一个性能边界。
- 固定盘面已完整运行到终局：109 次 Policy 决策，候选集整步最大 `970.33ms`，每候选平均
  `25.93ms`、最大 `74.15ms`，没有触发 1 秒门禁。
- 本局策略质量仍不合格：实际行动以 PASS/end_turn 为主，四席探测器实际得分均为 0，终局
  最高分仅 24。该问题属于目标实例化和跨稳定边界资源转化，不应通过放宽本轮搜索预算解决。
- transposition hit 在固定首回合仍为 0，说明当前收益主要来自目标可达性剪枝、复用 fork、
  分层 beam 和叶饱和提前停止，不代表共享搜索已经充分消除重复状态。
- `maxLeaves=8/root` 与 `maxFrontierPerRoot=8` 是两道不同的近似预算；前者是叶截断，后者才是
  逐根分层 beam。两者造成的 outcome 都保持 low confidence。

## 下一步实施方案

1. 将具体目标实例化，例如某颗行星登陆、某项科技、某张收入牌，并增加资源下界剪枝。
2. 找出固定盘面 transposition hit 为 0 的原因，确认状态指纹是否过细，或该盘面本身没有可交换路径。
3. 在保持完整局 1 秒硬门禁的前提下，将常规决策继续压到 100ms 量级。
4. 修复大量 PASS 和资源未转化问题后，再生成最终 HTML 行动日志并审计策略质量。

性能目标：平均单次决策保持毫秒级，优先控制在 100ms 内；任何常规决策不得进入秒级。

## 尚未交付

- 目标实例化与资源下界剪枝；
- 100ms 量级的常规决策时延；
- 基于新搜索器生成的最终 HTML 行动日志；
- 对最终资源是否充分转化为分数、科技和收入的策略评估；
- 当前环境下的真实 Chrome smoke。

## 启动下一会话时的首要动作

读取本文件、`docs/ai-design.md` 和本轮 frontier 矩阵，从目标实例化、资源下界和大量 PASS
的质量问题开始；每次新优化仍按“单次 Decision benchmark → 固定盘面 → 完整局报告”的顺序推进。
