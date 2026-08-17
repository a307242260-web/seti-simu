# V 引导决策器 quick_trade 误导问题分析（2026-08-17）

> 本文件是机器人迭代（免电分析盘面 `seti-free-analyze-v1`，目标均分 100）的
> **方向性分析**：上一版 V 引导决策器（commit 68ea408，fork 浅搜索 depth 4 + V 评估）
> 实测发现"有资源时最高 V 动作是 quick_trade"，说明 V 对行动价值的判断被误导。
> 按用户要求：先分析根因，**不继续在旧方向上加码**。
> 配套复现脚本：`tools/diag_vguided_quicktrade.js`（单决策点 V 成分分解）、
> `tools/compare_vguided_vs_baseline.js`（全盘行为对比）。

## 1. 症状

- 上一版实测：白色有资源时，V 引导决策选出的最高 V 动作是 quick_trade。
- 含义：V(state) 把"行动价值"评反了——本该把资源花在准备（科技/收入/首痕迹）
  与榨取（登陆/填数据）上的决策点，V 却认为"做一笔快速交易"最有价值。

## 2. 复现（HEAD 代码，commit 68ea408 + fabd2c7）

在免电分析盘面 `seti-free-analyze-v1` 上用启发式推进，取白色"有资源
（c5/e2/pub4/hand2）且是主行动选择"的决策点（step 23），对每个合法动作逐个
fork 浅搜索并分解 V 成分增量：

| 动作 | total | vDelta | actual | trace | score | liquid | tech | card |
|------|-------|--------|--------|-------|-------|--------|------|------|
| **quick_trade publicity-for-card** | **+6.0** | +6.0 | 0 | quick_trade>decision | 0 | 0 | 0 | **+6** |
| play_card（给科技那张） | -6.0 | -8.0 | +2 | play_card>decision | +2 | **-16** | **+12** | -6 |
| launch | -16.0 | -16.0 | 0 | launch | 0 | **-16** | 0 | 0 |
| scan | -24.0 | -24.0 | 0 | scan>decision | 0 | **-24** | 0 | 0 |
| place_data | -4.0 | -4.0 | 0 | place_data>decision | 0 | **-4** | 0 | 0 |
| card_corner | -2.0 | -2.0 | 0 | card_corner | 0 | +4 | 0 | -6 |

复现结论：**quick_trade(publicity-for-card) 以 +6.0 排第一**，且 step 24/26
（无科技牌可打时）同样第一。所有"花钱/花能"的动作（launch -16、scan -24、
甚至给科技的打牌 -8）全部为负。

## 3. 根因 1（主因）：V 的 liquidValue 把资源库存当价值

`evaluateStateValue`（HEAD 版）中：

```js
liquidValue = credits × INCOME_UNIT_VALUES.credits(8) + energy × 10 + data × 4
```

- 钱/能是**手段**不是**价值**（v-state-design 文档自己标注的测试契约红线：
  "钱/电/宣传/数据/手牌库存不得冒充分数"）。但实现把库存按固定单价直接计入 V。
- 后果：**任何"花资源"的动作都背上巨大负值**（花 2 钱 = -16），掩盖真实收益
  （分/科技/收入/外星进度）。V 变成"鼓励攒钱、惩罚花钱"的储蓄函数，而不是
  "评估行动价值"的价值函数。
- 而 quick_trade 是唯一能用 **V 值为 0 的资源**（宣传 publicity×0）换到
  **V 值为正的东西**（卡 +6）的动作 → 纯赚 → 最高 V。
- "有资源时"＝能付得起交易 ＝ quick_trade 可执行 → 它就是最高 V 动作。

## 4. 根因 2（放大器）：cardValue 固定 +6/张，不看成本与卡的质量

```js
cardValue = (handCount + reservedCount × 0.5) × V_CARD_EFFECT_VALUE(6)
```

- 任何"获得 1 张牌"都 +6，与牌面效果无关。
- 用 0 价值资源（宣传）或隐形资源（2 张牌换精选，fork 里还经常不生效）换卡
  = V 净赚 +6。
- 宣传是研究货币（research_tech 花 6 宣传/次），V 却鼓励把宣传花在买卡上，
  与科技路线直接冲突。

## 5. 根因 3（机制缺陷）：forkAdvance 的"深度 4"实际恒为 1

`v-guided-search.js forkAdvance` 的循环退出条件：

```js
const proj = comp.projection();
const currentActor = proj.state.turn?.currentPlayerId;
if (currentActor !== seatId) break;
```

实测（`/tmp/check_projection.js`）：fork 的 `projection().state` 是
`buildObservation` 产出的 observation 形状（顶层是 `publicState/selfState/
decision/...`，**没有顶层 `turn` 字段**；`publicState.turn` 也不存在——
`currentPlayerId` 在 `publicState` 顶层）。因此 `proj.state.turn` 恒为
`undefined` → `currentActor` 恒为 `undefined` → **第一轮循环必然 break**。

- 全部 trace 均为 `动作>decision`（1 个动作 + 1 个首选项决策），从未出现第 2 个动作。
- 宣称的"fork 执行 2-4 步到状态稳定点"没有落地；`maxDepth` 循环是死代码。
- 长链价值（用户 chong_3：打牌→移动→登陆→外星标记→盲抽牌）依然看不到；
  "统一搜索方案"（路线第 5 节）实际没有改变搜索覆盖，只是换了评估公式。
- 附带：条件决策用"第一个可用选项"求解（`choices.find(!disabledReason)`），
  不是最优选项——打牌/放数据的真实价值取决于选项枚举顺序。

## 6. 对工作树并发补丁的评估（未提交改动，勿覆盖）

分析期间发现 `randomizer/game/ai/expected-score-evaluator.js` 有并发未提交改动
（mtime 15:32），把 liquidValue 的资源项清零（credits×0、energy×0、data×0.3），
注释写明"花 1 钱 -8 掩盖真实收益 → AI 只选不花钱的 quick_trade"。

- **方向正确**：资源是手段不是价值，不该按固定单价计入 V（对应根因 1）。
- **但只治标**（补丁版 diag，step 24/26）：
  - credits-for-card / energy-for-card / publicity-for-card 并列 **+6.0 第一**
    ——资源成本在 V 里看不见了，"2 钱买 1 卡"变成免费 +6；
  - move/industry 变 0.0——移动不花钱了但 1 步内也看不到收益；
  - 有资源时 AI 会改为**刷钱/能/宣传买卡**，quick_trade 依旧霸榜，换汤不换药。
- 根因 2（cardValue 不看成本）与根因 3（fork 深度恒 1）未触及。

## 7. 全盘行为对比（已跑完）

`tools/compare_vguided_vs_baseline.js`：同一 seed、白方分别用
V 引导 / 启发式，其余三家固定启发式。输出白方行动族分布与 quick_trade 次数：

| 模式 | 白方终局分 | 均分 | 步数 | quick_trade | 科技 | 弃牌会话 |
|------|-----------|------|------|-------------|------|---------|
| baseline（启发式） | **86** | **64.3** | 534 | 3 | 4 | - |
| vguided（HEAD 原版 V） | **14** | 37.5 | 463 | **29** | 1 | 30 |
| vguided（工作树补丁版 V） | **14** | 37.5 | 463 | **29** | 1 | 30 |

- baseline 与路线文档基线（白 86 / 均分 64.3）完全一致，harness 有效。
- **vguided 白色终局 14 分（-72），quick_trade 29 次（baseline 仅 3 次）**——
  V 引导把白色打成了"交易机器人"：R1-R4 疯狂 quick_trade（宣传/钱/能买卡），
  全程只研究 1 个科技（baseline 4 个），分数轨迹 R1 8 → R4 14，几乎不涨。
- **工作树"资源清零"补丁对全盘行为零影响**（逐位相同）：买卡交易依旧免费
  （资源成本在 V 里看不见），quick_trade 照样霸榜——补丁只改了 liquidValue
  分量，没有改变"cardValue 固定 +6/张、不看成本"这个真正的误导源。
- 全盘运行还暴露了 quick_trade 弃牌会话死锁（见 7.1），分析 harness 加
  "选满 2 张不同卡再 confirm"完成器后才跑完；该完成器不改游戏代码。

### 7.1 附加发现：quick_trade 弃牌会话死锁（vguided 全盘暴露）

vguided 全盘跑到 R1 即卡死：白色（V 引导下把资源全花在 quick_trade，c=0/e=0）
做 `quick_trade cards-for-credit`（2张牌→1信用点）→ 规则要求先弃 2 张手牌 →
进入 `discard-hand-card`（逐张点选 + confirm）决策会话 → 死锁（每步同一决策，
hand 恒 4、c 恒 0，choose_payment 无限增长）。

死锁三要素：
1. **规则会话原语只有"单张点选（toggle）+ confirm"**：`executeDiscard`
   （production-composition.js）只认 `discard-hand-card`（已选→取消、未选→加入，
   然后带 `selected` 重新弹出同一决策）和 `confirm`（`selected.length !== required`
   拒绝，`QUICK_TRADE_DISCARD_INCOMPLETE`）。quick_trade 弃牌**没有**"一次提交
   N 张卡"的批量接口（旧 `discard-hand-cards` 复数接口只用于初始 setup）。
2. **启发式无会话记忆**：`heuristicEvaluator.selectLegalAction` 每次决策独立
   打分选最优，5 个弃牌选项打分全等 → 确定性选同一张卡 → 第二次提交同一张 =
   取消 → toggle 振荡 → 永远选不满 → 死锁。
3. **env 层不透传会话状态**：`normalizeConditionalCandidate`（simulation-contract.js）
   丢弃 `presentation.selected`、`disabledReason`、顶层 `phase`——决策层拿不到
   "已选哪些卡 / confirm 是否可用"，无法感知会话进度（分析 harness 为此绕行，
   正确修法见下）。

正确修法（用户口径"调用原函数直接给参数"）：
- 规则层给 `executeDiscard` 加**批量弃牌分支**（一次提交 N 张卡 → 扣卡 →
  调 `finalizeTradeAfterDiscard` 完成交易），AI 一次调用，toggle 模型只留给
  浏览器 UI；或
- 决策层（heuristic-policy / 条件委托）实现**会话感知**：选满 required 张不同卡
  再 confirm（当前所有弃牌交易 handSize 成本恒 2）。
- 注意：confirm 提交失败会 **abort 整个 quick_trade 会话**（phase=aborted，
  失败结果里 `progressed:true`、会话状态保留），所以"试 confirm 失败再补卡"
  不可行，必须先选满再确认。

## 8. 结论与建议（不继续在旧方向加码）

1. **V 评估误导的根源是"把资源库存当价值"**（根因 1）——这是"对行动价值的
   判断被误导"的直接原因；补丁已指向同一结论，但需要完整修复而不是清零了事。
2. **cardValue 必须与"获得路径"绑定**（根因 2）：卡牌价值来自"能打出的效果链"
   （免费科技/收入牌/移动登陆链），不是固定 +6/张。当前实现让"买卡"成为
   免费价值，AI 永远会选择囤卡而不是用资源做事。
3. **搜索覆盖必须真正展开**（根因 3）：fork 的"状态稳定点"判断 bug 让
   depth-4 浅搜索名存实亡。在修复 V 公式前，先修 `forkAdvance` 的推进条件
   （读 `publicState.currentPlayerId` 或正确投影 shape），让 2-4 步链真实可执行，
   否则"打牌→科技/收入/登陆"的长链价值依然不可见。
4. 本次只做分析，不改 V 公式、不加搜索预算；修复方向待用户拍板。
