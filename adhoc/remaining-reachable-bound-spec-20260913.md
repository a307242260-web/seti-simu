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
