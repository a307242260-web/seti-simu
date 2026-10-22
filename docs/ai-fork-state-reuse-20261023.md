# 分支已提交状态复用

本项只减少恢复和保存的重复工作，不改变搜索v21的探索空间、证明、默认V或预算。
Browser与Simulation继续共用Production内核；普通宿主的保存校验和复制路径不变。

## 所有权与失效

分析端口按完整`envelope.committedState`字符串保留最近一份JSON解码，并递归冻结。
稳定节点的身份与纯证明共用该树，pending身份仍读取自身Session的workingState。
恢复时通过已有`trustedState`参数向隔离StateStore提供冻结根，避免重新解析、克隆和冻结同一状态。
`beginWorkingCopy`仍完整复制，Session恢复仍复制，不能共享可写工作树或Session。

相同stateVersion不代表同一状态；任一已提交字节变化都替换解码。缓存最多1项，关闭端口释放。
首次恢复前后若字节变化，必须重新解码；不能为提高命中率忽略假设世界、RNG或规范化差异。
诊断新增`committedDecodeCount/committedDecodeHits`，打开根时清零。

仅`trustedIsolatedOwnership`下的`serializeForkSnapshot`缓存最近一份canonical序列化。
键是完整冻结committed对象身份；成功提交、普通恢复和fork恢复换根后重新计算。
失败提交不换根，不改变已缓存字节；工作副本修改不影响缓存。
普通宿主不启用该序列化缓存，也不直接把外部envelope字符串冒充canonical输出。
缓存保留至多一个旧根和一个字符串，不积累历史状态；端口关闭后隔离store一并释放。

## 证据和边界

[固定输入对照](../reports/ai-foundation-20261023/fork-state-reuse-comparison-v1.json)在三个真实冷根
分别执行256个正式输入，完整搜索图排除唯一耗时字段后摘要逐项相同，正式根保持不变。
修改前运行时来自`b1566ffa`；修改后仅analysis-port和state-store两个导入模块不同。

| 检查点 | 整状态解析：前→后 | 整状态克隆：前→后 | 含统计包装耗时ms：前→后 |
| --- | --- | --- | --- |
| 062 | 375→272 | 426→230 | 456.54→390.74 |
| 105 | 353→250 | 399→217 | 443.98→387.34 |
| 152 | 314→242 | 344→178 | 504.25→437.73 |

计时覆盖搜索调用，不含内核初始化和打开根。这三个图仍未闭合。统计包装有成本，
15秒诊断watchdog只用于收齐相同256输入，不能用作600毫秒
门槛或整局性能证据；节点、前沿和输入额度未增加。

[未加包装的八点复测](../reports/ai-foundation-20261023/decision-corpus-audit-v14.json)维持生产
256输入/257节点/256前沿/600毫秒，仍4/8通过。三个中后期根约353/395/446毫秒，
都因输入额度耗尽而非时间停止。后续必须减少必要计算量，单纯优化状态处理不能解决覆盖缺口。

验证覆盖同版本不同根、成功/失败提交、普通/受信任恢复、工作副本隔离、不同pending信封的
相同committed bytes复用及关闭释放。完整Node、相关Chrome和估值输入审计见
[验证记录](../reports/ai-foundation-20261023/fork-state-reuse-validation-v1.json)。
尚无新搜索完整局、终局分数或四席180秒验收。
