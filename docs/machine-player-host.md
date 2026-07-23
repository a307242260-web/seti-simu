# Machine Player Host

`randomizer/game/ai/machine-player-host.js` 是浏览器机器席位与 simulation/训练机器席位共用的协调器。
它只负责固定席位身份、Policy 请求生命周期和公共 Standard Action/Decision 提交；不执行规则、
不 drain Effect、不生成第二份状态，也不参与策略估值。

## 席位与初始化

新局或加载阶段通过 `initializeSeats(..., { phase: "new_game" | "load" })` 一次性固定每个席位的：

- `policyType`、`policyVersion`、`modelChecksum`；
- Policy `config` / `configChecksum` 与固定 `seed`；
- 当前采用的声明 Policy 序号。

初始化会验证 Policy 可调用性、provenance、Learned Policy checksum、context schema 与声明 capability。
primary 初始化失败时，Host 只会在新局/加载阶段依次尝试该席位预声明的 fallback，并记录
`seat_policy_initialization_failed` 与 `seat_policy_switched`。进入对局后不会调用 fallback 代走单步。

## 请求与 fail-closed

adapter 向 Host 提供三件事：从同源 state source 读取 observation/legal set、提交前复核 fresh
authority、把已验证 descriptor 提交公共输入端口。Host 负责：

1. 用固定席位 identity 和版本化 legal set 构造 `DecisionContext`；
2. 管理 deadline、AbortSignal、同 decision 去重和请求代次；
3. 复核 PolicyDecision 的 seat/state/decision/action 与固定 type/version/checksum；
4. fresh revalidate 后最多提交一次。

timeout、异常、非法输出、identity drift、stale 或提交失败都会留下结构化 paused reason；adapter
不得在失败后调用 recover、skip、旧 resolver 或 Heuristic 单步 fallback。由于提交发生在全部验证之后，
失败请求不会推进 state、effect 或 journal。

## 存档与恢复

`createSnapshot()` 只保存席位 identity/config/seed、声明 Policy 与 request ordinal，不保存 Promise、
AbortSignal 或在途 session。`restore()` 先切换 generation，使恢复前响应只能得到
`MACHINE_POLICY_REQUEST_INVALIDATED`，再按保存的 identity 解析 Policy；当前模型不可用时，只能在
load 阶段切换到存档中预声明的整席 fallback。

浏览器 `policy-input-adapter.js` 和训练 `heuristic-policy-adapter.js` 都只是该 Host 的 adapter。
前者提交 BrowserInputAdapter，后者提交 Simulation 的标准 Action/Decision input；对局动作进入
`simulation-env.step()`，setup 公司牌/初始牌组合则由 Standard Action registry 生成
`choose_branch` descriptor，并经 `submitDecision()` 提交。两端不维护独立 Policy 分支。

## Browser 接线

Browser 调度由 `app/ai/browser-bootstrap.js` 从 Rule Composition 的 inspection、StateSource projection
和 `inputPort.enumerateActions()` 构造唯一 boundary。顶层 Action 与 active Decision 都交给
`browser-host/policy-input-adapter.js`，再由本 Host 请求固定席位 Policy；成功结果只经
BrowserInputAdapter 的 `dispatchAction` / `submitDecision` 回到公共输入端口。

Browser 与 Simulation 都只把 legal descriptor 交给固定席位 Host，不直接执行 Policy，也不再通过
`ai_run_*`、candidate/selector 或 `simulation_*` Host Command 执行动作。新局与恢复 lifecycle
会失效所有 Browser 在途请求；人类席位不会创建 Policy 请求。
