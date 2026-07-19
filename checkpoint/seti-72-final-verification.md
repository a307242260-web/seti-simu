# SETI-72 最终验证

## 结论

Browser Host 阶段 1～9 的契约、生产装配和代表性热路径已经完成，满足 SETI-72 的关闭门禁。旧 UI/`pendingState` 兼容代码没有全部物理删除：legacy inventory 当前为 52 项，其中 2 项 host-only、50 项 dated adapter，owner 为 `SETI-72/browser-host-stages-5-9`，到期日为 `2026-08-31`。

## 本轮发现与修复

- 总 Browser Host Chrome smoke 漏载 `card-decision-ui.js` 与 `browser-services.js`，导致 facade 初始化失败；提交 `0833de1` 已补齐脚本顺序。
- `createAiController()` 在 Card Trigger runtime 初始化前按值注入 5 个函数，完整对局触发 `handleCardTriggerChoice is not a function`；改为延迟 wrapper，并新增装配回归测试。
- Card Trigger 任务完成 picker 使用 `getPendingOwnerFields`，但 runtime context 未声明/注入；已补齐显式 context。

## 分层证据

- 语法：`node --check randomizer/app.js` PASS。
- 全量 Node：隔离 HEAD + 本次补丁执行 `node tools/run_node_tests.js`，`passed=164 failed=0 total=164`。
- Effect legacy audit：52 项，`unknownFields=[]`、`missingFields=[]`、`expiredAdapters=[]`。
- State authority audit：PASS；2 个残余 state adapter 均有 owner、到期日和删除条件。
- Chrome 代表页：Browser Host 总 smoke、Browser Services recovery、研究科技 Decision、打牌/支付/触发、扫描/数据/登陆、公司/外星人、Policy 输入、Effect Session host 与 StateStore Session 均返回 `ok=true`。
- Chrome 完整对局：seed `seti72-final`，4 席，修复后 `ok=true`、`gamesRun=1`、`blockedGames=0`，最高分 188、最低分 55。
- 提交隔离：共享工作树首轮为 157/160，3 个失败来自其他未提交 AI/baseline 改动；相同 HEAD 的隔离 worktree 为 163/163，本次补丁后为 164/164。提交 `0833de1` 仅含 4 个 SETI-72 文件。

## 残余风险与删除条件

- `randomizer/app.js` 仍有 413 处 `pendingState.` 访问；它表示 legacy 物理清理未完成，不影响本次“有期限 adapter 可关闭”的明确契约判断。
- 50 个 dated adapter 必须在 `2026-08-31` 前按 inventory owner 继续删除或重新评审；到期后 `tools/audit_effect_session_legacy.js` 会失败。
- 本 checkpoint 不把 inventory 合规等同于 legacy 零引用，也不把一局 Chrome 终局等同于所有规则状态完备；全称/否定命题仍由各阶段 proof、结构扫描和 164 项 Node 合约共同承担。
