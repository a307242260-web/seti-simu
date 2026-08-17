# 统一搜索设计（2026-08-17，启发式搜索迭代）

> 目标：拆掉"strategic/bounded/control 分桶 + 目标门控"（roadmap 第 4 节指出的
> 性能 hack），改为"预算内全动作尝试 + 优先级排序"（roadmap 第 5 节）。
> 本文件先整理**现状门控体系**（动手前必须完整理解），再记录统一搜索的改动。
> 分桶启发式 = 现状默认；统一搜索 = 本迭代目标（开关 `unifiedSearch`，默认关）。

## 1. 现状：启发式决策链与 5 层门控

决策从 legalActions 到最终提交经过 5 层过滤/分派。任何一层都能让一个动作
"不可见"（unresolved / NOT_EVALUATED），所以诊断"为什么某个动作没被评估"时
必须逐层排查。

```text
legalActions（全部合法动作，约 18-20 个）
│
├─ L1  requiresRootCounterfactual        (expected-score-evaluator.js)
│    非 quick_trade：除 end_turn/pass 外全放行
│    quick_trade：只有"能为某目标补资源缺口"才放行（5 个 prepares* 见 §2）
│
├─ L2  selectSecondaryAgentRootActions   (expected-score-evaluator.js)
│    用 enumerateSecondaryAgentRootTargets 生成目标目录
│    （probe 探测 / data:analyze 数据分析 / sector:win 扇区 / income 收入 / tech 科技）
│    只返回"绑定到至少一个目标"的动作 → 未绑定动作（多数 quick_trade、
│    card_corner、industry、未命中目标的 place_data/play_card）被滤掉
│
├─ L3  三桶分派                          (simulation-env.js runHeuristicPolicyDecision)
│    strategic 桶：绑定目标动作，depth15/leaves8/nodes128/物理4096 + secondaryAgentSearch
│    bounded 桶：play_card 且未进 strategic，depth6/leaves3/nodes N×16
│    control 桶：end_turn/pass，depth1
│
├─ L4  反事实搜索内核                    (rule-composition.js secondaryAgentSearch)
│    L4a 根门控（2165-2187）：绑定目标 → 带 routeTargetId 进 frontier；
│         未绑定 + usesRootTargetCatalog → 不进 frontier（丢弃）
│    L4b 后继门控 selectSecondaryAgentSuccessors（evaluator 2294+）：
│         routeTargetId 非空 → 只返回"继续目标路线"的后继（targeted）+ control
│         routeTargetId 空   → 重新枚举目标目录 → targeted + control（未绑定后继被滤掉）
│    L4c conditional 等价折叠（2463+）：弃牌/支付/公共扫描/科技/星云取代表
│    L4d 分支优先级 evaluateSecondaryAgentSearchPriority（2014+）：
│         sortKey=[completedBoundTarget, 目标进度, primaryValue, …]
│         未绑定分支全部为 0 → 排序退化为 chain 深度/actionId
│    L4e 预算：maxExecutionNodes=4096；每 virtualRoot maxLeaves=8 饱和
│
├─ L5  completePolicyOutcomeSet          (simulation-env.js)
│    搜索返回了 outcome → 保留；没返回（被 L1-L4 滤掉）→ unresolved +
│    STRATEGIC_GOAL_NOT_EVALUATED
│
└─ 策略选择 heuristic-policy.decide
    selectInitialSetupAction / selectFinalMarkAction
    / selectLegalAction（只选 settled+selectable）→ selectControlFallbackAction
```

**关键结论**：
- 一个动作最终"不可见"（NOT_EVALUATED）可能死在 L1（quick_trade 特例）、
  L2（目标门控）、L4a（根门控）任意一层；诊断必须逐层看。
- 分桶的三层门控（L1/L2/L4a）都是"目标清单"语义：不绑定目标就不评估，
  与动作本身价值无关——这就是 roadmap 说的"分桶的本质是性能 hack"。
- L4d 优先级只对绑定目标分支有效；未绑定分支全 0 是后续性能问题的根源。

## 2. quick_trade 的特例要求（requiresRootCounterfactual，L1）

quick_trade 是唯一有专项门控的 family。它**不被视为有独立价值的动作**，
只有"为某个已绑定目标补资源缺口"才值得进反事实评估（ai-design.md：
"快速转换……只是既定目标的达成步骤"）。5 个 prepares* 检查：

| 检查 | 条件 | 语义 |
|------|------|------|
| preparesAnalyze | dataProgress.analyzeReady && 能量=0 && 交易给能量 | 为分析补能量 |
| preparesProbeGoal | 交易后某探测目标资源缺口缩小（probeResourceGapAfterTrade） | 为探测补资源 |
| preparesDataGoal | 交易后数据路线支付缺口缩小（dataPaymentGapAfterTrade） | 为数据补资源 |
| preparesSectorGoal | 交易后扇区扫描成本缺口缩小（resourceGapAfterTrade） | 为扇区补资源 |
| preparesIncomeGoal | 交易后收入计划缺口缩小 | 为收入补资源 |

**问题**：quick_trade 价值被窄化为"补缺口工具"。有资源时若当前无任何目标
缺资源，quick_trade 全部 NOT_EVALUATED——评估器既看不到"乱买卡"的错误，
也看不到"为未来准备"的正确（V 引导的 quick_trade 霸榜问题正是从这里暴露）。

## 3. 统一搜索改动清单（unifiedSearch 开关，默认关）

已实现：

| # | 位置 | 改动 |
|---|------|------|
| 1 | requiresRootCounterfactual | 加 `unifiedSearch` 参数：开启时 quick_trade 全放行（不再要求 prepares*） |
| 2 | selectSecondaryAgentRootActions | 加 `unifiedSearch`：开启时返回全部 candidates（L2 目标门控放开） |
| 3 | rule-composition 根门控 | `allowUntargetedRootActions` 时未绑定动作以 targetId=null 进 frontier（L4a 放开） |
| 4 | selectSecondaryAgentSuccessors !routeTargetId 分支 | `unifiedSearch` 时返回 targeted + 未绑定后继 top-K + controls（L4b 放开 + 预算截断） |
| 5 | selectSecondaryAgentSuccessors 条件折叠 | 未绑定分支的 choose_payment（弃牌/移动支付）与交易选牌直接 return []（不展开结算细节） |
| 6 | rule-composition 深度限制 | 未绑定 origin 展开 ≤3 层即收束 pruned（防无限深挖） |
| 7 | rule-composition selectRouteTarget | 未绑定分支展开后允许重新绑定目标（原来被 usesRootTargetCatalog 跳过） |
| 8 | simulation-env config | `unifiedSearch` 开关透传 + policyOutcomeActions 传参 |
| 9 | selectSecondaryAgentSuccessors 未绑定后继 | top-K 截断：未绑定后继按"立即价值"（family 基础 + 净资源收益）排序取前 4 |
| 10 | 绑定分支弃牌折叠 | `targetUsesFungibleResources` 扩展覆盖探测行动目标（orbit:/land:/move: 前缀）：
      直接环绕/登陆目标的弃牌折叠不再落到默认全返回（曾致 3043 choose_payment 节点）；
      card:/decision: 卡牌身份目标仍保留全部 choice（弃牌不等价） |
| 11 | 绑定分支弃牌振荡控制 | 弃牌会话延续层（actionChain 末尾已是 choose_payment）直接 return []：
      无状态折叠恒选第一张卡 → 规则 toggle（已选→移除）→ 永不选满，一个会话无限振荡 |

**A/B 实测（step 23 决策点，unified=on vs off）**：
- 覆盖：NOT_EVALUATED 12 → **0**（所有 18 个动作都有评估）
- choose_payment 节点：off 46 / on 158（爆炸修复前 3043）
- executedNodeCount：off 868 / on 3040（< 4096 上限）
- 单决策耗时：off ~2s / on ~6.3s（覆盖扩大的成本，< 10s 预算）
- 回归：off 模式 66 unit + 1 fullFlow 全过

剩余（后续迭代）：

| # | 位置 | 改动 |
|---|------|------|
| 12 | choose_target/choose_card 展开 | 目标选择/选牌决策的等价折叠（on 时 choose_target 889 节点是主要耗时项） |
| 13 | 全盘行为验证 | on 全盘很慢（每决策 ~6s），需先跑短窗口验证行为方向再决定全盘 |

## 4. 验证（A/B，同一 seed seti-free-analyze-v1）

- 单决策（step 23 决策点）：unified off/on 的 status 分布、executedNodeCount、
  executedNodeCountByFamily、耗时、最终选择。
- 覆盖指标：NOT_EVALUATED 数量（off=12 → on 应为 0）；各 family 是否有评估。
- 全盘：白方分数、行动族分布、quick_trade 次数、均分（对比 baseline 86/64.3）。
- 回归：默认关时 66 unit + 1 fullFlow 全过（分桶行为不变）。

### 4.1 实测结果

单决策（step 23 决策点，unified=on vs off）：

| 指标 | off | on |
|------|-----|----|
| NOT_EVALUATED 动作数 | 12 | **0**（全部 18 个动作有评估） |
| choose_payment 节点 | 46 | 158（修复前 3043） |
| executedNodeCount | 868 | 3040（< 4096） |
| 单决策耗时 | ~2s | ~6.3s（覆盖扩大的成本，< 10s 预算） |

150 步窗口（新架构协调器，全场 unifiedSearch）：

| 指标 | off | on |
|------|-----|----|
| 耗时 | 63s | 273s（4.3 倍，全盘预计 ~15 分钟） |
| 白色 150 步末 | 24 分 / R2 / tech1 / qt1 | **30 分 / R3 / tech1 / qt3** |
| 白色推进 | R2 | R3（更快） |

行为方向合理：覆盖打开后白色能评估 quick_trade 等未绑定动作（qt 3 次而非 V 引导的
29 次疯狂），分数与推进均优于分桶。剩余优化（§3 项 12）：choose_target/choose_card
展开是 on 的主要耗时项。

## 5. 性能问题定位（未绑定分支深挖）

实测（step 23 决策点，unified=on，改动 1-8 后）：4096 撞顶、8s、choose_payment
3042 节点。根因：
- 未绑定 origin proxyDepth 恒 0（不完成目标），普通后继分支无 node.depth 检查
  （只有 conditional 分支有）→ 深度限制（改动 6）只拦了普通后继，conditional
  （弃牌）不走该检查；
- 未绑定弃牌折叠（改动 5）恒选"第一张卡"→ toggle 振荡（executeDiscard 语义：
  已选→移除）→ 每个弃牌会话多节点；
- 每层全部后继展开（改动 4）→ 分支因子 17。

收敛方案见 §3 剩余项（9/10）。实现后再验证，验证通过才考虑默认开。
