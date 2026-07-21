# SETI-115 既定组合架构独立复核

## 结论

在独立 `origin/dev` HEAD `9c4a0c5` 上，行为回归与真实 Chrome 完整局均通过，但既定组合架构 **FAIL**。当前生产代码仍有第二份长期可变规则图、Effect Session 外提交、root/切片双向桥，以及机器人借用网页 composition/recovery 的可达路径；因此不得以 SETI-112 冻结审计的 `0 violation`、SETI-114 `done` 或全量 Node 绿灯宣称架构完成。

## 可证伪义务结果

| 义务 | 结果 | 独立证据 |
|---|---|---|
| 网页 UI 与机器人只提交输入 | FAIL | `app.js:270-281` 从 `getActiveSession().workingState` 长期取得 10 个可变规则切片；`app.js` 后续仍直接修改这些引用。 |
| 内部只有唯一 Action → Effect Queue ↔ Session 主链 | FAIL | `browser-state-authority.js:122-156` 的 `runTransaction(mutator)` 允许直接修改长期 `sessionState`，随后调用 `settle()`，未经过 Standard Action registry 或 Effect Queue。 |
| Session 进行中只修改同一短生命周期 Session 状态 | FAIL | `browser-state-authority.js:42-48` 创建常驻、始终为 `phase: "open"` 的 `activeSession.workingState`；该对象在 app 生命周期中保持引用 identity，不是 `session-runtime.js` 的按 Action 创建/终止 Session。 |
| Session 完成后只提交一次统一权威状态 | FAIL | `browser-state-authority.js:78-98` 的 `settle()/serialize()` 可在 Effect Session 外直接 `compareAndCommit`；模块还在 `:159-179` 暴露 raw `compareAndCommit`、`settle` 与 `runTransaction` 三条提交/写入端口。 |
| 不存在切片/root 拼装或恢复回填 | FAIL | `initial-game-state.js:38-60` 把长期切片拼成 committed root；`:63-97` 又把 root 回填到相同切片对象。`browser-state-authority.js:50-58,114-119` 在产品外延调用这两座桥。 |
| 机器人不借用网页装配/恢复获得规则能力 | FAIL | `headless-env.js:60-82,444-468` 从 `randomizer/index.html` 加载整套网页脚本并执行 `app.js`；`:495-526` 通过网页 `createRecoverySnapshot/restoreRecoverySnapshot` 在独立 headless StateStore 与网页状态间往返。 |
| 改名、wrapper、proxy 反例会被门禁抓住 | FAIL | 用 SETI-112 `baec071` 冻结版 `browser-authority-hard-cut-audit` 扫描当前 HEAD 返回 `198 files / 0 violations`，但其 capability chain 同时列出 `browser-state-authority.js` 的 authority、write、commit、restore。门禁把含 `beginWorkingCopy + compareAndCommit + baseVersion` 的整个模块视为 transaction kernel，并只识别特定 destructuring/同文件桥，因而漏掉本次改名与跨文件搬迁。 |
| 固定 UI/Policy 输入走同一 adapter 并保持 Effect/journal/final state | PASS（局部契约） | `policy-input-adapter.test.js` 固定 Action/Decision trace 比较玩家与 Policy 的 submissions、journal、final state；`headless-effect-session-host.test.js` 比较 Browser/headless Effect/journal 顺序。但这些合约没有覆盖上述生产 `app.js` 旁路。 |
| 非法/stale/失败输入零污染、Session 单提交 | PASS（Session kernel） | `state-store-session.test.js` 与 Effect Session 定向合约通过；该结论只证明内核正确，不证明生产只能到达内核。 |
| 存档恢复、全量 Node、真实网页机器人完整推进 | PASS（行为） | 见下方验证；行为可跑不抵消 owner/依赖方向失败。 |

## 审计反例

SETI-112 冻结 scanner 对当前 HEAD 的结果：

```text
ok=true
scannedFiles=198
violations=[]
capabilityChain includes:
  browser-state-authority.js authority createBrowserStateAuthority
  browser-state-authority.js write runTransaction
  browser-state-authority.js commit compareAndCommit
  browser-state-authority.js restore restore
```

这构成“扫描绿但生产旁路可达”的反例。尤其 `browser-state-authority.test.js` 当前主动断言 `runTransaction()` 能直接改玩家资源并使 authority version `+1`，以及恢复后长期 `playerState` 引用 identity 不变；测试固定的正是验收所禁止的第二 owner，而不是其删除。

## 验证

隔离 worktree：`9c4a0c5d255711d2fd6fdc12c71df42f740e6121`。

- `node --check randomizer/app.js`：PASS。
- `node tools/run_node_tests.js`：PASS，unit `132/132`，fullFlow `1/1`。
- `node randomizer/full-flow/standard-flow.test.js`：PASS；固定 40 步 trace，最终 `stateVersion=58`、Effect Session 清空。
- 真实 Chrome：`node tools/run_ai_autobattle_browser.js --games 1 --seed seti-115-browser --maxSteps 2500 --lightweight ...`：PASS；`gamesRun=1`、`blockedGames=0`、`steps=509`、完整终局，分数 `45/55/39/51`。
- SETI-112 冻结 hard-cut library 对当前 HEAD：**假绿**，`198 files / 0 violations`，但 capability chain 暴露上述旁路。

## 决策

本组合复核完成，结论为 FAIL。SETI-111 不可收口；后续实现必须物理删除网页长期 `workingState` owner、`settle/runTransaction` 外部提交链、跨 schema 拼装/回填，以及 headless 对网页 bundle/recovery 的借用，然后重新执行本矩阵。仅加强或恢复字符串扫描、改名 wrapper、移动桥函数、保留绿灯均不满足验收。
