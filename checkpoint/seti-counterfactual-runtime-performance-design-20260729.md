# SETI 反事实执行无损性能优化设计（2026-07-29）

## 目标与非目标

目标是在不减少目标、路线、conditional choice、叶或节点预算的前提下，降低每个反事实节点的
规则执行成本，为后续恢复非支配路线探索腾出预算。

本批明确不做：

- 不降低 `maxNodes=128`、`maxExecutionNodes=512`、`maxProxyDepth=15` 或 `maxLeaves=8`；
- 不增加 beam、只取第一项、只保留一个目标或只保留一种转换；
- 不改变状态等价、目标可达性、估值、对手冻结策略或 RNG；
- 不缓存带随机消费、Decision owner、Session revision 或 working state 的执行结果。

## 基线

固定盘面首个正常 Policy Decision，连续三次：

| 指标 | 结果 |
|---|---:|
| wall | 5.02–5.25s |
| counterfactual total | 4.76–4.99s |
| executed nodes | 337 |
| rule execution | 2.06–2.16s |
| projection | 0.45–0.47s |
| checkpoint | 0.22–0.23s |
| fork restore | 0.10–0.11s |
| 未细分 orchestration | 1.91–2.02s |
| transposition hits | 0 |

CPU profile 的 exclusive sample 中 `structuredClone` 为 3.78s。最大来源是 Standard Action
枚举时每个 domain 通过 `getAuthority()` 调用 `stateSourcePort.getSnapshot()`，仅为读取
`stateVersion` 却重复克隆完整 committed state。第二个确定性重复是反事实 `submitAction /
submitDecision` 内部生成一次默认 projection，`executeNode` 随后又为实际 viewer 生成一次
projection，前一份从未被消费。

## 完整设计矩阵

| 语义 | 唯一 owner / 正式 primitive | 状态与等价 | RNG / id / sequence / Decision | 事务与失败边界 | 性能改动 | 证据 |
|---|---|---|---|---|---|---|
| Action authority | Production Kernel `createActionContext/getAuthority` | working/committed state 自身的 `meta.stateVersion` 是该 context 的版本；缺字段才回退 StateSource | 不创建 id，不消费 RNG，不改变 Decision version | 只读字段；非法 context 仍走原 fallback | 避免为一个 number 克隆完整 root | authority unit + full-flow |
| 外部提交返回 | Rule Composition `submitAction/submitDecision` | 默认返回值与当前完全相同 | 不变 | 默认仍返回 projection；失败/terminal 不变 | 无 | 现有 Node/Browser |
| 反事实提交返回 | 同一提交 primitive 的内部 `skipProjection` option | 只省略未被 caller 使用的返回 projection；提交后的 Store/Session 完全相同 | 不变 | 仅 trusted counterfactual caller 使用；执行后仍 inspect 并为 viewer 投影一次 | 每节点从两次投影降为一次 | counterfactual parity |
| 叶 observation | Production projection adapter | 与优化前字节等价 | 不变 | 必须在 action 已正式提交后生成 | 不缓存、不裁字段 | outcome parity |
| checkpoint / restore | 现有 trusted fork lifecycle | 不变 | branch key 与 RNG state 不变 | canonical root 隔离断言不变 | 本批不改 | existing invariant |
| 搜索 frontier | Rule Composition | 不变 | 不变 | 不变 | 节点、叶、pruned 数必须逐项相同 | benchmark diagnostics |

## Proof obligations

| 验收 | 可证伪命题 | 验证 |
|---|---|---|
| 无搜索折损 | 同一 checkpoint 的 candidate/root target/executed/expanded/pruned/leaf 计数全部不变 | 优化前后 benchmark diagnostics |
| authority 等价 | context 带 `meta.stateVersion` 时不调用 StateSource snapshot，输出版本仍相同 | 定向 unit |
| projection 等价 | 默认 submit 仍返回 projection；counterfactual skip 后最终 viewer leaf observation 不变 | Rule Composition / simulation tests |
| canonical 隔离 | 搜索前后 state/RNG/session/journal/history/replay 不变 | 现有 counterfactual invariant + full-flow |
| 性能 | 相同 337 节点下 median 明显低于 5.02s；若收益不足，保留 profile 结论但不扩张 patch | 12 次单决策 benchmark |

## 实施顺序

1. authority 优先读取传入 root 的 `meta.stateVersion`，保留旧 fallback。
2. 给内部提交链增加 `skipProjection`，只由 `executeNode` 启用。
3. 补 timing 细分和 benchmark diagnostics，确认节点覆盖完全相同。
4. 重新 profile；只有新热点有明确无损边界时才进入下一批。

尝试过让 Effect Runtime 的单次 observe 复用 inspection 中的 Decision。首决策三次 wall 为
2.87–3.03s，没有稳定优于 2.79–2.87s 的前一版本；该盘面的多数节点并不等待 Decision，
节省不足以覆盖额外克隆，因此已撤销，不进入生产 diff。

## 第一批结果

12 次正式 `benchmark_probe_policy`：

- median wall：5019.43ms → 2956.30ms，下降 41.1%；
- p90 3055.07ms，max 3186.14ms；
- counterfactual median 2704.43ms，其中提交事务 1496.58ms、projection 447.40ms、
  checkpoint 233.19ms、fork 104.73ms、其余 orchestration 421.58ms；
- candidate 15、executed node 337、expanded goal node 18、root target 11、原始/保留
  frontier 52/15、pruned 316、transposition hit 0，12 次逐项完全一致。

因此两项优化保留。它们没有扩大或缩小搜索覆盖；新增 benchmark 会在相同 checkpoint 的覆盖
指标发生漂移时直接失败。
