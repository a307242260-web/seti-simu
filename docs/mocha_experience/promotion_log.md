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

- followup_evaluation_structural_20261118: 按既定收益空间筛选，定位两个准备前缀下重复主行动的68.4%实际成本，并用48次原生输入确认两个具体可交换端点；同时保留取牌解锁新主行动的反例。未推广通用重排或修改运行时。下一设计需证明足够适用范围，不能把理论上限当作达标。
- followup_structural_evidence: reports/ai-foundation-20261118/r4-preparation-structure-findings-20261118-v1.json；reports/ai-foundation-20261118/r4-main-owned-preparation-design-20261118-v1.json。

## SETI-METHOD-20261118-02：限制连续局部研究投入

- source: 用户要求方法论有效推进后再继续；SETI-METHOD-20261118-01的后续复核；reports/ai-foundation-20261118/methodology-review-20261118-v2.json。
- promoted_to: loop_template
- promotion_decision: promote
- target_agent: /root（SETI AI研究）
- target_component: 单项研究投入、出口与业务进展汇报
- target_file: docs/ai-research-workflow.md §1.2
- remote_skill_id: none
- change: 为下一工作单元设置60分钟主动研究／两个假设上限，先到即收口，停止自动串接补丁；分开诊断、局部修复、准入、整局与泛化证据。
- applied_change: 已新增§1.2；仅改变研究工作方式，不改变搜索覆盖、规则、正式运行时、运行时预算、全局规则或长期记忆。
- expected_effect: 局部有效但未达准入时及时交付明确结论，避免将持续验证包装为整体进展。
- evaluation_window: 下一次单一浏览器／Node运输差异归因，最多60分钟或两个可证伪假设，结束后复核出口。
- success_signal: 依据同一行动、任务与结算边界归类失败；证据不足则按时冻结，明确未解决项，不自动开始补丁或第二研究单元。
- rollback_condition: 仍超时串接研究，或只增加材料而未作出口判断；停止该循环并重审选题。不得通过截断必要搜索、放宽验收来满足工作时限。
- risk: 研究时限可能留下复杂问题未解决；应诚实冻结而非仓促下结论。两次不同运行时的单点计时不证明稳定性能，保留全部失败。
- evidence_before: 正式整局272不变；局部v513为69次提交／601节点／639.7ms、239.5。11项Node通过、1项历史失败；估值输入68通过；浏览器2通过、1未归类失败、6未运行。候选未准入。
- owner_or_agent_decision: 执行用户的方法论优先指令，冻结继续实现和新整局；保存已有候选证据。
- applied_at: 2026-11-18
- verification: python3 adhoc/audit-ai-methodology-20261118-v2.py；只读校验16来源、同根、运行时版本差异、数值和失败日志；本次没有AI／原生／浏览器执行。
- observed_outcome: 方法已增加投入上限和强制出口；已有诊断与局部修复有效，完整业务效果仍未验收；新的投入约束尚待下一工作单元检验。
- keep_or_revise: keep（有限研究流程）；不宣称时限机制或AI整体质量已经通过前瞻性验收。
