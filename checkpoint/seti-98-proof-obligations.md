# SETI-98 StateStore 零兼容硬切 Proof Obligations

## 状态 × 宿主 × 恢复 × 禁用依赖矩阵

| 状态 | Browser | Headless | 恢复义务 | 禁用依赖 / 最小反例 |
|---|---|---|---|---|
| opening | recovery 只序列化 StateStore committed schema | reset 从 Browser bundle 的 v2 committed JSON 建 store | v2 round-trip 后 opening、RNG、sequence 等价 | 注入 version=1 的 12-slice snapshot，必须返回 `RECOVERY_SNAPSHOT_VERSION_UNSUPPORTED`，不得调用 restore port |
| turn | renderer/public/debug 只取得 committed/working 派生快照 | action 前后 candidate 均为 committed schema | 非零 action checkpoint 比较 observation/legal/replay cursor/RNG | 给 `game-recovery` 装 legacy adapter poison；生产模块不得存在该依赖或符号 |
| pending / conditional | Decision/Effect Session 持有 choices/journal，不能进入 committed root | working state 随 session checkpoint 独立恢复 | 恢复后 owner、choices、decision version 等价 | committed JSON 注入 pending/UI/旧根切片，StateStore schema/invariant 必须 fail-closed |
| terminal | 最终 committed root 是唯一规则事实 | 完整局 checkpoint 仍只含 v2 core state | 新存档可重载并保持终局分数事实 | 输入未知 recovery version 或损坏 JSON，不得猜测/migrate |
| unknown | schema 精确白名单拒绝 | 未知 pending/family 由既有 headless fail-closed 处理 | 无旧 schema migration chain | `legacy-state-adapter`、`projectCommittedStateToLegacySlices`、dated adapter/expiry 的生产与 HTML 引用必须为 0 |

## 可证伪义务

| ID | 验收条款 | 可证伪命题 | 唯一责任点 | 证据 |
|---|---|---|---|---|
| H1 | 删除 legacy 状态兼容层 | 生产、HTML、工具和 authority inventory 不包含 adapter import/global/symbol | `index.html`、recovery/headless/inventory | `rg` 零引用 + dependency/audit test |
| H2 | 旧存档不兼容 | version 1、缺版本、未知版本均结构化拒绝，且 restore port 调用次数为 0 | `app/game-recovery.js` | 负向矩阵单测 |
| H3 | 新存档直接使用 StateStore | create 只调用 `StateStore.serialize()`；apply 只调用 `StateStore.deserialize()` 后交显式 restore port | `app/game-recovery.js` | poison fake store + v2 round-trip |
| H4 | Headless 只使用新 schema | reset/capture/load/checkpoint 不调用旧 10/12-slice adapter；`coreState` 恒为 v2 committed JSON | `app/headless-env.js` | checkpoint/replay/完整局测试 |
| H5 | 状态失败零污染 | 损坏 JSON、未知 schema、非法 root 时不调用 Browser restore port，不改 runtime | StateStore validate + recovery gate | restore spy 与前后 snapshot bytes |
| H6 | inventory 无过渡豁免 | inventory 中 `dated-adapter`、owner expiry/allowlist 为 0 | `authority-inventory.js`、audit tool | audit report `residualAdapters=[]` |
| H7 | Browser/Headless 同 trace | 同 committed state/action/RNG journal 的最终序列化 bytes 等价 | Effect Session StateStore CAS | 固定 seed、checkpoint fork、Browser/Headless smoke |

## 实现风险

- 当前 Browser 大量领域函数仍接收传统命名的对象引用；本阶段必须把恢复/持久化和 Headless
  边界先硬切为 StateStore，不得把旧双向 adapter 改名搬家。
- 删除旧恢复投影会暴露仍依赖宿主展示字段的 caller；这些字段只能由 Browser ViewState /
  renderer 派生，不能回填 committed root。
- 共享工作树有其他任务修改；提交只包含 SETI-98 文件，并在最新 HEAD 私有 index 独立验证。
