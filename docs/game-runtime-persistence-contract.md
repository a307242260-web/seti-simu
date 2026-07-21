# GameRuntime 装配、持久化与恢复总契约

## 当前结论

SETI 的规则状态、流程状态和宿主状态已经分属明确 owner：

- StateStore：唯一 committed 事实、schema、RNG、稳定 sequence 与 CAS 提交。
- Effect Session：唯一 working copy、queue、Decision、journal、undo/barrier 与 checkpoint。
- Standard Action：唯一 Action/Decision descriptor、合法性与 family handler 入口。
- Browser/Headless Host：只投影状态并提交标准输入。
- Machine Player Host/Policy：只管理请求与选择 legal `actionId`，不执行规则。

`app.js` 是 composition root，不是并列状态源。`window.Seti*` 是无构建脚本的模块注册方式，不得保存跨局权威事实。

## 依赖与提交

```text
ActionRegistry.enumerate/validate
             │
             ▼
EffectSession.beginWorkingCopy
             │ resolve/drain/journal
             ▼
StateStore.compareAndCommit
             │
             ├─ BrowserProjection / ViewState
             ├─ Headless observation / replay
             └─ next DecisionContext
```

硬约束：

1. Action registry 可读隔离 snapshot、构建 Effect Group，不直接替换 committed root。
2. Effect Session 只能从 StateStore `beginWorkingCopy()` 建立 working state；queue 清空、无等待输入且 invariant 通过时只提交一次。
3. Browser renderer、DOM handler、headless adapter 与 Policy 不调用领域 continuation，不持有 pending 真相。
4. 失败、stale、越权、timeout、未知 family 或未通过 validator 的输入不修改 state、journal 或 confirmed replay cursor。
5. 同一 committed/session 来源投影 BrowserProjection 与 observation；宿主不得各自维护规则切片。

## 持久化包

稳定边界包含：

```js
{
  committed: {
    schemaVersion: "seti-committed-game-state-v1",
    stateVersion,
    serializedState,
  },
  activeSession: null | {
    schemaVersion: "seti-effect-session-checkpoint-v1",
    baseVersion,
    checkpoint,
  },
  replay: {
    schemaVersion,
    confirmedCursor,
    entries,
  },
  summaries: { actionLog },
  host: { viewState },
}
```

权威顺序固定为：committed snapshot；同 baseVersion 的 active session checkpoint；confirmed replay；只读摘要；可丢弃 ViewState。后三级不能覆盖前两级事实。

允许保存的时机：

| 边界 | 保存内容 | 恢复语义 |
|---|---|---|
| 无 active session | committed + confirmed cursor | 安装 StateStore 后请求下一输入 |
| `awaiting_input` | committed base + 完整 session checkpoint | 恢复同一 decision id/version、choices 与 working state |
| 确定性 Effect 之间 | committed base + session checkpoint | 从下一 Effect 继续，不重复 RNG/journal/history |
| irreversible barrier 后 | committed base + locked session + provenance | 保持锁定，不回滚或重抽 |
| Effect 同步执行中 | 不保存 | 等原子 Effect 完成/失败；crash 只重放 confirmed cursor |

## 恢复顺序与拒绝语义

1. 校验外层包和 committed/session/replay schema。
2. 反序列化当前 StateStore schema，校验 root、RNG、sequence 与领域 invariant。
3. 若存在 session，校验 `baseVersion`、decision revision、queue、barrier 和 confirmed cursor。
4. 从 committed/session 同一源重建 BrowserProjection 或 observation。
5. 推进新的 Policy request generation，使恢复前响应全部 stale。
6. 可选用 confirmed replay 验证 state、RNG 与 cursor，不以 replay 覆盖 snapshot。

只接受当前 schema。版本 1、缺版本、未知 save/ruleset/action/effect/decision schema、未知 root 与损坏 JSON均结构化拒绝；不调用 restore port，不写状态，也不尝试迁移。

## RNG、journal、history 与 replay

| 数据 | owner | 规则 |
|---|---|---|
| `StateStore.meta.rngState` / `sequences` | StateStore | committed 边界后的下一位置和稳定 id |
| session `journal.rng/events/decisions` | Effect Session | 当前 working 流程已消费的确定性事实 |
| undo frame / barrier | Effect Session | session 内撤销与隐藏信息边界 |
| confirmed replay | runtime/headless facade | 每个外部 Action/Decision 至多一条 |
| action log | formatter/projection | 人类可读摘要，不参与恢复 |
| ViewState | Browser Host | 可清空重建，不影响合法性和流程 |

## 验收

- StateStore inventory 只含正式组件，owner/source/target 完整。
- 禁用状态 adapter、旧切片 projection、旧 candidate/selector 和 migration 元数据的生产引用为 0。
- 新存档 round-trip、非零 checkpoint fork、replay/RNG/cursor parity 通过。
- 旧/未知 schema、stale decision、非法 Policy 输出和未知 family 全部 fail-closed。
- 固定 seed Browser/Headless parity、完整 headless、多席 Chrome 与 Browser Services recovery 通过。
