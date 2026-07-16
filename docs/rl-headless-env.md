# SETI RL Headless Env 契约（第一阶段）

本文定义 SETI 第一阶段强化学习 headless 环境的统一契约。目标不是直接实现 simulator，而是给后续 `simulator / training harness / evaluation harness` 提供唯一上游接口，避免继续围绕浏览器 UI、overlay 按钮或临时 pending 结构各自发明协议。

## 当前实现

- Node 入口：`randomizer/app/headless-env.js`，通过 `createHeadlessEnv()` 创建单局环境。
- 已实现 `reset / observe / legalActions / step / isTerminal / getReplay / loadReplay / createCheckpoint / loadCheckpoint / dispose`。
- 顶层行动通过 `action-runtime` 分发，pending/effect 由 AI 自动机直接调用运行时处理函数收敛，不依赖用户点击。
- Node composition 通过 `randomizer/app/view-adapter.js` 注入 no-op view adapter；运行时不创建或安装 `document`、DOM 元素、overlay、`localStorage`、`Image`。
- `randomizer/app/headless-env.test.js` 覆盖无 DOM 启动、固定 seed 的完整 4 人局、terminal、replay 重放一致性和 actor 校验。

传统脚本仍以 `globalThis` 作为模块注册表，Node 启动时临时把 `window` 名称指向该注册表以兼容 `window.Seti*` 命名空间；这里没有浏览器对象或 DOM 能力。`app.js` 根据 `SetiHeadlessRuntimeConfig` 选择 no-op view adapter，跳过固定 DOM 收集、事件绑定、渲染、浏览器持久化和首屏 shell 初始化。

## 1. 设计目标

- 训练环境只暴露公开信息与当前决策必需的自有私有信息。
- 一切可执行内容都统一成 `action`，不再区分“主按钮点击”“overlay 按钮点击”“确认弹窗”。
- `legalActions` 必须覆盖主行动、快速行动、子选择、效果确认和 recover/end-turn。
- 单局必须可按 `seed + 初始配置 + action 序列` 复盘；必要时可从 checkpoint 恢复。
- owner 语义必须稳定：执行者永远是 `pending owner -> effect owner -> current player` 解析出的玩家，而不是当前 UI 可见玩家。

## 2. 顶层接口

```js
interface SetiHeadlessEnv {
  reset(config?: ResetConfig): EnvState;
  observe(viewerPlayerId?: string): Observation;
  legalActions(viewerPlayerId?: string): LegalAction[];
  step(action: EnvAction): StepResult;
  isTerminal(): boolean;
  getReplay(options?: ReplayOptions): ReplayRecord;
  loadCheckpoint(checkpoint: EnvCheckpoint): EnvState;
}
```

### 2.1 `reset(config?)`

输入：

- `seed`: 随机种子，必须驱动所有可复现随机过程。
- `activePlayerCount`
- `humanSeatPolicy`: 训练场景通常为 `all_ai`，评估可保留人类席位配置。
- `aiControl`: 可选，仅用于复现浏览器现有 AI 控制快照。
- `scenario`: 可选预制局面或测试夹具 id。

输出：

- 初始化后的内部 `EnvState`。

### 2.2 `observe(viewerPlayerId?)`

返回给某个观察者玩家的观测。训练时默认传当前待决策玩家；离线评估也可以对任意玩家请求。

### 2.3 `legalActions(viewerPlayerId?)`

返回当前玩家此刻所有合法动作，顺序稳定，可直接映射为 action mask。若当前没有待决策，则返回空数组。

### 2.4 `step(action)`

语义：

- 只接受一条离散动作。
- 动作可以是顶层行动，也可以是 pending 子选择或效果确认。
- 必须校验 `action.actorPlayerId` 是否等于当前 `decision.actorPlayerId`。

输出：

```js
{
  ok: boolean,
  actionId: string,
  actorPlayerId: string,
  reward: RewardDelta,
  done: boolean,
  observation: Observation,
  legalActions: LegalAction[],
  replayEvent: ReplayEvent,
  error?: string,
}
```

### 2.5 `isTerminal()`

当且仅当游戏终局已确定，且没有待处理的终局标记、奖励结算、弃牌或 replay flush。

### 2.6 `getReplay()`

输出可复盘记录，至少包含：

- `seed`
- 初始配置
- action 序列
- 每步摘要
- 终局结果

### 2.7 `loadCheckpoint(checkpoint)`

从中间快照恢复。它服务于搜索、回放、离线数据集生成，不替代 `reset(seed) + actions` 的完整复盘路径。

## 3. 状态分层

环境内部状态分为三层：

1. `core_state`
   对应当前浏览器内可持久化游戏切片：`solarState / nebulaDataState / alienGameState / finalScoringState / playerState / turnState / rocketState / planetStatsState / techGameState / cardState / cardTaskState / setupSelectionState`。现有 `createGameRecoverySnapshot()` 已按这个粒度落盘。
2. `runtime_state`
   决策驱动必需、但不直接计入公开观测的运行时信息，如当前 action/effect 链、pending 决策、AI 控制配置、history session。
3. `derived_state`
   可从前两层纯函数重建的派生信息，如 legal action 列表、当前决策 owner、终局公式边际分、可见摘要。

要求：

- `core_state` 可序列化，可 checkpoint。
- `runtime_state` 必须去 UI 化，不能依赖 DOM 节点、button 引用或 overlay 文案。
- `derived_state` 不进 checkpoint，只在恢复后重算。

## 4. Observation Schema

```js
{
  schemaVersion: "seti-rl-observation-v1",
  seed: string | number | null,
  perspectivePlayerId: string,
  publicState: PublicState,
  selfState: SelfPrivateState,
  decision: DecisionState | null,
  actionHistorySummary: ActionHistorySummary,
  terminal: boolean,
}
```

### 4.1 `publicState`

只包含所有玩家都可见的信息：

- `roundNumber`
- `turnNumber`
- `actionCycleNumber`
- `currentPlayerId`
- `passedPlayerIds`
- `completedTurnPlayerIds`
- `activePlayerIds`
- 所有玩家公开资源与公开计分：
  - 分数
  - 信用点 / 能量 / 宣传 / 可用数据 / 额外公共扫描
  - 手牌数量
  - 保留牌数量
  - 完成任务数
  - 科技数量与公开科技分布
  - PASS 状态
- 盘面公开状态：
  - 火箭位置、朝向、归属
  - 星球环绕/登陆标记
  - 扇区/星云数据 token、额外标记、完成状态
  - 公共牌
  - 科技供应
  - 外星人公开揭示、痕迹、公共符号/标记
  - 终局板块标记与 pendingMarks
- 当前公开 pending 摘要：
  - `kind`
  - `actorPlayerId`
  - `effectOwnerPlayerId`
  - `sourceActionType`
  - `choiceCount`

### 4.2 `selfState`

只对 `perspectivePlayerId` 公开：

- 自己手牌完整信息
- 自己保留牌完整信息
- 自己公司牌/外星人私有牌
- 自己可消费的一次性能力或任务内部状态

### 4.3 明确禁止泄漏的信息

以下内容不能进入训练观测，除非观察者本来就能合法看到：

- 对手手牌内容
- 对手保留牌内容
- 牌库顺序、未来抽牌
- 未翻开的外星人牌、未公开卡牌
- 仅用于 UI 的临时字段：
  - overlay button 文案
  - DOM dataset
  - hover/selected/highlight
  - 当前弹窗布局
- 恢复系统中的完整 `recoverySnapshot`
- AI 诊断值：
  - `candidate.score`
  - `actionGraph.net`
  - planner shadow
  - battle analytics 产物

## 5. Action Schema

统一动作结构：

```js
{
  schemaVersion: "seti-rl-action-v1",
  actionId: string,
  actorPlayerId: string,
  phase: "setup" | "main" | "quick" | "pending_choice" | "effect_resolution" | "turn_control",
  kind: string,
  target?: ActionTarget,
  payload?: Record<string, unknown>,
}
```

### 5.1 顶层 `phase`

- `setup`
  - 初始选择、初始弃牌、强制公司/起始卡确认。
- `main`
  - `launch / orbit / land / scan / analyze / playCard / researchTech / pass`
- `quick`
  - `move / quickTrade / industry / cardCorner / runezuFaceSymbol / placeData / end-turn`
- `pending_choice`
  - overlay 子选择、目标选择、弃牌选择、支付选择、科技槽位选择、任务确认、外星人选择。
- `effect_resolution`
  - 当前 effect 链中的 `execute / skip / confirm`。
- `turn_control`
  - `recover_pending_action / end_turn_after_recovery`

### 5.2 `kind`

`kind` 是稳定枚举，不直接暴露 UI handler 名。第一阶段建议最小集合：

- 顶层行动：
  - `launch`
  - `orbit`
  - `land`
  - `scan`
  - `analyze`
  - `play_card`
  - `research_tech`
  - `pass`
  - `move`
  - `quick_trade`
  - `industry_once`
  - `place_data`
  - `end_turn`
- setup：
  - `confirm_initial_selection`
  - `discard_card`
  - `confirm_pass_reserve`
- 通用 pending：
  - `select_public_card`
  - `select_hand_card`
  - `select_scan_target`
  - `select_land_target`
  - `select_probe_sector`
  - `select_probe_reward`
  - `select_tech_tile`
  - `select_tech_slot`
  - `select_card_trigger`
  - `select_task_completion`
  - `select_alien_choice`
  - `select_trace_target`
  - `pay_move_cost`
  - `pay_credit`
  - `discard_any_income`
  - `skip_optional`
  - `confirm_effect`
  - `skip_effect`
- recovery：
  - `recover_pending_action`

### 5.3 `target`

为 action mask 稳定编码，target 必须结构化，不传文案：

- `cardId`
- `handIndex`
- `publicCardSlot`
- `rocketId`
- `planetId`
- `satelliteId`
- `sectorX`
- `nebulaId`
- `techTileId`
- `techSlotId`
- `traceType`
- `choiceId`

### 5.4 `payload`

只放目标不足以表达的补充参数，例如：

- `direction: "clockwise" | "counterclockwise" | "inward" | "outward"`
- `tradeId`
- `repeatIndex`
- `preserveHandIndex`
- `blueSlot`
- `sourceActionType`

## 6. Legal Action / Action Mask

`legalActions()` 输出：

```js
{
  actionId: string,
  actorPlayerId: string,
  phase: string,
  kind: string,
  target?: ActionTarget,
  payload?: Record<string, unknown>,
  maskIndex: number,
  summary: string,
}
```

规则：

- `maskIndex` 在同一 `schemaVersion` 下稳定。
- 若某类动作是参数化动作，mask 可以是“模板动作 + 参数表”，也可以直接平铺成离散候选；第一阶段优先平铺，减少训练端解释成本。
- 当前无决策权的玩家看不到可执行动作。
- 同一步的可选 `skip` 必须显式出现在 mask 中，不能靠缺省超时。

## 7. Decision Owner 语义

当前浏览器实现已经明确：

1. pending 上显式 `playerId/playerColor`
2. 否则取 `effect owner`
3. 再否则取 `current player`

对应 headless 契约：

```js
{
  actorPlayerId,
  effectOwnerPlayerId,
  currentPlayerId,
  source: "pending_owner" | "effect_owner" | "current_player",
}
```

要求：

- `legalActions` 和 `observe().decision` 都必须带这组信息。
- `step()` 若收到非 owner 玩家动作必须拒绝。
- 不能让人类代理 AI pending，也不能让 AI 代做人类 pending。

## 8. Reward Schema

第一阶段 reward 采用“逐步增量 + 终局汇总”双轨：

```js
{
  immediateScoreDelta: number,
  resourceDelta: {
    credits: number,
    energy: number,
    publicity: number,
    availableData: number,
    additionalPublicScan: number,
    handCount: number,
  },
  terminalScoreDelta: number,
  shaping: {
    finalFormulaDelta?: Record<string, number>,
    traceDelta?: Record<string, number>,
    sectorProgressDelta?: number,
    dataProgressDelta?: number,
  },
}
```

约束：

- 环境真实奖励基准仍是规则分数变化。
- `shaping` 仅作为训练配置的可选附加字段，不应影响 replay 复盘真值。

## 9. Replay Schema

```js
{
  schemaVersion: "seti-rl-replay-v1",
  seed: string | number | null,
  config: ResetConfig,
  checkpoints?: ReplayCheckpointSummary[],
  steps: ReplayEvent[],
  finalStateSummary: FinalStateSummary,
}
```

### 9.1 `ReplayEvent`

```js
{
  stepIndex: number,
  actorPlayerId: string,
  action: EnvAction,
  reward: RewardDelta,
  preDecision: DecisionState | null,
  postDecision: DecisionState | null,
  publicSummary: PublicStateSummary,
  actionLogRef?: {
    entryId: number | null,
    actionType: string | null,
    stepId: string | null,
  },
  irreversible?: {
    code: string,
    reason: string,
  },
}
```

### 9.2 replay 与现有实现的关系

- `createGameRecoverySnapshot()` 已提供 checkpoint 所需的核心状态切片。
- `actionLogState.entries` 已提供按回合组织的 `actionType / actionLabel / steps / recoverySnapshot`。
- 训练 replay 不应直接复用 UI 文本日志作为唯一真相，但可以把 action log 作为可读摘要和 debug 引用。

## 10. Checkpoint Schema

```js
{
  schemaVersion: "seti-rl-checkpoint-v1",
  coreState: CoreState,
  runtimeState: RuntimeState,
  replayCursor: {
    seed: string | number | null,
    stepIndex: number,
  },
}
```

建议：

- 默认只在回合边界、effect 链边界、不可撤销节点前后生成 checkpoint。
- 搜索/评估可额外保留细粒度 checkpoint。

## 11. 当前实现到契约的映射

### 11.1 状态快照

- `createGameRecoverySnapshot()` -> `EnvCheckpoint.coreState + runtimeState.aiControl`
- `applyGameRecoverySnapshot()` -> `loadCheckpoint()`
- `readPersistentGamePackage()` / `createPersistentGamePackage()` -> 本地继续游戏，不直接作为训练接口

### 11.2 顶层动作

`runAiTurnActionDecision()` 当前已经稳定枚举：

- 主行动：`launch / orbit / land / scan / analyze / playCard / researchTech / pass`
- 快速行动：`move / quickTrade / industry / placeData / end-turn`
- 特殊快速：`cardCorner / runezuFaceSymbol`
- 恢复控制：`recoverPendingActionFromOpenHistoryForAi()`

这些可以直接映射成 headless `phase=main|quick|turn_control`。

### 11.3 pending 子决策

`runAiAutomationStep()` 已把待处理子流程按固定顺序列出，可直接视为第一版 pending 枚举来源：

- `initialSelection`
- `discard`
- `passReserve`
- `finalScoreMark`
- `cardSelection`
- `researchTechSelection`
- `handScan`
- `playCardSelection`
- `movePayment`
- `landTarget`
- `dataPlacement`
- `scanTarget`
- `strategyPassiveSlot`
- `effectMove`
- `cardTrigger`
- `cardTriggerFreeMove`
- `cardCornerFreeMove`
- `industryFreeMove`
- `scanAction4`
- `cardTaskCompletion`
- 外星人 use/trace/choice 流

### 11.4 owner 语义

- `assignEffectFlowOwner()`
- `getEffectOwnerPlayer()`
- `getPendingOwnerFields()`
- `getPendingOwnerPlayer()`
- `withPendingOwnerPlayer()`
- `setActiveEffectFlowOwner()`

这一组函数就是 headless env 的 owner 真值来源。

### 11.5 replay / record

- `actionLogState.entries[].actionType/actionLabel/steps` -> 人类可读回放摘要
- `entry.recoverySnapshot` -> 行动后恢复点
- `history source main/quick/setup` -> replay 中的 effect 来源标签

## 12. 高风险 pending 流程

以下流程最容易让 simulator 或 action mask 返工，第一阶段必须显式建模：

1. `pending owner` 与 `effect owner` 不同
   常见于跨玩家奖励、目标玩家效果、外星人/任务分发。
2. 多段 effect chain
   `actionEffectFlow` 中一个顶层行动会展开成多个 effect，且中间可插入 followup、skip、不可撤销节点。
3. 共用 overlay 承载多种决策
   `scanTargetOverlay` 不只是扫描目标，还承载移除标记、弃牌收入、支付信用、回手任务、探测器扇区扫描等奖励。
4. 移动后再决策
   `move -> land/orbit/scan` 之间存在路径支付、免费移动、后续落点兑现，动作粒度过粗会扭曲 legal mask。
5. recover/end-turn 语义
   已有 open history session 但当前没有 pending UI 时，允许 `recover_pending_action` 再 `end_turn`。
6. 不可撤销节点
   如抽牌、翻开隐藏牌、外星人牌获取；checkpoint 与 replay 必须记 `irreversible`。
7. setup 与 round-start 不是普通 main action
   初始选择、收入、PASS 后续弃牌都可能插入额外 pending。
8. 外星人与公司 1x 的专属分支
   九折、半人马、异常点、虫、阿米巴、奥陌陌、符文族，以及公司主动能力都带非标准子选择。
9. 终局板块 pending mark
   达 25/50/70 分后不是立即结束，需要单独决策标记目标。

## 13. 第一阶段落地建议

1. 先做纯协议层
   把当前浏览器 runtime 包一层 adapter，先输出 `observe/legalActions/step/getReplay/loadCheckpoint`。
2. 先平铺动作，不做参数压缩
   减少训练端解释复杂度。
3. 先只支持单步 replay 真值
   复杂文本日志继续作为 debug 辅助，不做训练输入。
4. checkpoint 直接复用现有 recovery slice
   先验证 owner、pending、复盘链路，再逐步去 UI 依赖。

## 14. 非目标

- 本文不定义训练算法。
- 本文不要求现在就把浏览器 runtime 拆成纯 simulator。
- 本文不承诺第一阶段覆盖所有外星人/公司牌的策略质量，只要求协议可表达。
