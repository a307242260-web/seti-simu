# SETI-109 Browser Projection / recovery proof obligations

| ID | 可证伪命题 | 最小反例 | 唯一落点 | 证据 |
|---|---|---|---|---|
| P1 | 常驻投影只接受规范 BrowserProjection 或 StateSource，不读取传统 slice key | 给 `playerState/turnState/cardState/solarState` getter 装 poison 后渲染，或直接把传统 key 传入 API | `browser-host/resident-projection.js` / `projection-adapter.js` | 结构化拒绝 + poison getter + DOM 重建测试 |
| P2 | projection id/source 只由 committed/session 版本事实生成，不存在 legacy identity/fallback | 省略手工 id 后出现 `legacy-resident`、`legacy-adapter` 或 working 常量身份 | ProjectionAdapter | exact source identity 断言 + 禁用符号扫描 |
| P3 | 常驻 renderer、action/decision input 与 public/debug 读取共享同一只读 projection；ViewState/renderer 不调用规则端口 | renderer/ViewState 重建触发 enumerate/commit，或 public getter 直接返回可变规则 slice | Browser Host composition / public API | rule-port poison、projection getter contract |
| R1 | 合法恢复只调用唯一 resident StateStore 的 `restore()`，不创建 validation store；恢复版本保持快照事实 | restore 时第二次调用 store factory，或通过 CAS 把恢复版本额外 +1 | StateStore / BrowserStateAuthority / GameRecovery | store creation counter + restore event/version test |
| R2 | 旧、缺失、未知 schema/version 在任何 restore port 调用前 fail-closed | 未支持 envelope 仍调用 state/session/view restore | GameRecovery / BrowserServices validation | call counter 恒 0 |
| R3 | state/session/view 恢复为同一原子 checkpoint；任一步失败回滚三者，前后 bytes 相同 | session 或 ViewState restore poison，StateStore 已被替换 | BrowserServices restore transaction | state/session/view before/after byte equality |
| R4 | action-log recovery 与 local persistence 复用同一 StateStore/session/ViewState envelope，不接受旧存档 | 日志和 localStorage 各自保存不同 schema 或 silent fallback 到 `snapshot` | GameRecovery / BrowserServices | common envelope round-trip + legacy package rejection |
| I1 | stale/越权 Action/Decision identity 提交后 state/journal 不变 | projection 刷新后提交旧 actionId/decisionVersion | Input Adapter / Policy Input Adapter | stale/owner negative tests + byte equality |

## 分层验收

- 结构：传统 slice key、legacy identity、临时 store factory 和旧存档 fallback 均有负向扫描/断言。
- 合约：StateSource committed/session identity、StateStore restore、Browser Services 三端原子恢复。
- 代表路径：常驻 renderer poison getter、人类输入 stale/越权、行动日志与本地保存恢复。
- 集成：全量 Node、独立提交快照与真实 Chrome 人类/机器席位 smoke。
