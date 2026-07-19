# SETI-87 Stage 7 Proof Obligations

| ID | 可证伪命题 | 最小反例 | 责任点 | 证据 |
|---|---|---|---|---|
| S7-01 source | 空闲宿主只读 committed，活跃 session 只读 working | renderer 混读旧 pending 与 committed | `host-source.js` | committed/working source、冻结与污染测试 |
| S7-02 commit | headless 每条完成 session 只触发一次 CAS | executor 先写正式状态，session 再提交 | `headless-effect-session-host.js` | 真实 StateStore commit counter、version +1 |
| S7-03 refresh | commit listener/renderer 异常不改变提交 | renderer poison 导致 CAS 失败 | StateStore subscription / browser host | poison refresh 后 committed bytes 与 version 正确 |
| S7-04 parity | 同 state/action/decision/RNG journal 的宿主差异不改变事实 | projection 字段进入 candidate | source/projector + Effect Session | browser/headless projection 同源、固定 trace state/journal parity |
| S7-05 checkpoint | 非零 Decision checkpoint 恢复 observation/legal/cursor/RNG 等价 | pending 被净化后 choices 消失 | DecisionEffect payload / checkpoint | `headless-env.test.js` 非零 fork 深等价 |
| S7-06 forbidden | 已迁移 headless 不调用 resolver/recover/skip/DOM | 未知 pending 自动取首项 | headless host fail-closed | source scan + unknown pending runtime spy=0 |
| S7-07 derived | observation/展示差异不能成为规则事实 | cardName/player label 恢复后改变 action | observation sanitizer | host-only 字段排除、legal/terminal/replay 回归 |
| S7-08 integration | 固定 seed 能完整终局且吞吐无明显失效 | session 永久 awaiting 或每步重启 | headless env/worker | 完整对局 integration + benchmark |

Stage 7 只关闭宿主 source/observation 路径；全仓旧切片和 adapter inventory 的删除条件由 SETI-88 验收。
