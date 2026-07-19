# SETI-86 StateStore × Effect Session proof obligations

| 验收条款 | 可证伪命题 | 最小反例 | 唯一责任点 | 证据 |
|---|---|---|---|---|
| session 使用同 schema working copy | store snapshot 为 v1 时，session base/working 逐字段同 schema且互不共享引用 | executor 修改 working 后 `getSnapshot()` 同步变化 | `dispatchStoredAction` → `beginWorkingCopy` | drain 前 canonical committed bytes 不变 |
| 仅在稳定边界 CAS | queue 非空、awaiting input、abort 或 barrier failure 时 `compareAndCommit` 调用为 0 | 第一个 Effect 后提前提交 | runtime `commit()` | compare spy + queue/decision/failure tests |
| 同版本只允许首写 | 两个 session 同 baseVersion，只有首个完成，次个返回 `STATE_VERSION_CONFLICT` | stale session 覆盖 turn | StateStore `compareAndCommit` | 双 session race |
| 多切片全有或全无 | 研究科技、卡牌、盘面链成功后所有相关切片同时可见；任一步失败 committed bytes 不变 | supply 已减但玩家 tile 未增加 | session working root + CAS | 三条代表链 + 逐研究步骤 poison |
| completed 与 store 事件一致 | session 只有 CAS 成功后进入 completed，committedState 等于 commit event snapshot，event metadata journal 等于 session journal | runtime 先 completed、宿主 CAS 冲突 | runtime store-backed commit | commit event/journal exact assertions |
| 禁止旧直写 | 已迁移链 `legacyDirectWrite` spy 恒为 0，唯一写调用是 CAS | executor/host 直接替换 committed slice | StateStore port | runtime spy + source contract |
| invariant/barrier fail-closed | invariant 失败与 barrier 后异常都不修改 store；后者进入 irreversible_locked | hidden reveal 后把 working 当 committed | abort/barrier + CAS gate | canonical bytes + phase assertions |

验证入口：`randomizer/game/effects/state-store-session.test.js` 与 `state-store-session.browser-smoke.html`。
