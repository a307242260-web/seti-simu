# SETI Effect Session Runtime 契约与迁移总图

## 目标、边界与当前完成度

Effect Session 是 Standard Action 与浏览器/训练宿主之间唯一共享的流程执行协议。SETI-56 负责 Action family、合法项和业务 handler；本契约从 Action 已被接受并生成 Effect Group 开始，负责队列顺序、外部选择、快速行动、working state、提交/回滚、事件和 replay journal。

阶段 0/1 reference core 位于 `randomizer/game/effects/session-runtime.js`。阶段 2 的研究科技贯穿参考链位于 `randomizer/game/effects/research-tech-session.js`，固定为 `旋转 → 科技 DecisionEffect → 放置 → 即时奖励 → commit`。阶段 3 的扫描与打牌代表链位于 `randomizer/game/effects/scan-card-session.js`：扫描固定覆盖 `多目标 DecisionEffect → 扫描 → 扇区 DecisionEffect → 参与奖励 → trigger → 延迟补牌`，打牌固定覆盖 `支付 DecisionEffect → 卡牌顺序效果 → 任务/被动 trigger → 新 DecisionEffect`。阶段 4 的 `randomizer/game/effects/quick-action-session.js` 把 Standard Action `phase=quick` descriptor 校验与 Effect interrupt 接到同一入口，拒绝 main/turn-control family 和旧 quick executor 旁路。阶段 5 在 reference core 内统一 main/quick history、确认输入 replay cursor、RNG/result、checkpoint/fork、Effect undo 和 irreversible barrier；行为矩阵位于 `randomizer/game/effects/session-journal.test.js`。阶段 6 的浏览器输入宿主位于 `randomizer/app/effect-session-host.js`。阶段 7 的训练宿主位于 `randomizer/app/headless-effect-session-host.js`：headless/worker 只提交 Standard Action/Decision，确定性推进、唯一选择和当前 Effect 都由同一 session drain，observation/legal choices 在 session `workingState` 对应的同步状态上投影，并把 session journal 固化到每个训练 replay step。阶段 8 已把旧 pending 创建入口收敛到 `legacy-flow-inventory.js`：52 项中 2 项为 host-only，其余 50 项是 owner 为 `SETI-72/browser-host-stages-5-9`、到期日为 `2026-08-31` 的单向兼容 adapter。`tools/audit_effect_session_legacy.js` 会列出剩余 callsite，并在未知字段、缺字段或 adapter 过期后非零退出；传统 app 兼容路径仍不得误报为 deleted/session-owned。

核心的禁止依赖：DOM、overlay/button、localStorage、render callback、AI valuation/planner、具体 Policy、领域 continuation。宿主可以注册纯 executor、提交 Action/Decision、读取可见投影和持久化稳定结果，不能在 runtime 外偷偷推进规则。

## 数据契约

所有公开 envelope 使用 `schemaVersion=seti-effect-session-v1`。

### Effect Group

```js
{
  groupId,                 // session 内稳定 id
  kind,                    // action | quick | spawned | internal
  ownerId,
  action,                  // 原 Standard Action 的可序列化副本
  effects: [Effect]
}
```

Effect Group 内的原始顺序就是规则顺序。宿主或 executor 不得按 UI 布局、估值或 effect type 重排。

### Effect / DecisionEffect

```js
{
  effectId,
  groupId,
  groupKind,
  type,                    // executor registry key
  kind,                    // effect | decision
  ownerId,
  decisionKind,
  allowQuickActions,
  payload,
  source                   // parentEffectId / priority 等 provenance
}
```

Effect 与 DecisionEffect 都是纯数据，不携带闭包、DOM、Policy 或宿主 callback。`effectId` 是 decision/replay/stale validation 的身份；显示 label 不参与身份。

普通 executor 接受 workingState 的克隆，必须返回：

```js
{
  ok: true,
  nextState,
  events: [],
  spawnedEffects: [],
  rng: [],
  history: [],
  log: null,
  irreversible: null
}
```

缺失 `nextState`、未知 executor、executor 抛错或未知 spawned priority 都结构化失败。executor 无法直接持有并修改 session 内部 workingState；runtime 只采纳返回的 `nextState` 副本。

Decision executor 额外实现：

- `getLegalChoices(workingState, effect)`：只读枚举当前合法项。
- `resolveDecision(workingState, effect, choice)`：仅执行 runtime 已重新确认仍合法的提交项，并返回普通 Effect result。

Decision submission 必须同时匹配 `decisionId` 与 `decisionVersion`。快速行动或其他 workingState 变化会推进 revision，使旧提交明确返回 `EFFECT_DECISION_STALE`。

### Effect Session

```js
{
  sessionId,
  phase,
  baseVersion,
  baseState,
  workingState,
  committedState,
  queue,
  revision,
  journal: {
    actions, decisions, effects, events, rng, history, logs, replay
  },
  irreversibleBarrier,
  failure
}
```

`baseState`、`workingState`、`committedState` 互不共享可变引用。session 内渲染和 Policy observation 都由 `observe()` 对同一 workingState 做 viewer-specific projection。配置 `stateStore` 的生产 runtime 由 `dispatchStoredAction()` 从 `beginWorkingCopy()` 建立 session，并在 `compareAndCommit()` 成功返回递增版本 snapshot 后才进入 `completed`；宿主不得再做第二次替换。未配置 store 的 `dispatchAction()` 只保留为 reference/test 模式。

## 状态机

| phase | 进入条件 | 允许操作 | 退出条件 |
|---|---|---|---|
| `idle` | 宿主无活跃 session；不是 session 对象内部 phase | 枚举/提交 Standard Action | `dispatchAction` 创建 session |
| `session_open` | 克隆 committedState，捕获 baseVersion | Action 生成 Effect Group | group 合法后进入 `action_accepted` |
| `action_accepted` | 初始队列已建立 | `advance/drain`；允许的边界可 quick interrupt | 执行首 Effect、等待输入或提交 |
| `effect_running` | runtime 正同步执行一个确定性 Effect | 宿主不可重入 | 结果原子采纳后进入 `draining` |
| `awaiting_input` | 队首是 DecisionEffect | `inspect/observe/resolveDecision`；若声明允许可 quick interrupt | 合法 decision、abort 或 interrupt |
| `interrupting` | Quick Action group 插在当前 Effect 前 | 执行 quick group；禁止嵌套 interrupt | 内部 resume marker 恢复原 Effect |
| `draining` | 队列仍有确定性 Effect/trigger | `advance/drain`；显式允许的边界可 quick interrupt | decision、queue empty 或失败 |
| `committing` | queue empty 且无 awaiting decision/trigger | 版本校验、不变量校验、journal 固化 | `completed` 或失败分流 |
| `completed` | current version 与 baseVersion 一致且不变量通过 | 读取稳定 committedState/result | 终态 |
| `aborted` | 屏障前失败/宿主中止 | 读取 failure 和恢复后的 baseState | 终态 |
| `irreversible_locked` | 已越过隐藏信息/外部副作用屏障后失败 | 读取 failure、barrier 和 journal，进入恢复流程 | 终态；不得伪装回滚 |

`advance()` 每次最多执行一个 Effect 或内部 resume 边界；`drain()` 只循环确定性步骤，到 `awaiting_input` 或终态停止，并有强制步数上限。DecisionEffect 绝不由 drain 自动选第一项。

## 队列、插入和快速行动排序

一个 Effect 成功后先从队首移除，再把它返回的 spawnedEffects 插在原队列之前。稳定优先级为：

1. `direct`：当前 Effect 的规则内直接子效果。
2. `trigger`：由当前结果触发的被动/任务等效果。
3. `deferred`：声明为当前 Effect 之后、原队列之前的延迟结算。
4. 原 Effect Group 的后续节点。

同一优先级保持 executor 返回顺序；多级嵌套按深度优先执行，因此子节点产生的新 direct child 先于其同级后续节点。未知 priority 直接 abort，不猜测顺序。

Quick Action 只在同步 Effect 之间的边界插入，不能打断 `effect_running`。宿主必须显式确认普通边界允许中断；DecisionEffect 只有 `allowQuickActions=true` 才允许。runtime 把 quick group 和内部 resume marker 插到当前 Effect 之前；quick group 与其 spawned children 清空后，恢复原队列。当前实现 fail-closed 拒绝嵌套 quick interrupt。

`createQuickActionCoordinator()` 只接受 Standard Action registry 当前 workingState 校验通过、且 family/descriptor 都声明 `phase=quick` 的 descriptor；它只构建 Effect Group，不调用旧 Standard Action `execute()`、quick history 或 AI resolver。非法 descriptor、构建失败、嵌套中断和同步 Effect 内重入均 fail-closed，不能改 workingState、queue、journal 或稳定 id 序列。

若原节点是 DecisionEffect，interrupt 被接受时立即推进 revision，使旧 `decisionVersion` 当刻失效；恢复时基于最新 workingState 再跑 `getLegalChoices` 并再次推进 revision。过期版本或已移除 choice 都只返回结构化拒绝，不写 decision journal、不执行 resolver。宿主必须展示/消费新 snapshot。

`journal.actions[].groupKind` 与 `journal.effects[].groupKind` 明确区分 `action` / `quick`；逐 Effect trace 还固定记录 `effectId/groupId/type/revision`。领域 history 保留原业务 payload，但不得再靠独立 quick history 推进或回滚 session。

## 事务、journal 与不可撤销语义

- reference beginSession 捕获 committedState 的深拷贝与 `baseVersion`；store-backed session 只消费 `beginWorkingCopy()` 返回的同 schema candidate/baseVersion。
- 每个 executor 只看到 workingState 克隆，成功结果作为一次原子 revision 采纳。
- queue 非空、队首 DecisionEffect、未消化 spawned trigger 时都不会进入 commit。
- reference commit 前重新读取权威版本并运行 runtime 不变量；store-backed commit 在 runtime 校验后只调用 `compareAndCommit(baseVersion, workingState, { sessionId, journal })`，由 CAS 统一裁决版本/schema/领域不变量。CAS 成功前不得暴露 `completed`。
- 屏障前任何失败恢复 `workingState=baseState`，清空 queue，终态为 `aborted`。
- executor 对抽牌、翻牌、外星人揭示或已发出的外部副作用返回 `irreversible`。屏障后失败保留 workingState/journal 并进入 `irreversible_locked`，交由宿主执行恢复协议，不能丢弃状态后声称撤销成功。
- RNG/result 必须由实际随机 executor 写入 `journal.rng`；Policy decision 写入 `journal.decisions`；确定性事件写入 `journal.events`。replay 层据此区分外部 timestep 与环境 drain。
- `journal.replay` 只记录 runtime 已接受的 main/quick Action，以及 resolver 成功并被原子采纳的 Decision。每项带连续 `cursor` 和 `confirmed=true`；确定性 Effect 只写 `effects/events/rng/history/logs`，不占外部 replay step。resolver 抛错或返回失败时不得预写 decision/replay。
- 每个成功 Effect 都在 session 内形成一个统一 undo frame。frame 恢复 workingState、queue、revision、journal cursor、序列和 interrupt context；屏障后的确定性 frame 可以逐步撤销，产生屏障的 frame 和屏障以前的 frame一律拒绝。
- `seti-effect-session-checkpoint-v1` 只允许在 Effect 边界建立，保存完整非零 session、undo frames 和已确认 replay cursor。恢复时要求 cursor 与 `journal.replay` 逐项连续匹配；两个 fork 从同一 checkpoint 接受相同 Decision 时，RNG/result、cursor、journal 与 committedState 必须一致。

## 浏览器与训练共用宿主 API

| API | 宿主职责 | runtime 保证 |
|---|---|---|
| `registerExecutor(type, executor)` | 在装配时注册纯规则 executor | 重复 type 和无效接口 fail-fast |
| `dispatchAction(committedState, action, createEffectGroup)` | 提交已验证 Standard Action 与 group builder | 创建隔离 session，不修改输入 state |
| `dispatchStoredAction(action, createEffectGroup)` | 生产宿主提交 Action，不传第二份权威 state | 从 StateStore working copy 建 session，完成态只由 CAS 产生 |
| `inspect(session)` | UI/worker 查询 phase、queue、decision、failure | 不暴露可变内部引用 |
| `advance(session)` | 调试、动画或逐 Effect replay 推进一步 | 单 Effect 原子执行，不跨策略边界 |
| `drain(session)` | 浏览器/训练消化确定性流程 | 到 decision/terminal 停止，带上界 |
| `resolveDecision(session, submission)` | 玩家或 Policy 提交同一个标准 Decision | 重新校验 id/version/legal choice |
| `dispatchQuickAction(session, action, builder, options)` | 在规则允许边界提交 Quick Action | 插入、恢复、decision revalidation |
| `observe(session, viewer)` | 浏览器渲染或训练 observation | 两端基于同一 workingState 投影 |
| `abort(session, reason)` | 宿主取消或恢复流程 | 屏障前回滚；屏障后拒绝伪回滚 |
| `undoLastEffect(session)` | 在 Effect 边界请求撤销最近确定性步骤 | 同时恢复 state/queue/journal/RNG cursor；不可越过屏障 |
| `createCheckpoint(session)` / `restoreCheckpoint(checkpoint)` | crash/timeout 前后保存或恢复非零 session | 只接受稳定边界与连续 confirmed replay cursor |
| `getConfirmedReplay(sessionOrCheckpoint, cursor)` | 宿主读取 crash 后允许重放的外部输入 | 不返回等待中、失败或尚未原子采纳的 Decision |

浏览器 adapter 的目标形态是 `click -> Standard Action/Decision -> runtime`，render 只消费 `observe()`。训练 adapter 已固定为 `step(action) -> dispatch/resolve -> drain -> observation/reward/replay`，并由 `headless-effect-session-host` 统一 Action、Decision、deterministic Effect、checkpoint 和 confirmed journal；两端不得各自拥有 pending resolver。

公司/外星人领域 adapter 位于 `randomizer/game/effects/industry-alien-session.js`。它不新增第二套 choice identity：公司 picker、痕迹、机会、牌、任务和物种分支分别映射到既有 conditional Standard Action family，并以六类 `decisionKind` 暴露 presentation 语义。领域 followup 只能声明为 direct/trigger/deferred 的 Decision 或 Effect；未知 kind/species/family/followup 一律终止 session。八物种与公司行为矩阵、旧 resolver 零调用及 browser renderer 证据见 `checkpoint/seti-78-proof-obligations.md`。

## 旧流程覆盖矩阵

下表以 `randomizer/game/effects/legacy-flow-inventory.js` 的 52 项字段为权威 inventory；`randomizer/app/runtime.js#createPendingState` 只消费该清单，不再复制默认值。`dated-adapter` 表示只能在明确 owner/到期日内映射成 Effect/DecisionEffect；`session-owned` 表示迁移后由 session/journal/phase 直接取代；`host-only` 表示纯显示/序号状态可留在宿主，但不得推进规则。

| 领域 | 当前字段 | 标准阶段/目标 | 首批迁移 |
|---|---|---|---|
| 通用选择 | `discardAction`, `cardSelectionAction`, `passReserveSelection`, `passReserveSelectionDismissed` | DecisionEffect；dismiss 是 choice 而非旁路 flag | 卡牌/支付阶段 |
| 扫描 | `scanTargetAction`, `probeSectorScanAction`, `probeLocationRewardAction`, `publicScanQueue`, `scanRunSequence`, `handScanAction` | target/reward DecisionEffect + nested Effect；序号转 journal id | 扫描代表链 |
| 外星人痕迹 | `alienTraceAction`, `alienTracePickerState`, `alienRevealConfirmation`, `turnEndAfterRevealContinuation` | DecisionEffect + reveal Effect/barrier + spawned continuation | 外星人/回合末阶段 |
| 登陆 | `landTargetAction` | Standard Action target 或 DecisionEffect adapter | Standard Action 后续 |
| 卡牌触发 | `cardTriggerAction`, `cardTriggerFreeMove`, `type1TriggerEvents`, `cardTaskCompletion` | trigger priority + DecisionEffect；事件进 journal | 打牌代表链 |
| 九折 | `jiuzheCardPlay`, `jiuzheOpportunityOpen`, `jiuzheOpportunityQueue` | card DecisionEffect + spawned trigger queue | 外星人批次 |
| 异常点 | `yichangdianCardGain`, `yichangdianCornerAction` | card/reward DecisionEffect | 外星人批次 |
| 半人马 | `banrenmaCardGain`, `banrenmaOpportunity`, `banrenmaOpportunityQueue` | DecisionEffect + trigger queue | 外星人批次 |
| 虫族 | `chongCardGain`, `chongFossilChoice`, `chongTaskCompletion` | card/reward/task DecisionEffect | 外星人批次 |
| 阿米巴 | `amibaCardGain`, `amibaSymbolChoice`, `amibaTraceRemoval` | card/branch/target DecisionEffect | 外星人批次 |
| 奥陌陌 | `aomomoCardGain` | card DecisionEffect | 外星人批次 |
| 符文族 | `runezuCardGain`, `runezuSymbolBranch`, `runezuFaceSymbolPlacement` | card/branch/placement DecisionEffect | 外星人批次 |
| 策略/海盗 | `strategyPassiveSlotChoice`, `piratesRaidPlacement` | reward/target DecisionEffect | 公司能力批次 |
| 旧 Action 流 | `actionExecuted`, `passPlayerId`, `actionEffectFlow`, `actionHasIrreversibleBarrier`, `actionIrreversibleReason` | phase/owner/queue/barrier，全部 session-owned | 研究科技 reference 热路径已迁移且禁用旧队列；网页兼容 adapter 尚未迁移 |
| 移动/手牌支付 | `movePayment`, `playCardSelection`, `futureSpanPlayBeforePlayer`, `handCardPlayAction`, `cardCornerQuickAction`, `cardCornerFreeMove` | payment/card DecisionEffect + quick interrupt | 打牌/quick 阶段 |
| 数据/公司 | `dataPlaceAction`, `industryAbility` | target/reward DecisionEffect + Effect group | quick action 阶段 |

当前 inventory 之外仍有 app 模块 continuation、UI runtime flag、两个 action history、refresh 调度和 AI pending resolver。迁移矩阵验收不能只看 52 字段减少，还必须证明以下旧责任从已迁移热路径不可达：

- `abilities.chain` 不再作为第二套队列/插入状态机。
- `actionHistory` / `quickActionHistory` 不再各自决定事务边界，改为消费 session journal。
- `renderAll`、overlay callback 和 DOM click 不再调用领域 continuation 推进规则。
- AI automation 不再按 pending priority 选择或自动 resolve 多选项。
- headless 未识别 pending 不再 recover/skip；显式返回 unsupported 并停止。

## Proof obligations 与证据计划

| ID | 可证伪命题 | 最小反例 | 阶段 1 证据 | 完整迁移证据 |
|---|---|---|---|---|
| ES-01 顺序 | 任意 group 及嵌套 spawnedEffects 严格按 direct→trigger→deferred→原队列执行 | trigger 抢在直接奖励前，或嵌套 child 跑到 sibling 后 | nested order 行为测试 | 研究/扫描/打牌固定 trace |
| ES-02 原子 Effect | executor 失败前不采纳半个 nextState | executor 先改 session 引用再抛错 | clone boundary + thrown rollback test | 领域 executor mutation spy |
| ES-03 Decision owner | 多个非等价项必停在 owner 的 awaiting_input | drain 取首项或 AI resolver 代选 | choose-tech pause test | 每 conditional family 多选合约，resolver spy=0 |
| ES-04 stale | workingState 变化后旧 decisionId/version 不可执行 | quick action 删除 target 后仍接受旧按钮 | interrupt/revalidation test | 每可中断 DecisionEffect stale fork |
| ES-05 commit gate | queue、decision、trigger 任一未清空不得替换 committedState | effect 1 后 UI/headless 已读到正式状态 | awaiting commit test | adapter 原子替换 spy + parity |
| ES-06 rollback | 屏障前任一失败回到完整 baseState，journal 不产生成功 commit | effect 2 异常污染资源 | executor/invariant/version failure tests | 多 slice checkpoint parity |
| ES-07 barrier | 隐藏信息已暴露后 abort 不得伪回滚 | reveal 后恢复旧牌堆让玩家重抽 | RNG + irreversible_locked test | 抽牌/翻牌/揭示 replay recovery |
| ES-08 parity | 浏览器与 Policy 对相同 Action/Decision trace 得到同 effect 顺序、投影源、结果和 journal | 两端各跑一套 resolver | viewer projection shared-state test | browser/headless fixed trace parity |
| ES-09 fail-closed | 未注册 executor/未知 priority/超限 drain 都停止并带诊断 | 静默跳过旧 effect 后 commit | unknown executor + loop limit tests | 未迁移 pending 注入 + forbidden-call spy |
| ES-10 version | commit 时权威版本必须仍等于 baseVersion | 并发 session 覆盖更新状态 | version conflict test | 双 session race/checkpoint test |

阶段 1 的测试文件是 `randomizer/game/effects/session-runtime.test.js`。阶段 2 的测试文件是 `randomizer/game/effects/research-tech-session.test.js`，覆盖旋转后的 workingState 决策、owner、多节点 commit gate、失败回滚、旧队列/continuation 调用为零及浏览器/Node 固定 trace parity。阶段 3 的测试文件是 `randomizer/game/effects/scan-card-session.test.js`，覆盖 SETI-60 Standard Action identity 映射、多次 DecisionEffect、direct/trigger/deferred/原队列稳定顺序、未知 pending/followup fail-closed、固定 journal replay 以及浏览器/Node workingState parity。阶段 4 的测试文件是 `randomizer/game/effects/quick-action-session.test.js`，覆盖普通边界与 awaiting_input、中断当刻 stale、恢复重枚举、过期 choice 无副作用、quick 内 DecisionEffect、嵌套/非法 family/同步 Effect 重入/畸形 group fail-closed、main/quick journal 隔离、旧 executor 调用为零和浏览器/Policy 固定 trace parity。阶段 5 的测试文件是 `randomizer/game/effects/session-journal.test.js`，覆盖屏障前完整恢复、揭示后拒绝伪回滚、屏障后逐 Effect undo、main/quick 单一 history 与 replay cursor、失败 Decision 不入 journal、非零 checkpoint 双 fork RNG/cursor parity，以及 timeout 只暴露已确认 Action。它们是 reference model 的行为证据，不替代后续完整网页 adapter、真实领域状态可达性、训练 checkpoint、完整对局和性能证据。

## 分阶段迁移与冲突边界

1. 阶段 0/1（SETI-62 总控）：冻结本契约与 reference core；不改 SETI-56 的 action handler 热路径。
2. 阶段 2：研究科技贯穿链。Standard Action 仍由 SETI-56 registry 拥有；本阶段只把 rotate→decision→placement→reward continuation 映射为 Effect Group。
3. 阶段 3：扫描与打牌代表链已落地；SETI-60 conditional Action descriptor 直接作为 DecisionEffect choice/journal identity，nested trigger 和多个 DecisionEffect 已由固定 trace 与 replay 验证。SETI-76 在同一 runtime 上补齐多参与者扫描奖励、延迟隐藏补牌、数据放置与登陆目标/支付链；Browser Host 只提交 inspect choices，旧 scan/data/land pending owner 与 continuation 在该迁移热路径为 0。完整旧网页兼容入口删除仍归阶段 6/7。
4. 阶段 4：已统一 Quick Action boundary、interrupt/resume 和所有可中断 decision 的 stale validation；Standard Action quick descriptor 通过单一 coordinator 接入，main/quick journal 可区分。
5. 阶段 5：已把 main/quick history、RNG/replay、undo 与 irreversible barrier 收口到 reference session journal，并固化 checkpoint/fork 与 confirmed replay cursor；旧浏览器 history 热路径的删除仍属于阶段 6/8 adapter 迁移。
6. 阶段 6：浏览器 adapter 只负责 dispatch/observe/render，删除对应 DOM continuation。
7. 阶段 7：headless/training adapter 只负责 Standard Action/Decision 与 observation/reward/replay，删除 policy/resolver drain。
8. 阶段 8：已建立 52 字段的可执行 inventory 与过期门禁，收窄为 2 个 host-only + 50 个有明确 owner/到期日的 adapter；已迁移 Browser/Headless host 的旧 resolver 引用保持为 0。剩余传统 app callsite 由机械报告持续暴露，不能伪报为已删除。

任何阶段更新矩阵状态时必须同时给出：真实状态构造、Effect/Decision 枚举、执行 trace、旧路径调用为零、失败语义和 replay/checkpoint 证据。只修改 label、删除字段或跑通一条 happy path不能升级为 completed。
