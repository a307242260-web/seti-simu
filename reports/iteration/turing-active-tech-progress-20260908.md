# 图灵重复能力剪枝进度（2026-09-08）

生产提交cbf7966f，候选位于/private/tmp/seti-turing-active-tech-20260908。
按当分支有效永久科技筛选，启用与选择共同处理；强制全重复Decision仍保留一个结算，
其他公司及失效科技不误删。公共观察提供正式公司能力编号，Action及存档身份不改。

已通过新增unit、正式输入回归、唯一full-flow及V输入审计；新增unit在旧生产上复现失败，
修复后通过。补充跨席位测试曾误用旧focalSeatId，被原越权检查正确拒绝，已修正测试席位。
未运行全量Node或真实Chrome smoke。

单点161根状态相同，物理节点4096→3654，输入8172→7194，
用时17525.10→15846.43ms；优胜27步与正式重放终态相同。
借橙2/紫4选择从75/78→0，全部借用604→490（队列补位后其他科技增加）。
executionLimitReached=false，remainingFrontierNodeCount=0；
仍有beamPrunedOriginCount=2013，不能称穷尽全部合法状态。
借橙4后只放数据仍在，需求式用途绑定未完成。

已查重并通过标准入口启动turing-active-tech-20260908完整局；尚无终局结果，
不提前登记为通过。原始单点证据在候选reports/iteration/blue161-turing-active-20260908.json，
完整局结束后同步正式版本与原始记录。整体Goal保持原目标与108.5底线，
与父版均111比较，下降须解释。

文档已随生产更新ai-design与rl-simulation-env；无入口、构建、规则执行或目录职责变化，
README/AGENTS与node-testing不需更新，测试已登记inventory。未修改项目记忆。
