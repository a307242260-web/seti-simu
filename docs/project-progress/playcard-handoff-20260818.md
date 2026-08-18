# 打牌价值专项——彻查交接（2026-08-18）

> 目标：AI 打牌次数（全盘白色 3 次 vs 用户 405 档 19 次，用户 R1 就打 2 张、
> R2 打 3 张、R3 打 6 张含外星牌；AI 全程 0 外星牌）。用户裁决顺序：
> 打牌 → 收入 → 科技。

## 已确认事实（勿重复验证）

1. **用户 405 档 19 次打牌分布**（`seti-saves/seti-save-537-merged.json`）：
   R1 card-13(b_117)/card-15、R2 card-24×2/card-42、R3 card-51/amiba-1/amiba-0/
   card-29/amiba-7/card-62/chong-3、R4 chong-2/chong-6/card-67/card-80/card-84/
   amiba-5/amiba-6。**8 张外星牌**（amiba×4、chong×3）。
2. **AI v27-tech-v3 全盘 3 次打牌**：step167 card-45、step272 card-56、step460
   card-76（全普通牌，零外星牌）。
3. **关键案例**：用户 R1 step23 打 b_117（成本 3，playEffects = LAUNCH skipCost
   免费发射 + 2 宣传）→ 免费探测。AI 同盘面 R1 通过"收入选牌"拿到 b_117
   （step31 choose_card income:card-13-0）后**不打**，step32 选择付费 launch。
4. **probe 目标绑定存在**：`probePlanActions` 里 `launchCards = legalActions.filter(
   play_card && cardHasFreeLaunch)`——只要探测目标 nextStep=launch 且手牌有
   免费发射牌，play_card 应并列进候选。b_117 的 playEffects 确实是
   `{type: "launch", options: {skipCost: true}}`，cardHasFreeLaunch 判定应通过。

## 正确诊断方法（重要，否则会误判）

- **必须走协调器等价装配路径**：`createSimulationEnv().reset({seed,...})` 从零
  开局（kernel 注入 `projectCounterfactualState → buildObservation`），再用存档
  `replaySteps[i].action` 逐个 `env.step(action)` 重放到目标步，然后 `env.observe()`
  + `env.legalActions()` 检查。
- **禁止**用裸 `createDecisionObservation(proj.state)`（projection().state 的
  players 是 `{players:[...]}` 包装，findPlayer 找不到座位 → outcomeProjection.assets
  全 0 → probeGoalResourceReachable 全 false → probe 目标全被滤掉——这是诊断
  假象，不是运行时问题。运行时 viewer.role="player" 走 projectCounterfactualState
  装配，assets 正常透传（实测 5钱2能5宣）。
- 诊断脚本：`node tools/diag_playcard_b117.js <save> <step-index>`（已按上述
  正确路径实现，重放到第 N 步动作后打印手牌/资源/probe 候选/目标绑定）。

## 重放到 step32 决策点的实测结果（正确装配）

- 白色手牌：card-15-0(3)、card-37-0(2)——**b_117(card-13-0) 已不在手**
  （step31"收入选牌 b_117"后手牌从 card-13/card-15 变成 card-15/card-37，
  需查"收入选牌"机制到底做了什么：收入阶段选牌把 b_117 换了？）。
- probe 目标 2 个（probe:launch:land:mars / probe:launch:orbit:mars），
  每个 compatibleActionIds 只有 1 个动作（应为 launch），**0 个 play_card**。
- 目标绑定 14 个动作，play_card 0 个。
- assets 正常：5钱2能5宣、手 2 张。

## 待查方向（新 agent 彻查点）

1. **"收入选牌"机制**（step31 choose_card income:card-13-0）：为什么 R1 收入
   阶段会出现选牌？b_117 被选中后去了哪里（手牌从 2 张变 2 张但内容变了）？
   是否该选牌本身就有问题（用户档同一步是 play_card 打 b_117）。
2. **probe 目标为什么没并列 play_card**：step32 决策点手牌是 card-15/card-37，
   若这两张含免费发射（cardHasFreeLaunch）应并列进 launchCards；若不含，
   则 probe 路径正确但手牌无免费发射牌——需查 b_117 为何不在手。
3. **外星牌打牌路径**：用户 8 张外星牌全打，AI 0 张。外星牌（amiba/chong）
   打牌经哪条目标绑定？是否完全不可见？
4. **play_card 评估价值**：即使进候选，叶价值是否让 play_card 胜出？
   （曾全放行退化 86→17，故需目标绑定+效果链价值而非放行。）

## 相关代码

- `randomizer/game/ai/expected-score-evaluator.js`：`cardHasFreeLaunch`(1200)、
  `probePlanActions`(1797)、`selectSecondaryAgentRootActions`(2046)、
  `enumerateSecondaryAgentRootTargets`(1751)。
- `randomizer/app/simulation-env.js`：`buildObservation`(176)、
  `projectCounterfactualState` 注入(610)、`step`(662)。
- 诊断工具：`tools/diag_playcard_b117.js`。
- 对比数据：用户档 `seti-saves/seti-save-537-merged.json`；AI 全盘
  `seti-saves/seti-save-research-v27-tech-v3-full-v267.json`。
