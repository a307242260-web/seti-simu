# SETI-113 Action → Effect Queue → Session → StateStore 内部主链证据

## 边界

本项只收口 SETI-56、SETI-62、SETI-71 三个既有内部组件的组合关系，不改变 Action 业务语义、Effect 顺序、状态 schema、游戏规则或数值。

SETI-112 hard-cut 仍报告的 Browser 长期切片、slice/root 双向同步、app 直写，以及 Headless 借用 Browser capture/restore，属于 SETI-114 的网页 UI / 机器人外延清理。本项不为这些残留加白名单，也不把 hard-cut 红灯改成绿色。

## 可证伪义务

| 义务 | 最小反例 | 证据 |
|---|---|---|
| Action 先在当前 StateStore working copy 上重验，再生成 Effect Group | stale Action 已创建 queue 或执行领域 effect | `state-store-session.test.js`：stale 返回 `STANDARD_ACTION_STALE`，groupCalls=0、CAS=0、committed bytes 不变 |
| 生产 stored flow 只走 Session Runtime 的统一 Action 入口 | 研究/扫描/卡牌/公司外星人直接调用 raw stored dispatch | `research-tech-session.js`、`scan-card-session.js`、`industry-alien-session.js` 的 StateStore 分支统一调用 `dispatchStandardAction`，并在缺少 registry 时 fail-fast |
| Session 未完成不得污染权威状态 | queue 创建后 committed bytes 已变化 | `state-store-session.test.js`：dispatch 后、drain 前逐字节不变 |
| Session 完成只提交一次 | flow 提交后 Browser Host 再 CAS | `effect-session-host.js` 不再持有或调用 `compareAndCommit`；终态只读取 StateStore snapshot；行为测试断言 CAS=1 |
| 非法、失败、过期输入零污染 | validation/Effect 失败仍写入 committed root | stale、逐 Effect failure、render poison 测试均断言 CAS=0 与 committed parity |
| UI 动画推进不改变规则顺序 | auto drain 与逐步 advance 得到不同状态 | `effect-session-host.test.js` 的 auto/animated parity |

## 实现结果

`randomizer/game/effects/session-runtime.js` 新增既有 runtime 的 `dispatchStandardAction` 入口：

1. 从 StateStore 建立唯一 working copy；
2. 用 SETI-56 registry 对同一 working state 重验 descriptor；
3. 仅合法 Action 创建 SETI-62 Effect Group / Queue；
4. 全部 Effect 与 Decision 只修改 session working state；
5. queue 清空且无 Decision 后，由 runtime 向 SETI-71 StateStore CAS 一次。

Browser Effect Host 已删除第二个 CAS，只消费 Session 的完成结果。没有新增并列 runtime、共享逻辑 wrapper 或替代状态组件。

## 验证摘要

- `node --check randomizer/app.js`：PASS。
- `node --check randomizer/game/effects/session-runtime.js`：PASS。
- `node tools/run_node_tests.js`：本次相关 138 项 PASS；2 项 FAIL 为 SETI-112 冻结的同一组 11 个 Browser 外延 hard-cut 违规，交由 SETI-114 清理。
- 定向：StateStore Session、Research、Scan/Card、Industry/Alien、Browser Effect Host、Scan/Data/Land Browser Host 全部 PASS。

提交：`7662309`。
