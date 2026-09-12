# Browser / Simulation 内核共用与接口统一审计

本文回答两个问题：

1. 浏览器模式与 Simulator（Node simulation / 训练）是否共用同一套内核？
2. 每一项功能（例如登陆，包括打牌登陆与直接登陆）是否使用同一接口？

结论：**内核完全共用，输入端口完全共用，全部 23 个 family 均为唯一实现。**
直接主行动与卡牌、奖励来源共用同一能力层。

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

全部 23 个 family 使用唯一实现，probe-turn 直接主行动与卡牌、奖励来源共用能力层。

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
family 共用能力层的 `launchProbe` / `orbitProbe` / `landProbe`。

## 信息层统一

- `app/rule-observation.js` 的 `buildRuleObservation` 与同一 sanitize 纯函数为两个宿主
  提供顶层 `publicState`、`selfState` 和 requirements。
- Browser `projectBrowserState` 保留 `resident` 信息字段，将读模型附加在 `resident.ui`。
  UI 从 `resident.ui.browserReadModel` 与 `resident.ui.finalReadModel` 读取展示数据。
- 机器协调器读取 `projection.state` 的规则观察，评估器只消费完整、按 viewer 遮蔽的输入。
- 反事实完整叶观察由当前 `activeForkComposition` 重建；缺失 fork 时显式抛出
  `COUNTERFACTUAL_LEAF_OBSERVATION_FAILED`。

## 验证入口

- `node tools/run_node_tests.js`：相关 composition 与完整流程行为验证。
- `node tools/run_browser_smokes.js`：真实页面输入、机器席位和保存恢复。
- `node tools/audit_v_state_inputs.js`：评估器输入完整性检查。

验证结论属于具体代码版本，不在当前契约复制历史通过数量。
