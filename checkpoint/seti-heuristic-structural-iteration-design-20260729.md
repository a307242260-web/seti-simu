# 启发式机器人结构性五轮迭代设计（2026-07-29）

## 目标与固定边界

- 固定盘面：`seti-104-board-v1`
- 固定 seed：`seti-104-official-v1`
- 一级评价目标仅包含：实际分数、科技、收入。
- 分数价值不随轮次变化；科技与收入价值随剩余可利用时机下降。
- 搜索持续到本席实际 PASS，或本席执行满 15 个次级代理。
- 所有快速转换在纯资源交换上都是亏模型行动，但它是达成目标的合法手段。快速转换不得成为
  路线目标、不得因交换本身获得正向代理奖励；当它能补足路线资源缺口，并使后续完成的一级
  目标价值覆盖转换损耗时，路线应当执行转换。
- 每轮采用闸门：先通过行为义务；再比较同一固定盘面的四席均分。行为失败或均分下降即放弃。
- 不通过缩小 node cap、beam 或深度来制造耗时改善。

## 完整设计矩阵

| 语义 | 唯一 owner / 正式 primitive | 状态与确定性 | Decision / 事务边界 | 搜索与评价义务 | 行为证据 |
|---|---|---|---|---|---|
| 实际分数 | Production Composition 结算后的 `realizedScore`；终局使用 `officialTerminalScore` | committed player score；不得预测伪分 | 沿正式 Action/Decision 链一次次提交到隔离 fork | `Δscore` 始终 1:1，不按轮次折损 | evaluator unit：第 2/4 轮同一得分增量同值 |
| 科技 | `research_tech` 与正式科技 Decision/奖励 | `techState.ownedTiles`；tile id 稳定 | 非等价科技选择保持为 Policy Decision | 只计算真实新增科技；随剩余可利用轮次下降；具体科技即时产生的后续一级收益由真实路线结算，不重复加库存价值 | evaluator unit：早轮大于晚轮；同路线分数不重复 |
| 收入 | 正式收入轨与 `round_start_income` | player income；收入阶段仅在新轮开始 | 行动中提高收入轨的即时奖励由规则效果自己结算 | 只按当前行动后尚未发生的轮初收入次数计长期价值；第 4 轮收入轨增量长期价值为 0 | evaluator unit：R1/R2/R3/R4 窗口为 3/2/1/0 |
| 快速转换 | `quick_trade` Production Domain；真实 cost/gain 与卡牌 Decision | committed resources、hand、RNG/card sequence | 花费、弃牌、精选牌都在同一 Effect Session；未知/stale fail-closed | 交换本身没有正价值，但可作为路线第一步或中间步骤；比较“转换后完成的一级目标价值－转换损耗”；没有资源缺口改善或不能到达一级收益的转换路线不可选；连续转换不得因中间库存变化获得正值 | unit + fixed-board：必要转换可选；无目的转换不可选；同目标优先损耗更小的转换链 |
| 次级代理路线 | Rule Composition counterfactual fork | committed bytes + session checkpoint + action identity + depth | conditional 不计 15 代理深度；本席顶层代理计深度 | 一级目标是叶评价轴，不是路线终点；所有 family 固定 rank 只可作最终稳定 tie-break，不能覆盖一级增量或路线进度 | search unit：更高一级增量必胜；同增量短/少损耗路线优先 |
| 探测器路线 | 正式 launch/move/orbit/land 与 probe requirement projection | rocket id/坐标、太阳系旋转、目标 planet id | 每步复用 Standard Action；不手工移动或结算奖励 | 锁定目标后仅保留匹配下一步或控制动作；报告当前动作位置来自 action 前后的真实 board snapshot | fixed-board 报告：火星探测器不得标成环绕金星 |
| 数据路线 | 正式 place_data/analyze/research_tech | data track、computer slots、tech state | 放置奖励与科技选择均保留正式 Decision | 比较完整顺序；先科技后填数据若真实叶更高，应由叶一级价值胜出；不靠 family rank 猜测 | fixed-board 行为审计 + action chain |
| 卡牌与移动支付 | 正式 play_card/card_corner/choose_payment/choose_card | hand entity、probe presence、资源 | 非等价支付与选牌保持 Decision | 没有太阳系探测器时，弃牌换移动不能成为有效路线；所有支付只以最终叶一级收益减去转换/机会成本比较 | unit：无探测器的移动支付路线不可优先 |
| PASS / end_turn | 正式 turn owner 与 round lifecycle | turn owner、passed players、round number | PASS 必做链结算；新轮收入仍由后续轮初 owner | 本席 PASS 后立即成叶，不把下一轮收入记到 PASS；无正价值路线确定性 PASS | full-flow + evaluator unit |
| 报告归因 | training report 只读 Policy outcome 与真实 replay | action before/after、leaf chain、evaluation breakdown | 不影响规则与策略 | 分开显示当前动作即时变化、路线累计一级价值、科技价值、未来收入价值和转换损耗 | HTML 文本/结构断言 + 视觉抽查 |

## 状态 × owner × fallback 矩阵

| 状态 | 当前玩家 Policy | 对手冻结 rollout | 环境确定性结算 | 禁止 fallback |
|---|---|---|---|---|
| opening | 标准 setup Decision 比较正式叶 | 不参与 | 唯一项可自动推进 | 静态卡牌分表、旧 selector |
| turn | 搜索顶层次级代理路线 | 正式 action，固定且版本化 | 无选择事件自动推进 | family 权重代替路线完成度 |
| conditional | 非等价选择全部保留并估值 | 版本化确定性选择 | 唯一 legal choice 可自动推进 | 取第一项、UI callback、旧 resolver |
| focal PASS | PASS 必做链后立即叶 | 不再推进 | PASS 自身确定性效果 | 观察下一轮收入 |
| terminal | 官方终局分 | 不参与 | 正式 final scoring | 自建终局预测分 |
| unknown / stale | fail-closed | fail-closed | 不提交 | recover/skip |

## 五轮候选及反例

1. **收入时序**：删除“当前轮收入窗口”。反例：第 4 轮提高信用收入仍被估为 5 分。
2. **快速转换目的性**：把每次正式快速转换的有损成本纳入路线，交换本身不给正 rank，但允许
   它作为补足明确路线缺口的第一步或中间步骤。反例：`电→牌→宣传→牌` 与更短的直接换牌路线
   得到同值；反向反例是“因为转换亏模而拒绝唯一能完成高价值目标的转换”。
3. **路线支配与短路**：同一一级结果下按转换次数、代理深度和资源实耗排序；没有探测器时过滤
   移动及移动支付代理。反例：无探测器仍弃牌换移动。
4. **数据/科技顺序**：以叶中科技与实际得分的真实先后结果排序，移除会让 `place_data` 抢在
   可立即取得科技之前的固定 family 偏置。反例：先填数据再拿蓝科技导致填充分数损失。
5. **报告归因与综合固定盘面复核**：把即时分、路线分、科技、未来收入和转换损耗分栏，并用
   固定盘面检查位置、转换链和最终均分。反例：把整条路线 `V=9` 标在“环绕金星”旁，读成
   环绕本身 9 分。

如果实现中发现新的 state owner、RNG、Decision 或事务边界，停止生产 patch，先回补本矩阵。

## 五轮完整固定盘面结果

所有轮次均使用同一盘面、seed、`maxNodes=128`、全局 beam 4 和 15 个本席次级代理。第 1～4
轮通过一次性模块加载隔离复现累计候选，隔离脚本在实验后删除；第 5 轮为最终 production v13。

| 轮次 | 累计候选 | 四席分数 | 均分 | 相对上一轮 | 快速转换 | 科技 | 结论 |
| ---: | --- | --- | ---: | ---: | ---: | ---: | --- |
| v12 | 原正式基线 | 43 / 37 / 35 / 20 | 33.75 | — | 22 | 3 | 对照 |
| 1 | 收入只计后续轮初 | 50 / 34 / 31 / 15 | 32.50 | -1.25 | 21 | 4 | 规则正确性强制保留；不得用虚构本轮收入换分 |
| 2 | + 路线净资源机会成本 | 58 / 35 / 30 / 19 | 35.50 | +3.00 | 21 | 7 | 强度与行为均通过，保留 |
| 3 | + 同状态少转换/短路线支配，转换 rank 归零 | 58 / 35 / 30 / 19 | 35.50 | 0.00 | 21 | 7 | 分数无增益；作为搜索语义约束保留，不记强度收益 |
| 4 | + 无探测器移动角标字段修复 | 58 / 35 / 30 / 19 | 35.50 | 0.00 | 21 | 7 | 固定盘面未触发；反例测试通过，作为行为修复保留 |
| 5 | + 转换必须解锁下一正式代理 | 49 / 38 / 30 / 30 | 36.75 | +1.25 | 2 | 6 | 行为与均分均通过，保留 |

最终 v13 相对 v12：

- 均分 `33.75 → 36.75`，提升 3 分。
- 最低席 `20 → 30`，最高席 `43 → 49`。
- 快速转换 `22 → 2`。剩余两次分别直接解锁扫描与登陆；没有连续钱电互换。
- 科技 `3 → 6`；白色玩家在首批连续数据放置前先取得科技。
- 弃牌角标 `36 → 23`；无探测器移动角标由精确字段反例保证不可选。
- 每候选平均 `279.41ms`；没有缩小 node、beam 或代理深度。

第 2～4 轮一度得到均分 35.5，但绿色玩家连续执行 14 次钱电互换。报告证明每次转换都把很远
之后的收入重复归因给当前转换，而转换后的第一项非转换代理（放置数据）在转换前已经合法。
因此该中间结果虽高于 v12，仍因行为义务失败而拒绝。第 5 轮要求转换后的第一项非转换代理必须
是 root 原本不合法、转换后才解锁的标准行动；它允许多次转换共同补足一个明确目标，但拒绝
与目标无关的资源振荡。

最终 HTML：`checkpoint/seti-heuristic-structural-v13-20260729-action-log.html`。
