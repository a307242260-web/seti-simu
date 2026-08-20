# Browser / Simulation 内核共用与接口统一审计

本文回答两个问题：

1. 浏览器模式与 Simulator（Node simulation / 训练）是否共用同一套内核？
2. 每一项功能（例如登陆，包括打牌登陆与直接登陆）是否使用同一接口？

结论：**内核完全共用，输入端口完全共用，全部 23 个 family 均为唯一实现。**
2026-08-17 统一改造前，`launch` / `orbit` / `land` 三个 family 在内核内部存在两套并行
实现（"参考行动" 与 "能力层"），打牌来源与直接主行动走不同引擎；改造后直接主行动与
卡牌/奖励来源共用同一能力层引擎，参考行动副本已物理删除。此前文档中 family 计数
（22 vs 23）与"唯一规则执行器"表述与代码不一致，冲突已全部处理（见第 6 节）。

---

## 1. 内核共用：结论与证据

两个宿主最终装配的是**同一个** `randomizer/game/production-kernel.js`，区别只在
`hostKind`（`browser` / `simulation`）与宿主专属的 projection adapter / host services：

```text
Browser（app.js）
  └─ app/browser-rule-composition.js
       └─ createBrowserProductionKernel({ hostKind: "browser" })   ← production-kernel.js
Simulation（app/simulation-env.js）
  └─ training/simulation-rule-composition.js（仅 re-export）
       └─ createSimulationRuleComposition({ hostKind: "simulation" }) ← production-kernel.js
两者共同：
  └─ createProductionHostComposition() → installProductionKernel()
       └─ createProductionComposition()（production-composition.js：唯一 Domain Pack）
            └─ createRuleComposition()（rule-composition.js：唯一生命周期/输入端口）
```

- `production-kernel.js` 的 `createBrowserProductionKernel` 与 `createSimulationRuleComposition`
  都调用同一个 `createProductionHostComposition`，只传不同的 `hostKind`；
- 23 个 family 的 registry、六个 Effect domain（opening / standard / card / science /
  probe-turn / residual）、Decision owner、提交链全部由 `production-composition.js` 唯一安装；
- 输入端口（`inputPort.enumerateActions / submitAction / submitQuickAction /
  submitDecision / undo`）与 `lifecycle`、`counterfactualPort`、`inspect` 由
  `rule-composition.js` 唯一实现，两个宿主逐字调用同一端口；
- AI 席位决策共用 `game/ai/machine-player-coordinator.js`（Browser 机器席位与
  Simulation 完全同一协调器 + 同一 `heuristic-decision-function.js`；唯一差异是
  协调器 `recordStep` 记账钩子——sim 训练补记 replay/reward，browser 空操作）。
  旧 `machine-player-host.js` / `policy-input-adapter.js` 异步 Host 壳已删除。

**已测试证明**（`randomizer/app/rule-composition.test.js`、`randomizer/training/
simulation-standard-action-composition.test.js`）：

- 同一 checkpoint 上 Browser 与 Simulation 枚举出的 Standard Action **逐字相等**；
- 提交同一 Action 后两端的 committed state / journal / checkpoint envelope **逐字相等**；
- `quick_trade` 的 descriptor identity、executor 结果、journal events/history 两端一致。

## 2. 输入接口：两端完全一致

Browser 与 Simulation 都不再拥有第二套规则入口：

| 能力 | Browser | Simulation | 实现 owner |
|---|---|---|---|
| 顶层 Action 提交 | `inputPort.submitAction` | `inputPort.submitAction` | `game/rule-composition.js` |
| 快速 Action 提交 | `inputPort.submitQuickAction` | 同（经 step 的 selector） | 同上 |
| Decision 提交 | `inputPort.submitDecision` | 同 | 同上 |
| 合法候选枚举 | `inputPort.enumerateActions` | `inputPort.enumerateActions` | 同上 |
| 撤销 | `inputPort.undo` | 无（训练不需要） | 同上 |
| 新局/保存/恢复 | `lifecycle.newGame/save/restore` | 同 | 同上 |
| 反事实评估 | `counterfactualPort.evaluate` | 同 | 同上 |

## 3. 功能（family）接口唯一性矩阵

统一改造（2026-08-17）后，**全部 23 个 family 均为唯一实现**；`launch` / `orbit` / `land`
的参考行动副本（`game/actions/{launch,orbit,land,index}.js`）已物理删除，probe-turn
直接主行动与卡牌/奖励来源共用同一能力层引擎。

| family | 相位 | 唯一实现 | 执行入口 |
|---|---|---|---|
| `launch` | main | ✅ | probe-turn → `abilities/rocket.launchProbe`（枚举用 `getLaunchCost/getRocketLimitForPlayer/getActiveRocketCountForPlayer`） |
| `orbit` | main | ✅ | probe-turn → `abilities/planet.getOrbitOptions` + `orbitProbe` |
| `land` | main | ✅ | probe-turn → `abilities/planet.getLandOptions` + `landProbe`（多目标走 `choose_target`） |
| `move` | quick | ✅ | `abilities/rocket.listPlayerMoveChoices` + `moveProbe`（probe-turn / 卡牌 / 快速交易 / 残余域共用同一入口） |
| `scan` / `place_data` / `analyze` | main/quick | ✅ | science-session → `abilities.scan/scanEffects`、`abilities.data` |
| `research_tech` | main | ✅ | science-session → `game/actions/research-tech.js`（其内部再调 `abilities.tech.researchTechSelect`） |
| `play_card` | main | ✅ | card-play domain（`game/cards/play-domain.js`） |
| `quick_trade` | quick | ✅ | production-composition + `game/actions/quick-trades.js` |
| `industry` / `card_corner` / `runezu_face_symbol` / `complete_task` | quick | ✅ | residual-domain-session + `industry/abilities` |
| `pass` / `end_turn` | main/turn_control | ✅ | probe-turn-session 内部 |
| 7 个 conditional（choose_* / accept_optional_effect） | conditional | ✅ | 各 Effect domain 的 Decision |

## 4. 登陆的唯一接口（打牌登陆与直接登陆已统一）

改造后两条路径（都在共用内核里）走**同一个引擎**：

| | 直接登陆（`land` family，主行动） | 打牌登陆（`play_card` 效果链） |
|---|---|---|
| 目标枚举 | probe-turn → `abilities.planet.getLandOptions` | play-domain `listPlanetChoices` → `abilities.planet.listLandRequirementsAt` |
| 执行 | probe-turn EXECUTE/LAND_CHOICE → `abilities.executeAbility("landProbe", …)` | play-domain `resolvePlanet` → `abilities.executeAbility("landProbe", …)` |
| 多目标选择 | 走 `choose_target` Decision（与打牌同一选择框） | 走 `choose_target` Decision |
| 奖励 | 两端都经 `planetRewards.buildRewardEffectsForAction("land", result)`（共享） | 同左 |
| 事件 | 两端都发 `{type:"land", planetId, markerKind, satelliteId, playerId, playerColor}` | 同左 |

能力层 `landProbe`（`game/abilities/planet.js`）是唯一登陆引擎，支持
`skipCost/cost/allowDuplicateLanding/allowDuplicateSatelliteLanding/afterLandRewards/
forceFirstLandingReward/displayLandingSlot/referenceOffsetTokenWidths/source` 等选项，
失败时用快照整体还原 `pieces/planets/aliens/player`。`launch`、`orbit` 与 `land` 三个
family 已全部收敛到能力层（`launchProbe` / `orbitProbe` / `landProbe`），
`game/actions/{launch,orbit,land}.js` 参考行动副本与 `actions/index.js` facade、
`standard-action.js` 的 reference definition 机制均已物理删除。
`research_tech` 是"行动薄包装能力"的正确范式。

## 5. 统一方案（已执行，2026-08-17）

1. `game/effects/probe-turn-session.js`：`launch`/`orbit`/`land` 的 `getOptions` 与
   EXECUTE/LAND_CHOICE 全部改用能力层（`launchProbe` / `getOrbitOptions`+`orbitProbe` /
   `getLandOptions`+`landProbe`），保留 `mainActionCompleted` 置位与奖励构建；枚举用的
   发射合法性检查改用 `abilities.rocket.getLaunchCost/getRocketLimitForPlayer/
   getActiveRocketCountForPlayer` 纯原语。`actions`（SetiActions）依赖已从本模块移除。
2. `game/actions/{launch,orbit,land,index}.js` **物理删除**；`standard-action.js` 的
   reference definition 机制（createLaunchDefinition/createOrbitDefinition/
   createLandDefinition/createReferenceDefinitions/createReferenceRegistry/
   createStage2/4Definitions 等）一并删除；`index.html` 移除对应 4 个 script 标签。
3. 测试：`game/actions/actions.test.js` 重写为能力层断言（保留发射上限/费用、环绕折扣、
   登陆能量、卫星橙4、奥陌陌、多目标、溢出标记等覆盖 + research-tech 直调）；
   `node tools/run_node_tests.js` 全量回归通过（排除他人未提交 AI 估值改动影响的两例）。
4. 文档：本文件第 3/4 节已改为"唯一实现"；`standard-action-contract.md` 与
   `mechanics-reference.md` 的"唯一规则执行器"表述已收敛为能力层。
5. 浏览器装配：`production-browser-full-parity` 等 9/10 Chrome smoke 通过（唯一失败
   `production-solar-preview` 为改造前已存在的独立缺陷，与本次无关）。

行为保真说明：直接主行动改走能力层后，`orbit`/`land` 成本语义为
`resolveCost(options, default)`；probe-turn 不传 `cost`/`skipCost`，因此与改造前固定值
（环绕 1信用+1能量、登陆 3-环绕-橙3 能量）一致；多目标 `choose_target` 的
`payload.energyCost` 保持透传。

## 6. 代码与现有文档的冲突清单（处理状态）

| # | 位置 | 文档说法 | 代码现状 | 处理 |
|---|---|---|---|---|
| 1 | `docs/app-architecture.md` L26 | "安装 22 个 Standard Action family" | **23**（commit b52fcfb 已加 `complete_task`，计数 22→23） | ✅ 已修正 |
| 2 | `docs/standard-action-contract.md` L7 | "当前 15 个顶层 family 与 7 个 conditional family" | **16 + 7 = 23** | ✅ 已修正 |
| 3 | `docs/rl-simulation-env.md` L43-44 | 顶层 family 列表缺 `complete_task` | 16 个顶层 family 含 `complete_task` | ✅ 已修正 |
| 4 | `docs/browser-host-ui.md` L9 | "15 个顶层 family、7 个 conditional family" | 16 + 7 | ✅ 已修正 |
| 5 | `docs/project-architecture.md` L38 | "15 个顶层 family 与 7 个 conditional family" | 16 + 7 | ✅ 已修正 |
| 6 | `docs/standard-action-contract.md` L52 | "唯一规则执行器为 `game/actions/land`" | 统一后唯一执行器为 `abilities/planet.landProbe`（打牌/直接同一引擎） | ✅ 统一改造后消除 |
| 7 | `docs/mechanics-reference.md` L282-283 | 奖励"在 orbitProbe/landProbe 成功后生成" | 统一后两条路径都经 `orbitProbe`/`landProbe`，表述成立 | ✅ 统一改造后消除 |

## 8. 信息层统一（host-unify，2026-08-18）

### 背景：Browser 机器席位 observation 失明（隐藏失败）

机器协调器与 AI 评估需要**规则观察**形状的输入（顶层 `publicState.players/board`、
`selfState.hand`、requirements）。修复前 Browser 的 `projectBrowserState` 产出的是
**UI 展示视图**：`defaultVisibilityPolicy` 把 players/board/cards 放在 `resident.*`，
随后 `projectBrowserState` 把 `visible.resident` **整体替换**成
`{ finalReadModel, browserReadModel, initialSetup, initialIncome }`（读模型壳）。
结果 `composition.projection(viewer).state` 顶层只剩 `match`/`resident`(壳)/
`feedback` —— 协调器 `createDecisionObservation(projection.state)` 从中取不到
players/board/hand，**静默**产出空 observation（players=0、assets=0、hand=[]），
启发式决策评估全 0 → 兜底选 `pass`，且**不抛任何错**（隐藏失败）。

`tools/diagnose_browser_machine_end_to_end.js` 实证：同一协调器 + 同一决策函数 +
同一 seed 推进到主行动边界，Simulation 观察完整（players=4/hand=4/assets=3/5/1/3，
选 `place_data`），Browser 观察失明（全 0，选 `pass`）。

### 方案：信息层同源、UI 只套壳

- 共享实现：`app/rule-observation.js` 从 simulation-env 迁移 `buildObservation`
  （含 `pendingFinalMarkValue`/`buildDecisionFromState`），导出 `buildRuleObservation`。
  Simulation 的 `projectCounterfactualState` 与 Browser 的 `projectBrowserState`
  信息层调用**同一份实现**、同一 sanitize 纯函数（simulation-contract）。
- Browser `projectBrowserState`（`app/browser-rule-composition.js`）：
  - **不再整体替换 `visible.resident`**——信息字段（players/board/cards/tech/aliens/
    solar/planets/data/finalScoring）保留为共享信息视图；
  - 读模型壳附加为 `resident.ui = { finalReadModel, browserReadModel }`（不覆盖信息）；
  - 顶层附加规则观察信息层 `publicState`/`selfState`（`buildRuleObservation` 产出，
    与 Simulation 完全同源）。
- 机器协调器 `createObservation(projection.state)` 命中顶层 `publicState`/`selfState`
  → Browser/Simulation 机器席位观察同构，outcome-model 零改动。
- UI 消费点迁移：`resident.browserReadModel` → `resident.ui.browserReadModel`、
  `resident.finalReadModel` → `resident.ui.finalReadModel`（app.js / decision-ui /
  resident-renderer）；`resident.players`、`resident.solar` 随信息层保留而恢复。

### 连带修复：反事实叶观测从未被完整重建

`rule-composition.js` 的 `fullLeafObservation` 原代码写 `composition.projection(viewer)`
——`composition` 在本闭包未定义，**每次执行都抛 ReferenceError 被旧 `catch (_error)`
静默吞掉** → 叶观测恒为中间（cheap）观测 fallback，评估器一直拿缺 planets/data/
solarSystem/finalScoring 的观测算分。修复：

- `fullLeafObservation` 改用搜索循环维护的 `activeForkComposition`（当前 fork 的
  composition）重建完整叶观测；无可用 fork 时显式抛
  `COUNTERFACTUAL_LEAF_OBSERVATION_FAILED`（错误必须暴露，不再静默回退）。
- `simulation-counterfactual-outcome.test.js` 的"首痕迹宣传奖励"断言（同根两槽位
  publicity delta = {0,1}）在修复前恒失败（叶观测无真实结算），修复后通过。

### 验证

- `node tools/run_node_tests.js` 全量回归通过（unit + full-flow）。
- `tools/diagnose_browser_machine_end_to_end.js`：Browser 机器席位观察恢复完整
  （players/hand/assets 非空），主行动正常评估，不再兜底 pass。
- `tools/audit_v_state_inputs.js` 扩展 Browser 路径（projectBrowserState 信息层喂 V
  评估）后全部通过。



## 7. 验证义务（已执行）

- Browser/Simulation parity：`rule-composition.test.js`、`simulation-standard-action-
  composition.test.js` 保持绿色（同 checkpoint 枚举逐字相等、提交后 committed
  state/journal/checkpoint 逐字相等）。
- 全量回归：`node tools/run_node_tests.js` 63/63 unit + 1/1 full-flow 通过（排除
  `simulation-counterfactual-outcome.test.js` 与 `strategic-goal-evaluator.test.js`——
  两者依赖他人未提交的 `expected-score-evaluator.js`/`outcome-model.js` 改动，改造前
  即失败，与本次无关）。
- 浏览器：`node tools/run_browser_smokes.js` 9/10 通过，含 `production-browser-full-parity`
  （人类主/快/回合动作、机器席位标准输入、多步 Decision、保存恢复）；`production-solar-preview`
  为改造前已存在的独立失败。
- 旧路径删除证据：`git show --stat` 确认 `game/actions/{launch,orbit,land,index}.js`
  已删除；grep 全仓库无 `actions.getAction("launch"/"orbit"/"land")`、`SetiAction*` 残留。
