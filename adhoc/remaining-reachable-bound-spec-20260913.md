# 剩余可达上界（remaining reachable bound）设计规格 · 2026-09-13

> 这是**唯一尚未被否证**的通向"守分 + 最慢 ≤5s"的路线。
> 已否证的 10 条（深度/宽度/常数上界/收入梯度/绝对潜力作上界/身份缓存/…）见 `perf-assessment-20260913.md`。

## 一、为什么必须换形态（已实测的三条硬约束）

| 事实 | 值 | 来源 |
|---|---|---|
| 现状排序键是**已兑现增量** | 展开节点 77% 优先级 ≤0、无一个 >25 | Round 52 分桶 |
| 叶可从 0 值祖先到达 | 祖先值 680/680 全为 0，叶值 p50 46 / max 71.5 | Round 51 配对 |
| "当前持有的潜力"不是上界 | 剪枝恒 0（节点 ~300 > 现任解 99），且潜力项**沿路径非单调** | Round 60 |

**结论**：上界必须是"**该状态还能再兑现多少分**"，且**沿路径单调不增**。

## 二、定义

```
RR(node) = Σ_{t ∈ pendingTargets(node)} unclaimedValue(t) × feasibility(node, t)
         + remainingIncomeValue(node)              // 随回合推进单调下降
         + Σ_{e ∈ finiteEntities} remainingEntityValue(node, e)   // 供给/槽位随取用单调下降
```

各项口径与来源：

| 项 | 口径 | 来源（已在搜索里算过，可复用） |
|---|---|---|
| `pendingTargets` | 该 origin 绑定的 `routeTargetId` / `routePlanId` 集合 | `origin.routeTargetId/routePlanId`（前沿诊断已在用） |
| `unclaimedValue(t)` | 该目标**尚未兑现**的分（扇区胜场、探测登陆/环绕、分析放数据、科技首拿、痕迹位） | `rawSectorWinRequirements` / `rawProbeRequirements` / `rawDataAnalyzeRequirements` |
| `feasibility(node,t)` | 0/1 或按剩余移动步数/资源缺口的折扣 | 同上（`required.movementSteps`、`gap.credits/energy`） |
| `remainingIncomeValue` | `(finalRoundNumber − roundNumber) × income` 的等值分 | 投影 `progress` + 评估器 `incomeFutureValue` |
| `remainingEntityValue` | 未取用的科技公共供给 / 未揭示外星槽位 / 剩余板块格位 × 单件上限 | `publicState.board.*` |

**单调性要求**：目标兑现、回合推进、实体被取用，三项都只减不增 ⇒ `RR` 沿路径单调不增（这是它能当上界的前提）。

## 三、验收协议（三步，缺一不可）

1. **不变量校验（先做，不改行为）**：
   对每个决策的**每个被评估的完成叶**，断言 `RR(任一祖先) ≥ primaryValue(叶)`，统计违例数。
   工具已就绪：祖先口径取证（`leafValuePairs` + `minAncestor*`）已在实验分支实现过，改用 `RR` 作为祖先值即可。
   - 通过线：**零违例**（若有违例，按违例量放大对应项的上限口径）；
2. **剪枝效果（再改行为）**：`RR(node) ≤ 现任解` 则不展开，记 `incumbent-bound` + 计数；
   - 目标：482 执行节点从 4096 明显下降、**截断消除**，且**动作与计划逐字不变**（或按 owner 流程自查后仅分数不降）；
3. **完整局（最终门禁）**：均分 **≥113.5**、打满 4096 次数下降、最慢决策下降。

## 四、成本约束（决定成败）

- 每节点 **≤0.2ms**（当前 ~3.6ms/节点）；优先复用搜索**已经在算**的 requirements，避免每节点做完整事实分解（这正是 Round 47 让 482 超时的原因）；
- 若 `RR` 太贵或太松（剪不掉），按止损：**放弃 B，转"只做 A 合并批 + 非搜索项"**。

## 五、已知风险

1. `RR` 若退化成"所有节点近似同值"，则既不能排序也不能剪枝 → 回到平原；
2. `unclaimedValue(t)` 的口径若包含已被其他席位抢走的目标，会高估 → 上界仍成立（安全）但更松；
3. 若最终"守分"要求 `RR` 极松（例如必须按全局理论上限），剪枝量归零 → 判定不可达并留曲线。

## 六、Round 71 修正：**requirements 不在搜索内可得**，RR 必须改用"目标类型静态上限表"

核查 `rule-composition.js` 的实际可得性：

| 数据 | 搜索内是否可得 | 位置 |
|---|---|---|
| `origin.routeTargetId` / `origin.routePlanId` | **可得**（每个 origin 都带） | :1463、:2032-2062、:2173 |
| `rawProbeRequirements` / `rawSectorWinRequirements` / `rawDataAnalyzeRequirements` | **不可得**（只在评估器/端口按需算） | 全文件无出现 |

因此原规格里"**复用搜索已在算的 requirements**"这一条**不成立**——若照它实现，每节点都得做一次 requirements 计算（正是 Round 47 让 482 超时的原因）。

### 修正后的 RR（更便宜，且仍是上界）

```
RR(node) = Σ_{t ∈ pendingTargets(node)} STATIC_VALUE[type(t)] × feasibilityFlag
         + remainingIncomeValue(node)        // 投影 progress 即可，极廉价
```

- `t` 取自 **每个 origin 的 `routeTargetId`**（搜索内可得，零额外调用）；
- `STATIC_VALUE[type]` 是一张**目标类型静态上限表**（如 `sector:win`≈8、`land:`≈12、`orbit:`≈5、
  `data:`≈4、`tech:gain`≈5、`trace:`≈3、`card:acquire`≈3）；**每个值必须 ≥ 该类型目标的真实最大收益**，
  这是它当上界的前提，由不变量校验来验证与修正（违例就抬高对应项）；
- `feasibilityFlag` 初版可取 1（最松、最安全），后续再按剩余移动步数/资源缺口收紧。

**成本**：每节点 O(origin 数) 次查表 + 一次投影读取 ⇒ 远低于 0.2ms ✓

### 不变量校验的作用（比原先更重要）

由于静态表是"拍出来的"，**第一步的只读不变量校验就是唯一的安全网**：
对每个完成叶断言 `RR(任一祖先) ≥ 叶值`，**任何违例都直接指出是哪类目标的上限给低了**，
按违例量抬高该类型后重测，直到零违例——这比"先证明再实现"更符合本项目的实证风格。

## 七、Round 72 实测：**静态表 RR 不成立（679/680 叶违例）**

实现（隔离分支，只读不测量行为）：`RR(node) = Σ STATIC_VALUE[type(origin.routeTargetId)]`，
跟踪 `minAncestorRR`，对步 37 的 680 个叶断言 `leafValue ≤ minAncestorRR`。

| 指标 | 值 |
|---|---|
| `minAncestorRR` 分布 | **0 ~ 12** |
| `rrGap = 叶值 − min(祖先RR)` | min −3.0 / p50 **46** / max **71.5** |
| **违例数（RR 不是上界）** | **679 / 680** |

### 两个结构性原因（都不是"把表调大"能解决的）

1. **`min` 聚合遇到"当时没有绑定目标"的祖先**：多数路径存在 `routeTargetId` 为空的祖先（结算/移动中间态），
   其 RR = 0 → 任何正收益的叶都违例。**祖先不知道它之后会绑定哪些目标**——这正是"未来"的不可知性；
2. **单个目标的静态分（8~12）远小于叶值（可达 71.5）**：叶值聚合了整条链上多个收益
   （分 + 基建 + 宣传研究增量），而非单一目标的分。

### 结论（这条路线也被否证）

要让 RR 成为上界，它必须覆盖"从该状态**可达**的全部目标"（而不仅是已绑定的），
那就退化成"全局剩余潜力上限"——**极松 → 剪不掉**。这与之前"常数上界"的困境同源：

> **任何紧的合法上界都需要预知未来；任何不预知未来的上界都太松而剪不动。**

至此，"按值剪枝"的最后一种形态也被实测否证。剩余可选：
(A) 无损降每节点成本（天花板 ~22~24s，到不了 ≤5s）；
(B) 消除 `structuredClone` 的结构共享大重构（同上天花板）；
(C) **接受"守分 + ≤5s"在本架构下不可达**，把目标改为可测档位（例如每步 1929ms → ~1500ms）。
