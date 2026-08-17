# 机器人迭代路线（2026-08-17，用户讨论纪要 + 执行计划）

本文档记录 2026-08-17 与用户讨论确认的机器人（免电分析盘面 `seti-free-analyze-v1`）
迭代路线。目标：**均分 100**（当前基线白色 86、四家均分 64.3）。用户口径：
"学思路学方法，不要单点调参"——改的是搜索覆盖与评估模型，不是参数。

## 1. 用户给出的两个先决条件（总纲）

> 要大幅度提高 AI 的效果，有两个先决条件：
> 1. **AI 真的能尽可能多地尝试所有可能性**（搜索覆盖）
> 2. **对尝试结果 / 盘面有正确的评估判断**（价值模型）

两条缺一不可：覆盖再广，评估错也没用；评估再准，没试到也白搭。当前两条都缺。

## 2. 用户指出的三个最迫切改进点

1. **对打牌价值没有正确的认知**
   - 因此对"标记外星人、获得外星人牌"没有渴望
   - 因此不会有意识地去标记仍未标记的外星人首踪迹、开外星人、获得外星人牌
2. **对科技价值认知不足**
   - 无法理解科技会让后期资源转换效率大幅增加（研究 4 次 vs 用户 12 次）
3. **对收入的动力也不是很充足**
   - 虽然有认知（incomeValue 已在模型里），但和用户差距太大
   - 用户收入轨迹 R2末 c6/e2 → 终局 c8/e7；AI 全程 c4/e2

## 3. 用户确认的行动逻辑二分法（价值模型设计原则）

> 做行动的逻辑有两种：
> - **为后续作准备**：拿科技、获得收入
> - **当下榨取收益**：获得分数、资源
>
> 之前说的赢得扇区、登陆等大多是直接榨取收益。
> **环绕 orbit 和填充数据 place_data 是获得收入的主要来源。**

即评估模型必须同时覆盖两类价值：准备类（科技复利、收入复利）与榨取类（即时分/资源），
且明确"环绕 + 填数据 = 收入引擎"。

## 4. 用户反对当前的分桶架构

**不要分成 strategic / bounded 两个桶，应该是统一的。**

当前架构（`simulation-env.js runHeuristicPolicyDecision` + `expected-score-evaluator`）：

| 桶 | 进去的动作 | 搜索预算 | 问题 |
|----|-----------|---------|------|
| strategic | 绑定 探测/数据/扇区/收入/科技 目标 | depth 15 / leaves 8 / nodes 128 / secondary（实际只用 4096 物理上限） | 只搜"命中预设目标"的动作 |
| bounded | 未绑定目标的 play_card | depth 6 / leaves 3 / nodes N×16 / 无 secondary | 打牌链 >6 步就被截断 |
| control | end_turn / pass | depth 1 | 无需评估 |
| 未评估 | 其余（quick_trade / card_corner / place_data 未命中目标等） | `unresolved` | 完全看不到价值 |

两个门控：
- **根门控**：`selectSecondaryAgentRootActions` 只放行"绑定预设目标"的动作进 secondary
- **后继门控**：`selectSecondaryAgentSuccessors` 分支内同样按目标清单选后继，未绑定动作被过滤

**分桶的本质是性能 hack，不是价值设计**——把"是否值得深搜"做成了"是否命中预设目标清单"。
副作用：价值链超过 bounded 深度的动作（如用户 chong_3：打牌→移动→登陆→外星标记→盲抽牌，
6+ 步才完整）永远看不到价值 → 对打牌无渴望 → 对标记外星人无动力。

## 5. 统一搜索方案（第一步：搜索覆盖）

核心思路：**去掉"目标清单门控"，改为"预算内全部尝试 + 优先级排序"**。

1. **根动作不再按目标过滤**（`simulation-env.js`）：`selectSecondaryAgentRootActions`
   改为所有非 control 动作都进 secondary 搜索（`requiresRootCounterfactual` 已滤掉
   end_turn/pass）。不问"绑定什么目标"，而是"能不能试"。
2. **后继选择不再只留目标动作**（`expected-score-evaluator selectSecondaryAgentSuccessors`）：
   `!input.routeTargetId` 分支里把 `targeted` 与**所有其他合法后继**合并返回，让搜索
   在每个节点都能尝试所有动作。
3. **优先级排序驱动预算分配**（替代门控）：`getBranchPriority` 对未绑定目标的分支也给
   合理默认优先级（family 基础价值 / 立即资源收益），绑定目标的仍优先（有明确 gap 缩小）。

爆炸控制：
- `maxExecutionNodes` 保持 4096 物理上限，靠 branchPriority 排序让高价值分支先展开；
  低价值分支在节点耗尽时被 pruned（被尝试过，而非"根本不在搜索里"）。
- `maxLeaves` 饱和保持（每虚拟根 8 叶），防止单动作独占。

验证方式（不是只看分数）：
- 覆盖指标：unresolved 比例下降、各 family 是否有评估（不再只有绑定目标的有）
- 行为指标：AI 是否开始打有长链价值的牌、放外星痕迹
- 全盘对比 baseline（均分、行动族分布、外星人时间线）

## 6. 后续工作（同步记录）

- [x] 2026-08-17 讨论确认路线（本文档）
- [x] 诊断：AI 全盘外星人时间线——白色 slot1 蓝/黄（step100/114）、slot2 粉（step366），
      揭示虫（step385，太晚），阿米巴被绿色抢走（step303）；终局外星来源全 "-"（未放位置）
- [x] 诊断：用户 405 档外星牌真实价值链（chong_3 打牌→移动→登陆→标记、chong_6 登陆+扫描）
- [x] 基础设施：tools/run_simulate_save.js（模拟全盘+同浏览器格式存盘）、
      tools/fast_forward_save.js（存档快进复现，537 步 ~5s，纯内核重放）
- [x] V 校准数据提取：用户 405 档各回合末状态与收入/科技事件（见下）
- [ ] 统一搜索：去掉分桶门控（第 5 节三处改动）
- [ ] 价值模型：准备类（科技效率红利、收入复利）与榨取类完整覆盖
- [ ] 外星目标簇：放首痕迹→三色齐→揭示→放位置→拿外星牌作为正式目标
- [ ] 收入动力：环绕/填数据作为收入引擎进入评估

## 7. V 校准（用户 405 档实测）

### 7.1 用户各回合末状态（白色）

| 回合末 | 分 | 钱/能 | 收入 | 科技数 | 科技列表 | 外星 |
|-------|-----|-------|------|-------|---------|------|
| R1 | 15 | 0/1 | **c6/e2** | 2 | blue2+purple4 | s1:0首 s2:1首 |
| R2 | 32 | 4/1 | c6/e2 | 3 | +blue1 | s1:2首 |
| R3 | **105** | 0/0 | **c7/e4** | 6 | +purple2/orange2/orange4 | **s1:3首✓ s2:3首✓** |
| R4 | 249 | 0/0 | **c8/e7** | 12 | 全 | 双✓ |

### 7.2 用户收入升级事件（11 次，全部"打牌/支付"获得）

- R1（+4 收入 → c6/e2）：#17 b_97 支付 +1c、#18 dlc_22 支付 +1c、#44 dlc_40 打牌收入 +1c、
  #57 dlc_39 打牌收入 +1c
- R3（+3 收入 → c7/e4）：#164 b_48 +1e、#193 dlc_25 +1e、#244 chong_7 +1c
- R4（+4 收入 → c8/e7）：#318 b_111 +1e、#354 dlc_8 +1e、#414 b_140 +1c、#472 b_133 +1e

### 7.3 用户科技事件（12 次，全部研究 research_tech）

- R1: blue2（#38，蓝槽1）、purple4（#61）
- R2: blue1（#99，蓝槽2）
- R3: purple2（#138）、orange2（#147）、orange4（#231）
- R4: orange1（#334）、blue4（#375，蓝槽3）、purple1（#395）、blue3（#406，蓝槽4）、
  orange3（#482）、purple3（#512）

### 7.4 V 校准结论（反推权重）

1. **收入是复利引擎**：R1 收入 c6/e2（比 AI 的 c4/e2 多 2c/0e）→ 用户 R3 爆发 105 分。
   R1 每 +1c 收入 ≈ 未来每轮多 1 钱 → 4 轮 × 行动转化价值。**1 收入 ≈ 8-10 分/轮**。
2. **科技是效率引擎**：12 科技（蓝4槽全占）→ blueTechScore 40 分 + 研究 bonus 30 分 +
   效率红利（橙/紫降价）。R1 研究 blue2（蓝槽1）→ 后续 8 次放槽收益。
3. **外星双开是爆发点**：R3 双开（阿米巴+虫）→ R3 单回合 +73 分。首痕迹分
   （slot1 5分+1宣、slot2 3分+1宣）+ 位置分（3-5分/位置）+ 外星牌效果链。
4. **节奏**：R1-R2 是纯准备期（研究+收入+首痕迹，分数仅 15→32），R3-R4 榨取期
   （32→249，+217 分）。准备期投入的每 1 资源在榨取期放大 ~5-7 倍。

## 8. 相关文件

- `randomizer/app/simulation-env.js`：分桶逻辑（`runHeuristicPolicyDecision`、
  `policyOutcomeActions`、`evaluateActionOutcomes`）
- `randomizer/game/ai/expected-score-evaluator.js`：`selectSecondaryAgentRootActions`、
  `enumerateSecondaryAgentRootTargets`、`selectSecondaryAgentSuccessors`、`leafValue`
- `randomizer/game/ai/heuristic-policy.js`：`decide`（选动作）、初始/终局专用决策
- `randomizer/game/ai/heuristic-evaluator.js`：`selectLegalAction`（settled+selectable 过滤）
- `randomizer/game/rule-composition.js`：反事实搜索内核（maxNodes/maxLeaves/maxExecutionNodes、
  `consumesSearchBudget`、叶边界、PRUNED/unresolved）
- `randomizer/training/heuristic-policy-adapter.js`：Policy 适配（runDecision 装配）
- 存档工具：`tools/run_simulate_save.js`（模拟全盘+存盘，seti-browser-save-v2 同格式）、
  `tools/fast_forward_save.js`（存档快进复现，纯内核重放 ~6s/537 步）
