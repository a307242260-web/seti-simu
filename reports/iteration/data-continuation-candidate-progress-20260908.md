# 连续数据执行候选：状态隔离门禁未通过（2026-09-08）

工作树`/private/tmp/seti-data-continuation-20260908.5CF4Mp`，分支
`perf/data-continuation-20260908`，基点483fc706，当前生产改动尚未提交、不得合dev。
主目录仅归档本次证据。完整实施设计为data-continuation-implementation-plan-20260908.md。

## 已实施

三处生产模块：evaluator新增分析/数据收入的逐来源连续共识；heuristic挂同一回调；
rule-composition连续正式起手/选位，逐边界branchKey、每输入计划及外层动作链保留，
新普通起手重置条件深度。旧信息遮蔽保持，新屏障及奖励Decision停止。AI/RL说明
已同步在候选工作树。没有调整评分、4096/256/30秒或正式规则。

## 已验证与失败

- 语法及diff检查通过，V输入审计通过。
- 新共识测试通过：来源不变、混合目标/首根拒绝、奖励停止、既有遮蔽不变、错误
  席位显式报错。初次测试把错误席位误写成返回null，实际正式选择器按既有契约抛错；
  仅修正测试为assert.throws，未修改生产来吞错。
- 支付和预算unit通过，唯一full-flow通过。strategic-goal-evaluator仍在既有
  “分析目标释放”断言失败；没有改该通用断言，也不声称整文件或全量通过。
- 真实53根定向边界实验完整执行4096节点，规则失败{}；带Inspector，不是冷性能。
  与新建fork恢复后独立提交的完整状态对照失败：主要差异为sessionId及派生effect/
  group编号27对1。失败原始记录data-continuation-boundary-candidate-20260908.json保留。
  未完成计划、完整RNG等价或冷性能验收，没有运行新完整局。

## 未修改基线的独立复现

`reproduce-session-sequence-isolation-20260908.js`在未修改483fc706执行，无AI搜索：
固定同一envelope和同一resetBranch种子，均以inPlace恢复后提交同一place_data。
两次Action完全相同，committedState和workingState相同，但Session分别为
effect-session-1与effect-session-2，完整envelope不相同。
原始前置及两次完整envelope：session-sequence-isolation-483fc706-20260908.json。

源码：session-runtime的nextSessionSequence是运行实例闭包计数，不在composition
save envelope中；inPlace restore保留runtime，普通restore通过installStore重建它。
首次连续对照使用新建fork/普通restore，因此1对27本身不能证明本轮生产融合错误；
但基线同实例固定输入复现已经证明，完整快照未包含这个影响后继会话身份的状态。
rule-composition.sessionKeyHash保留sessionId/queue/journal，branchKey使用完整
envelopeHash：该差异不能简单从状态键删去，也不能忽略为无关日志。

下一步：独立处理会话身份的恢复/分支隔离义务，覆盖新Action、活动Decision、错误
提交和Browser/Simulation共用路径；不得在数据融合里加计数器重置或环境特判绕过。
先保持本候选完整方案和失败证据，不把它作为已验收优化；未证明该缺陷导致历史
白方下降或均分变化，不据此替历史降分归因。整体Goal继续，尚非权限/外部阻塞。

文档检查：候选AI/RL说明随实现更新；正式规则、README/AGENTS、存档schema尚未
修改，不更新成已完成口径。当前不修改长期记忆。生产验收未通过，暂不提交候选代码。
