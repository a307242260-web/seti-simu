# 方法升级决策记录

## SETI-METHOD-20261118-01（2026-11-18）

- source: 用户的方法论优先指令；`exploratory_research.md`中`experience_id: SETI-METHOD-20261118-01`对应经验；`reports/ai-foundation-20261118/methodology-review-20261118-v1.json`。
- promoted_to: loop_template
- promotion_decision: candidate
- target_agent: /root（SETI AI研究）
- target_component: SETI AI研究选题、因果诊断与分层验证循环
- target_file: docs/ai-research-workflow.md
- remote_skill_id: none
- change: 候选流程采用业务问题、同起点归因、收益空间筛选、小规模方法试验及分层验证；保留既有局部PASS与整体验收规则。
- applied_change: none；未修改目标工作流、运行时、全局规则或项目长期记忆。只记录候选方案，并按本次用户指令停止AI实现、完成只读审计。
- expected_effect: 减少连续低收益性能补丁，重新产出可验证的第四轮决策／资产结论，使实现工作能够导向既定验收。
- evaluation_window: 下一张前瞻性同起点决策卡及其最小必要对照；完成前不推广方法或恢复开放式AI实现。
- success_signal: 从当前证据定位一个可复现原因，给出可推翻的对照、修正预期与原约束下的可行计算路径；明确区分策略等价、合理取舍和真实缺陷。
- rollback_condition: 新方法仍只增加材料和验证数量，不能改变选题或形成可判定根因；立即修订草案，不以“方法已写好”宣布有效。
- risk: CPU采样比例只是估计；筛选不应错误否决有明确组合路径的小优化。不能把教师单种子事后收益当作当时可见信息，也不能改变必要覆盖或以缩短边界造达标。
- evidence_before: 连续六个检查点正式成绩272不变；困难点1.528秒，原拟三个热点并集仅28.8%；第289步两条下界235.5相同但资产不同。
- owner_or_agent_decision: 用户要求方法论优先；agent仅记录候选，尚未宣称新方法有效改善AI。
- applied_at: none
- verification: `python3 adhoc/audit-ai-methodology-20261118-v1.py`；只读现有图、CPU采样、原生对照和检查点，校验来源SHA，无AI运行或原生输入。
- observed_outcome: 回顾性筛选拒绝继续以三个热点作为600ms主线；确认当前等值下界不构成战略资产等价。前瞻性方法试验未完成。
- keep_or_revise: candidate；保持实现停止，前瞻性试验后再决定是否推广。

## SETI-METHOD-20261118-01：前瞻性试验后的有限推广

- source: 同一用户方法论优先指令；reports/ai-foundation-20261118/r4-task-assignment-method-20261118-v1.json。
- promoted_to: loop_template
- promotion_decision: promote
- target_agent: /root（SETI AI研究）
- target_component: 教学学习与性能超限的前置诊断、迁移对照及止损循环
- target_file: docs/ai-research-workflow.md §1.1
- remote_skill_id: none
- change: 在既有实验流程前加入同起点因果诊断、收益上限筛选、完整计划比较、逐例旧最好结果对照和反例止损；不改变原有验收条件。
- applied_change: 新增目标文档§1.1；未修改共享运行时、全局规则或长期记忆。隔离v511原型已拒绝，新增源码仅按补丁存档。
- expected_effect: 在扩大实现或批跑前发现真实遗漏，并拦下单点改善、其他状态退步的补丁。
- evaluation_window: 本次38输入原生对照及v511六例迁移试验；推广后观察后续两张决策卡。
- success_signal: 已定位原任务绑定遗漏；按事先声明的条件拒绝三例退步的原型，未执行第289步或新整局；后续须继续产生可判断的原因或无退步修正。
- rollback_condition: 连续两张卡只新增材料或测试数量，没有新的因果结论／可验收修正；修订选题与流程，不恢复开放式微优化。
- risk: 当前窗口估值不等于全局分数；逐例不退步只适用于已固定的比较问题，不能阻止事先说明且有资产依据的合理取舍。一个方法试验不能证明AI整体质量提高。
- evidence_before: 六检查点正式成绩272不变，热点收益上限不足，等值下界未证明资产等价。
- owner_or_agent_decision: 按用户要求先验证方法；仅推广有证据的诊断与止损部分。AI实现、整局和批跑不恢复。
- applied_at: 2026-11-18
- verification: 原生控制两例共38输入、四存档精确恢复；目标回归先失败后达到239.5；六例旧最好结果比较发现三例退步；拒绝补丁四文件独立还原SHA一致。
- observed_outcome: 候选／固定计划根因已确定；v511被否决；正式成绩272和共享AI均不变。实际AI质量改善仍未验收。
- keep_or_revise: keep（有限推广诊断／对照／止损）；重审任务、化石、路线及筹资的归属后，再决定下一项最小方法试验。

- followup_evaluation_20261118: 第二张因果卡确认完整Native续运，v512六例不退步、两例+4且改变第289步选择；诊断／对照流程继续保留。47文件及卡牌目录独立还原，历史测试输入单独登记；缺依赖和旧断言失败显式保留。7项相关检查通过、1项历史失败。1573.7ms未准入，整体AI质量未完成，不恢复整局或低收益微优化。
- followup_evidence: reports/ai-foundation-20261118/r4-cargo-suffix-findings-20261118-v1.json
