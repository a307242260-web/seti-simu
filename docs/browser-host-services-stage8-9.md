# Browser Host 阶段 8/9：Services、恢复与最终 Parity

`randomizer/app/browser-host/browser-services.js` 将 local persistence、恢复、下载、
debug/failsafe、public facade 与提交驱动刷新收口为独立宿主端口。持久化 envelope 固定为
`seti-browser-services-v1`：committed state 只能来自 `StateStore.serialize()`，活跃 Effect
Session checkpoint 与可选 `ViewState` 分别保留自身 schema，不从 DOM、renderer 或宿主
交互状态反推规则事实。

恢复先对 state/session/view 全部预验证，再调用显式 `stateRestorePort`、session restore port
与 `ViewStateStore.restore`。任一 schema 或 checkpoint 无效时，所有 restore port 调用均为
0。下载端口只接受显式 `filename/content/mimeType`；debug/failsafe 只提交冻结 command；
public facade 为冻结方法集合，不泄漏 mutable authority。StateStore/session 的订阅只触发
刷新，renderer 抛错不会回滚已经成立的提交。

最终证据见 `checkpoint/seti-81-proof-obligations.md`：Browser Services 的 Node 与真实 Chrome
恢复 round-trip 通过；ViewState 清空/恢复、stale/隐藏信息、Action Bar、通用 Decision、
公司/八外星人、扫描/数据/登陆、卡牌与 Policy 输入由阶段 1–7 的 registry 合约覆盖。真实
Chrome 4 席完整对局以固定 seed 推进 894 步正常终局，`blocked=false`、`bugCount=0`，四席
得分为 97/129/192/94。

最终 authority inventory 只保留 4 个正式组件：CommittedGameState、card task 派生索引、
setup session 与 Browser ViewState；每项都有明确 owner/source/target。恢复直接使用当前
StateStore schema，生产装配不存在状态转换器、豁免表或第二套切片。
