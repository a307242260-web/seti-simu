# SETI-72 最终验证

## 结论

Browser Host 阶段 1～9 的契约、生产装配和代表性热路径已经完成。正式 HEAD 的 Effect legacy inventory 当前仅有 2 项明确 host-only、0 项 dated adapter；SETI-72 管理的 dated adapter 已全部清零，满足关闭门禁。

## 本轮发现与修复

- 总 Browser Host Chrome smoke 漏载 `card-decision-ui.js` 与 `browser-services.js`，导致 facade 初始化失败；提交 `0833de1` 已补齐脚本顺序。
- `createAiController()` 在 Card Trigger runtime 初始化前按值注入 5 个函数，完整对局触发 `handleCardTriggerChoice is not a function`；改为延迟 wrapper，并新增装配回归测试。
- Card Trigger 任务完成 picker 使用 `getPendingOwnerFields`，但 runtime context 未声明/注入；已补齐显式 context。
- 后续按同一领域连续迁移 card/trigger、alien、company 等兼容链，提交 `47687e0`、`96c2533`、`82679e6`、`71d9091` 和 `5c02439`，最终删除全部 dated adapter。

## 分层证据

- 语法：`node --check randomizer/app.js` PASS。
- 全量 Node：最终清零提交的隔离 HEAD 执行 `node tools/run_node_tests.js`，`passed=170 failed=0 total=170`。
- Effect legacy audit：`total=2`、`hostOnly=2`、`datedAdapters=0`，且 `unknownFields=[]`、`missingFields=[]`、`expiredAdapters=[]`。
- State authority audit：PASS；2 个残余 state adapter 均有 owner、到期日和删除条件。
- Chrome 代表页：Browser Host 总 smoke、Browser Services recovery、研究科技 Decision、打牌/支付/触发、扫描/数据/登陆、公司/外星人、Policy 输入、Effect Session host 与 StateStore Session 均返回 `ok=true`。
- Chrome 完整对局：最终清零 seed `seti72-final-zero` 返回 `ok=true`、`blockedGames=0`、`bugCounts={}`。
- 提交隔离：清零迁移提交为 `47687e0`、`96c2533`、`82679e6`、`71d9091`、`5c02439`；所有最终审计与门禁均基于隔离的正式 HEAD，未纳入共享工作树中的其他未提交改动。

## 残余风险与删除条件

- Effect legacy inventory 保留的 `passReserveSelectionDismissed` 与 `scanRunSequence` 是 Browser Host 内部字段，不是 dated adapter；若其所有权或调用边界改变，必须重新分类并由审计拦截。
- State authority audit 仍报告 2 个由 SETI-71 管理的 dated state adapter；它们不属于 SETI-72 的 Effect legacy inventory，也不影响本 issue 的 dated adapter 清零结论。
- 本 checkpoint 不把 inventory 清零等同于全仓 legacy 零引用，也不把一局 Chrome 终局等同于所有规则状态完备；全称/否定命题仍由各阶段 proof、结构扫描和 170 项 Node 合约共同承担。
