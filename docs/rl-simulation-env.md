# SETI RL Simulation Env 契约

Simulation 是 Production Composition 的无 DOM 宿主。它与 Browser 共用 StateStore、
Standard Action、Decision、Effect Session 和机器玩家协调器（`machine-player-coordinator.js`），
不加载 `index.html`、`app.js`、Browser projection、overlay、localStorage 或 Browser 恢复适配器。

## 正式入口

- `randomizer/app/simulation-env.js`：单局环境 API。
- `randomizer/app/simulation-contract.js`：Action/Observation schema 与可见性净化。
- `randomizer/training/simulation-rule-composition.js`：Simulation Composition 装配。
- `randomizer/game/rule-composition.js`：Browser/Simulation 共用的规则生命周期。
- `randomizer/training/worker-protocol.js`、`simulation-worker.js`、`worker-pool.js`：常驻采样。

## 环境 API

`createSimulationEnv()` 暴露：

- `reset(config)`：按 seed 创建当前 schema 的新局并推进到首个策略边界。
- `observe(viewerPlayerId?)`：返回 viewer-safe observation。
- `legalActions(viewerPlayerId?)`：返回当前 owner 的完整、稳定排序 Action descriptor。
- `step(action)`：复核 schema、identity、owner、state/decision version 后提交 Action 或 Decision。
- `isTerminal()`：读取 Production Composition 的终局事实。
- `getReplay()` / `loadReplay()`：读写已确认策略输入与环境事件。
- `createCheckpoint()` / `loadCheckpoint()`：保存和恢复当前 composition envelope、RNG 与 replay cursor。
- `runHeuristicPolicyDecision()` / `runOfflineTeacherDecision()`：经机器人玩家协调器（`machine-player-coordinator.js`）编排——裸调共享 composition 读边界、计划复用优先、未命中调用 Heuristic 决策函数（`heuristic-decision-function.js`，直调 Policy）、提交共享 `inputPort`（零转换）；replay/reward 记账由协调器 `recordStep` 钩子补做（env 提供实现，记录原生 action）。返回值含 `actionOutcomes`、`policyDecision` 与 `plan`。计划复用默认开（`planContinuationFastPath`，显式传 `false` 关闭）；新回合复用 `planNewTurnReuse` 默认开（`false` 关闭后新回合一律重新搜索）。
  **策略估值统一入口**：旧 `evaluateActionOutcomes()` 入口已删除——评估动作必须用 `runHeuristicPolicyDecision` 返回的 `actionOutcomes`（与决策函数同一搜索参数：secondary-agent 目标引导单一路径），不存在第二套搜索参数。反事实原语（任意候选评估）不是 env API：单动作结算链验证经规则层测试（`simulation-rule-composition.test.js` 或生产 composition 的 `counterfactualPort.evaluate`）。
- `getDiagnostics()` / `getCounterfactualDiagnostics()`：只读性能诊断。
- `dispose()`：释放单局环境。

机器玩家计划使用 `seti-action-plan-v2`：`steps` 逐项携带动作身份、执行前揭示基线和
具名依赖。搜索的折叠支付/连续数据提交也各有证据；同回合与跨回合均校验，只有控制
动作的重决策例外受回合边界控制。计划不写入 checkpoint，恢复时清空。详见 AI 设计 §3。

环境没有 pending inventory、resolver、recover、skip、DOM callback 或第二套规则 executor。
未知 family、非法 descriptor、stale、wrong-owner 和版本不匹配都零副作用失败，失败输入不进入
confirmed replay。

轮初数据收入由共享residual handoff通过正式`data.gainData`生成池内token，观察中的
`availableData`与实际可放置数据同步；容量、弃置及实体序列由数据内核负责。
收入在轮次推进的确定性效果中结算，checkpoint包含已生成token及序列；恢复已完成
的收入不重复发放。本修复不追补旧错误存档已遗漏的历史收入，效果验证须新版本开局。

## Action 与 Decision

Simulation 决策路径使用共享 `inputPort` 的原生 Action（`seti-standard-action-v1`，
零转换，Browser/Simulation 同一实现，见 docs/ai-design.md §1）；训练记录在协调器
`recordStep` 钩子补做，不做形状转换。

顶层 family：

`launch / orbit / land / scan / analyze / research_tech / play_card / pass / move /
quick_trade / industry / card_corner / place_data / runezu_face_symbol / complete_task / end_turn`

conditional family：

`choose_card / choose_target / choose_payment / choose_reward / choose_branch /
choose_final_scoring / accept_optional_effect`

两个以上非等价结果必须暴露为独立 Decision 和 policy step。确定性 Effect 与唯一等价选择由
Composition drain，不伪装成策略动作。

## Observation

卡牌效果的插收入选择与精选选择均在play-domain经共享`formalizeChoices`输出完整
Standard Action身份；恢复存档时重新枚举，AI与浏览器不补写actionId/actorId。

`incomeGainRequirements`中计算机第4格路线的`nextCost.handSize=1`表示完成收入所需
持有的牌数，供资源准备使用，不是正式扫描费用；钱/能量仍表示当前下一行动需要量。
该字段不改变正式Action、Decision或checkpoint状态结构。

`sectorWinRequirements.accessSources`是潜在扫描能力目录，`standardScanCost`仅为
主行动基础成本；实际可选科技追加费用和合法性仍由正式执行校验。目录缓存的完整
输入为data、玩家id/color、当前正式派生的来源及基础成本，公共牌/旋转/借用时点/
公司成本变化不能沿用旧范围；紫2水星通过正式行星数组查找。
`standardScanEarthSource`为标准扫描首步正式几何来源：普通扫描为`{sectorX}`，
紫1为`{nebulaIds}`，缺失行星为null；由science-session的`getPlanetScanSource`共享计算。
该字段也加入目录缓存键，避免地球/水星交换但能力并集不变时返回旧首步。
计划只在同目标段仍有未来scan时依赖它，不写入规则session或持久化计划。

逐步计划从公开`board.finalScoring.tiles`与`tileVariants`采集终局板块占位和变体，
按正式`final:<tile>`选择身份建立具名依赖；不把终局tileId当作科技。此证据不写回
Production状态或存档，缺失事实仍拒绝复用。

Production地球坐标及探测/正式行动context通过共享太阳系内核的
`collectPlanetLocations`读取行星数组，省略无关的完整快照计算；Browser与Simulation
使用同一函数，观察、合法动作、规则提交与存档schema不变。

反事实结果投影与Policy输入保持来源隔离、返回图深冻结；多叶相同的只读元数据可在
返回图内共享引用。观察仍从正式规则事实重建；复制优化不改字段值、顺序、隐藏信息
边界或checkpoint格式。Policy副本缓存仅在单次复制调用内生效，完成校验后才可复用。
祖先路径集合在递归进入时加入、finally退出时移除；共享兄弟引用不视为循环。

机器策略的标准 Decision observation由`outcome-model`从规则观察派生。其中
`outcomeProjection.progress.researchOptions`为同viewer正式科技候选的
`{tileId, publicityCost}[]`，与轻量`strategicFacts.researchOptions`同源；只来自正式
`techGainRequirements`，不推测隐藏奖励。该派生字段不写入Production状态或checkpoint。
研究预期的状态差分与V分项见`docs/ai-design.md`。

反事实叶可携带`executionStepCount`：实际成功提交的Action/Decision总数，包含节点内
折叠步骤，不等于搜索节点数。Production搜索输出该计数；未提供此字段的非折叠叶以
actionChain长度表示提交数。非终局条件决策的同价值排序使用该计数，终局不使用；它不
写入正式游戏状态或改变replay/plan结构。

搜索叶`terminalReason=goal-completed`表示目标及附带Decision已经完成，但搜索仍可继续
下一目标；这是已执行路径的真实结果，不是尚待执行的frontier。后续触顶时仍可用于
评估，outcome的pruned/低置信度标记保留。次级搜索已取消结束叶饱和计数；此叶不改变
规则执行或正式存档schema。

rollout v20沿用4096物理节点、256全局队列容量及30000ms搜索期限；根首步优先，
队列为每个仍有frontier的根保留最优节点，再按统一优先级填充。去重保留完整状态、
RNG/序号和Decision；资源/完成摘要不再支配删除后继。全部准入目标进入统一队列，
旧completeTargetCatalog配置及未绑定top-4已删除。宏步前后超时检查显式失败，不提交
真实根；同步宏步不能中断。2026-09-06用户允许适度放宽模拟耗时，完整决策略超10秒
不再单独阻止全盘验证；快速验证触发原10秒搜索超时后，期限独立放宽为30秒，
不增加节点预算，整局耗时另行实测报告。再次超时须定位，不自动继续加码。

action outcome新增可选searchCompleteness元数据：`{status, reasons}`。生产输出必须
提供；旧外部v1输入缺失不推断为complete。status为complete/incomplete/not-evaluated，
reasons为去重排序字符串数组，校验失败显式抛错。原因包括node-budget、beam-budget、
leaf-budget（普通control）、conditional-depth、goal-depth、untargeted-depth、
representative-choice、information-barrier、branch-failed、not-evaluated。
complete原因必须为空；incomplete原因非空且不含not-evaluated；not-evaluated须无叶、
outcome.status=unresolved且只有同名原因。完整性表示声明的单席策略搜索范围。
它不替代outcome.status：有真实完成叶但搜索不完整仍为settled并可选，未执行frontier
不用于收益或计划。投影透传、Policy校验及复盘报告共用该字段，不加入正式游戏存档。

rollout v18的搜索内部`executionEvents`只包含当前宏步成功提交新增的launch/orbit/land
事件：新Action会话从0计数，恢复中的Decision从节点checkpoint的journal游标开始，
每次折叠提交按增量读取；缺journal或长度倒退显式失败。`getBranchPriority`和
`completesRouteTarget`消费同一增量；`advanceRoutePlan`按正式launch身份推进来源。
事件与逐步绑定只驻留反事实执行结果，不加入Production状态、Browser存档或replay schema。
多个origin共享物理执行事实，各自推进绑定与计划，不能共用可变来源。

蓝槽派生事实同样在Browser/Simulation共用的sanitize和outcome-model生成：
`publicState.players[].blueBonusAssets`及`outcomeProjection.progress.blueBonusAssets`
含`credits/energy/ordinaryCards`来源留存数量，不暴露对手牌身份；`dataProgress.blueSlots`
含`tileId/slot/occupied/unlocked`，槽位前置条件来自正式data placement表。
轻量strategicFacts携带同样两项；原`blueBonusCount`只是当前占用数，不再用于奖励归因。
自身可见卡的`blueBonusOwnerId`为来源标记，未知身份遮蔽仍移除整张卡身份及附加字段。
来源字段仅供归因，不直接改变Primary或V的资源估值。
搜索完成态抽象`seti-secondary-agent-completion-facts-v4`包含`valuationContext`：
终局/轮次、槽位、研究候选费用、自身全部可见手牌实例与卡面标识；不同上下文
禁止互相支配删除。此为搜索内部派生事实，不改变Observation或存档schema。

Observation schema 为 `seti-rl-observation-v1`：

```js
{
  schemaVersion,
  seed,
  perspectivePlayerId,
  publicState,
  selfState,
  decision,
  probeRouteRequirements,
  terminal,
}
```

- `publicState` 只包含回合、公开玩家资源/计数、公开棋子、星球、太阳系、公共牌、弃牌数量、
  科技供应、已揭示外星人与终局板块。
- `selfState` 才包含该 viewer 的手牌、保留牌、公司私有状态、外星人牌和任务状态。
- 对手手牌、牌库顺序、未来 RNG、未揭示外星人、executor、callback、recovery snapshot、
  Policy/heuristic score 和 Browser ViewState 不得进入 observation。

## State、Checkpoint 与 Replay

公共观察中的 `publicState.board.aliens.slots[]` 保留正式 `slotId`（1/2）；数组位置不是
槽身份。每槽只公开 `revealed`、已揭示的 `alienId` 和 `traces`，不输出 `assignedAlienId`。
逐步计划按 `slotId` 与 `traces[traceType]` 读取依赖，不读取槽顶层的首痕迹字段。

Simulation 只读取 Composition 的 committed snapshot 或 active Session working state。唯一
持久化根是当前 `CommittedGameState` schema；不得重建传统 slice root。

Checkpoint schema 为 `seti-rl-checkpoint-v1`，保存：

- Composition lifecycle envelope；
- 可恢复 RNG state；
- confirmed replay cursor 与环境事件；
- episode/policy/opponent/seat provenance。

恢复只接受当前 schema。未知 schema、损坏 envelope、RNG 不可恢复、journal/cursor 不一致或
stale Decision 一律 fail-closed，不迁移、不猜测、不续跑旧 pending。

Replay schema 为 `seti-rl-replay-v1`。每个成功的外部 Action/Decision恰好增加一个 policy
step；确定性结算进入对应 Effect Session journal/environment events。失败、超时、取消和迟到
PolicyDecision 不进入 replay。

浏览器存档（`seti-browser-save-v2`）加载恢复：`loadCheckpoint` 的 restore 分支接受
`browserReplaySteps` 字段（浏览器格式历史，原样保留为 env 瞬态 `browserReplayHistory`），
之后续玩产生的内部 replay 步骤在 `saveBrowserSave` 时从历史长度续号拼接。因此
**读档续玩后再存盘，replaySteps = 历史（开局→读档点）+ 新步骤，完整不丢**——
"从 v47 档读档 → 续玩 → 存新档"不会只剩读档点之后的部分。`reset()` 清空该瞬态；
内部 replay（`getReplay`/`loadReplay`）仍只覆盖本 env 生命周期内记录的步骤，不含
读档前的浏览器历史。

## Reward 与策略评估

Reward 和价值评估只比较标准执行前后的 viewer-safe observation。反事实叶必须调用与真实
`step()` 相同的 Production Action/Decision/Effect 链，使用隔离 fork，不能用 Browser helper、
旧 selector 或手写资源变化代替。

策略模块只负责从 legal set 中选择 `actionId`。它不得提交规则、代替多选 owner、读隐藏信息
或改变 reward 事实。详细契约见 `docs/policy-port-contract.md` 与 `docs/ai-design.md`。

## 常驻 Worker

Python/PyTorch 通过版本化 JSONL 与常驻 Node worker 通信：

```bash
node tools/run_rl_worker_server.js --workers 4 --timeout-ms 120000
python3 tools/rl_worker_client.py --workers 2 --episodes 2 --max-steps 1000
```

worker 必须有有界队列、request deadline、backpressure、crash replacement 与 confirmed
journal recovery。每个 worker 独占 isolate 和环境实例；reset 必须清空 episode 状态，并通过
fresh A/A、同实例 A/A、同实例 A/B/A 与非零 checkpoint fork 证明隔离。

## 训练与评测

```bash
node tools/run_self_play_training.js \
  --episodes 2 \
  --seed baseline-v1 \
  --checkpoint checkpoint/self-play/baseline-v1.json \
  --log checkpoint/self-play/baseline-v1.jsonl

node tools/run_rl_evaluation.js \
  --checkpoint checkpoint/self-play/candidate.json \
  --report checkpoint/evaluation/candidate.json
```

冻结评测协议是 `randomizer/training/evaluation/stable-200-v2.seeds.json`：20 局、4 席、
每局最多 1000 次 policy 决策。通过条件为 20/20 正常终局、80 席均分不低于 200、P25
不低于 180、P50 不低于 200、非法动作率和阻塞率均为 0。修改 seed、样本数、分位数、
步数上限或门槛必须发布新协议 id。

## 固定盘面（浏览器开局）

开始界面"固定盘面"下拉提供两个与训练侧同 seed 的确定性盘面（RNG 起点契约 =
`hashSeed(seed)`，见下）：

- `seti-107`（双发盘面）：白色 2 选 1 含「寰宇动力 / 异星实验室」；
  训练侧 `FIXED_BOARD_CONFIG` 默认即为该盘面（`seti-107-board-v1`）。
- `seti-free-analyze-v1`（免电分析盘面）：白色 2 选 1 含「异星实验室 / 深空探测」，
  深空探测被动 `deepspace_free_analyze` 使数据分析不消耗能量。

选择固定盘面会把对应 seed 锁定到种子输入框；也可以直接输入任意种子自定义
盘面（4 人局、weak_start，与训练侧对齐）。

## 人类示范录制与导入

前台开局前有"录制本局轨迹（self-play 格式）"开关，默认勾选。开启后浏览器不依赖
任何 UI 事件埋点，直接在引擎输入链（Browser 与 Simulation 共用的
submitAction/submitDecision 语义）为**每个已确认输入**记录一条
`seti-self-play-log-v1` step，并在终局追加 episode_summary：

- step：`actorPlayerId`、`action`、`reward`、`legalMask`、`terminal`、`ok`，
  外加 `actorKind`（`human`/`machine`，区分人类席位与机器席位，不改变 log 结构）；
- episode_summary：`players` 携带各席位终局分，供训练按
  `reward + 终局分` 口径回填 target；
- 撤销（undo）只影响当前 Effect Session，录制器按 session journal 的确认
  replay 截断对齐，被撤销的输入不进入轨迹；恢复（restore）后从恢复点重新开始
  记录，不把恢复前的旧轨迹与新状态混在一起。

终局后浏览器自动下载 `seti-demo-<时间戳>.jsonl`，同时
`SetiRandomizer.getRecordedTrajectory()` 返回同一 JSONL、
`isTrajectoryRecordingEnabled()` 返回开关状态。录制是纯只读旁路：观测、reward
或枚举异常一律吞掉，绝不改变对局结果。

人类示范灌入训练：

```bash
node tools/run_self_play_training.js \
  --episodes 10 \
  --demo-log checkpoint/demo/human-2026-01-01.jsonl \
  --demo-all-seats \
  --checkpoint checkpoint/self-play/demo-augmented.json
```

`--demo-log` 接受逗号分隔的多个人类示范 JSONL；默认只导入 `actorKind === "human"`
的步骤，`--demo-all-seats` 才包含机器席位步骤。导入与 self-play 的
`updateAgent` 同一更新口径（`flattenReward(reward) + 该席位终局分` 作为 target，
按 family 更新 action-kind Monte Carlo 值）。已应用的示范以文件内容指纹写入
checkpoint `config.demoLogs`，resume 时按指纹去重，不会重复灌入同一文件。

## 性能门禁

```bash
node tools/benchmark_simulation_env.js --games 3 --max-steps 1000
node tools/benchmark_rl_workers.js --workers 1 --games-per-worker 5 --max-steps 1000
node tools/benchmark_rl_workers.js --workers 4 --games-per-worker 5 --max-steps 1000
```

常驻 worker aggregate 目标为 `>= 50 decision/s`。报告必须分列 boot、legality、transition、
effect drain、observation、serialization 与 inference idle；不得通过省略 observation、owner
校验、replay、自动结算或扩大等待窗口制造吞吐提升。历史机器实测不写入长期契约，以命令
生成的版本化报告为准。

## 验证

- unit：Action/Observation schema、隐私、stale/owner、checkpoint/replay、worker isolation。
- full-flow：唯一版本化完整流程。
- parity：Browser/Simulation 对同 descriptor、Decision、journal 和 committed checkpoint 等价。
- 性能：固定命令输出可追溯报告；性能测试不替代规则正确性证据。
