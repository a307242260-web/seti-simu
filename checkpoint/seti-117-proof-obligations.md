# SETI-117 唯一状态主链 Proof Obligations

## 边界

本 issue 只收敛状态所有权、Action/Effect Session 提交链、恢复方向和 headless 装配；不改变规则、数值、UI、Policy、训练算法或 `seti-committed-game-state-v1` schema。

## 可证伪义务

| ID | 可证伪命题 | 最小反例 | 实现责任点 | 必须证据 |
|---|---|---|---|---|
| PO-1 | Browser 生产代码不存在生命周期跨越一次 Action/Decision 的可变规则 root 或规则切片 owner。 | 从 `getActiveSession().workingState`、别名 getter 或 wrapper 取得对象，两个输入之间引用 identity 不变且可被直接修改。 | Browser composition + Effect Session host。 | 生产可达性审计为零；poison 第二 owner 非零；动作中 committed bytes 不变，完成后只变一次。 |
| PO-2 | 规则写入只能由 Standard Action/Decision 进入 Effect Queue，并由对应 Session 在完成时执行一次 CAS。 | Session 外暴露 `runTransaction`、`settle`、raw `compareAndCommit`，或 wrapper 最终调用 CAS。 | StateStore capability ownership + Session runtime。 | capability-chain 审计；stale/throw/validation 失败零污染；单次提交计数。 |
| PO-3 | 生产中不存在 committed root 与长期规则切片之间的拼装或原位回填。 | 跨文件 helper 将 `players/turn/...` 映射为 `playerState/turnState/...`，或反向 `Object.assign`/delete 后回填。 | 唯一 committed root 初始化与 recovery。 | 跨文件 bridge 审计；poison 改名/搬迁回填非零；旧 bridge getter poison 后仍完整推进。 |
| PO-4 | Headless 不读取网页入口、不执行网页 `app.js` composition、不调用网页 recovery facade。 | 解析 `index.html` script 列表、最后加载 `app.js`，或调用 `createRecoverySnapshot/restoreRecoverySnapshot` 往返规则状态。 | Browser/headless 共用的内部规则 composition 与 StateStore/Session checkpoint 端口。 | 依赖图审计；网页 getter poison 后 headless reset/step/checkpoint/replay/worker recovery 全绿。 |
| PO-5 | UI 与 Policy 对固定输入只通过公共输入 adapter，得到相同 Action、Effect、Decision、journal 与 committed state。 | Browser 或 headless 直接调用规则 mutator/旧 resolver，绕过 registry 或 queue。 | input adapter + shared Session host。 | 固定 trace parity；禁用旧 resolver spy 为零。 |
| PO-6 | 冻结门禁按 capability 与数据流判定，不依赖单一文件名、函数名或 allowlist。 | 将第二 owner 改名、CAS 包一层、回填桥搬到另一文件、网页 recovery getter 改名后审计仍为零。 | `tools/audit_state_authority.js` 与 poison tests。 | 四类 poison 逐项稳定非零，正常生产为零。 |

## 分层验证

1. 静态：`node tools/audit_state_authority.js`，并运行 poison 测试。
2. 内核：StateStore/Effect Session stale、失败零污染、单提交与 checkpoint 合约。
3. 集成：Browser/Headless 固定 Action/Effect/journal/final state parity；replay、worker recovery。
4. 端到端：全量 Node、独立提交快照、真实 Chrome 玩家/机器人完整局。

任一层只能证明本层命题；全量测试或 Chrome 可跑不能替代 PO-1 至 PO-4 的所有权和依赖方向证据。
