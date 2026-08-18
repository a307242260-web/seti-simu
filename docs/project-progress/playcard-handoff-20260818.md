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
5. **第一条实锤（收入选牌消耗 b_117）**：AI step31"收入选牌"= place_data
   计算机 4 号位奖励（`EFFECT_TYPES.INCOME`，science-session.js ~1475：
   选一张手牌插入收入列，**移出游戏**）。AI 把手牌 b_117（income_code=2 →
   手牌上限+1）插了收入列，b_117 移出游戏 → 后续无免费发射牌可打。
   用户 405 档同机制下**从未把 b_117 插收入列**（用户 step23 打它免费发射；
   用户插收入列的牌是 dlc_40/dlc_39/b_48/dlc_25/chong_7/b_111/dlc_8/b_140/
   b_133）。→ 条件决策"收入选哪张"的评估需查：AI 为什么选 b_117 而不是
   保留它打牌（机会成本没被考虑？还是选牌评估只看收入收益？）。
6. **第二条实锤（收入选牌评估全 0，纯字典序选择）**（2026-08-18 诊断）：
   step31 收入选牌决策点（插 b_117 vs 插 dlc_9）两个候选的
   `evaluateAction` **都评 0 分**（score=0, delta=0, infra=0, income=0）——
   反事实搜索对 choose_card income:XXX 的叶链**没捕获 income 插牌效果**
   （手牌上限+1 / 移出游戏 / 机会成本全不可见）。全 0 平局 → policy 按
   actionId 字典序选（income:card-13-0 < income:card-15-0 → 选 b_117）=
   **纯运气选择**。提交后规则侧正确执行（handSize 1→2、b_117 移除换
   card-37），问题只在搜索评估侧。
7. **修正误解：place_data 是 quick 行动不占主行动**（用户 2026-08-18 纠正）：
   R1 step23 AI 选 place_data（quick）**不是问题**——先放数据不影响之后
   打牌（main）。真正的问题链只在：① 收入选牌消耗 b_117（实锤）；
   ② 主行动窗口 launch vs play_card 评估**平局**（69.5=69.5，诊断实测），
   被 actionId 字典序打破选 launch——免费发射的 2 宣传+省发射费优势没被
   评估捕获（launch 的叶链也做了同样探测，收益归因相同）。
8. **收入选牌机会成本修复（2026-08-18 实施）**：用户口径"手牌也有价值，
   已知的牌可以评估他的价值（插进去的损失价值/机会成本）"——新增
   `cardPlayValue`（免费发射 15 / 宣传 5×宣传数 / 免费科技按
   selectHeuristicTechPlans top3 是否匹配：匹配 30 / 不匹配 10 / 收入牌 /
   登陆 / 移动 / 痕迹）+ `incomePickOpportunityCost`（evaluateOutcome 里对
   choose_card income:* 扣被插牌的打牌价值×0.5）。修复前两候选评 0 平局
   字典序选 b_117；修复后 step31 选 **dlc_9**（免费紫色科技不在 top3 →
   成本 5）保留 b_117（免费发射+宣传 → 成本 12.5）——与用户行为一致。
   67/67 测试全过。待 200 步快速验证确认整体行为。
9. **免费发射打牌奖励（2026-08-18 实施，第二环）**：用户口径"免费发射 = 探测链
   价值 + 省发射费 + 牌面宣传，理应优于付费 launch"。诊断确认 launch 与 play_card
   b_117 在决策函数路径（目标绑定完整链）评出完全相同的 59.5——launch 的叶链展开
   26 步（launch→end_turn→play_card→...→analyze→pass），incomeValue=30/
   traceValue=5/alienPurpose=6.5/pubResearch=10 全是链里后续动作的收益被归因到
   launch 根（搭便车；单独 evaluateActionOutcomes 无绑定则只有 1 层叶无 income）。
   两候选绑定同一 probe 目标走相同完整链 → 平局 → 字典序选 launch。修复：
   `playCardFreeLaunchBonus`（evaluateOutcome 对含 LAUNCH(skipCost) 的 play_card
   加 2 钱发射费 × 信用单位 8 × 0.5 = 8 分奖励）。修复后 step32（R1 第一主行动，
   同用户 405 档 step23 决策点）选 **play_card b_117**（67.5 > launch 59.5）——
   与用户行为一致。67/67 测试全过。

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

1. **"收入选牌"消耗 b_117（已实锤，优先级最高）**：AI 把 b_117 插收入列
   （手牌上限+1），用户保留它打牌（免费发射+2宣传）。查条件决策
   choose_card income:XXX 的评估：为什么选 b_117 而不是保留它？
   收入选牌是否有"跳过"选项？选牌评估是否考虑该牌的打牌价值/机会成本？
   （science-session.js EFFECT_TYPES.INCOME executor ~1475；
   协调器条件决策路径见 heuristic-decision-function policyFor。）
2. **probe 目标为什么没并列 play_card**：step32 决策点手牌是 card-15/card-37
   （b_117 已被收入选牌移出）。若这两张含免费发射（cardHasFreeLaunch）应
   并列进 launchCards；若不包含，则 probe 路径本身待验证（用一张含免费发射
   的牌在手的存档点测）。
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
