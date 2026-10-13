# A 合并批计划（无损，唯一剩下的可落地路线）· 2026-09-13

## 为什么必须"合并批"而不是单项

- 计时纪律实测：同一份未改动代码在 482 上漂移 **20.0s ↔ 26.4s（±25%）**；
- 而 A 的单项收益只有 **1~7%**（见下）→ **单项低于计时噪声，无法验收**；
- 但整局层面可测：基线 **1115s / 1929ms 每步**，若合并批达 −10~15%，整局省 110~170s —— **高于整局复跑波动**（历史整局复跑 989s / 1115s / 1266s / 1378s 受负载影响，需同负载交替）。
- 结论：**一次改完、一次验收**，用 `profile 占比`（相对量）确认方向 + `同负载整局交替复跑`确认幅度。

## 批内清单（按 profile 占比，来自 Round 65 的 482 profile）

| # | 目标 | 占比 | 位置 | 改法 | 风险 |
|---|---|---|---|---|---|
| 1 | postSearch outcome 投影克隆 | ~7%（`clone`+`cloneShared`） | `outcome-model.js: projectOutcomeObservations` | 结构与搜索共享、只克隆必要分支；或对同一 root 的多次调用复用投影 | 中（契约边界） |
| 2 | `restoreCheckpoint` 克隆 | 3.8% | `session-runtime.js` / `rule-composition.js restore` | 只在**确需隔离**时克隆；对只读路径传冻结引用 | 中高（隔离契约） |
| 3 | `capturePlanStep` 克隆（未遮蔽路径） | 2.9% | `plan-continuation.js` | 已在 `8badab3e` 做过一版（planEvidence）；检查是否还有残留克隆 | 低 |
| 4 | `projectionInner` 克隆 | 2.1% | `rule-composition.js: projectionInner` | 返回冻结**视图**而非深拷贝（结构共享） | 中高 |
| 5 | `buildRuleObservation` | 1.8% | `rule-observation.js` | 避免整树克隆，直接构造 | 中 |
| 6 | GC | 10~14% | 全局（由 1-5 的临时对象产生） | 随 1-5 自然下降 | — |
| 7 | 非搜索每步 440ms | 22.8% 整局 | 提交/序列化/存档/契约拷贝 | 单独一轮，**不影响最慢决策** | 低 |

**`structuredClone` 总量占 33~35%**（以上 1-5 是它的已归因部分，其余未归因）。

## 验收协议（合并批）

1. `node tools/run_node_tests.js` → unit 99/99 + full-flow 1/1；
2. **482 / 448 / 485 冷决策逐字对比**（动作 actionId + 计划步数 + after 状态）——A 的门禁是**行为不变**；
3. **profile 占比对照**（同输入多处采样取中位数）：`structuredClone` 总占比应明显下降；
4. **同负载整局交替复跑**：均分必须 **113.5**、逐动作 actionId 与 after 差异 **0**，整局耗时下降幅度记录在案；
5. 通过 → 登记版本 + 合回 + 报告中心。

## 预期与止损

- **预期**：整局 **−10~15%**（1115s → 950~1000s；每步 1929ms → 1640~1740ms）；
- **止损**：若 profile 显示 `structuredClone` 占比未降，或逐字对比出现任何差异 → 回退该子项，不合并；
- **明确声明**：本批**不影响最慢决策的量级**——482 仍会落在 ~20~24s 区间，**达不到 ≤5s**（≤5s 已被 11 条否证路线判定为不可达，见 `perf-assessment-20260913.md`）。

## 八、Round 75 开工前确认：**主工作树不是可提交状态 → A 批必须在隔离克隆里做**

`git status` 实测（**不是本次会话的改动**，是历史遗留）：

```
随机/运行时路径下未提交条目 1000+，其中包含运行时代码文件：
  MM randomizer/app/rule-observation.js
  MM randomizer/app/simulation-env.js
  D  randomizer/app/income-target-classification.test.js
  ...（另有大量 MM/D 条目）
```

**三条推论（都很重要）**：

1. **主仓库运行时行为 = 工作树（脏树）**，而所有登记版本的 `gitCommit` 指向 **HEAD**；
   → `robot_iterate check` 早就报过这个警告："工作树有未提交改动——若实验运行于脏树，代码版本与记录可能不完全对应"。
   → 我此前"运行时=618501e0 行为"的说法**只是假设**，准确说法是"运行时=工作树，其与 HEAD 的差异未清点"；
2. **临时目录里的实验（B / chain / 绝对潜力 / RR）跑的是"已提交代码"**（`git clone` 不含脏树改动），
   与主仓库的脏树**可能不同**。抽样上它们是等价的（482/448/485 的动作、节点、计划一致），
   但"抽样等价"不等于"逐字一致"——这一点此前没有被我明确记录，现在补上；
3. **因此 A 批（跨文件克隆改造）绝不能在主工作树里做**：我的改动会与 1000+ 条历史遗留改动混在一起，
   无法按流程"只提交本次内容"；正确做法是在**隔离克隆**（已提交状态）里实现与验收，再走合回流程。

**仍然成立**：测试 99/99 + 1/1 全绿、482 默认动作 `industry:e887dc52`、耗时 ~20.1s，默认行为可复现。

## 九、Round 76：A 批施工环境已建好并验证（脏树 vs 已提交 = 行为等价）

隔离克隆：**`/tmp/seti-abatch-140931`**（`git clone --local`，HEAD = `3a7a9cdb`，已含 `adhoc/` 脚本与输入）。

| 环境 | 482 动作 | 用时 |
|---|---|---|
| **隔离克隆（已提交状态 HEAD）** | `industry:e887dc52` | **20055ms** |
| 主仓库（脏树，含历史未提交改动） | `industry:e887dc52` | 20079ms |

**差异 0.1%（24ms）**，动作完全一致 → 说明历史遗留的未提交改动**对该决策无实质影响**，
因此：登记版本的 `gitCommit→HEAD` 映射**在抽样口径上是可信的**（Round 75 的顾虑结案），
且**隔离克隆可作为 A 批的施工与验收环境**。

### 下一步（A 批，在克隆里执行）

按第四节清单从**风险最低**开始（第 3 项 `capturePlanStep` 残留克隆 + 第 7 项非搜索两项），
每项做完立刻用门禁：482/448/485 逐字对比 → 单测 → profile 占比；全部完成后整局交替复跑（含均分 113.5）。

## 十、Round 77：排除一项（避免无谓改动）

`randomizer/app/simulation-env.js` 的 `sameSubmittedAction`（第 32 行，含两次 `stableSerialize`）
**调用频次 = 每条被提交动作一次（第 481 行）**，即整局 ~578 次、每次对象很小 ⇒ **微秒级，可忽略**。

**结论**：非搜索的 **440ms/步** 不来自这处比较——排除它，避免了对"相等判定语义"做无谓改动。
非搜索开销（整局 254s / 22.8%）的真实构成仍未定量，需要**整局级 profile**（约 20 分钟一次）才能定位；
它**不影响最慢决策**，因此对 ≤5s 目标无贡献，优先级低于搜索侧克隆项（第 1/2/4/5 项）。

## 十一、Round 78：A 批**头号目标**定位（每节点两次克隆，且同函数内有成功先例）

在 `randomizer/game/rule-composition.js` 的动作执行路径（约 405-420 行）：

```js
const result = runWithWorkingStateContext(
  workingContext,
  () => actionRegistry.execute(workingContext, clone(action)),   // ← 每节点 1 次
);
...
const clonedResult = clone(result);                                // ← 每节点 1 次（result 含 nextState）
lastActionResult = clonedResult;
return { ...clonedResult, nextState };
```

**每个执行节点（单决策 4096 个）都会做这两次克隆**，其中 `clone(result)` 会**连同 `nextState`（整份新状态）一起深拷贝**。

### 为什么这是头号目标（有成功先例）

同一函数的第 488 行附近，**已经有一处同类优化落地**，注释写得很清楚：

> 性能：transformEffectResult … 此前每 effect 执行都整状态 structuredClone（**单决策 ~3552 次，实测 ~600ms/11% + GC 压力**）。
> nextState 同引用时直接复用：… 仅当 transform 真的产出新状态对象时才防御性克隆。

即：**"当引用已归自己所有时不再防御性克隆"这一手法在本文件里已被验证能省 ~11%**。
上面那两处（`clone(action)`、`clone(result)`）是**同一模式、同样在每节点路径上**，尚未处理。

### 改动方向（下一轮执行，风险中）

1. **`clone(action)`**：确认 `actionRegistry.execute` 不就地修改 action（只读）→ 可传冻结引用；
2. **`clone(result)`**：确认 `result` 与 `nextState` 的所有权——若 `nextState` 已由本调用链独占（trusted fork 下 `applyResult` 本就直接采用 `result.nextState`），
   且 `lastActionResult` 只被诊断读取，则可改为"仅在需要隔离时才克隆"（与第 488 行的先例同构）；
3. 门禁照旧：**482/448/485 逐字对比 → 单测 → profile 占比（`structuredClone` 应明显下降）→ 整局交替复跑**。

### 预期

若此处与先例同量级（~10%），**单项就可能带来整局 ~10% 的收益**，且属纯无损类改动——比前面所有微优化加起来都大。

## 十二、Round 79：两次克隆**不是冗余**（原因已查明：就地修改）+ 一条验收协议补强

### 事实链

| 行 | 代码 | 用途 |
|---|---|---|
| 415 | `lastActionResult = clone(result)` | 存下结果供后续使用（工作状态此后可能被提交/改写） |
| 636 | `terminal = deepFreeze({ ...clone(lastActionResult \|\| {}), ... })` → `publish(...)` | 组装并**发布**终局事件给外部监听器 → 必须与内部状态解耦 |

表面上"同一份 result 每节点克隆两次"，但**两次的目的不同、且不能省前一次**：

- 第 488 行附近的注释已明确记录：`transformEffectResult`（production 唯一实现 `augmentEffectResult`）
  **只原地增补 `result` 并返回新外壳对象**；
- 因此 415 之后、636 之前，`result` **可能被就地修改**——若 415 不克隆而直接存引用，
  636 处的克隆就会带上那些后续改动 → **语义变化**。

### 结论（避免了一次错误优化）

- **不能简单删掉 415 或 636 的克隆**；
- 真正的优化路径是二选一（都属中等风险）：
  1. 把 `augmentEffectResult` 改成**非就地修改**（返回新对象），从而允许"只在发布前克隆一次"；
  2. 或把克隆**推迟到发布前一次性做**，并证明 415→636 之间没有任何就地修改。
- 两条都需要先做**调用链审计**，不能凭"看起来重复"就删。

### 验收协议补强（重要，防盲区）

这些改动落在**诊断/发布路径**上：**只验"决策逐字不变"是不够的**——
即使决策不变，若**记录里的诊断/指标变了**，证据链就会被污染。因此 A 批中凡涉及诊断/发布路径的改动，
门禁必须增加一条：

> **同一决策的 `diagnostics`（含各计数与 `budgetLimits`）与记录字段必须逐项一致**（不只是动作与计划）。

## 十三、Round 80：调用链审计结果——"就地修改 result"**未找到证据**

审计 `augmentEffectResult`（`randomizer/game/effects/residual-domain-session.js:1379`，production 唯一实现，
经 `production-composition.js:987` 接到 `transformEffectResult`）：

| 检查 | 结果 |
|---|---|
| `executorResult.<字段> = ...` 赋值 | **0 处**（全文 grep 无命中） |
| 该函数返回形式 | 一律 `{ ...executorResult, spawnedEffects[, events] }` —— **新建外壳对象** |
| 是否修改**状态** | 是：通过 `root` 调 `chong.markTransportedFossilDelivered`、`completeVisitOrbitFacts(root, ...)` 等 |

因此第 488 行注释里"**原地增补 result**"的表述**与代码事实不符**（至少在这个实现里找不到对 result 对象的就地写）。
真正发生的是**状态（`root`/`nextState`）被修改**。

### 这对头号目标意味着什么

- 415 处 `clone(result)` 的必要性，**不再有"result 被就地改写"这层理由**；
- 剩下的是一个**语义判断**：终局事件（636 行发布）应当携带**修改前**还是**修改后**的状态快照。
  由于 `lastActionResult` **唯一的读取点就是 636 行**（其余全是 `= null` 重置），
  这件事**必须由运行时实验定论**，不能靠读代码断言。

### 因此下一轮的实验（已具备全部条件）

1. 在克隆里**移除 415 的克隆**（改为存引用），跑 482/448/485；
2. 门禁按补强后的协议：**动作 + 计划 + `diagnostics` 逐项 + after 状态**全部一致（不只是决策）；
3. 若全绿且 profile 显示 `structuredClone` 占比下降 → 保留；任一不一致 → 立即回退并记录"该克隆确有必要（附差异证据）"。
