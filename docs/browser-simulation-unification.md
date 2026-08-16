# Browser / Simulation 内核共用与接口统一审计

本文回答两个问题：

1. 浏览器模式与 Simulator（Node simulation / 训练）是否共用同一套内核？
2. 每一项功能（例如登陆，包括打牌登陆与直接登陆）是否使用同一接口？

结论：**内核完全共用，输入端口完全共用；但 `launch` / `orbit` / `land` 三个 family 在
内核内部存在两套并行实现（"参考行动" 与 "能力层"），打牌来源与直接主行动走不同引擎。**
其余 family 均只有唯一实现。文档中 family 计数（22 vs 23）与"唯一规则执行器"表述与
代码不一致，冲突清单见文末。

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
- 23 个 family 的 registry、五个 Effect domain（opening / standard / card / science /
  probe-turn / residual）、Decision owner、提交链全部由 `production-composition.js` 唯一安装；
- 输入端口（`inputPort.enumerateActions / submitAction / submitQuickAction /
  submitDecision / undo`）与 `lifecycle`、`counterfactualPort`、`inspect` 由
  `rule-composition.js` 唯一实现，两个宿主逐字调用同一端口；
- AI 席位共用 `game/ai/machine-player-host.js`（Browser 经
  `app/browser-host/policy-input-adapter.js`，Simulation 经
  `training/heuristic-policy-adapter.js`）。

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

| family | 相位 | 唯一实现？ | 执行入口 |
|---|---|---|---|
| `launch` | main | **否（双实现）** | 直接行动：probe-turn → `game/actions/launch.js`；奖励/卡牌：`abilities/rocket.launchProbe` |
| `orbit` | main | **否（双实现）** | 直接行动：probe-turn → `game/actions/orbit.js`；卡牌：`abilities/planet.orbitProbe` |
| `land` | main | **否（双实现）** | 直接行动：probe-turn → `game/actions/land.js`；卡牌：`abilities/planet.landProbe` |
| `move` | quick | 是 | `abilities/rocket.listPlayerMoveChoices` + `moveProbe`（probe-turn / 卡牌 / 快速交易 / 残余域共用同一入口） |
| `scan` / `place_data` / `analyze` | main/quick | 是 | science-session → `abilities.scan/scanEffects`、`abilities.data` |
| `research_tech` | main | 是 | science-session → `game/actions/research-tech.js`（其内部再调 `abilities.tech.researchTechSelect`） |
| `play_card` | main | 是 | card-play domain（`game/cards/play-domain.js`） |
| `quick_trade` | quick | 是 | production-composition + `game/actions/quick-trades.js` |
| `industry` / `card_corner` / `runezu_face_symbol` / `complete_task` | quick | 是 | residual-domain-session + `industry/abilities` |
| `pass` / `end_turn` | main/turn_control | 是 | probe-turn-session 内部 |
| 7 个 conditional（choose_* / accept_optional_effect） | conditional | 是 | 各 Effect domain 的 Decision |

注：双实现的三个 family 在**两个宿主内行为一致**（同一内核），双实现是内核内部的
重复代码，不是 Browser 与 Simulation 之间的分歧。

## 4. 登陆的双实现细节（打牌登陆 vs 直接登陆）

当前两条路径（都在共用内核里）：

| | 直接登陆（`land` family，主行动） | 打牌登陆（`play_card` 效果链） |
|---|---|---|
| 目标枚举 | probe-turn-session → `actions.getAction("land").getLandOptions`（`game/actions/land.js`） | play-domain `listPlanetChoices` → `abilities.planet.listLandRequirementsAt`（`game/abilities/planet.js`） |
| 执行 | probe-turn-session EXECUTE/LAND_CHOICE → `actions.getAction("land").execute` | play-domain `resolvePlanet` → `abilities.executeAbility("landProbe", …)` |
| 多目标选择 | 走 `choose_target` Decision（与打牌同一选择框） | 走 `choose_target` Decision |
| 奖励 | 两端都经 `planetRewards.buildRewardEffectsForAction("land", result)`（共享） | 同左 |
| 事件 | 两端都发 `{type:"land", planetId, markerKind, satelliteId, playerId, playerColor}` | 同左 |

`actions/land.js` 与 `abilities/planet.js:landProbe` 是**两套独立代码**，能力层是更完整
的版本，行为差异点：

- 能力层支持 `skipCost/cost/allowDuplicateLanding/allowDuplicateSatelliteLanding/
  afterLandRewards/forceFirstLandingReward/displayLandingSlot/referenceOffsetTokenWidths/
  source` 等选项；`actions/land.js` 只支持 `rocketId/target`，成本恒为 `3 - 环绕折扣
  - 橙3折扣` 能量。
- 失败回滚：能力层用快照整体还原 `pieces/planets/aliens/player`；`actions/land.js` 在
  标记失败时只退还能量、不还原已移除的火箭（`actions/orbit.js` 同理只退还费用）。
- 返回形状：能力层带 `abilityId + payload`；参考行动带 `actionId`，无 `payload` 嵌套。

`launch`、`orbit` 与 `land` 是同一模式的三个实例：probe-turn-session（直接主行动）走
`game/actions/{launch,orbit,land}.js`，而卡牌、行星奖励、扫描奖励、probe 需求枚举走
`abilities/*` 能力层。`move` 已经统一到能力层（`listPlayerMoveChoices` + `moveProbe`），
`research_tech` 是"行动薄包装能力"的正确范式。

## 5. 统一方案（待执行）

目标：让三个 family 的唯一执行引擎落在能力层，删除/收编参考行动副本。

1. `game/effects/probe-turn-session.js`：
   - `launch` family `getOptions`/EXECUTE 改用 `abilities.executeAbility("launchProbe", …)`
     （保留 `mainActionCompleted` 置位与奖励构建）；
   - `orbit`/`land` family `getOptions`/EXECUTE/LAND_CHOICE 改用
     `abilities.planet.getOrbitOptions/getLandOptions` + `orbitProbe/landProbe`；
   - 校验 `landProbe` 返回字段与 `buildRewardEffectsForAction`、`buildLandChoiceSummary`
     兼容（两者都读 `markerKind/satelliteId/planetId/rewardMarkerSequence/markerSequence`，
     已验证兼容）。
2. `game/actions/{launch,orbit,land}.js` 改为能力层的薄包装或物理删除；同步删除
   `actions/index.js` 与 `standard-action.js` 中对应的 reference definition /
   `createReferenceRegistry` 残余（先确认 `actions/index.js:execute` 只剩测试使用）。
3. 测试：`game/actions/actions.test.js`、`standard-action.test.js`、
   `probe-turn-session` 相关用例迁移到能力层断言；跑 `tools/run_node_tests.js` 全量回归。
4. 文档：本文件第 3/4 节改为"唯一实现"；`standard-action-contract.md`、
   `mechanics-reference.md` 的"唯一规则执行器"表述收敛为能力层。

风险：直接主行动改为能力层后，`orbit`/`land` 的成本语义从"固定值"变为
`resolveCost(options, default)`——直接主行动必须显式传 `cost`（能量/信用点），
不得误用 `skipCost`；多目标 `choose_target` 的 `payload.energyCost` 保持透传。

## 6. 代码与现有文档的冲突清单

| # | 位置 | 文档说法 | 代码现状 |
|---|---|---|---|
| 1 | `docs/app-architecture.md` L26 | "安装 22 个 Standard Action family" | **23**（commit b52fcfb 已加 `complete_task`，计数 22→23） |
| 2 | `docs/standard-action-contract.md` L7 | "当前 15 个顶层 family 与 7 个 conditional family" | **16 + 7 = 23** |
| 3 | `docs/rl-simulation-env.md` L43-44 | 顶层 family 列表缺 `complete_task` | 16 个顶层 family 含 `complete_task` |
| 4 | `docs/browser-host-ui.md` L9 | "15 个顶层 family、7 个 conditional family" | 16 + 7 |
| 5 | `docs/project-architecture.md` L38 | "15 个顶层 family 与 7 个 conditional family" | 16 + 7 |
| 6 | `docs/standard-action-contract.md` L52 | "唯一规则执行器为 `game/actions/land`" | `abilities/planet.landProbe` 同样执行登陆（打牌来源）；`actions/land.js` 只是直接主行动的执行器 |
| 7 | `docs/mechanics-reference.md` L282-283 | "Production domain 在 `orbitProbe` / `landProbe` 成功后生成奖励 Effect" | 奖励由调用方（probe-turn / play-domain）在 `orbitProbe`/`landProbe` **或** `actions/orbit/land` 成功后构建；能力函数本身不生成奖励 |

## 7. 验证义务

- 本文第 1/2 节结论由现有 parity 测试持续证明（`rule-composition.test.js`、
  `simulation-standard-action-composition.test.js`）；改动输入端口或 Domain Pack 必须
  保持这两组测试绿色。
- 执行第 5 节统一方案前，按 `docs/implementation-proof-obligations.md` 把验收条款
  （同 seed 直接登陆 / 打牌登陆的标记、事件、奖励、journal 前后一致）转成可证伪义务。
- 统一后 `node --check` 全部改动文件 + `tools/run_node_tests.js` 全量回归。
