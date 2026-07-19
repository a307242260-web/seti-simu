# GameRuntime 装配、持久化与恢复总契约

## 结论与用途

本文件是 SETI-45 对现有迁移链的总装配契约，不新建另一套 runtime，也不替代各总控的详细协议：

- SETI-56 / `docs/standard-action-contract.md`：Standard Action 的枚举、校验和业务语义。
- SETI-62 / `docs/effect-session-runtime.md`：Effect Session、Decision、queue、journal、undo、checkpoint 与不可逆边界。
- SETI-71 / `docs/committed-game-state.md`：CommittedGameState、StateStore、schema migration、RNG 与稳定编号。
- SETI-72 / `docs/browser-host-ui.md`：Browser Projection、ViewState、Input Adapter 与 Browser Services。
- SETI-90 / `docs/policy-port-contract.md`：启发式和 Learned Policy 的公共决策端口。

目标形态只有一个可实例化的 `GameRuntime` 装配根。每局拥有独立 StateStore、Effect Session、Lifecycle 状态、RNG、稳定编号、journal 与宿主请求代次；浏览器、headless、训练和机器玩家只通过窄端口使用它。传统 `window.Seti*` 可以继续承载不可变模块定义和 factory，但不能承载某一局的可变事实。

当前实现仍处于迁移期：`app.js` 和部分 app runtime 继续持有 legacy slices、pending 与 continuation；headless 同 isolate reset 仍会重建传统模块/runtime 注册表。下文描述目标契约、迁移归属和删除条件，不把 reference core 或文档存在误报为生产热路径已经完成。

## 一、唯一装配根

目标公开 factory：

```js
const runtime = createGameRuntime({
  game: { gameId, rulesetVersion, seed, config },
  definitions: {
    actionRegistry,
    effectRegistry,
    lifecycleRules,
    invariantValidators,
    migrations,
  },
  services: {
    clock,
    idFactory,
    diagnostics,
  },
});
```

`createGameRuntime()` 创建并唯一持有：

```text
GameRuntime instance
├─ StateStore                 唯一 committed owner
├─ EffectSessionHost          唯一 working state / queue / decision owner
├─ Lifecycle coordinator      只把 setup/turn/round/terminal 规则编成 Action/Effect
├─ RNG + stable sequences     每局实例状态，持久化到 committed meta / session journal
├─ Replay + history facade    只读导出和恢复入口，不是第二份状态
├─ request generation         Policy / async host 请求失效边界
└─ subscriptions/dispose      commit event、宿主观察与资源清理
```

factory 不接收 DOM、localStorage、renderer、AI valuation、训练器或 worker。Browser/Headless/Training 在 runtime 创建后分别挂 adapter；Policy 只收 runtime 生成的只读 DecisionContext。

### 依赖方向

```text
immutable definitions / registries
          │
          ▼
     GameRuntime factory
          │
          ├─ StateStore snapshot ───────────────┐
          │                                     │
          ├─ ActionRegistry enumerate/validate  │
          │              │                      │
          │              ▼                      │
          ├─ EffectSession working copy ────────┤
          │              │ compareAndCommit     │
          │              ▼                      │
          └────────── StateStore committed ◄────┘
                         │
            projection / observation / events
                         │
                Browser / Headless / Policy
```

硬约束：

1. StateStore 不依赖 Action、Effect Session、UI、Policy 或宿主。
2. Action registry 可以读取隔离 snapshot 并构建 Effect Group，不能直接替换 committed state。
3. Effect Session 从 `snapshot + baseVersion` 建 working copy；只有 queue 清空、无 awaiting decision/trigger 且不变量通过时调用 `compareAndCommit`。
4. Lifecycle 不是与 Effect Session 并列的第二套推进器。它只提供 setup、turn、round、terminal 的纯规则与 Effect 构建，由同一 session 执行。
5. Browser、Headless、Policy 不调用领域 continuation，不持有 pending 真相，也不绕过 Action/Decision 入口。
6. registry 在装配完成后不可变；运行中注册、覆盖或按局修改 definition 均 fail-fast。

## 二、宿主与兼容面的最终职责

| 当前入口 | 最终保留 | 必须迁出 | 删除条件 |
|---|---|---|---|
| `randomizer/app.js` | 浏览器默认局的 composition、adapter 接线、顶层错误呈现 | 权威状态、pending、规则 continuation、直接 reset 领域闭包 | Browser Host 全部正式输入和 projection 改走 runtime 端口 |
| `window.Seti*` | 不可变模块 API、definition、factory；兼容传统脚本顺序 | 当前局 state、RNG、序列、缓存、listener、active session | 同进程创建两局不共享可变引用，dispose 后无残留 |
| `headless-env.js` | `reset/observe/legalActions/step/checkpoint/replay/dispose` adapter | 自建合法性、AI resolver、UI no-op 推进、全局单例状态 | 每个 env 只委托一个 GameRuntime，fresh/reset 结果一致 |
| `public-api.js` | 当前 runtime 的只读 facade 和显式 command | 暴露 mutable slices、内部 registry、DOM callback、直接领域 mutation | public API contract 只返回隔离数据并提交标准命令 |
| Browser Services | local persistence、下载、debug、可选 ViewState | 规则判断、checkpoint 内容拼装、恢复后直接续跑 | save/load 只调用 runtime serialize/restore，服务失败不改规则事实 |
| Policy Host | 请求时机、timeout/cancel、输出校验与提交 | 规则执行、Effect drain、history mutation、单步 fallback | 启发式/Learned 均只返回一个 Standard Action/Decision |

兼容期允许 `app.js` 创建浏览器默认 runtime 并把 facade 暴露为 `window.SetiRandomizer`。这个默认实例不是全局架构要求；测试、headless worker 和未来服务端可以直接调用 factory 创建自己的实例。

## 三、多实例、reset 与 dispose

### 多实例

同一 JS isolate 内允许：

```js
const gameA = createGameRuntime({ game: { gameId: "A", seed: 11, ... } });
const gameB = createGameRuntime({ game: { gameId: "B", seed: 29, ... } });
```

两局可以共享深冻结的 definition/registry 表，不能共享以下可变对象：StateStore、session、RNG state、sequence、journal、history、cache、subscription、timer、Policy request generation 或宿主 adapter 状态。A 的 Action/Decision/reset/dispose 对 B 的 snapshot bytes、legal set、RNG cursor 与 replay cursor 必须无影响。

迁移完成前，训练 worker 仍可用独立 Node isolate 隔离传统全局模块；这只是过渡隔离，不替代同 isolate 多实例目标。

### reset

`runtime.reset(config)` 表示在同一 runtime facade 中开始一局全新游戏：

1. invalidate 全部 Policy/async request，推进 request generation；
2. 中止或明确封存 active session，不把旧 working state 带入新局；
3. 释放旧局 subscriptions、timer、cache 和宿主 continuation；
4. 用新 `gameId/rulesetVersion/seed/config` 创建全新 StateStore 与确定性状态；
5. 通过共享 Lifecycle setup 生成初始 Action/Decision；
6. 返回新一代只读 projection/observation。

reset 后不得依赖重新 `require()`、重新加载 `<script>`、清空 DOM 或重建 worker 才能获得正确初态。同实例 A/A、A/B/A 与 fresh A 的 committed snapshot、legal set、RNG/replay cursor 必须一致。

### dispose

`dispose()` 永久关闭实例：取消异步请求、清理 listener/timer、使 facade 后续命令 fail-closed。dispose 不删除外部持久化文件，也不修改其他 runtime。

## 四、统一持久化包

目标 envelope：

```js
{
  schemaVersion: "seti-game-save-v1",
  saveId,
  savedAt,
  game: {
    gameId,
    rulesetVersion,
    config,
  },
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
  summaries: {
    actionLog,
  },
  host: {
    viewState,
  },
}
```

权威性从高到低固定为：

1. `committed.serializedState`：StateStore 已提交事实。
2. `activeSession.checkpoint`：可选的非零 working state、queue、Decision、undo frame、barrier 与 journal；只能基于同一 committed `baseVersion`。
3. `replay.entries`：已确认的外部 Action/Decision，用于验证、重建和 worker 恢复，不覆盖 snapshot 中的事实。
4. `summaries.actionLog`：面向人阅读的派生摘要，不作为恢复真相。
5. `host.viewState`：可丢弃的浏览器视图状态；损坏时清空重建，不影响规则。

禁止把 legacy slices、CommittedGameState 和 session working state 三份同时双写为并列真相。旧存档只能经版本 adapter 单向迁移到上述 envelope。

## 五、允许的存档点

| 存档点 | 必须保存 | 恢复语义 |
|---|---|---|
| 无 active session 的 committed 边界 | committed + confirmed replay cursor | 直接恢复 StateStore，再由 Lifecycle/Host 请求下一输入 |
| `awaiting_input` | committed base + 完整 session checkpoint + decision id/version | 恢复同一 queue/working state，重新展示/请求当前 Decision |
| 确定性 Effect 边界 | committed base + 完整 session checkpoint | 从下一 Effect 继续，不重复已写 journal/RNG/history 的步骤 |
| irreversible barrier 后 | committed base + locked session + barrier provenance | 恢复到 `irreversible_locked` 或明确恢复协议，禁止伪回滚重抽 |
| Effect 正在同步执行中 | 不允许直接持久化 | 等当前原子 Effect 完成/失败后再存；crash 只重放 confirmed cursor |

Browser 自动保存默认选择 committed 边界或稳定 session checkpoint。训练 checkpoint 可以更密，但必须使用相同 runtime checkpoint；训练器自身 optimizer/model/episode 进度属于另一个 training checkpoint，不进入游戏存档。

## 六、history、RNG、journal 与 replay 分工

| 数据 | 唯一所有者 | 用途 | 禁止用法 |
|---|---|---|---|
| `StateStore.meta.rngState` | StateStore | committed 边界后的下一随机位置 | 使用进程 `Math.random` 闭包作为唯一真相 |
| `StateStore.meta.sequences` | StateStore | 牌、火箭、数据、事件等稳定 id | 模块级 counter 跨局泄漏 |
| session `journal.rng` | Effect Session | 记录当前 session 已消费的随机结果与 provenance | 恢复时重新抽取替代已公开结果 |
| session `journal.replay` | Effect Session / runtime facade | 已接受的 Action/Decision confirmed cursor | 把确定性 drain 伪装成 Policy 决策 |
| undo frames / barrier | Effect Session | session 内撤销与不可逆边界 | 由 Browser history 自行回滚 working state |
| domain history payload | Effect Session result | 规则级撤销/展示所需事实 | 作为第二份 committed state |
| action log | projection / formatter | 人类调试与下载 | 用 UI 文本反推恢复状态 |

一次外部 Action/Decision 最多写一个 confirmed replay step；确定性 Effect、trigger、收入和环境推进只写 environment/journal event。失败、stale、越权、timeout 或未通过 validator 的输入不得占用 confirmed cursor。

## 七、恢复顺序与跨版本策略

统一恢复顺序：

1. 解析外层 `seti-game-save-*`，未知版本 fail-closed。
2. 根据 `rulesetVersion` 选择兼容的不可变 definitions/registries；缺少原规则集时不能静默用最新版。
3. 对 committed schema 逐版本 migrate；校验所有 root slices、RNG、sequence 和领域不变量。
4. 创建新的 GameRuntime 实例并安装 StateStore snapshot。
5. 若有 active session，校验 `baseVersion === committed.stateVersion`、checkpoint schema、queue/decision、barrier 和 confirmed replay cursor 后恢复。
6. 从 committed/session 同一源重建 derived state、BrowserProjection 或 observation。
7. 创建新的 Policy request generation；旧进程/旧局响应全部失效。
8. 可选执行 replay 验证：相同 seed/config + confirmed entries 应得到相同 state、RNG 与 cursor；不一致时报告版本/事件位置，不覆盖存档。

跨版本规则：

- 存档迁移只转换数据结构，不偷偷改变玩法结论。
- replay 默认使用原 `rulesetVersion`；若要迁移 action schema，必须有显式逐步 adapter 和可验证的语义说明。
- 旧 action log 文本不参与迁移。
- 未知 Effect、Decision、Action family、RNG provenance 或 barrier 一律 fail-closed，并保留诊断信息。

## 八、现有 issue 推进映射

更新于 2026-07-19：

| 契约范围 | 当前 issue | 当前状态 | 下一门 |
|---|---|---|---|
| Action registry / 单一执行入口 | SETI-56 | done | 后续只消费，不重做 |
| Session core、代表链、journal/RNG/replay | SETI-62 / 64-67 | done 到 Stage 5 | 继续由宿主 adapter 消费 |
| Browser Effect Session adapter | SETI-68 | done，commit `fd8da79` | 已核验并解锁 SETI-69 |
| Headless / training Effect Session adapter | SETI-69 | running，run `d6bf23a3` | 完成后核验 SETI-70 全链路收口前置 |
| committed schema、recovery adapter、RNG/sequence | SETI-71 / 82-85 | done 到 Stage 5 | SETI-86 compare-and-commit 已解锁并运行 |
| Effect Session → StateStore CAS | SETI-86 | running，run `71927d04` | 完成后核验 SETI-87 投影/observation |
| Browser Projection/Input/Services | SETI-72 / 73-81 | waiting on SETI-71 | StateStore 稳定端口后从 SETI-73 串行推进 |
| Policy 公共端口 | SETI-90 / 91 | contract done | SETI-92 独立 Heuristic Policy 正在执行 |
| 宿主席位与最终跨宿主集成 | SETI-93 / 94 | backlog | 逐项等待 SETI-92、68/69、87 与 Browser Host 前置 |

SETI-45 不复制这些实现 issue。它负责维护本总契约、检查 stale `waiting_on`、在一个阶段完成后重新读取下一 sibling 的完整描述，并只解锁全部显式前置已满足的阶段。

## 九、收口标准

以单元测试为主要证据；只有修改 Browser 或训练宿主时补对应的最小集成检查。总契约完成至少满足：

1. factory 可在同一 isolate 创建两局，A/B 的 state、session、RNG、sequence、journal 与 request generation 无共享可变引用。
2. 同实例 A/A、A/B/A 与 fresh A reset 结果一致，不依赖模块 reload、DOM 重建或 worker 重启。
3. Standard Action 只经 Action registry；所有流程只经 Effect Session；正式事实只经 StateStore compare-and-commit。
4. stable committed、awaiting decision、普通 Effect 边界和 irreversible locked 四类存档恢复均保持 state/session/RNG/replay cursor 一致。
5. 旧 schema 有单向迁移；未知 save/ruleset/action/effect 版本 fail-closed。
6. Browser、Headless、Heuristic/Learned Policy 提交同一标准输入，不拥有第二套 pending/resolver/合法性。
7. `app.js`、`window.Seti*`、public API 和 host services 不再暴露或持有跨局可变规则真相。
8. 兼容 adapter 均有 owner、覆盖范围和删除条件；SETI-70、88、81、94 收口时核对旧入口归零。

## 非目标

- 不引入前端框架、DI 框架、事件总线框架或第二套 GameRuntime。
- 不因落本契约而重开 SETI-62、71、72、90 已覆盖的实施范围。
- 不调整游戏规则、AI 权重、奖励函数、PPO 算法或页面视觉。
- 不要求每次改动执行多层复杂门禁；默认单元测试，按实际宿主改动补最小检查。
