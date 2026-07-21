# SETI-114 UI / 机器人外延清理证据

## 边界

本项只收敛网页 UI 与机器人产品外延的接线，不改变 Action 语义、Effect 顺序、游戏数值、网页交互或 Policy 算法。

## 可证伪义务

| 义务 | 最小反例 | 实现 / 证据 |
|---|---|---|
| UI 不再取得匿名长期 `working` 规则图 | `app.js` 继续解构 `browserStateAuthority.working` 并直接写 | UI 装配只取得带 schema/baseVersion/phase 的 `getActiveSession().workingState`；旧 `working` API 已物理删除 |
| bootstrap/reset 只创建一份 Session state | Browser authority、turn flow、AI reset 分别调用领域 state factory | factory 集中在纯 `initial-game-state.js`；turn flow / AI 只调用 `resetSession()` |
| root 拼装/恢复不再由产品外延拥有 | Browser authority 内继续硬编码 11 个 root 双向映射 | 纯状态映射迁入 `game/state/initial-game-state.js`；Browser authority 只调用 Session/StateStore port |
| StateStore 构造不属于 UI/机器人外延 | Browser / headless 直接调用 `createHighCouplingStateStore` | 构造入口集中到 `game/state/runtime-authority.js`；两个产品外延只请求 runtime authority |
| 机器人不自建 executor/resolver | Headless/Policy 按 family switch 执行或代选 | 继续复用 Machine Player Host、Policy port、Standard Action 与 Effect Session host；本项仅替换 state authority 获取入口 |
| 恢复保持单一 resident identity | restore 新建 store 或替换 UI 捕获的窄引用 | Browser authority 原位 `store.restore`，再恢复同一 Session state 对象；测试固定 store creation=1、引用 identity 与 stateVersion=17 |

## 验证摘要

- `node --check randomizer/app.js`：PASS。
- `node tools/run_node_tests.js`：132 unit + 1 full-flow 全通过。
- `browser-state-authority.test.js`：bootstrap、事务失败零污染、恢复 identity 与单 store 通过。
- SETI-112 hard-cut（迁移期间保留的 9 negative / 3 allowed 审计版本）对本次生产树扫描：0 violation；随后该延期架构闸门由并发 SETI-116 按测试治理计划移出当前 HEAD。
- 固定 full-flow：Action identity、最终 authority、Effect Session checkpoint 与 replay parity 通过。

## 提交边界

共享树存在 SETI-104/116 的并发 staged/unstaged 改动。本项使用私有 index，只纳入本 checkpoint 与 UI/机器人接线文件；未纳入测试治理、启发式估值、公司能力及其他 checkpoint 改动。
