# Canonical Rule Composition

`randomizer/game/rule-composition.js` 是 Browser 与 headless 共用、且不依赖宿主环境的规则装配边界。它直接用 `seti-committed-game-state-v1` 根创建唯一 `StateStore`，把 Standard Action 校验、Effect Queue、Decision 和 Session journal 接到同一条提交链。

规则 Action definition、Effect Group builder 和 Effect executor 都显式接收当前 Session 的 canonical working root。composition 不保存或公开 `players`、`turn` 等规则切片引用，也不公开 `beginWorkingCopy`、`compareAndCommit`、`runTransaction` 或 raw Session。宿主只能读取 committed snapshot/投影并提交 Standard Action、Quick Action 或 Decision 输入。

一次顶层 Action 打开一个短生命周期 Effect Session。Decision 和 Quick Action 继续使用该 Session 的 working root；queue 清空前 committed serialization 保持不变，完成时由 Session 对唯一 StateStore 执行一次 CAS。stale、非法输入或执行失败不会提交候选 root。

恢复分为两个明确边界：idle 时可用 `restoreCommittedState()` 恢复 StateStore serialization；进行中的规则流程只用 `createCheckpoint()` / `restoreCheckpoint()` 恢复 Effect Session，且 checkpoint 的 `baseVersion` 必须仍等于当前 committed version。
