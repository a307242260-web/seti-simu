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
