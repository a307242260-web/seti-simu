# SETI RL Headless Env / Harness v2 契约

本文定义 SETI 第一阶段强化学习 headless 环境的统一契约。目标不是直接实现 simulator，而是给后续 `simulator / training harness / evaluation harness` 提供唯一上游接口，避免继续围绕浏览器 UI、overlay 按钮或临时 pending 结构各自发明协议。

## 当前实现

- Node 入口：`randomizer/app/headless-env.js`，通过 `createHeadlessEnv()` 创建单局环境。
- 已实现 `reset / observe(viewer) / legalActions(viewer) / step / isTerminal / getReplay / loadReplay / createCheckpoint / loadCheckpoint / dispose`。
- `randomizer/app/headless-contract.js` 固化 15 个顶层动作族、7 个 conditional family、旧 runtime selector 映射、稳定 action feature 与 observation 公私域 sanitizer。
- `legalActions()` 输出 `seti-rl-action-v2`，不再暴露 `candidate.score`、`actionGraph.net`、planner/UI 字段；非 decision owner 请求时返回空数组，`step()` 同时校验 actor 与当前 legal action id。
- observation 已按 `publicState / selfState / decision` 分域；公开玩家仅保留资源、计数与公开科技，自己的手牌/预留牌才进入 `selfState`，牌库顺序、未来科技 bonus、未揭示外星人身份不进入观测。
- replay 分开记录 policy `steps` 与自动结算 `environmentEvents`；checkpoint 额外保存随机数状态，可在 fresh env 中恢复且不触发浏览器渲染。
- 顶层行动通过 `action-runtime` 分发，pending/effect 由 AI 自动机直接调用运行时处理函数收敛，不依赖用户点击。
- Node composition 通过 `randomizer/app/view-adapter.js` 注入 no-op view adapter；运行时不创建或安装 `document`、DOM 元素、overlay、`localStorage`、`Image`。
- `randomizer/app/headless-contract.test.js` 建立 15 动作族覆盖矩阵与 conditional taxonomy characterization；`randomizer/app/headless-env.test.js` 覆盖无 DOM 启动、固定 seed 完整 4 人局、terminal、replay/checkpoint parity、owner/非法动作拒绝以及观测反泄漏。
- 最小训练入口为 `tools/run_self_play_training.js`：串行运行多局 self-play，以 action kind 的 Monte Carlo value table 作为第一版弱 baseline，输出逐步 JSONL，并在局间边界原子保存训练 checkpoint。
- 固定评测入口为 `tools/run_rl_evaluation.js`：加载任意 self-play checkpoint，在冻结的 20 局四人 seed pool 上输出均分、P25/P50/P75、完局率、非法动作率、阻塞率，以及可机器判定的“稳定 200 分”结论。

训练示例：

```bash
node tools/run_self_play_training.js \
  --episodes 2 \
  --seed baseline-v1 \
  --checkpoint checkpoint/self-play/baseline-v1.json \
  --log checkpoint/self-play/baseline-v1.jsonl
```

从同一游标继续训练：

```bash
node tools/run_self_play_training.js \
  --episodes 2 \
  --resume checkpoint/self-play/baseline-v1.json \
  --log checkpoint/self-play/baseline-v1-resumed.jsonl
```

只加载 checkpoint 评测、不更新 agent：

```bash
node tools/run_self_play_training.js \
  --episodes 1 \
  --resume checkpoint/self-play/baseline-v1.json \
  --evaluate \
  --log checkpoint/self-play/baseline-v1-eval.jsonl
```

训练 checkpoint 固定在 episode 边界，包含配置、下一局游标、trainer 独立随机状态、agent 参数与累计统计；因此跨进程恢复不会依赖 headless env 的进程内随机闭包。逐步日志记录 `seed / action / reward / legalMask / terminal / actorPlayerId`，局摘要记录终局分数、阻塞原因、非法动作次数与 action 尝试数。

### 固定评测与“稳定 200 分”协议

默认协议文件为 `randomizer/training/evaluation/stable-200-v1.seeds.json`。协议冻结 20 个 seed，每个 seed 都必须跑完整 4 人局，统计总体为 80 个终局席位；分位数使用 nearest-rank。不得删除低分局、只跑 seed 子集或把未终局时的实时分计入分数总体。

“稳定 200 分”同时满足以下条件才判为 PASS：

- 20/20 局正常终局，80/80 个席位有终局分；
- 80 席均分不低于 200，P25 不低于 180，P50 不低于 200；
- 非法动作率为 0，阻塞率为 0。

均分定义“达到 200”，P25/P50 防止少量高分掩盖低尾，完局/非法/阻塞门槛保证分数不是以牺牲运行可靠性换取。P75 作为观察指标输出，但不设单独门槛。修改 seed、样本数、分位数方法或门槛必须发布新的协议 id，不能原地改写 `stable-200-v1`。

评测任意 checkpoint：

```bash
node tools/run_rl_evaluation.js \
  --checkpoint randomizer/training/examples/baseline-v1.checkpoint.json \
  --report checkpoint/evaluation/candidate.json \
  --log checkpoint/evaluation/candidate.jsonl
```

命令在未通过稳定 200 门槛时退出码为 `2`，运行错误退出码为 `1`。完整 JSON 报告保留每局 seed、四席分数、步数、阻塞原因和 checkpoint 身份；JSONL 保留逐步 action 与 legal mask，因此可用报告先定位具体局，再按 `seed + action 序列` 回放。与历史 checkpoint 对比时追加：

```bash
node tools/run_rl_evaluation.js \
  --checkpoint checkpoint/self-play/candidate.json \
  --baseline-report randomizer/training/evaluation/baseline-v1.report.json \
  --report checkpoint/evaluation/candidate-vs-baseline.json
```

对比接口拒绝不同 seed pool 的报告，避免把 seed 漂移误当成模型变化。仓库内的 `baseline-v1.report.json` 是当前 action-kind baseline 的固定协议结果，只是回归基线，不代表已经达到 200 分。

当前仓库 baseline checkpoint 的 20 局实跑结果为：80 席均分 `7.1875`、P25 `6`、P50 `7`、P75 `8`，20/20 局终局，非法动作率与阻塞率均为 `0`。可靠性门槛通过，但分数门槛未通过，因此协议结论为 `FAIL`；这组低分与该 checkpoint 只学习到 PASS / end-turn 的弱基线定位一致。

传统脚本仍以 `globalThis` 作为模块注册表，Node 启动时临时把 `window` 名称指向该注册表以兼容 `window.Seti*` 命名空间；这里没有浏览器对象或 DOM 能力。`app.js` 根据 `SetiHeadlessRuntimeConfig` 选择 no-op view adapter，跳过固定 DOM 收集、事件绑定、渲染、浏览器持久化和首屏 shell 初始化。

### 单进程 decision/s 基线

使用固定的 PASS/end-turn 快速终局策略测量环境协议开销；命令会输出局数、policy decision 数、耗时和 decision/s：

```bash
node tools/benchmark_headless_env.js --games 3
```

基准只用于同机同进程版本间复测，不代表训练策略质量；吞吐优化不得删减 observation、owner 校验、replay 或自动结算语义。

2026-07-18 在当前工作区（Node `v22.22.0`）的单局 smoke 基线：`32 decisions / 104.735s = 0.306 decision/s`，复测命令为 `node tools/benchmark_headless_env.js --games 1`。该数值明确表明当前 composition boot 与逐步全量派生观测仍是下游吞吐优化的首要目标。

## 1. 设计目标

- 训练环境只暴露公开信息与当前决策必需的自有私有信息。
- policy action 只表示会改变游戏状态或未来收益的真实策略选择，不把 UI 确认、效果队列推进或错误恢复伪装成模型决策。
- `legalActions` 必须覆盖主行动、快速行动及有多个非等价结果的条件选择；确定性结算和技术状态推进由环境自动完成。
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

- 只接受一条离散 policy action。
- 动作可以是顶层回合行动，也可以是随机信息揭示后才出现的语义化条件选择。
- 必须校验 `action.actorPlayerId` 是否等于当前 `decision.actorPlayerId`。
- 执行后自动推进所有确定性规则结算，直到终局或下一个真实策略决策点。

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

## 5. Policy Action Schema

模型动作采用三层语义：顶层动作族、动作参数、条件策略决策。`setup / pending / effect_resolution / recover` 是环境内部技术阶段，不是 policy action taxonomy。

统一动作结构：

```js
{
  schemaVersion: "seti-rl-action-v2",
  actionId: string,
  actorPlayerId: string,
  decisionType: "turn_action" | "conditional_choice",
  family: string,
  target?: ActionTarget,
  payload?: Record<string, unknown>,
}
```

### 5.1 顶层回合动作族

正常回合边界共有 15 个稳定动作族：

- 主行动 / PASS：`launch / orbit / land / scan / analyze / research_tech / play_card / pass`。
- 快速行动 / 结束行动：`move / quick_trade / industry / card_corner / place_data / runezu_face_symbol / end_turn`。

`pass` 表示退出本轮；`end_turn` 表示已经完成主行动后停止追加快速行动。二者不能合并。

### 5.2 动作参数

具体目标和支付等差异属于父动作参数，不另造顶层动作族。例如：

- `play_card(card_instance_id, mode, targets...)`
- `research_tech(tile_id, slot_id, bonus_target...)`
- `move(rocket_id, direction_or_path, payment...)`
- `scan(source, sector_or_nebula_or_target...)`
- `orbit(rocket_id, planet_id)` / `land(rocket_id, planet_or_satellite_id)`
- `quick_trade(trade_id, discarded_cards...)`
- `card_corner(card_instance_id, corner, target...)`
- `pass(reserved_card_id | null)`

父动作执行前已经可见的参数应直接平铺成完整 legal candidate，不能由旧 heuristic 在 wrapper 内继续代选。

### 5.3 条件策略决策

只有父动作执行后揭示了新随机信息，且存在两个以上会产生不同游戏状态或未来收益的合法选项，才产生新的 `conditional_choice` timestep。`family` 使用业务语义，不暴露 pending 类型名：

- `choose_card`
- `choose_target`
- `choose_payment`
- `choose_reward`
- `choose_branch`
- `choose_final_scoring`
- `accept_optional_effect`

若只有一个合法选项，环境直接执行，不产生 timestep。

### 5.4 环境自动推进事件

以下内容可以记录到 replay 的 environment event，但不得出现在 policy `legalActions()`：

- 首版 `setup`：由 scenario 或 seed 配置公司与起始牌；未来 opening policy 单独建模。
- 收入、抽牌、洗牌、轮次切换、效果队列推进及其他确定性规则结算。
- `confirm`、关闭提示、overlay 点击等纯 UI 交互。
- 唯一合法选项、确定性的 effect execute/continue。
- `recover_pending_action`、错误恢复、replay flush。
- 没有实际放弃权的 `skip`；存在真实取舍时改为 `accept_optional_effect`。

统一判定标准：**至少两个合法选项会产生不同游戏状态或未来收益，才是策略决策；其余全部由环境推进。**

### 5.5 `target`

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

### 5.6 `payload`

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
  decisionType: "turn_action" | "conditional_choice",
  family: string,
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
- 只有会改变结果的可选放弃才以 `accept_optional_effect` 显式进入 mask；纯确认/跳过由环境推进。
- 技术 pending 名、旧 heuristic `candidate.score`、UI handler 和 DOM 字段不得进入候选特征。

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
