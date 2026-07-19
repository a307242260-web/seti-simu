# SETI-88 Stage 8 Proof Obligations

| ID | 原验收条款 | 可证伪命题 / 最小反例 | 唯一责任点 | 证据 |
|---|---|---|---|---|
| S8-01 schema | CommittedGameState schema、ownership、invariant、API、migration 冻结 | recovery 输入重新接受未知根切片或无版本状态 | `state-store.js`、`legacy-state-adapter.js` | state/store/adapter 契约测试 |
| S8-02 pure core | StateStore 不依赖 DOM、Action/Effect、Policy、localStorage 或宿主 | Node import 触发浏览器全局或宿主回调 | `state-store.js` dependency boundary | Node 直接导入、no-browser smoke |
| S8-03 unique write | 当前 recovery 不再走 v1 serializer；旧 12-slice 不能作为新存档输入 | `game-recovery.js` 调用 `serializeLegacySnapshot` | current runtime adapter + audit | `tools/audit_state_authority.js` |
| S8-04 fail closed | version/schema/invariant/serialization 失败时 committed bytes 不变 | 非法 current slice 被静默净化后写入 | StateStore validate/CAS + strict current input | state-store/authority negative matrix |
| S8-05 atomic CAS | 多切片只在一次 CAS 成功后同时可见且 version +1 | resources 已扣但 card/tech 未更新 | Effect Session store mode | state-store-session tests |
| S8-06 host parity | 同 state/action/decision/RNG journal 的 browser/headless 最终 committed bytes 等价 | renderer/observation 差异进入 candidate | HostSource + Effect Session | Stage 7/Browser Host/固定 seed trace |
| S8-07 excluded state | cardTask、setup session、card/tech/rocket UI 不进入新 recovery committed bytes | `cardTaskState: structuredClone(...)` 出现在新存档写路径 | game recovery current input + purifier | recovery tests + authority audit |
| S8-08 recovery | v1 只读迁移与 v2 committed round-trip 均显式版本化；损坏输入零污染 | 新存档再次写 v1 或未知版本被猜测 | legacy read adapter + v2 deserialize | legacy adapter/game recovery tests |
| S8-09 derived only | UI/legal/observation/log 只由 committed/working source 派生 | host projection 回写 StateStore candidate | HostSource/BrowserProjection/headless observation | host-source/browser/headless tests |
| S8-10 regression gates | 直写/双写扫描、领域测试、Node、seed、恢复、完整局、性能、Chrome 都有证据 | 只以静态 inventory 或一局终局代替全称证据 | audit + layered verification | 本 checkpoint 收口记录 |
| S8-11 docs | app/state/recovery/effect/AI/headless/RL/mechanics 边界同步 | 文档仍把 cardTask/setup 描述为 recovery 输入 | `docs/state-authority-stage8.md` + committed contract | 文档结构检查 |

## Inventory completion rule

`randomizer/game/state/authority-inventory.js` 是最终机械清单。任一项只能是
`store-owned`、`derived`、`session-owned`、`host-only` 或带 `owner/expiresOn/deleteWhen`
的 `dated-adapter`。当前仅保留两项 dated adapter：v1 recovery 只读兼容与浏览器
runtime working projection；二者 owner=`SETI-71`、到期日=`2026-08-31`。

## 收口验证记录

- 定向：StateStore/Effect Session、headless checkpoint、headless integration、legacy/current
  recovery、authority inventory 全部通过。
- 工作树全量 Node：157/160；3 个失败均位于其他任务正在修改的 heuristic/public API
  baseline，纯 HEAD 对应既有测试通过，且不涉及本提交文件。本 issue 私有提交 `e6886e4`
  独立快照全量 Node 163/163 通过。
- inventory：state authority 6/6 合规，legacy effect inventory 52/52 合规；unknown、missing、
  undated、expired 均为 0。
- headless benchmark：3 局、315 decisions、39.834 decisions/s，均在 200 步内终局。
- Chrome recovery：`browser-services.browser-smoke.html` 返回 `ok=true`，facade frozen。
- Chrome 完整对局：seed=`seti88-authority-complete`，776 步正常终局，`blocked=false`、
  `bugCount=0`，比分 126/63/180/36。
