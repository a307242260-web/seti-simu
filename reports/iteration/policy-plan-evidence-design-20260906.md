# Policy输入与计划续用证据分离（方案冻结，2026-09-06）

目的：避免对Policy不消费的逐步计划证据做第二次安全校验复制；不减少搜索节点、叶、
真实输入或计划内容。真实42输入图237253962字节、2938叶，复制CPU累计约10.23秒。

## 唯一改动及完整边界

在Heuristic决策函数调用Policy Port之前，为每个outcome/leaf构造浅层输入视图，
只排除leaf.planSteps。其余字段一律原样保留，交原createDecisionContext完整校验、
独立复制、深冻结。原actionOutcomes仍传extractPlanSnapshot并原样返回协调器。
不改变通用Policy Port的接受字段和安全约束，不新增trusted bypass，不改搜索执行。

| 语义/消费者 | 冻结义务 | 可证伪证据 |
|---|---|---|
| 搜索及Outcome投影 | 保留原始全部叶与planSteps、共享图隔离规则 | 原actionOutcomes未变；节点/提交次数相同 |
| Policy评分 | evaluateAction/heuristic-policy不读取planSteps；根观察、根稳定观察及后继、trace、goalPaths全部保留 | 真实25动作逐项完整评价相同，PolicyDecision相同 |
| 计划提取唯一owner | plan-continuation仍从原winning leaf读取planSteps并compilePlanSteps | 同selectedLeafId、同完整plan，正式逐步执行 |
| 接口/来源隔离 | 只改变HDF内部给Policy的视图，外部返回outcomes不变；通用Policy Port仍拒绝恶意输入 | 原Policy安全单元；视图不得修改来源，未裁字段仍全部校验 |
| 状态/RNG/ID | 不执行新规则，不改branchKey或任何提交；保留actionId/leafId/来源/隐藏信息 | 单决策数量、动作、计划对照；固定完整局核验 |
| 旧路径 | 删除HDF把完整planSteps送入Policy的直传，不删除计划证据生产/存储 | 全仓planSteps读取核对，Policy端口本体不变 |
| 预算/性能 | 4096/256/30秒、排序与保留叶规则不变；不是改节点记账 | 相同真实输入离线复制时间及单决策实耗 |

消费审查：planSteps生产在rule-composition，projectOutcomeObservations保留并冻结；
运行期直接读取只在plan-continuation.extractPlanSnapshot。expected-score-evaluator
读取rootActionObservation、rootActionLegalSuccessors、rootActionSettledLegalSuccessors
以及trace/goalPaths/goalSelections，均不得顺带裁掉。rootActionSettledObservation也
保留，不为多省一项扩大本方案。

首个生产patch前先用已保存V8图离线对比完整与仅去planSteps的Policy输入，检查
除该字段外的完整输出图、25动作评价和Decision一致，再判断收益是否足够。
生产实施后按既有unit/唯一full-flow及V输入审计验证；单决策达标后中文提交，
迭代中心去重运行一次完整固定盘面，均分至少108.5。未验收前不宣称提速完成。

## 实施与局部验收

已仅在HDF的createDecisionContext参数处映射叶并排除planSteps，原输出/计划提取
不变。新增Policy接口单元同时验证Policy看不到该字段、其他输入被冻结、原输出
保留独立证据且下一步计划可提取；未修改通用Policy Port的任何校验。

真实输入图以Node 22 V8序列化并gzip保存为policy-input-42-20260906.v8.gz，
保持共享引用（JSON序列化不能替代该图）。采集记录policy-input-capture-42-20260906.json。
首次离线验证用V8字节哈希比较失败，原记录保留；V8编码不是规范化语义编码。
v2改为完整双向对象映射检查字段/值/共享关系：25动作完整评价和Decision相同，
2938叶全部保留，输入未变；复制11.0405秒→6.0467秒，单次离线候选证据，不冒充全局收益。

改后真实42单决策16.915秒，改前专门采集23.032秒，约下降26.6%；同为4096节点、
4804成功提交，25动作评价及完整29步计划与保存基线相同。不是节点数减少。
证据policy-plan-view-decision-42-20260906.json；历史完整局该步4819提交与当前冷
基线不同，性能比较使用本轮同条件采集，不把历史与冷基线混用。

回归77 unit + 唯一fullFlow通过（7.04s/0.55s），V输入审计通过；明确排除用户
指定暂不处理的simulation-counterfactual-outcome和strategic-goal-evaluator。
测试fixture首次漏plan采集必需board字段已修正，之后改前因Policy含planSteps失败、
改后通过；未为了fixture改动生产机制。73e7b2ca完整终局已通过：569步均109，
全部replay/终局状态/非时间搜索诊断一致，398875→375302ms（-5.91%）。
完整验收与残余风险见policy-plan-full-review-20260906.md。

文档同步：更新AI设计、RL契约、测试inventory义务及性能计划。README/AGENTS和公司
规则无入口、接口或规则变化，无需修改；不触碰长期记忆。
