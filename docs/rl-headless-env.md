# SETI RL Headless Env / Harness v2 契约

本文定义 SETI 第一阶段强化学习 headless 环境的统一契约。目标不是直接实现 simulator，而是给后续 `simulator / training harness / evaluation harness` 提供唯一上游接口，避免继续围绕浏览器 UI、overlay 按钮或临时 pending 结构各自发明协议。

## 当前实现

- Node 入口：`randomizer/app/headless-env.js`，通过 `createHeadlessEnv()` 创建单局环境。
- 已实现 `reset / observe(viewer) / legalActions(viewer) / step / isTerminal / getReplay / loadReplay / createCheckpoint / loadCheckpoint / dispose`。
- `randomizer/app/headless-contract.js` 固化 15 个顶层动作族、7 个 conditional family、稳定 action feature 与 observation 公私域 sanitizer；旧 selector 映射只保留为存量 replay/诊断兼容面。
- 传统 app 的 52 项 pending 由 `game/effects/legacy-flow-inventory.js` 单一登记；headless Effect Session host 不消费该容器。`tools/audit_effect_session_legacy.js` 会阻断未知/过期 adapter，并扫描 Browser/Headless host 的旧 resolver 回流。
- `legalActions()` 输出 `seti-rl-action-v2`，候选来自 app 与浏览器共享的 Standard Action adapter，不构建 actionGraph、valuation、selection pressure、planner 或第二套 legality。RL envelope 补充 mask/feature 与环境版本，但沿用 registry `actionId`；`step()` 校验 actor、版本与当前 legal action id 后，把保存的完整 Standard Action descriptor 交回同一 `registry.execute`。
- pending/conditional 边界在枚举顶层行动或执行 deterministic drain 之前先经过 inventory 审计；未知 pending key、已知 key 的未知 type、未知 conditional family 分别以稳定 `HEADLESS_UNSUPPORTED_PENDING`、`HEADLESS_UNSUPPORTED_PENDING_TYPE`、`HEADLESS_UNSUPPORTED_CONDITIONAL_FAMILY` 拒绝。诊断固定包含 `state/family/type/owner`，拒绝分支不枚举顶层行动，也不调用旧 resolver、DOM callback、recover 或 skip。
- observation 已按 `publicState / selfState / decision` 分域；公开玩家仅保留资源、计数与公开科技，自己的手牌/预留牌才进入 `selfState`，牌库顺序、未来科技 bonus、未揭示外星人身份不进入观测。
- replay 分开记录 policy `steps` 与自动结算 `environmentEvents`；checkpoint 将 RNG 与稳定编号统一保存到 `coreState.meta`，可在 fresh env 中恢复且不触发浏览器渲染。
- 终局 25/50/70 分 pending 由 `choose_final_scoring` 独立枚举与执行：多项由 pending owner 决策并写一条 policy replay，唯一合法板块由环境自动推进；headless 路径显式禁止调用旧 final-score AI resolver，标记时间使用稳定 replay 值。
- 顶层与 conditional 行动都保留已验证的 Standard Action descriptor；`step()` 不调用 AI candidate builder 二次构建候选，而只向 `headless-effect-session-host` 提交 Standard Action/Decision。唯一选择、deterministic pending 和当前 Effect 由同一 Effect Session drain；每个 policy replay step 附带已确认的 session action/decision/effect/event journal，失败输入不进入 confirmed replay。
- Node composition 通过 `randomizer/app/view-adapter.js` 注入 no-op view adapter；运行时不创建或安装 `document`、DOM 元素、overlay、`localStorage`、`Image`。
- `randomizer/app/headless-contract.test.js` 建立 15 动作族覆盖矩阵与 conditional taxonomy characterization；`headless-effect-session-host.test.js` 与 `headless-effect-session-integration.test.js` 覆盖未知 pending fail-closed、resolver/recover/skip 零调用、固定 trace journal、非零 checkpoint fork 和固定 seed 完整 4 人局；worker recovery 测试覆盖崩溃后只重放已确认 Action/Decision。
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

每局训练或评测完成后还会生成独立 HTML 可视化总结。默认写到日志或 checkpoint 同级的 `reports/`；两者都未指定时写到 `checkpoint/self-play/reports/`，可用 `--report-dir` 覆盖。报告按玩家展示最终总分、终局板块/卡牌与蓝科/着陆/环绕/任务等分类得分、逐步累计的正向资源获取量及各行动族次数；它只消费 episode 终局数据，不参与 agent 更新与训练推进。

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

### Python / PyTorch 常驻采样层

并行采样使用 `worker_threads`，每个 worker 拥有独立 Node isolate、seed、环境、replay 和进程级随机状态。不能把多个 `createHeadlessEnv()` 放在同一 isolate 并发：传统 runtime 仍以 `globalThis` 注册模块，并在局内临时接管 `Math.random`。worker 常驻且复用同一个 `createHeadlessEnv()` 实例连续 reset 多局，不会按 episode 或 decision 重启 Node。每次 reset 会在同一 isolate 内重建浏览器模块/runtime 注册表并重新安装 seed RNG，确保同实例 A/A、A/B/A 与 fresh A 的 observation、legalActions、replay cursor 和 RNG 一致，同时清空上一局的 action log、pending、缓存与稳定 id 状态。

Python 通过版本化 JSONL 长连接访问：

```bash
node tools/run_rl_worker_server.js --workers 4 --timeout-ms 120000
```

每行请求都必须包含：

```json
{"schemaVersion":"seti-rl-ipc-v1","requestId":1,"operation":"server_info","payload":{}}
```

服务端回复保持同一 `requestId`，成功时返回 `result`，失败时返回稳定的 `error.code/message/details`。支持的顶层 operation：

- `server_info`：返回 worker 数、持久化能力与恢复策略。
- `worker_request`：向一个 worker 发送 `reset/state/step/checkpoint/load_checkpoint/replay/dispose`。
- `batch`：并发向多个 worker 发送一批请求；结果按 `batchIndex` 对齐并逐项报告错误，适合一次 PyTorch forward 后批量 step。
- `shutdown`：排空在途请求并关闭 worker。

`tools/rl_worker_client.py` 是仅依赖 Python 标准库的最小客户端，可直接被 PyTorch sampler 包装：先对全部 worker 批量 `reset` 或 `state`，把返回的 observation/legalActions 组 batch 做一次 inference，再把选择的完整 legal action 批量 `step`。协议不内置 PPO、value update 或模型格式。

Python smoke：

```bash
python3 tools/rl_worker_client.py --workers 2 --episodes 2 --max-steps 200
```

2026-07-18 使用 `python3 tools/rl_worker_client.py --workers 4 --episodes 100` 完成真实连续 smoke：100/100 局 terminal，非法动作 0、阻塞 0；每局均读取完整 replay 与 checkpoint，并校验 `episodeId` 一致，期间未出现 timeout、worker crash、schema mismatch 或 backpressure。

worker 的等待队列有界；队列满返回 `backpressure`。每个请求有 deadline；超时返回 `timeout` 并终止、重建对应 worker。异常退出返回 `worker_crash`。worker pool 为每个未完成 episode 保留 `reset config + 已确认成功的 action journal`，下一次请求前在新 isolate 自动重放；恢复失败单独返回 `worker_recovery_failed`，不会把旧局轨迹接到新状态。非法 action 返回 `illegal_action`，schema 不符返回 `schema_mismatch`，二者都不会写入恢复 journal。

每个 reset 可携带 `episodeId/policyVersion/opponentIdentity/seat/seed`；这些字段随完整 replay 和 checkpoint 返回，step 轨迹由同一 `episodeId + replay stepIndex` 关联。checkpoint 含完整 replay cursor/action/environment event 和随机状态，可以在 fresh worker 中恢复。

### Worker 吞吐闸门

分项 benchmark 同时报告 JSON 序列化空载、批量 inference 空载、reset/boot、step-only 与包含 boot 的 aggregate decision/s：

```bash
node tools/benchmark_rl_workers.js --workers 1 --games-per-worker 1 --max-steps 200
node tools/benchmark_rl_workers.js --workers 4 --games-per-worker 1 --max-steps 200
```

aggregate 目标为 `>= 50 decision/s`。未达标时命令退出码为 `2`，JSON 报告仍完整输出，必须保留 `resetSeconds / stepSeconds / serializationIdle / inferenceIdle` 来区分 composition boot、环境推进、IPC 序列化和模型空载；不得只报告总耗时或用增大 batch 等待窗口制造吞吐假提升。

2026-07-18 当前机器（Node `v22.22.0`）实测：单 worker 为 `32 decisions / 43.252s = 0.740 decision/s`，双 worker 为 `64 decisions / 51.840s = 1.235 decision/s`，未达到 50 decision/s 闸门。单 worker 分项中 boot `1.263s`、legal action enumeration `20.802s`、action execution `20.781s`、observation `0.344s`、replay `0.0003s`；JSON 序列化与 inference 空载均为百万级 decision/s。已通过复用同一决策点的稳定 legal action/selector，把单 worker 从优化前的 `0.490` 提升到 `0.740 decision/s`，但剩余瓶颈明确在规则域 candidate enumeration 和 action execution。下一步优化应对 `listAiTurnActionCandidates` 做规则域 profiling、按未变化状态切片增量派生或 memoization，并拆解 `runAiSelectedTurnAction` 内自动结算；没有证据支持继续压缩 JSONL 或扩大 batch 等待窗口。

2026-07-19 切换到 headless rule enumeration、轻量收入弃牌规则与预验证 action 直执行后，同机常驻 10 局实测：单 worker `320 decisions / 3.725s = 85.897 decision/s`（step-only `101.166/s`），四 worker `1280 decisions / 6.200s = 206.464 decision/s`（step-only `245.234/s`）。单 worker 末局分项为 setup selection `8.676ms`、reset drain `12.778ms`、legality `5.900ms`、transition `26.054ms`、effect drain `96.087ms`、observation `165.092ms`；100 局四 worker smoke 为 100/100 terminal、非法动作 0、阻塞/worker crash 0。训练闸门按常驻多局窗口通过，单次冷启动仍包含浏览器模块装配成本。

2026-07-19 Standard Action 全链路集成后的同机复测（Node `v22.22.0`）：单 worker `91 decisions / 0.598s = 152.194 decision/s`（step-only `195.657/s`），四 worker `399 decisions / 1.257s = 317.522 decision/s`（step-only `361.876/s`），均通过 `>=50 decision/s` 闸门。该基线使用 registry descriptor 直接枚举/执行并沿用 actionId；单 worker 分项为 legality `36.962ms`、transition `180.202ms`、effect drain `51.946ms`、observation `90.065ms`，用于后续兼容层删除和性能回归对比。

传统脚本仍以 `globalThis` 作为模块注册表，Node 启动时临时把 `window` 名称指向该注册表以兼容 `window.Seti*` 命名空间；这里没有浏览器对象或 DOM 能力。`app.js` 根据 `SetiHeadlessRuntimeConfig` 选择 no-op view adapter，跳过固定 DOM 收集、事件绑定、渲染、浏览器持久化和首屏 shell 初始化。

### 单进程 decision/s 基线

使用固定的 PASS/end-turn 快速终局策略测量环境协议开销；命令会输出局数、policy decision 数、耗时和 decision/s：

```bash
node tools/benchmark_headless_env.js --games 3 --max-steps 200
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

训练策略与浏览器启发式现在共享 `game/ai/policy-port.js` 的请求 envelope：Host 将本节 observation、当前 registry legal descriptors、seat/state/decision version 与确定性上下文封装为只读 `DecisionContext`；Policy 只返回 `PolicyDecision.actionId` 和版本化模型元数据。`step` 仍只接受 Host 经公共 validator 与 `registry.validate` 复核后的 Standard Action descriptor。超时、取消、恢复、stale 或迟到响应不会进入 `step` 或 replay；完整契约见 `docs/policy-port-contract.md`。

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

- `createGameRecoverySnapshot()` -> `EnvCheckpoint.coreState`；`meta.rngState / meta.sequences` 是 RNG 与牌、火箭、数据、历史事件等稳定编号的唯一持久化权威
- `applyGameRecoverySnapshot()` -> `loadCheckpoint()`
- `loadCheckpoint()` 用 replay journal 重建不进入 committed schema 的 pending/continuation，再校验并恢复 committed meta；未知闭包序列、不可恢复 RNG 或 replay/meta 不一致均 fail-closed
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
