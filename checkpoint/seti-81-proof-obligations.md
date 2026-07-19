# SETI-81 Browser Services / 最终 Browser Host proof obligations

| ID | 可证伪命题 | 最小反例 | 证据 |
|---|---|---|---|
| S81-01 | 持久化 state 只能来自 `StateStore.serialize()`，session/view 使用独立 schema | 从 DOM 或 legacy slice 拼存档 | `browser-services.test.js` 分 schema round-trip；Browser Services 不接收 DOM/领域 slice |
| S81-02 | state/session/view 在任何恢复 mutation 前全部预验证 | session checkpoint 损坏但 state 已被替换 | 无效 session 负向测试断言 state/session restore 调用均为 0 |
| S81-03 | ViewState 清空或恢复不改变权威 state/session | overlay 状态决定 continuation | ViewState 独立 restore；StateStore bytes 与 session checkpoint 只经各自 port |
| S81-04 | refresh 是提交/session 事件的只读订阅者，异常不影响提交 | renderer 抛错造成 CAS 回滚 | refresh 抛错 poison 后 StateStore 仍提交到下一 version |
| S81-05 | download 只消费显式格式化内容 | download port 获得 StateStore 或隐藏牌序 | 无 `content` 请求 fail-closed；port 只收到 filename/content/mimeType |
| S81-06 | debug/failsafe 与 public API 只经独立 command/facade | public API 泄漏 mutable store/session | frozen facade 无 store/session 引用；debug command port spy |
| S81-07 | headless/runtime 导入不访问浏览器 service | Node import 读取 localStorage/document | Browser Services 构造前无浏览器全局读取；Node poison/全量回归 |
| S81-08 | legacy inventory 在迁移完成后可整体删除 | host-only 豁免继续借用旧 pending schema | runtime 负向结构测试 + HTML/生产零引用 |
| S81-09 | 七类正式 UI 的既有领域证据在最终装配仍成立 | 单项 Node 通过但主页面脚本缺失 | 全量 Node + Browser Host Chrome main/decision/recovery smoke |

阶段 8 的恢复入口使用显式 `stateRestorePort.restore(validatedCommittedState)`，因为 `StateStore` 故意不暴露绕过 CAS 的原地替换；具体宿主在建局/加载边界替换 authority。旧 `game-recovery.js` 投影回 legacy slice 的生产兼容入口由 SETI-88 在本阶段接口稳定后删除，不得包装成新 Browser Services 的第二真相。

## 验证结果

- 私有索引独立快照：`node --check randomizer/app.js` 与全量 Node `162/162` 通过。
- 共享工作树：排除 SETI-92 正在修改的 4 个 Heuristic baseline/contract 测试后 `155/155` 通过；4 个失败在独立快照均通过，不属于本提交。
- inventory：本阶段曾验证 52 项分类；SETI-72 最终收口已删除该迁移期 inventory、旧 pending 创建入口和专项 audit。
- Chrome recovery：`browser-services.browser-smoke.html` 返回 `ok=true`，state/session/view 分协议恢复且 facade frozen。
- Chrome Decision：研究科技固定 trace `rotate -> place:blue2:slot-b -> reward:score:3`，一次 commit，旧 continuation 调用为 0。
- Chrome 完整对局：seed `seti81-chrome-complete`，894 步正常终局，blocked=false、bugCount=0，比分 97/129/192/94。
