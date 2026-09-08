# 目标选择错误传播修复：进度

2026-09-08，独立分支fix/route-selection-error-20260908，工作树/private/tmp/seti-route-selection-error-20260908，实验生产提交70043d34。基于正确dev基线，不包含未通过的顺序或身份候选。完整局验收通过，已以7b4ce37f合入本地dev，尚未推送远端。

问题：rule-composition未绑定目标时调用selectRouteTarget；旧catch吞错并保留旧目标继续。当前机器人allowUntargetedRootActions=true，路径可达，不应把抛错当成合法null返回。

修改：回调异常立即传播原始错误并释放复用fork；释放同时失败时AggregateError保留两个错误；正常字符串/对象/null目标解析和所有预算、评分不变。不是数据组合取舍，不用于解释之前候选的降分。

验证：新增异常传播测试先在原代码失败。修复后，非复用和复用fork都传播同一个Error，根envelope不变，清理后旧监听器不再收到事件；释放同时出错的双错误保留也通过。5项搜索回归及唯一standard-flow通过。测试夹具原先误认为dispose后save必须报错，后又发现复用夹具缺少allowTrustedForkLifecycle，均按正式契约纠正，未为测试增加生产兼容路径。完整冻结方案与生产代码同在70043d34。

真实第24步单点已完成，证据route-selection-normal-20260908.json：11195ms，整条正式第24步记录（动作与after状态）相同，节点数、提交数、动作家族、Decision分类、执行截断状态均与1a061690.1501ebfd.full.json相同，规则失败0。

按标准入口先--list查重后，于70043d34完成route-selection-error-20260908唯一完整局，终端会话84136已exit 0，存档、记录和逐步报告均生成。终局613步，蓝/绿/棕/白74/105/115/113，均101.75；全部replaySteps及逐次非耗时搜索指标与正确基线一致。143252节点、182804输入、战略执行截断30/88、控制8/84，规则失败0；前沿裁剪字段两版均未保存，不能推断为0。耗时579822→571832ms，单次差异不宣称性能收益。证据route-selection-full-comparison-20260908.json，原记录c43c1f88.70043d34.full.json。异常传播独立通过，不代表第五轮提分、降节点或减少截断门槛通过。

本次不改变原Goal。将补数据组合与第五轮合并的顺序建议仍待用户答复，未获得授权，原顺序继续有效。
