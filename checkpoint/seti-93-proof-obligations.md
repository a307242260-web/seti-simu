# SETI-93 Machine Player Host Proof Obligations

## 边界

Machine Player Host 只拥有机器席位身份、Policy 请求生命周期和 Standard
Action/Decision 提交协调。规则执行、Effect drain、状态真相、legal set 枚举和策略估值仍分别属于
共享 session/state source/Policy。

## 可证伪义务

| 验收条款 | 可证伪命题与最小反例 | 唯一实现落点 | 验证证据 | 失败语义 |
|---|---|---|---|---|
| 席位身份固定 | 初始化后任意请求返回的 type/version/checksum 必须与席位 identity 全等；反例为同一席第二步返回另一版本 | `game/ai/machine-player-host.js` 席位注册与响应 identity 复核 | 多步 trace + identity drift 注入 | `MACHINE_POLICY_IDENTITY_DRIFT`，暂停且不提交 |
| 只在开局/加载整席切换 | primary 初始化失败时只可切到预声明 fallback；运行中不可切换；反例为 timeout 后 fallback spy 被调用一次 | Host `initializeSeats` / `restore` 与 runtime request 路径隔离 | 初始化失败诊断 + fallback spy=0 | 初始化显式 `seat_policy_switched`；局中故障暂停 |
| 请求 deadline/取消/去重 | 同一 generation + decision version 最多一个 active request 和一次成功提交；反例为并发 request 或 late resolve 再提交 | Host request record、AbortController、submitted decision key | timeout/cancel/duplicate/late 测试 | 结构化错误，Host paused，state/effect/journal 不前进 |
| stale/恢复隔离 | 提交前 authority/legal set 必须仍与原 context 一致；restore 后旧 generation 响应永远不可提交 | Host generation + adapter `validateFresh` | stale boundary、restore-before-response | `MACHINE_POLICY_STALE` / `MACHINE_POLICY_REQUEST_INVALIDATED` |
| 非法/异常 fail-closed | Policy throw、schema/capability/checksum 不兼容、非法 action 均不得调用 submit | Host 初始化验证、公共 validator、统一 `failClosed` | 每类负向注入，submit spy=0 | paused snapshot 暴露 code/request/seat/versions |
| 两宿主同路径 | browser/headless 对同一 context/legal set 都经 Host `requestDecision`，只由 adapter 实现 read/validate/submit | browser policy adapter、training heuristic adapter | 固定 trace parity + adapter contract | adapter 错误向 Host 返回失败并暂停 |
| 恢复与 replay parity | snapshot 只保存席位 identity/config/seed/ordinal，不保存 active request；恢复后首请求使用新 generation | Host snapshot/restore | fresh restore、非零请求 ordinal、旧响应隔离 | restore 失败不部分应用 identity |
| 禁 DOM/resolver/fallback | Host 与 Policy 热路径读取 DOM/renderer/picker/pending resolver 次数恒为 0；不存在单步 fallback 调用 | 纯 game 模块依赖 + poison spy | 源码依赖检查 + runtime poison | 任一调用直接使合约失败 |

## 完成证据

- 定向：Host 生命周期、浏览器 adapter、headless adapter、固定席位 trace、恢复隔离。
- 全量：`node --check randomizer/app.js` 与 `node tools/run_node_tests.js`。
- 长轨迹：固定 seed 完整 headless 对局、checkpoint/replay；真实 Chrome 机器席位 smoke。

## 验证结果

- Host 生命周期、浏览器 adapter、headless adapter、Effect Session、checkpoint、worker recovery 与
  冻结 Heuristic seed 定向测试全部通过。
- 固定 seed `seti-93-machine-host`：538 个公共 Policy 决策后终局，分数
  `[67,37,54,27]`，trace SHA-256
  `aaa403e165768545f081cc968db67103736ee02729b709919b735f2e00f9ed03`；第 25 步 checkpoint
  fresh restore 后 observation/legal set 相等，继续 20 步 action/observation 逐步 parity，四个席位 identity
  均保留且 snapshot 无在途请求。
- 真实 Chrome Policy Input 固定 trace 为 `launch -> choose_reward:score`，DOM/renderer/picker/pending
  resolver poison 调用均为 0；生产整页 seed `seti-93-browser-smoke:1` 744 步终局，
  `blocked=false`、`bugCount=0`、最低分 86。
- 共享工作树全量 Node 为 165/166；唯一失败是并行工作树修改导致旧
  `ai-controller.seed-baseline` 99/100 步边界漂移。纯 HEAD archive 单独运行该测试通过，新增 Host 相关及
  其余 165 项全部通过。
