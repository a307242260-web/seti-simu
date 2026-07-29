# SETI 隔离反事实 fork 状态所有权转移设计（2026-07-30）

## 决策

多目标物理执行共享后，首决策已恢复 42 个目标并共享 293 个虚拟 origin，但仍执行满
`maxExecutionNodes=512`；median 4.63s。下一步进入原计划的 copy-on-write 方向。

首批不直接实现 Proxy/按 slice 写时复制。当前 Effect executor 已经获得一份独占可变 clone，
但 Session、StateStore 在同步调用返回后仍把同一份 plain state 再复制多次。先在严格隔离的
counterfactual fork 内实施“所有权转移”：

1. StateStore working copy 仍从 frozen committed state 克隆，保证分支可写且与父状态隔离；
2. executor 仍获得独占 clone，undo frame 仍保留独立 pre-state；
3. executor 返回后，把其独占 `nextState` 所有权转给 Session，不再立即复制；
4. commit 时把 Session 独占 candidate 所有权转给 fork-local StateStore，完整执行两次 validation
   与 version CAS，再原位冻结；完成后的 Session/Store 只共享同一不可变对象；
5. canonical Browser/Simulation 继续使用原有全量 clone 契约。

若这一层已足以让扩大的搜索稳定低于门槛，则不引入复杂的 Proxy COW。

## 启用边界

唯一开关链：

```text
Production createCounterfactualFork
  -> createRuleComposition({ allowTrustedForkLifecycle: true })
  -> StateStore({ trustedIsolatedOwnership: true })
  -> EffectRuntime({ trustedIsolatedOwnership: true })
```

任何 canonical composition、Browser restore、普通 Simulation step、训练 replay 都不能设置该
标记。只凭 caller 参数不能临时开启；必须由创建期封闭配置决定。

## 完整设计矩阵

| 语义 | owner / primitive | 状态归属 | RNG / id / Decision | validation / 事务 | 优化 | 证据 |
|---|---|---|---|---|---|---|
| fork root | Rule Composition trusted restore | frozen parsed state 归 fork-local Store | branch RNG 已独立 | restore checkpoint/version 校验不变 | 不复制已冻结 root | existing |
| working copy | StateStore `beginWorkingCopy` | 新 clone 归 Session dispatch，父 Store 仍 frozen | 不变 | baseVersion CAS 不变 | 保留必要 clone | store tests |
| base/working | Effect Runtime `createSession` | trusted 下接收的 working copy 直接成为 base owner，再克隆一份 mutable working | session id/sequence 不变 | abort 仍从 base clone 恢复 | 少一次完整 state clone | runtime tests |
| executor 输入 | Effect Runtime execute/resolve | executor 仍拿独占 clone；undo frame 另有 pre-state clone | Effect/Decision 不变 | 抛错仍 rollback | 不优化，保留隔离 | journal tests |
| executor 输出 | Effect Runtime `applyResult` | 同步返回后 `nextState` owner 转给 Session；executor 不再持有异步写权限 | 不变 | result schema/array 校验先完成 | 少一次完整 state clone/effect | parity |
| commit candidate | StateStore trusted compare-and-commit | Session 独占 candidate 转给 Store | stateVersion 仍仅 Store +1 | 提交前/改版本后两次 validate 均保留；CAS 保留 | 不做入口 clone，原位冻结 | invalid candidate tests |
| commit result | Store / completed Session | 共享同一 frozen committed object | 不变 | canonical 仍返回隔离 snapshot；trusted 只在 fork 内共享 | 少 Store/Session 多次回拷 | checkpoint parity |
| events | Rule Composition | trusted fork 没有外部 listener | 不变 | canonical publish 不变 | fork 不绑定无消费者的 Store event bridge | browser/full-flow |
| checkpoint | Effect Runtime | checkpoint 仍 clone 完整 Session | 不变 | replay cursor/undo 校验不变 | 本批不优化 | recovery tests |

## 禁止事项

- 不跳过 `validateState`、StateStore schema/invariant validator 或 version CAS；
- 不省略 undo frame、journal、Decision owner/version、RNG/replay；
- 不把 mutable state 放入跨节点缓存；
- 不允许 canonical composition 使用 ownership transfer；
- 不因性能扩大或缩小搜索 beam/node/leaf/目标集合。

## Proof obligations

| 验收 | 最小反例 | 期望 |
|---|---|---|
| canonical 隔离不变 | canonical executor 保存并修改返回引用 | Store/Session 不受影响 |
| trusted candidate 消费后只读 | commit 后修改原 candidate | 对象已 frozen，修改失败；snapshot 不变 |
| invalid 仍拒绝 | trusted candidate 含非法字段/破坏 invariant | commit 返回相同错误，不进入 Store |
| abort 恢复 | effect 2 失败 | workingState 深等于 baseState |
| checkpoint 可恢复 | trusted Session awaiting Decision | checkpoint clone 后恢复结果一致 |
| 搜索等价 | 同一固定 checkpoint | target/origin/executed/pruned/leaf 与优化前逐项一致 |
| 性能 | 12 次 benchmark | 在同 512 节点、42 targets、293 shared origins 下 median 明显低于 4.63s |

## 结果

同一 512 节点 benchmark：

- median wall 4629.13ms → 3926.92ms，下降 15.2%；
- counterfactual total 4032.56ms → 3345.78ms；
- submit transaction 2292.65ms → 1615.19ms，下降 29.6%；
- 42 targets、293 shared origins、512 executed nodes、5 remaining frontier、所有 pruned/beam
  指标与优化前一致。

随后仅在诊断调用中把 `maxExecutionNodes` 提到 1024：实际执行 852 节点后 frontier 归零，
耗时 5.79s，未触发上限；42 targets，共享 305 个 origin。仍有 409 个 origin 被既有
“每虚拟目标一条路线”beam 剪掉。

结论：所有权转移保留。当前不进入复杂 Proxy/slice COW；现有底层性能已经能在 10 秒内完成
beam 限定的 42 目标搜索。下一步应将保护提高到 1024 并移除有损 beam；只有该版本重新超过
10 秒，才继续做按 slice 写时复制。
