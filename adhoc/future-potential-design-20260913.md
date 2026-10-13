# futurePotential 设计（2026-09-13 · 针对"零值平原"病根）

## 一、问题（已量化）

| 事实 | 实测值 | 来源 |
|---|---|---|
| 482 展开节点中优先级 ≤0 的占比 | **77.0%**（3153/4096） | Round 52 分桶计数 |
| 优先级 >25 的节点 | **0** | 同上 |
| 叶值与"路径上最小祖先节点值"之差 | p50 **46** / max **71.5**（祖先值 680/680 全为 0） | Round 51 配对 |
| beam 已裁来源 vs 仍打满 | 14.8 万裁 / 43 次打满 | 记录 |

**根因**：`primaryValue = 分差 + 基建差 + 宣传研究差` 只是"**相对根的已兑现增量**"。
节点尚未拿到任何分/基建时它就是 0，因此**大量节点并列在 0**，beam 的 256 名额在不可区分的并列里取舍，
搜索只能靠深探发现价值 → 4096 打满；而任何常数上界都必然失效（祖先 0、叶可达 71.5）。

## 二、定义

```
priority'(node) = primaryValue(node) + futurePotential(node)
```

要求（缺一不可）：
1. **同尺度**：与 `primaryValue` 同单位（分/等值分），否则无法相加；
2. **单调**：沿路径不增（`futurePotential` 随状态推进而单调不增），这样它才同时能当**上界**用于 B（展开前剪枝）；
3. **廉价**：每节点 ≤0.2ms（当前 ~3.6ms/节点；若它让每节点成本涨 >30% 就抵消了节点削减的收益）；
4. **状态相关**：必须由该节点观测算出，不能是常数（那正是之前 G 的失败原因）。

## 三、候选分项（按"可达上限"口径，逐项给来源）

| 分项 | 口径 | 代码来源 | 成本 |
|---|---|---|---|
| **剩余收入发放** | `(finalRoundNumber − roundNumber) × income` 的等值分 | 投影 `progress.roundNumber/finalRoundNumber`；评估器 `incomeFutureValue` | 极低（投影已有） |
| **当前路线未完成目标的得分** | 该 origin 绑定的 `routeTargetId/routePlanId` 尚未兑现的目标分（扇区胜场/探测登陆等） | `rawSectorWinRequirements` / `rawProbeRequirements`（搜索已在算，可复用） | 低（已有结果可复用） |
| **未领取的首拿/痕迹/科技兑现** | 剩余公共供给/未揭示槽位 × 单件上限 | `publicState.board.techSupply.stacks` / `aliens` 槽位 | 低-中（需读公共盘面） |
| **宣传→研究→科技分** | `ceil(max(0, 6 − publicity)/可得速率) × 单次研究期望` | `resources.publicity` + 科技公共供给 | 低 |

**关键**：分项都取"**可达上限**"（宁可略高），因为 (a) 作为上界必须不低于后代真实值；(b) 作为排序键，略高比略低安全
（略低会把有价值分支排到后面）。但这与"要能区分零值"并不矛盾——因为不同状态的**可达上限差异很大**
（例如已完成目标的路径其上限显著更高）。

## 四、成本控制

- 只在**节点展开时算一次**，用状态哈希缓存（同一状态多次出现时复用）；
- 优先复用搜索**已经在算**的量（`rawProbeRequirements`/`rawSectorWinRequirements`/`rawDataAnalyzeRequirements` 已按节点算过），
  避免新增一遍事实分解（那正是 Round 47 里让 482 超时的原因）；
- 若预算不足，先只做前两项（收入 + 当前路线目标分），它们最便宜且覆盖大部分"零值"节点。

## 五、验收协议（基线已量出，逐项对照）

| 指标 | 基线 | 通过线 |
|---|---|---|
| A. 482 展开节点中优先级 ≤0 占比 | **77%** | < 30% |
| B. 优先级 >25 的节点占比 | **0%** | > 20% |
| C. `leafValue − min(祖先节点值)` p50 / max | **46 / 71.5** | p50 < 20 |
| D. 打满 4096 次数（完整局） | **43** | 明显下降 |
| E. 最慢决策 | ~29s | 下降（低负载下测） |
| F. **完整局均分** | **113.5** | **≥113.5（硬约束）** |

验证顺序：先只读量 A/B/C（不改行为，加计数器即可）→ 确认梯度出现 → 再改行为并跑 482/448/485 单决策 →
最后完整局验 D/E/F。

## 六、风险与止损

1. **若 `futurePotential` 对所有状态近似同增**（例如都被"剩余收入"项主导）→ 排序不改善，A/B 指标不达标 → 停，记录负结果；
2. **若它让每节点成本上升 >30%** → 即使节点数下降，总时间可能不降 → 先做成本优化或改用更便宜的近似；
3. **若破坏单调性** → 不能用于 B（上界），但**仍可用于 C' 的排序**（这条路独立有效）；
4. 全程以"**均分 ≥113.5**"为硬门禁；任何掉分即按 owner 流程（原选择是否被剪/新选择是否新入队）自查，仍掉分则否决。

## 七、Round 55 修正：**"剩余收入发放"作为梯度项无效；应改用"状态绝对潜力"**

### 修正 1：收入项是常数，不产生梯度

`remainingPayments × income` 在同一回合内**对所有节点是同一个值**（同一轮次、同一收入），
把它加进优先级只会**整体平移**，不会拉开任何差距——**对"零值平原"毫无作用**。
（它只有作为 B 的剪枝上界时才有意义，因为它会随回合推进单调下降。）

**要产生梯度，加的项必须随状态变化。**

### 修正 2：根因是"增量口径"，应改用"状态绝对潜力"

现在排序键 `sortKey[2] = primaryValue`，而
`primaryValue = 分差 + 基建差 + 宣传研究差` —— **全是相对根的增量**。
所以"这条路径还没拿到任何东西"的节点**一律是 0**，与"手里已有 3 个科技/2 条痕迹"的节点**无法区分**。

而评估器内部本来就有**绝对口径**：`valueFromStrategicFacts(facts)` 返回
`{terminal, realizedScore, securedEndGameBonus, resourceFacts, infrastructure}`（绝对量），
`infrastructureFrom({ownedTechIds, income, researchOptions, traceCount, alienSlots, sectorWinRequirements, dataProgress, ...})`
也是绝对的。**只是从没被用于排序。**

### 实现位置（重要，避免白做）

`valueFromStrategicFacts` / `infrastructureFrom` / `researchPotential` **都没有导出**
（导出清单里只有 `incomeFutureValue` 等相关项）。因此**不要在端口层拼装**，而应**在**
`expectedScoreEvaluator.evaluateSecondaryAgentSearchPriority`（`expected-score-evaluator.js` 内，
`rootFacts`/`branchFacts` 与全部内部函数都在作用域内）里加一项：

```
sortKey[2] = primaryValue + w × absolutePotential(branchFacts)
absolutePotential(facts) = valueFromStrategicFacts(facts).infrastructure.total
                         + researchPotential(valueFromStrategicFacts(facts))
```

要求：**开关默认关**（不改变默认行为与既有契约）；打开时**同时记录**分桶分布，
以便用 Round 52 的指标验收：482 展开节点中优先级 ≤0 占比（基线 77%）应显著下降、>25 的节点（基线 0）应出现。

### 为什么这条路值得做（与前三次否证的关系）

深度上限、前沿宽度去重、展开宽度去重**全部失败**，因为"值不值得展开"无从判断。
`absolutePotential` 提供的正是这个判断依据：它让"手里已有资源/科技/痕迹/路线进度"的节点
**在优先级上被区分出来**，随后 beam 取舍与宽度去重才会真正生效。

## 八、Round 56：管线已就位；**取值方式待修（已定位到精确改法）**

### 已实现（默认不改变行为，单测全绿）

- `evaluateSecondaryAgentSearchPriority` 内新增 `absolutePotential` 计算，并写入返回值；
- `sortKey[2] = primaryValue + w × absolutePotential`，**w 默认 0**（`SETI_DIAG_ABS_POTENTIAL_W` 可开启）；
- rule-composition 增加只读分桶计数 `absPotentialBuckets`（≤0 / ≤25 / ≤50 / ≤100 / >100）。

### 实测：当前取值恒为 0（4092/4096 落在 ≤0）

原因已定位：`infrastructureFrom(parts)` 返回的是**基础设施描述符**
（`ownedTechIds/income/researchOptions/roundNumber/finalRoundNumber/traceCount/alienSlots/...`），
**没有 `.total`**；`.total` 只由 `infrastructureDeltaValue(rootValue, leafValueState)` 产生。
我按 `.total` 直接取，`finite(undefined)` → 0，所以恒为 0。

### 精确改法（下一轮直接做）

```
absolutePotential(facts) =
    infrastructureDeltaValue(emptyValue, branchValue).total    // emptyValue = 同轮次的"一无所有"基线
  + researchPotential(branchValue)
```

其中 `emptyValue` 必须**保持 `roundNumber/finalRoundNumber` 与 branch 相同**（否则收入项会失真）：
```
emptyValue = {
  terminal: false,
  realizedScore: 0, securedEndGameBonus: 0,
  resourceFacts: { credit:0, energy:0, publicity:0, ... },   // 各资源 0
  infrastructure: { ownedTechIds: [], disabledTechIds: [], income: {},
    researchOptions: [], blueBonusAssets: {}, traceCount: 0, alienSlots: [],
    roundNumber: branchValue.infrastructure.roundNumber,
    finalRoundNumber: branchValue.infrastructure.finalRoundNumber, ... },
}
```
（`branchValue = valueFromStrategicFacts(branchFacts)`；两者均在函数作用域内可用。）

修好后仍按原验收：先看 `absPotentialBuckets` 是否出现梯度（不再全 0），再用 w>0 跑 482/448/485 与完整局。

## 九、Round 57：**梯度已生效（分布被彻底打散），但仅靠排序不省节点**

### 绝对潜力修好后（482，只读分布）

| 分桶 | 现状 `sortKey[2]` | **`absolutePotential`** |
|---|---|---|
| ≤0 | **3153（77%）** | **1428（35%）** |
| (0,10] / (0,25] | 534 / 405 | — / **1675（41%）** |
| (25,50] | **0** | **989（24%）** |
| >50 | **0** | 0 |

修复方式：`absolutePotential = infrastructureDeltaValue(emptyValue, branchValue).total + researchPotential(branchValue)`，
其中 `emptyValue` 是"同轮次、其余全空"的基线，因此 delta 等价于**绝对**基建潜力。

### 打开权重后（482）

| W | 动作/计划 | 节点 | 截断 | 剩余队列 | 分桶（≤0 / ≤10 / ≤25 / ≤50 / >50） |
|---|---|---|---|---|---|
| 0（基线） | industry:e887dc52 / 13 步 | 4096 | 是 | 244 | 3153 / 534 / 405 / 0 / 0 |
| 0.5 | **相同** | 4096 | 是 | 254 | 2488 / 210 / 989 / 405 / 0 |
| 1 | **相同** | 4096 | 是 | 244 | 1920 / 270 / 508 / 1061 / 333 |
| 2 | **相同** | 4096 | 是 | 244 | 1469 / 451 / 270 / 580 / 1322 |

**两个结论**：
1. **排序键真的变得有区分度了**（W=2 时已有 1322 个节点 >50），且 **482 的动作与 13 步计划在所有权重下都不变**——说明"绝对潜力"没有破坏估值语义；
2. **但节点数与截断完全没变**：排序只决定"256 个前沿名额留给谁"，**不减少"可展开节点的总数"**；
   搜索仍一路探到 4096 上限才停。

**因此：梯度是必要但不充分条件，还必须配上"按值停止/剪枝"的规则**（即 B）：
`priority'(node) + G ≤ 现任解` 才不展开。而它的可行性取决于**加了梯度之后"祖先口径差距"是否大幅收紧**——
这正是下一轮要量的事（原基线：祖先值全 0、p50 46、max 71.5）。

## 十、Round 58：**尺度必须一致——梯度只加在优先级上会让剪枝失去意义**

实验：把梯度项（W=2）加到实验分支（含祖先口径取证 + 现任解桥），量步 37 的 696 个叶样本：

| 口径 | min | p50 | max |
|---|---|---|---|
| W=0（基线）`leafValue − min(祖先节点值)` | 0 | **46** | **71.5** |
| **W=2** 同口径 | **−283** | **−237** | **−211.5** |

**差距变成大幅负数**，即"祖先的优先级"（≈237）**远大于叶值**（≤71.5）。

原因很清楚：**两边的尺度不同了**——
- 节点优先级 = `primaryValue + W × absolutePotential`（绝对潜力可达 ~50~280）；
- 而现任解来自 `resolveLeafValue = evaluateStrategicFactsBreakdown(root, leaf).primaryValue`，**是纯增量口径**（≤71.5）。

于是 B 的判据 `priority'(node) + G ≤ 现任解` **失去意义**（左边量级 200+，右边 70，要么永不剪、要么乱剪）。

### 修法（下一轮的直接动作）

**梯度必须同等地加到叶值上**，让现任解与优先级处在同一尺度：

```
resolveLeafValue(leaf) = evaluateStrategicFactsBreakdown(root, leaf).primaryValue
                       + W × absolutePotential(leafFacts)      // 与优先级同一公式、同一 W
```

改完之后：
1. 重测祖先口径差距（此时两侧同尺度，差距才有意义）；
2. 若差距显著收紧（目标：从 p50 46 收到 20 以内）→ 扫 G 找"安全且能剪"的区间；
3. 若差距仍大 → 说明 `absolutePotential` 作为"上界"不够紧（它可能只是排序键而非上界），
   那时按设计文档第六节的止损条件处理：只把它用于**排序**（C'），放弃用它做剪枝（B）。
