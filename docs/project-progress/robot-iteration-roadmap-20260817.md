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
- [x] V(state) 设计文档：docs/project-progress/v-state-design-20260817.md
- [x] V(state) 初版实现：outcome-model 投影加 alienSlots，expected-score-evaluator 加
      evaluateStateValue（收入复利/科技效率/外星进度/手牌期望）
- [x] V 接入评估（默认关）：evaluateOutcome 叶排序加 V 增量，env 开关透传
- [x] 判定：counterfactualPort.evaluate 与旧目标体系深度耦合，不适合直接复用 →
      暴露 fork 原语（createCounterfactualFork，可回退执行）作为基础组件
- [x] 新 V 引导决策器：randomizer/game/ai/v-guided-search.js（fork 浅搜索 depth 4，
      全动作评估 V(leaf)-V(root)+实际分Δ）+ runVGuidedDecision（条件决策委托启发式）
- [x] V 引导全盘对比（2026-08-17 分析）：**V 对行动价值的判断被误导**——
      quick_trade 霸榜（详见 docs/project-progress/v-quicktrade-mislead-analysis-20260817.md）：
      - HEAD 原版：白色 86 → **14 分**，quick_trade 3 → **29 次**，均分 64.3 → 37.5
      - 根因：liquidValue 把资源库存当价值（花 1 钱 = -8 惩罚所有花钱动作）+ 
        cardValue 固定 +6/张不看成本（宣传/钱/能买卡 = 免费 +6）→ 唯一"赚"的
        动作是 quick_trade；另发现 forkAdvance 深度恒为 1（proj.state.turn 恒
        undefined，宣称的 depth-4 浅搜索未落地）、quick_trade 弃牌会话 toggle 死锁
      - 工作树"资源清零"补丁治标不治本（全盘结果与 HEAD 逐位相同）
- [x] 修复方向（2026-08-18 用户拍板"按此方向修复 V(state)"，已实施）：
      ① liquidValue 资源库存不再按固定单价计入 V（手段不是价值，钱/能/宣传 0，
      数据仅保留 0.5 折半转化期望）——花资源动作不再背负值；
      ② cardValue 与获取路径绑定（手牌价值 = 可打效果链期望：免费科技/收入牌/
      移动登陆/外星痕迹，按剩余轮次折半，不是固定 +6/张）；
      ③ forkAdvance 推进条件修复（proj.state.publicState.currentPlayerId 取代
      恒 undefined 的 proj.state.turn → 浅搜索 trace 深度 1→3-6 真实展开）；
      ④ 弃牌会话 toggle 死锁（另见 unified-search 防死锁 skip 兜底）；
      配套：V 输入审计工具 tools/audit_v_state_inputs.js（所有路径喂 V 的
      observation 必须标准装配，缺装配显式抛错——AGENTS 硬规矩"错误必须暴露"）
- [x] V 引导接入方式（2026-08-18 用户裁决"先有倾向的确定搜索目标，去掉不执行的，
      不是先执行再失败"）：放弃 fork 浅搜索路径（runVGuidedDecision +
      v-guided-search——会话/可行性/状态漂移反复出问题），改为
      **v-guided-decision-function**：复用启发式决策函数生成标准 actionOutcomes
      （目标预筛+可行性+反事实搜索 = "先定倾向"），主行动叶排序用 v-guided-policy
      （V 增量 = "再执行"），条件决策委托启发式（choose_* 含初始选牌/弃牌会话）。
      heuristic-decision-function 加 policyFor 支持按 boundary 切换策略
- [x] 统一搜索（目的引导版，2026-08-18 迁移回主分支 10ded3e9/dd5da46）：
      搜索入口 = 目标绑定 + 需求放行（quick_trade 补缺口/card_corner 弃牌收益/
      industry 公司能力），废弃"预算内全动作尝试"（实测全体玩家变弱：乱按打字机的
      猴子写不出莎士比亚）；quick 根截断（叶价值 = 立即效果，不搭主行动便车）；
      全盘 on 均分 60.3 → 70（off 86/63.5），目的型动作"需要时使用"
      （详见 docs/project-progress/unified-search-design-20260817.md）
- [x] 外星目的价值（用户规则 2026-08-18）：首痕迹 = 分 + 外星人牌（倾向抢未抢夺的
      首痕迹）；揭示后位置优先覆盖"有外星人牌"的高收益位置（阿米巴 3/4 号位）；
      位置选择按奖励排序；AI 局外星链（首痕迹→三色齐→揭示→位置+牌）完整走通
- [x] 搜索机制合并（2026-08-18 用户裁决"on/off 合并，搜索机制只需要一套"）：
      去掉 bounded 分桶与 unifiedSearch 开关，目标引导 + 需求引导成为唯一路径
      （policyVersion v26→v27）；quick_trade 需求放行、被调度器剪枝的目标动作
      作为未绑定后继返回；详见 unified-search-design §6
- [x] 打牌价值第一步（2026-08-18 用户裁决"无法评估打牌的价值"）：尝试 play_card
      常开 + 效果快照估值，**实测全盘退化**（白色 86→17，单决策 8.9s/4096 撞顶，
      纯效果牌评估虚高、打牌链未兑现）→ **回退**，保持 play_card 目标绑定；
      结论：打牌价值应通过目标系统增强（income:card 收入牌 / tech:research 免费
      科技 / probe:免费发射 / sector:观测 / data:卡牌），而非放行全部打牌
- [x] 科技价值打分（2026-08-18 用户裁决"给每个科技设定一个基础分数 + 单次利用
      价值 × 预期使用次数，按总分取 top 3 做尝试"）：`selectHeuristicTechPlans`
      废弃硬编码场景规则（probe/scan/sector 布尔过滤，导致 blue3/blue4/orange3/
      purple1 等永远不可见），改为每个科技按真实效果打分。**不预估即时收益**
      （背面 bonus 随机翻到什么就是什么、首发分有就有没有就没有、扣 6 宣传）——
      这些由反事实搜索执行研究动作时真实结算进叶价值（实测研究 blue1：score+2
      首发 + pub-5 含随机 +1 宣传 bonus，actualScoreDelta 正确捕获）。科技分三类
      （用户逐项纠正）：① **持续收益**（单次利用价值 × 预期使用次数 × 场景权重 ×
      剩余轮次）：蓝1-4 数据槽、橙2 移动自由、橙3 登陆省能、紫2 水星扫描
      （1 宣传→扇区信号+数据，是收益）、紫4 扫描后发射/移动；② **一次性解锁**
      （只算解锁价值不乘次数）：橙1 火箭上限+1（无持续收益）；③ **灵活性/有代价**
      （价值 0）：紫1 扇区扫描升级（收益可能完全不变）、紫3 手牌扫描（消耗宝贵
      手牌，换扫描不一定赚）。**橙4 卫星登陆解锁 = 条件性有限收益**（用户纠正：
      橙4 解锁后才允许卫星登陆，但本身也能登陆/环绕本星；不是所有行星都有卫星、
      卫星槽位会被占、每颗卫星只能登陆一次）——价值 = 可达卫星目标数 × 单颗
      卫星增量收益 8 × 场景权重，**不乘每轮次数**（每颗卫星一次性）。取 top 3
      尝试，其余不评估（避免全放开稀释搜索）。实测有数据+扫描场景 top3 =
      blue1/blue2/purple4——搜索覆盖由价值排序决定，不再是硬编码场景
- [x] 节点粒度（2026-08-18 用户裁决"一个行动包括所有的 target 选择完毕算一个
      节点"）：反事实搜索执行节点 = **完整行动**（主行动 + 其等价结算链），不再是
      "动作第一步"。纯结算（弃牌/支付/交易选牌）折叠进动作节点（choose_payment
      节点 418→68，单决策 4096→1846 不撞顶）；折叠提交保留隐藏信息 mask（公共牌
      翻出不泄漏）。**策略级选择（外星痕迹槽位/科技/探测目标）保持展开**（AI 需
      比较多分支形成多叶，如土星登陆 2 槽位 2 叶）；play_card 效果链保持展开
      （折叠后不形成叶被 pruned）——策略级折叠的正确实现是"保留价值分支 + 分支
      内结算折叠"，待专项
- [ ] 打牌价值（用户长线意图）：打牌 = 免费科技（省宣传）+ 收入牌 + 移动/登陆/外星链，
      AI 打牌少（4-6 次 vs 用户 19 次），机制存在但引导待强化
- [ ] R3R4 资源流转（用户长线意图）：根因已定位——AI 收入 R1 c4/e2 不升（用户 c6/e2），
      place_data 填数据行给收入牌（dlc_39）未被 income 目标识别（只认"计算机 4 槽"），
      数据获取不足（扫描 4-5 次）→ 第 4 槽收入 R1-R2 没触发 → R3R4 无资源可流转
- [x] 收口：全量 run_node_tests 恢复可跑（登记 initial-setup.test.js 进清单，阻塞解除）；
      存档工具 tools/save_checkpoints.js + verify_from_checkpoint.js（/tmp/checkpoints 存档复用）
- [x] 科技打分三类修正后**真实从头全盘**（2026-08-18 v27-tech-v3，指纹
      0bd19be8，gitCommit 34730eeb + 工作树橙4 条件性有限收益，8m31s/520 步，
      终局轮 4）：**白色 64 / 均分 52.25**（baseScore 口径；含终局板块结算
      白色 106 = base64 + 板块 a33/d3 + 卡6）。终局科技（含打牌免费给的）：
      **白色 blue1+blue2+purple2**（不再是纯蓝——紫2 水星扫描打分 7 生效被选中），
      蓝方 blue1/blue2/blue4/orange3/purple1，绿方 blue1/blue2/purple4，
      棕方 blue1/blue2/blue3/blue4。白色 research_tech=3（研究步 93/235/370，
      与用户 R1-R3 节奏一致）、play_card=3（用户 19）、quick_trade=4（step165-167
      连续 quick_trade 是换资源，终局 4 次正常量级）、外星首放 5 次揭示 1 次。
      对比锚点：v26 on-head 白58/均分60.5、v26 off-head-clean 白72/均分59——
      均分口径下科技打分版仍低于 v26 两条基线，白色绝对分略高于 on-head。
      **结论：科技打分解决了"只研究蓝科技"（紫2 入选），但尚未带来净提升；
      三大缺口仍存在（打牌 3 vs 19、科技研究 3 vs 8、外星首放 5 vs 全首），
      下一步优先打牌价值与收入-科技联动**

## 7. V 校准（用户 405 档实测）

### 7.1 用户各回合末状态（白色）

| 回合末 | 分 | 钱/能 | 收入 | 科技数 | 科技列表 | 外星 |
|-------|-----|-------|------|-------|---------|------|
| R1 | 15 | 0/1 | **c6/e2** | 2 | blue2+purple4 | s1:0首 s2:1首 |
| R2 | 32 | 4/1 | c6/e2 | 3 | +blue1 | s1:2首 |
| R3 | **105** | 0/0 | **c7/e4** | 6 | +purple2/orange2/orange4 | **s1:3首✓ s2:3首✓** |
| R4 | 249 | 0/0 | **c8/e7** | 12 | 全 | 双✓ |

### 7.2 用户收入升级事件（真实机制，2026-08-17 用户纠正）

**收入机制澄清**：收入不是"打牌获得"——**所有收入都需要"插入一张牌"**（动作奖励一张
收入牌 → `choose_card 收入 X` 把牌塞进收入区 → 每轮按牌面收入标记 +资源）。用户 R1
收入升级的真实来源（2026-08-17 用户纠正时序）：

- **公司初始资源（R1 生效）**：深空探测 `incomeIncreaseCount: 2` = **两次"插入收入牌"
  行动**。#17/#18 就是这两次插入（b_97、dlc_22 被插进收入区，收入标记都是钱）→ +2c
  收入（2/2→3/2→4/2）。不是弃牌、不是结算时机碰巧，是真实的插入收入牌行动。
- **公司 baseIncome（第 2/3/4 回合开始发放，R1 不发）**：credits 2 + energy 2 + handSize 1
  + additionalPublicScan 1。数据来源：玩家状态 `income` 字段（收入率面板值，每轮发放
  额度）；R1 末读取到 c2/e2 是"R2 开始会发的额度"，不是 R1 已发。
- **R1 #41-44 orbit 环绕火星** → 奖励 dlc_40 → `收入 dlc_40` +1c（**环绕→收入**）
- **R1 #49-57 place_data 填满数据轨** → 奖励 dlc_39 → `收入 dlc_39` +1c（**填数据→收入**）
- R3 #164 b_48 +1e、#193 dlc_25 +1e、#244 chong_7 +1c（同为"奖励牌→插入收入"）
- R4 #318/#354/#414/#472 同理

R1 末收入率 c6/e2 构成 = 两次插入收入牌 +2c（初始资源，R1 生效） + 环绕 +1c
+ 填数据 +1c + baseIncome c2/e2（R2 起每轮发放）。收入率含义 = "下一回合开始发放
的额度"（R1 末 c6/e2 → R2 开始发 6钱2能）。

**V 校准修正**：收入引擎 = **orbit 环绕 + place_data 填数据轨**（用户明确指认）——
这两个动作是"获得收入"的主要手段（奖励收入牌→插入）。不是打牌本身。

### 7.3 用户科技事件（12 科技 = 8 研究 + 4 打牌，2026-08-17 用户纠正）

**科技机制澄清**：科技获得有两条路——① `research_tech` 主行动（花 6 宣传）；② **打牌
效果免费给科技**（play_card 后弹 choose_target 选科技，不用宣传）。此前误把所有
`choose_target 研究 XX` 都当成研究动作，实际打牌给的科技占 1/3。

- **research_tech 主行动（8 次）**：#37 blue2、#98 blue1、#137 purple2、#230 orange4、
  #333 orange1、#394 purple1、#405 blue3、#481 orange3
- **打牌效果免费给科技（4 次）**：
  - #60 play_card(card-15) → #61 **purple4**（R1 紫4 就是打牌拿的）
  - #146 play_card(card-29) → #147 **orange2**
  - #143 amiba_0 → #147 orange2（同一效果链）
  - #374 play_card(card-67) → #375 **blue4**（蓝槽3）
- 分布：R1 研究 blue2 + 打牌 purple4；R2 研究 blue1；R3 研究 purple2/orange4 + 打牌 orange2；
  R4 研究 orange1/purple1/blue3/orange3 + 打牌 blue4

### 7.4 V 校准结论（反推权重）

1. **收入是复利引擎**：R1 收入 c6/e2（比 AI 的 c4/e2 多 2c）→ 用户 R3 爆发 105 分。
   收入来自 公司 baseIncome + orbit 环绕 + place_data 填数据轨（奖励收入牌→插入）。
   **1 收入 ≈ 8-10 分/轮**（每轮多 1 资源 → 行动转化）。
2. **科技是效率引擎**：12 科技（**8 研究 + 4 打牌**，蓝4槽全占）→ blueTechScore 40 分 +
   研究 bonus 30 分 + 效率红利（橙/紫降价）。R1 研究 blue2（蓝槽1）+ 打牌 purple4 →
   后续 8 次放槽收益。**打牌免费给科技是重要来源（1/3）——打牌价值认知直接决定
   科技获取**。
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
- `randomizer/game/ai/heuristic-decision-function.js`：Heuristic 决策函数（反事实搜索 + 直调 Policy + plan 构建）
- 存档工具：`tools/run_simulate_save.js`（模拟全盘+存盘，seti-browser-save-v2 同格式）、
  `tools/fast_forward_save.js`（存档快进复现，纯内核重放 ~6s/537 步）
