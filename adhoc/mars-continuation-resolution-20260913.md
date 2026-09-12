# 火星续搜测试：预算截断与提前停止的区分

独立fixture诊断见mars-continuation-20260913.json（源码595105de阶段，未加根动作归属字段）。
火星根12个goal-completed叶，深度1；根结果settled且incomplete，原因information-barrier/
node-budget。执行4096节点后剩249节点，包含end_turn；仅凭全局队列不能断言归属火星根。

开启现有goalClusters诊断后，该根没有已执行的后续目标，不能声称它已经执行了续搜。
新增frontierNodeBreakdown.rootActionIds（纯诊断，不改队列/排序），直接核对队列来源。
最终测试要求至少满足：更深完整叶；或火星目标之后确有已执行目标；或仅含火星根
这一来源且proxyDepth>=1、chainDepth>=4的实际待执行节点。后一情况还必须根结果
明确标node-budget不完整、实际execution预算截断，不以其他根的预算耗尽代替证据。

最终综合simulation-counterfactual-outcome unit通过（24.46s），唯一standard-flow通过，
规则源码语法通过。没有提高预算、没有将frontier算收益或已执行叶、没有删除继续规划要求。
本测试验证的是“继续执行或有据可追溯地等待预算”，不宣称预算截断专项已经完成。

节点投影性能候选仍按1580566e无插桩23.56秒及6701叶逐一等价证据验收前置门槛；
后续新增根归属字段仅用于诊断，完整局受测提交另行登记，不混淆指纹。
下一步评估输入审计、实验查重后运行唯一完整局；规则修复与性能改动分别记录贡献。
