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

- followup_evaluation_bounded_cargo_20261118: 首个有限单元以5次实际回放确认Browser错误保留了已交付F07的任务5；真正独立的F06任务7完整保留。完整存档与旧7输入续运起点一致，复用旧证据而不运行AI或续运。归因后收口，未接策略补丁；Browser及性能准入仍未通过。先前诊断序列化失败及推定重复成本明确留档；方法能形成有限结论，不能据此宣布整体AI提升。
- followup_bounded_cargo_evidence: reports/ai-foundation-20261118/r4-browser-cargo-findings-20261118-v1.json；adhoc/audit-r4-browser-cargo-diagnosis-20261118-v1.py。

## SETI-METHOD-20261118-03：按整条路线累计投入并强制裁决

- source: 当前用户的方法论优先指令；SETI-METHOD-20261118-02后续记录；reports/ai-foundation-20261118/methodology-review-20261118-v3.json。
- promoted_to: loop_template
- promotion_decision: promote
- target_agent: /root（SETI AI研究）
- target_component: 候选从归因到采用／拒绝／冻结的完整研究路线
- target_file: docs/ai-research-workflow.md §1.3
- remote_skill_id: none
- change: 将投入限制从单项提升到整条路线；试行累计最多两个60分钟单元，评审后在原有准入满足时运行唯一自主整局，结束必须裁决，不因新阻塞续期。
- applied_change: 更新§1.2历史状态并新增§1.3；只改变研究流程，正式AI、隔离候选、规则、预算、共享index及现有实验记录不变。
- expected_effect: 阻止局部改进不断推迟业务验收，尽早交付可比整局与逐轮资产结论，或明确结束无可行验收路径的投入。
- evaluation_window: 方法试验中的v514完整路线，累计主动工作最多120分钟；本次只读方法整理不启动实验，不额外增加用户审批。
- success_signal: 在限额内完成既有准入和唯一自主整局并作资产裁决，或明确冻结未通过的路线、不自动串接新补丁；冻结仅验证止损，不证明棋力提高。
- rollback_condition: 改名／拆分子项重置累计投入，超时仍继续补丁，或将局部通过、冻结包装为整体有效；立即停止当前路线并修订流程。必要验证未完成不得通过。
- risk: 两小时试行限额可能无法收完复杂候选，应冻结而非降低正确性／性能门槛；只有一个教学盘的完整结果仍不能证明20盘泛化。
- evidence_before: v512在目标决策修复遗漏但1573.7ms，v513为639.7ms，v514为572.910541ms；均没有新完整局，正式272未变。既有单项时限未覆盖候选全生命周期。
- owner_or_agent_decision: 按用户要求继续方法整理，冻结策略修改和新实验；推广累计收口约束，前瞻效果保持未验证。
- applied_at: 2026-11-18
- verification: 只读校验路线复核的来源SHA及Git中正式完整局，独立快照检查文档链接、证据与具体数值；不运行AI、规则重放或浏览器。
- observed_outcome: 五项既有工作裁决清楚，下一项更新为v514准入评审；没有新分数或整局质量结论。
- keep_or_revise: keep（试行累计投入约束）；等待后续方法试验的路线结果，不宣称已解决长期收敛问题。

- followup_evaluation_20261119: 准入评审实际执行必需回归，181项unit与唯一full-flow有通过证据，91项unit仍未通过；部分旧断言由Native端点和预算计费对照归类，原测试未改，候选冻结、无自主新局。但墙钟已超过60／120分钟且未完整分开主动／等待时间，期限执行未通过；keep_or_revise改为revise，不恢复该路线第二单元。记录包含诊断console误报零搜索的更正：实际保留了两个先行fixture的六次搜索，另有三次预算诊断，未重跑替换证据。
- followup_evidence_20261119: reports/ai-foundation-20261118/v514-route-admission-20261118-v1.json。

## SETI-METHOD-20261119-04：有限推广命令期限门禁

- source: SETI-METHOD-20261118-03的期限执行失败；reports/ai-foundation-20261119/method-deadline-verification-20261119-v1.json。
- promoted_to: loop_template
- promotion_decision: promote
- target_agent: /root（SETI AI研究）
- target_component: 已限定研究单元的命令启动、续接与超时收口
- target_file: docs/ai-research-workflow.md §1.3；adhoc/research-deadline-guard-20261119.py
- remote_skill_id: none
- change: 复用持久绝对截止时间，命令前拒绝过期、执行中停止自有进程组，实时保存输出和退出状态，禁止并发与未核实的重复启动。
- applied_change: 增加单一Python标准库守卫及独立快照行为验证；工作流只推广命令门禁，不修改规则、AI、搜索预算、全局规则或长期记忆。
- expected_effect: 防止实验／诊断命令跨轮续期或到期继续运行，提供明确失败证据，减少口头时限失效后的继续投入。
- evaluation_window: 本次30分钟固定墙钟窗口及其十项子进程控制；后续第一个有明确业务范围的有限单元另验整体时限。
- success_signal: 十项真实行为控制通过，快照源码SHA一致，检查点期限跨进程不变；本轮归档在原截止前完成。整体研究或AI效果不由此推断。
- rollback_condition: 存在过期启动、续接重置期限、未停止自有子进程、日志丢失或覆盖；暂停使用门禁并保留失败，不恢复AI实验来检验基础设施。
- risk: 不能中断模型思考，也不能阻止绕过脚本或人为改期限；采用墙钟会从严计入等待。仍需在每个工具边界检查截止，不能宣传为平台级强制时限。
- evidence_before: v514单元和路线墙钟均超限，主动／等待未分开，期限执行未通过；正式成绩272不变。
- owner_or_agent_decision: 按方法论优先要求修复有证据的执行缺口，仅有限推广命令门禁；v514继续冻结。
- applied_at: 2026-11-19
- verification: python3 adhoc/verify-research-deadline-20261119.py <新验证输出路径>；实际运行独立快照中的同一源码，十项控制通过。
- observed_outcome: 命令层期限、失败和续接行为已验证；本轮无AI搜索、原生输入或新自主整局，整体质量仍未验证。
- keep_or_revise: keep（命令层有限推广）；下一次业务工作单元继续核查整体时限和交付，不能重开耗尽路线。
