# SETI 正式测试矩阵

本文是 SETI-140 Checkpoint A 的范围基线。测试从正式 owner 和可观察协议反推，不继承迁移阶段、文件布局或旧测试数量。

## 证据分层

| 类型 | 唯一职责 | 允许的证据 | 禁止的替代证据 |
|---|---|---|---|
| `unit` | 一个规则 owner、领域对象或窄端口的确定性行为 | 公共输入、返回 envelope、提交后的状态、journal/replay、可见 projection、调用端口次数 | 读取生产 `.js/.html` 后匹配文本、导出名枚举、文件存在性、函数名/行数/装配顺序 |
| `fullFlow` | 唯一版本化正式流程 | 固定初态、公共 Action/Decision 输入、最终 committed state、session journal 与 replay | 第二个整局、worker integration、固定 seed 报告或把 integration 改名为 unit |
| Chrome smoke | Browser Host 真实装配 | 页面启动、人类输入、projection、Policy 输入、save/recovery | Node DOM stub 代替真实浏览器装配 |

## Owner 测试矩阵与反例

| 正式 owner | 必须证明的行为 | 最小反例 | unit 落点 |
|---|---|---|---|
| StateStore | committed snapshot 隔离；版本单调；CAS 只接受同版本；restore 仅接受当前 schema | 修改返回 snapshot 污染 store；两个 working copy 连续提交；旧/未知/损坏 schema 被接受 | `game/state/state-store.test.js`、`host-source.test.js`、高低耦合 slice 行为测试 |
| Rule Composition | registry/runtime/store 只有一个提交 owner；Action/Decision 失败不污染 working/committed state；提交原子 | handler 抛错后 working state 留脏值；renderer 失败回滚规则提交；重复 CAS | `app/rule-composition.test.js` 改为纯端口行为；`game/effects/state-store-session.test.js` |
| Standard Action | identity 稳定；完整 family 可枚举、校验、执行；unknown/stale/越权零提交 | label 改变 actionId；旧版本 action 仍执行；未知 family 进入 fallback | 新的 `game/actions/standard-action.test.js`；规则细节继续由 `actions.test.js`、`quick-trades.test.js` 与外星人行为 unit 承担 |
| Effect Session | working copy 隔离；Decision owner/version；queue 顺序；journal/replay；undo/barrier；commit/abort/checkpoint | drain 代选多选项；stale Decision 改状态；barrier 后伪回滚；失败 effect 入 journal | `game/effects/session-runtime.test.js`、`session-journal.test.js`、`state-store-session.test.js` 及四类窄领域 session unit |
| Browser Host | projection 可见性与 ViewState 隔离；人类/Policy 都走正式输入端口；renderer 失败不改规则 | 隐藏字段泄漏；清空 ViewState 改 legal set；非法 Policy action 仍调用 submit；renderer 抛错撤销 commit | `app/browser-host/*.test.js`、`app/game-recovery.test.js`；新增 `browser-host/policy-input-adapter.test.js` |
| Simulation Host | rules-only；observation/action/replay/checkpoint parity；未知状态 fail-closed | 读取 DOM；非零 checkpoint 后 action 漂移；恢复时猜测旧 schema | `app/simulation-*.test.js`、`training/simulation-rule-composition.test.js` |
| Policy Port / Machine Player Host | schema/owner；deadline/cancel；迟到/重复/stale/非法 actionId 零提交 | 上一代响应提交到新 decision；timeout 后迟到结果落盘；Policy 返回 legal set 外 action | 新的 `game/ai/policy-port.test.js`、`machine-player-host.test.js` |
| persistence/recovery | 当前 schema round-trip；损坏、未知、旧 schema fail-closed；恢复不经 UI 猜测 | 缺 version 仍恢复；未知 root 被丢弃后继续；损坏 session 部分应用 | `app/browser-host/browser-services.test.js`、`app/game-recovery.test.js`、`app/simulation-state-checkpoint.test.js` |
| 唯一 full-flow | 同一正式 composition 经公共 Action/Decision 输入，留下逐步 session journal/replay 与最终权威盘面 | 直接调用规则 helper；出现第二个整流程入口；流程结束时 session 未清空 | `full-flow/standard-flow.test.js`（严格唯一） |

## 现有测试处置清单

### 删除

- `randomizer/app/dependencies.test.js`：全部证明脚本文件、装配顺序、旧文件删除和源码禁词，删除后不以 AST/snapshot 换皮。
- `randomizer/app/ai-runtime-root.test.js`：混合多个 runtime 与估值域的大型 characterization；正式 Policy/Host 契约拆到公共端口 unit。
- `randomizer/app/ai/browser-bootstrap.test.js`：装配 key/方法枚举门禁；Policy 输入行为由 Browser input port 和 Machine Player Host unit 接管。

### 保留行为、删除静态形态段

- `randomizer/app/rule-composition.test.js`
- `randomizer/app/engine-action-executor.test.js`
- `randomizer/app/render-runtime.test.js`
- `randomizer/app/browser-host/card-decision-ui.test.js`
- `randomizer/app/browser-host/industry-alien-decision-ui.test.js`
- `randomizer/game/effects/research-tech-session.test.js`
- `randomizer/game/effects/scan-card-session.test.js`
- `randomizer/game/aliens/runezu.test.js`
- `randomizer/game/cards/deck.test.js`

这些文件只保留通过模块公开 API 执行后的状态、输出或端口调用证据；删除 `fs.readFile*`、`existsSync`、源码 `match/includes/indexOf` 和资源文件字节/布局断言。

### 合并或重写为正式协议 unit

- 新建 `randomizer/game/actions/standard-action.test.js`，合并 identity、枚举、校验、family 执行以及 stale/unknown/越权反例。
- 新建 `randomizer/game/ai/policy-port.test.js`，覆盖请求/响应 schema、owner、actionId 合法性和 stale。
- 新建 `randomizer/game/ai/machine-player-host.test.js`，覆盖 generation、deadline、取消、迟到、重复与零提交。
- 新建 `randomizer/app/browser-host/policy-input-adapter.test.js`，覆盖 Policy 与人类共用正式 Action/Decision input port。

### 原样保留

除上述文件外，当前 inventory 中的测试只在其失败可对应公开协议或运行时行为时保留：

- `randomizer/game/state/**`、`cards/**`、`data/**`、`tech/**`、`history/**`、`players/rockets/planet/final-scoring`：统一权威状态和独立规则对象。
- `randomizer/game/effects/**`：Effect Session/queue/journal；不再保留任何迁移接线断言。
- `randomizer/game/actions/actions.test.js`、`quick-trades.test.js`、`game/aliens/**`：玩家可选择行动与产生差异结果的物种规则。
- `randomizer/app/browser-host/**` 与 app 领域 runtime unit：只验证 projection、ViewState、输入端口和 renderer 可观察行为。
- `randomizer/app/simulation-*.test.js`、`training/simulation-rule-composition.test.js`：Simulation rules-only、decision owner、checkpoint/replay/recovery。
- `randomizer/full-flow/standard-flow.test.js`：唯一 full-flow。

## Checkpoint 门禁

- Checkpoint A：本矩阵提交；生产代码和测试未改。
- Checkpoint B：完成删除、静态断言清零、四个正式协议 unit 与显式 inventory；`rg` 对生产源码读取模式零命中，定向 unit 全绿。
- Checkpoint C：`node --check randomizer/app.js`、`node tools/run_node_tests.js` 全绿；full-flow 恰好一个；真实 Chrome 覆盖页面、projection、人类输入、Policy 输入和 recovery。
