# 完整投影冻结可变规则状态：独立缺陷

状态：已复现，待独立修复；不混入61cc94af取消修复的完整局实验。

## 对照证据

`inspect-projection-freeze-471-20260907.js`复用真实471检查点，只改变正式取消前
的投影读取方式。`projection-freeze-471-20260907.json`：不读取、simulation-cheap、
player-full、player-cheap都成功；只有simulation-full随后报
EFFECT_SESSION_COMMIT_THROWN：stateVersion只读。读取前后的序列化envelope
仍相同，说明只比较JSON值不足以发现冻结副作用。

## 已读源码关系与修复义务

Rule Composition启用trusted fork时，Session.observe可把working state直接传给
projectState；Production adapter启用trustedProjectionReader时只浅展开state。
simulation完整视图保留meta等引用，projectionInner的deepFreeze冻结观察同时
冻结了session内部meta。后续commit写stateVersion才失败。玩家视图经过
buildObservation形成独立值，本样本未受影响，不能据此声称其他路径绝对安全。

修复应在完整投影快照的所有权边界隔离可变源后再冻结，不取消冻结，不屏蔽写入
错误，不按本次species/cancel特判。明确idle committed/active working、完整/cheap、
玩家/全量视图、trusted/普通装配各边界；cheap内部临时只读用途不能冒充可持有的
完整快照，完整快照后续不能因继续执行而变化，也不能冻结规则状态。

验收：真实471四种读取方式与不读取结果一致；完整快照持有后继续输入、恢复、
二次读取均保持旧快照不变，RNG/序号/完整状态与无读取路径相同。正常玩家搜索
单决策须测实际开销，不靠移除公共投影功能规避。修复后单独中文提交和完整局登记。
当前没有生产改动，不声称任何一项义务已由本对照覆盖全部状态。
