# SETI 机器玩家公共 Policy 端口

## 目标与唯一调用方向

本端口冻结启发式与 Learned Policy 共用的纯决策边界。Policy 只选择共享 runtime 已枚举的一个合法 Standard Action descriptor；它不决定请求时机，不执行规则，也不拥有恢复、超时或权威状态。

```text
Browser / Simulation Host
  │  从当前 viewer 生成 observation，向 registry 枚举 legal descriptors
  ▼
DecisionContext (只读、可序列化、版本化)
  │
  ├── Heuristic Policy ──┐
  └── Learned Policy ────┤  只返回 PolicyDecision(actionId + policy metadata)
                         ▼
Host request session → public validator → registry.validate
                                             │
                                             ▼ Host 显式提交
                                       registry.execute / Effect Session
```

禁止反向依赖：Policy 不调用 Host automation、DOM/picker resolver、Effect drain、history mutation 或 StateStore mutation。公共 validator 也只调用 `registry.validate`，不会执行动作或写 journal。

## 所有权

| 责任 | 唯一 owner | Policy 是否参与 |
|---|---|---|
| 生成合法可见 observation | Host / shared observation builder | 只读 |
| 枚举合法 Standard Action descriptor | shared registry | 只读 |
| 选择 descriptor | Heuristic 或 Learned Policy | 是 |
| deadline、AbortSignal、重复/迟到响应、恢复失效 | Host request session | 否 |
| actor/schema/state/decision/legal set 复核 | public validator + registry.validate | 否 |
| 执行、事务、Effect drain、journal、权威状态 | shared runtime | 否 |

## `DecisionContext`

schema 为 `seti-policy-context-v1`：

```js
{
  schemaVersion,
  requestId,
  seatId,
  stateVersion,
  decisionVersion,
  observation,
  legalActions: StandardActionDescriptor[],
  deterministicContext,
}
```

- `observation` 必须已经按 `seatId` 做 viewer 投影；允许自己的手牌详情和所有玩家公开手牌数量，不允许对手手牌内容。
- `legalActions` 沿用 `seti-standard-action-v1`，actor/state/decision version 必须与 context 完全一致，`actionId` 不得重复。
- `deterministicContext` 只放 seed、episode/request ordinal、已公开 RNG cursor 等复现上下文；不得放未来 RNG 或牌库顺序。
- 创建过程只接受 plain object/array/JSON primitive，拒绝函数、symbol、accessor、循环引用和非有限数值；结果为递归只读副本，不保留宿主 mutable reference。
- 默认拒绝对手手牌、对手保留牌、牌库顺序、未来抽牌/RNG、未公开牌、recovery snapshot、heuristic score、policy score、actionGraph、planner shadow、battle analytics、DOM、resolver、executor、continuation 和 callback 字段。

## `PolicyDecision`

schema 为 `seti-policy-decision-v1`：

```js
{
  schemaVersion,
  requestId,
  seatId,
  stateVersion,
  decisionVersion,
  actionId,
  policy: { type, version, modelChecksum },
  diagnostics: { confidence?, latencyMs?, reasonCode?, traceId? },
}
```

`actionId` 只能引用当前 `legalActions` 成员。Learned Policy 必须提供模型 checksum；Heuristic 可用 `null`。诊断字段为有限白名单，不能夹带 effect、状态补丁、continuation、回调、评分图或隐藏 observation。

## 同步、异步与请求失效

`runPolicy(policy, context, options)` 同时接受同步返回值和 Promise。Host 以绝对 `deadlineAt`（epoch milliseconds）定义截止时间，并可传 `AbortSignal`。端口本身不重试；失败后的 fallback 必须由 Host 在新 `requestId/decisionVersion` 下显式发起。

每个 request session 只有一个终态：

- 首个响应进入 `responded`，不论合法或拒绝，后续响应均为 `POLICY_DUPLICATE_RESPONSE`。
- deadline 到达进入 `timed_out`；AbortSignal 进入 `cancelled`。
- state/decision version 变化、checkpoint/replay 恢复或 Host 代次变化时调用 `invalidate()`，进入 `invalidated`。
- 上述终态后的 Promise resolve 都是 `POLICY_LATE_RESPONSE`，不得执行动作、写 journal 或复活旧请求。
- 恢复只能从恢复后的权威状态创建新 context 和新 request；旧 request 不进入 replay，也不能复用旧 legal set。

## Failure taxonomy

| 类别 | 代码 | 语义 / Host fallback |
|---|---|---|
| context 构造 | `POLICY_NOT_SERIALIZABLE` / `POLICY_FORBIDDEN_FIELD` | fail-fast；修复 observation builder，不调用 Policy |
| descriptor envelope | `POLICY_ACTION_SCHEMA_MISMATCH` / `POLICY_ACTION_ACTOR_MISMATCH` / `POLICY_ACTION_STALE` | fail-fast；重新从 registry 枚举 |
| Policy envelope | `POLICY_DECISION_SCHEMA_MISMATCH` / `POLICY_REQUEST_MISMATCH` / `POLICY_SEAT_MISMATCH` / `POLICY_STALE` | 拒绝；不得提交 |
| Policy 字段 | `POLICY_DECISION_FIELD_FORBIDDEN` / `POLICY_METADATA_INVALID` / `POLICY_DIAGNOSTICS_INVALID` | 拒绝 effect/状态补丁/未知字段或不完整模型身份 |
| 选择合法性 | `POLICY_ACTION_NOT_LEGAL` | 拒绝；Host 可用新 request 选择降级 Policy |
| runtime 复核 | `STANDARD_ACTION_SCHEMA_MISMATCH` / `STANDARD_ACTION_ACTOR_MISMATCH` / `STANDARD_ACTION_STALE` / `STANDARD_ACTION_NOT_LEGAL` | 透传 registry 结构化拒绝；重新观察与枚举 |
| 生命周期 | `POLICY_TIMEOUT` / `POLICY_CANCELLED` / `POLICY_REQUEST_INVALIDATED` | 不执行、不写 journal；新代次显式重发 |
| 重复/迟到 | `POLICY_DUPLICATE_RESPONSE` / `POLICY_LATE_RESPONSE` | 忽略，不得恢复旧 request |
| Policy 失败 | `POLICY_NOT_CALLABLE` / `POLICY_FAILURE` | Host 决定是否用新 request 降级；不得隐式执行首项 |

## 状态 × 决策 × owner × fallback 禁区

| 状态 | action / decision | owner | 合法行为 | fallback 禁区 |
|---|---|---|---|---|
| opening / turn | 多个顶层 descriptor | 当前席位 Policy | 返回一个 `actionId`，Host 复核后提交 | DOM click、旧 action switch、自建 executor |
| pending / conditional | 多个非等价 conditional descriptor | pending owner Policy | 独立 request / response / replay step | resolver 代选、取首项、Effect drain 内调用 Policy |
| pending / conditional | 唯一等价项 | shared runtime | 确定性 drain，不创建 Policy request | 伪造 policy journal |
| terminal | 无 descriptor | shared runtime | 不请求 Policy | recover/skip 伪装成 action |
| unknown family / pending | unsupported | shared runtime | fail-closed 并诊断 | heuristic/Host automation 静默兜底 |
| timeout / cancel / stale / recovery | 旧 response | Host request session | 失效并忽略 | 执行、journal、旧 request 复活 |

## 当前生产边界

Browser Host 与 simulation/training Host 都直接构造 `DecisionContext` 并提交 `PolicyDecision`。setup、弃牌、移动支付、科技槽和外星人分支也先把当前合法选项转成 Standard Decision descriptor，在隔离 Composition fork 中经生产 input port 完整执行，再由公共 Heuristic Policy 按标准 leaf observation 的 `V(leaf)-V(root)` 返回 `PolicyDecision`。旧 `selection-evaluator.js` 与 `game/ai/policy.js` 已删除。Host 失败策略必须显式创建新的 request generation，不能单步调用 resolver、读取 descriptor 文案或取首项。

## Proof obligations 与证据

以下内容保留为后续机器人实现的设计义务，当前不作为已实现能力或单元测试证据：

1. 同一 context/legal set 无差别传给 heuristic/learned fixture，二者只通过公共 validator 得到同一类 Standard Action descriptor；只有 Host 显式 `registry.execute` 才改变状态。
2. 非法 action、decision schema、actor mismatch、stale stateVersion 均结构化拒绝。
3. 源码断言不含执行/DOM/history/effect/state-store 依赖；poison globals 证明运行时访问计数为 0。
4. 正向 viewer 夹具允许 self hand 和 opponent hand count；负向夹具拒绝 opponent hands、deck order、actionGraph 与 accessor executor。
5. timeout、AbortSignal、invalidate、duplicate 与 late resolve 均不执行、不写 journal。
