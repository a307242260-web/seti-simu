# R3-T1 板块依赖类型修正（2026-09-06设计冻结）

实际第194步前原计划将终局`final:a`编译为科技a，valid=false，证据见
`r3-brown-second-realization-20260906.json`。这是R3实现偏差，不是正确逻辑的连带效果。

| 正式来源/完整选择闭包 | 描述符 | 唯一事实owner/依赖 | 行为义务 |
|---|---|---|---|
| science-session/listResearchChoices：标准研究、免费效果及嵌套奖励研究 | tech:<tile>及tech:<tile>:slot:<n>，target.tileId | techSupply.stacks具名板块；仍用已有tech scope | 科技剩余/bonus变化失效；终局板块无关变化不影响 |
| residual公司借用/失效科技 | tech:<tile>，target.tileId | 保持同一科技scope与正式合法性检查 | 不把公司选择错归终局；此次不扩展科技自有状态策略 |
| residual FINAL_MARK：回合结束门槛、嵌套效果及多门槛followup | final:<tile>，target.tileId | board.finalScoring.tiles[tile]及tileVariants[tile] | 所选板块占位或变体变化失效；其他板块变化不影响；未知/缺失不能复用 |
| 无tileId的研究主动作 | tech:gain:<tile>目标 | 原目标依赖不变 | 不要求主动作伪造选择字段 |
| 未知tile选择 | 无正式可辨认类型 | 显式plan-tile-scope-unknown | 不默认为科技，不按a/b/c/d字母特判 |

实现：capturePlanStep复制公开终局板块目录（每块含variant和tile）；stepScopes使用
正式choiceId的final:<tile>识别终局，其余仅接受公共科技目录中的tile并核对已有choiceId
科技身份（无choiceId的窄接口仍可由正式科技目录辨认）。scopedFact按具名final-tile取事实。
同段后继终局选择的依赖自然传给end_turn，推进后使用下一步重新采集的占位事实。

无新规则执行器、RNG/id/sequence、事务或Decision owner；不修改提交/恢复，计划仍
reset/load清空。终局规则唯一在final-scoring.js，计划只比较公开事实，不调用会ensure
或写状态的计分函数。不修水星扫描疑点、不改权重或预算。旧通用tileId=>tech入口删除。

验证先覆盖正式四板块、两变体、同回合end_turn及后续标记、其他板块不失效、所选
板块占位/变体变化失效、缺事实和未知选择拒绝、科技依赖不退化；再在第172步真实
checkpoint新搜索核对不再产生tech:a的invalid步骤、规则结果评分/节点保持等价。
随后相关回归、文档同步、中文提交；固定盘面仅干净提交后标准去重执行，不预设均分恢复。

## 局部验证结果

四板块×两变体、占位/变体/缺失/未知类型及原有科技回归通过。真实第172步一次搜索
420.35ms、118节点，各根完整evaluation与修复前逐项相等；原end_turn和final:a两个
invalid步骤均恢复有效，全部步骤有效。证据`r3-tile-dependency-verification-20260906.json`
含生产源码哈希（运行时生产改动尚未提交，不冒充完整版本实验）。

`r3-tile-dependency-realization-20260906.json`按正式存档重放至第194步前，前8个本席
动作命中；当前边界end_turn检查从缺事实miss变成hit，符合原计划语义。之后轨迹将与旧档
分歧，未强制重放旧动作充当新策略结果。局部验证不能证明均分恢复。

默认Node回归unit 73通过、2项用户指定旧失败（365/348），唯一fullFlow通过；V输入
审计通过。AI/RL已同步；README、AGENTS、PROJECT_MEMORY、Node标准和迭代标准已核对，
无入口/schema或长期口径变更，不需修改。下一步是干净提交的固定盘面验证与版本登记。
