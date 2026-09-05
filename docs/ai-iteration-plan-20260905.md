# AI 四轮迭代计划（2026-09-05，用户已批准）

起点：`3816b918`，生产代码等价 `elig-sum4 / 56e9a9c0`。按顺序独立实现、验证、
中文提交、登记版本并向用户报告；未完成全部四轮前持续目标保持 active。

| 轮次 | 目的 | 验收边界 | 状态 |
|---|---|---|---|
| 1 | 终局估值正确性 | 正式终局分唯一决定终局价值；库存和未来收益不改变排名 | 已实现，定向验证通过，待版本实验 |
| 2 | 蓝槽收益归因、宣传研究预期和资源口径 | 收益有来源、避免重复计算，阶段口径一致 | 待设计 |
| 3 | 计划逐步依赖与新信息失效 | 每一步检查对应假设，同回合新信息也能失效 | 待设计 |
| 4 | 搜索预算和目标裁剪 | 有限预算下覆盖与完成度可解释；先单决策性能再全盘 | 待设计 |

## 第一轮设计冻结

唯一估值 owner 为 `expected-score-evaluator.js`；状态、正式终局分、RNG、action id、
Decision owner 与事务仍归原 Production composition。本轮不修改规则执行、随机性、
搜索空间、非终局权重或输入提交链；没有旧 runtime 迁移或兼容入口。

| 消费路径 | 正式输入与现状 | 义务与实现 | 行为证据 |
|---|---|---|---|
| 标准状态读值 | outcome-model 的 terminal / officialTerminalScore；已锁定分在终局已并入正式分 | 继续使用 evaluateState；不重复叠加 securedEndGameBonus | 基础分与正式分不同、锁定分非零的终局样例 |
| 最终叶评分 | leafValue；infrastructure 已在终局归零，宣传项未归零 | 宣传研究价值只适用于非终局 | 宣传 0→6、全部未来收益变化而终局分不变 |
| V 估值 | evaluateStateValue；终局仍消费数据、手牌、外星预期 | 终局在计算未来收益前返回正式分，所有未来分项为 0 | V 开关两种模式，富资源终局与空资源终局等值 |
| 轻量搜索读值 | evaluateStrategicFactsBreakdown 复用 leafValue | 与标准叶评分的正式分差一致 | 标准 observation 与 strategicFacts 对照 |
| 次级搜索队列 | evaluateSecondaryAgentSearchPriority 的目标进度在价值前 | 终局清空目标进度/资源/路线项，仅保留正式分差所在维度 | 不同目标绑定和剩余数据不改变终局 priority |
| 最终动作/叶排序 | evaluateOutcome → heuristic-evaluator；V 可参与同分叶排序 | 低正式分不能胜出；同分只按既有稳定、非资源 tie-break | 交换 actions/leaves 顺序，V 开/关仍同一赢家 |
| 计划提取 | extractPlanSnapshot 再调用 evaluateOutcome | 取到同一终局优胜叶的到达路径，不丢失通向终局的动作 | snapshot.nextActionId 对应优胜叶 |

最小反例：根正式/锁定分为 0，终局正式分仍为 0，宣传从 0 升到 6；旧实现返回 60。
第二反例：终局正式分相同，残余数据不同；旧 V 返回不同值。测试先复现再整体实现。

## 验证与实验约定

- 独立终局估值 unit 登记进现有测试清单；覆盖标准观测、轻量事实、V、搜索排序和计划消费。
- 修改前后运行默认 Node 回归，区分既有失败与本轮回归，不以恢复旧接口来迁就旧测试。
- 先提交生产代码与文档，再执行研究验证；实验期间 tracked 代码必须与提交一致。
  现有用户未跟踪报告保留，不装入本次提交。
- 研究验证先 `--list` 去重，200 步快速结果与正式终局契约分开报告；终局正确性不能由
  200 步分数证明。需要完整局时从同版本快速存档续跑，使用标准版本登记与复盘产物。
- 文档核对范围：README、AGENTS、PROJECT_MEMORY、AI 设计、RL 契约、Node 测试说明、
  研究流程和迭代登记说明。只更新受本轮影响的内容。

## 第一轮实现验证（2026-09-05）

- 反例先失败：终局正式分 20、根基础分 7 + 锁定分 3，宣传 0→6，旧实现估值 70，
  正确值应为 10。完整实现后 `terminal-value.test.js` 通过。
- 修改前全量：unit 65 通过 / 2 失败，唯一 full-flow 通过；修改后：unit 66 通过 /
  2 失败，唯一 full-flow 通过，新增终局测试通过；语法与 diff whitespace 检查通过。
- 两个既有失败未被本轮修改：`simulation-counterfactual-outcome.test.js:365` 的
  快速转换根候选断言；`strategic-goal-evaluator.test.js:348` 的旧目标释放接口断言。
  后者实际完成 owner 已是 `completesSecondaryAgentRouteTarget`。后续搜索轮统一核对
  测试与现行搜索契约，不能把本轮报告表述为全量全绿。
- 已核对 README、AGENTS、PROJECT_MEMORY、RL、app 架构、玩法和 Node 测试说明；
  本轮不改变其运行方式、规则或 schema，无需更新。AI 设计已同步终局契约。
  非终局资源口径的历史矛盾归第二轮处理，当前不改其行为。
