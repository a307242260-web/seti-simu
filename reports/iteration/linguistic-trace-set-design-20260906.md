# 语言学分析三色任务模型修正（2026-09-06）

## 目的与边界（生产修改前冻结）

只修正 b_67.webp（牌面编号 102）的任务条件及奖励目标描述，不迁移痕迹执行器，
不改变搜索或任务确认方式。该问题是核对卡牌来源时发现的既有规则错误；没有证据
证明由阿米巴改动引入。共享痕迹结算路径修复仍独立进行。

直接依据为仓库牌面 `assets/cards/basic/split/b_67.webp`：任务左侧为三个分别
着色的粉/黄/蓝痕迹图标，文字“for a single species”；右侧才是单个三色混合的
任选痕迹图标，文字“for that species”。因此不是任意三个同色痕迹。
资料站 https://seti.ender-wiggin.com/ 可核对名称和编号，但网页文本丢失图标，
不单独作为颜色判定依据。

| 义务 | 唯一实现与验证 |
|---|---|
| 同物种三色各一，且属于本人 | 模型复用现有 singleAlienTraceSet / playerHasSingleAlienTraceSet，不新增计数器 |
| 首次、额外、已揭示正面一起判断 | 复用 slotHasPlayerTraceSet；已有混合状态测试覆盖 state 黄/粉与奥陌陌正面蓝 |
| 同色三枚不达标；跨物种三色不达标；他人颜色不达标 | 扩展现有 effects.test.js 的真实任务查询输入 |
| 奖励仍允许任意颜色，但限满足三色的物种 | 模型 targetRule=singleAlienTraceSet、requiredTraceTypes 三色；不把奖励 allowedTraceTypes 限成单色 |
| 状态/恢复/身份 | 条件为纯读取，无新增状态、RNG、sequence 或 Decision；保留原任务 id，已完成任务不重开 |
| 删除与范围 | 删除 b67 模型中的 count=3 和 requiredTraceCount，不清理其他任务的计数能力 |

已知未完成项：当前旧卡牌痕迹执行器忽略 targetRule（旧计数规则也未执行）。本项
只交付任务模型修正，不宣称奖励目标执行正确；共享 Science 路径实现时必须消费
新的三色目标限制，并覆盖 residual 任务奖励来源。全盘验收等待该显式缺陷修复及
单决策门禁，不以本项单测代替完整局 108.5 门槛。

## 验证记录

修复前定向测试已复现失败：三个同色痕迹被错误判为 b67-three-traces-task 达标。
修复后定向测试通过。回归命令：
`node tools/run_node_tests.js --exclude simulation-counterfactual-outcome --exclude strategic-goal-evaluator`。
结果 unit 77/77（6.60 秒）、唯一 fullFlow 1/1（0.53 秒）。两项排除沿用用户确认
的既有失败，不宣称包含它们的全量通过。没有新增评估器输入或搜索路径。

文档核对范围：AGENTS 快速入口、Node 测试规范、卡牌 DSL、AI 性能计划、痕迹来源
设计及迭代登记规范。更新 DSL/性能计划/痕迹设计；未变动装配、接口、运行命令和
状态结构，无需改 README、AI/RL 接口说明或项目长期记忆。本轮无新全盘与性能数据。
