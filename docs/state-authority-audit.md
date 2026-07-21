# 状态权威与可执行架构审计

## 当前 owner

生产规则只有五个正式边界：Standard Action registry、Effect Session runtime、StateStore、Browser Host、Machine Player Host / Policy port。`randomizer/game/state/authority-inventory.js` 为机器可读清单；每项必须声明 source、target 和唯一 mutation gate。`RESIDUAL_INVENTORY` 必须为空，不提供 allowlist、expiry 或兼容身份。

StateStore 是 committed root 的唯一 owner。Effect Session 从 `beginWorkingCopy()` 取得隔离副本，在稳定边界经 `compareAndCommit()` 提交。Browser Host 只消费 StateSource、session inspect 与 ViewState；机器席位只消费 `DecisionContext + legal descriptors`，输出由 Host 复核后进入与人类相同的 Standard input port。

## 审计范围

`node tools/audit_state_authority.js` 递归枚举 `randomizer/**` 的全部生产 JS/HTML，并为每个入口输出依赖以及 authority/write/read/projection/recovery/policy 能力边。浏览器 HTML 的每个本地脚本必须存在。

审计按结构和数据形状阻断以下语义残留，而不是依赖某组旧接口名：

- 非 lifecycle 位置创建第二 StateStore；
- 修改 committed snapshot，或 StateStore 提交后继续写 shadow/mirror/cache；
- Browser Host 接收由传统 slice 重新拼出的 projection bundle；
- 保存路径手工拼 canonical committed root；
- 恢复路径把 committed root 拆回多个传统 slice owner；
- Policy/AI helper 在失败或未知 family 下取 legal set 首项；
- 生产路径读取已删除字段。

审计还执行两类运行时证据：StateStore commit trace 证明 working-copy isolation、单版本提交和 stale 零污染；Browser Projection poison 证明传统 slice getter 不会被读取。负向 fixture 位于 `randomizer/game/state/semantic-architecture-audit.test.js`，九类注入必须逐项非零失败。

## 验证

```bash
node --check randomizer/app.js
node tools/audit_state_authority.js
node randomizer/game/state/semantic-architecture-audit.test.js
node tools/run_node_tests.js
```

完整收口还包括固定 seed、非零 checkpoint/replay、worker recovery、完整 headless 多局、Browser/Headless trace parity，以及真实 Chrome 的人类和机器席位路径。Proof obligations 见 `checkpoint/seti-110-proof-obligations.md`。
