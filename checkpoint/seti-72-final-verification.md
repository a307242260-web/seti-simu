# SETI-72 最终验证

## 结论

Browser Host 阶段 1～9 的契约、生产装配和代表性热路径已经完成。旧 `pendingState` 容器、Effect legacy inventory、专项 audit 与浏览器脚本接线已物理删除；两项原 host-only 状态已迁入正式 `runtime.ui` / `runtime.browserHost`。

## 本轮发现与修复

- 总 Browser Host Chrome smoke 漏载 `card-decision-ui.js` 与 `browser-services.js`，导致 facade 初始化失败；提交 `0833de1` 已补齐脚本顺序。
- `createAiController()` 在 Card Trigger runtime 初始化前按值注入 5 个函数，完整对局触发 `handleCardTriggerChoice is not a function`；改为延迟 wrapper，并新增装配回归测试。
- Card Trigger 任务完成 picker 使用 `getPendingOwnerFields`，但 runtime context 未声明/注入；已补齐显式 context。
- 后续按同一领域连续迁移 card/trigger、alien、company 等兼容链，提交 `47687e0`、`96c2533`、`82679e6`、`71d9091` 和 `5c02439`，最终删除全部 dated adapter。
- owner 明确要求不保留旧字段白名单后，删除剩余 legacy schema/audit，并清理生产装配中的无效 `pendingState` 注入；探测器位置奖励的旧字段写入改为复用标准 Decision Session helper。

## 分层证据

- 语法：`node --check randomizer/app.js` PASS。
- 全量 Node：删除旧 inventory test 后的隔离快照执行 `node tools/run_node_tests.js`，`passed=169 failed=0 total=169`。
- 结构删除门禁：旧 inventory 文件、旧 test、旧 audit tool、HTML script 与生产 `runtime.pending` 均不存在；`runtime.test.js` 固化该负向契约。
- State authority audit：PASS；2 个残余 state adapter 均有 owner、到期日和删除条件。
- Chrome 代表页：Browser Host 总 smoke、Browser Services recovery、研究科技 Decision、打牌/支付/触发、扫描/数据/登陆、公司/外星人、Policy 输入、Effect Session host 与 StateStore Session 均返回 `ok=true`。
- Chrome 完整对局：seed `seti72-legacy-container-zero` 返回 `ok=true`、`gamesRun=1`、`blockedGames=0`，胜者 146 分、最低席位 75 分。
- 提交隔离：清零迁移提交为 `47687e0`、`96c2533`、`82679e6`、`71d9091`、`5c02439`；所有最终审计与门禁均基于隔离的正式 HEAD，未纳入共享工作树中的其他未提交改动。

## 残余风险与删除条件

- `passReserveSelectionDismissed` 只能作为可丢弃 UI 状态；`scanRunSequence` 只能作为宿主 journal identity。若其开始决定规则，必须迁入共享 Session，而不是恢复旧 pending/inventory。
- State authority audit 仍报告 2 个由 SETI-71 管理的 dated state adapter；它们不属于 SETI-72 的 Effect legacy inventory，也不影响本 issue 的 dated adapter 清零结论。
- 本 checkpoint 不把单次结构扫描或一局 Chrome 终局等同于所有规则状态完备；全称/否定命题仍由各阶段 proof、结构扫描和全量 Node 合约共同承担。
