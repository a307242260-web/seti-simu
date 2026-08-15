# SETI 说明书核对审计发现清单（Rulebook Audit Findings）

> 审计依据：官方规则书《SETI: Search for Extraterrestrial Intelligence》基础规则书 v06（简体中文版，
> `rules/seti-rulebook-base-zh-s.pdf`，28 页）与公司扩展《Space Agencies》规则书 v02
> （`rules/seti-rulebook-space-agencies-zh-s.pdf`，8 页），必要时对照英文版
> （`rules/seti-rulebook-base-en.pdf` / `seti-rulebook-space-agencies-en.pdf`）。
>
> 审计方式：6 个并行子代理分域深读（核心行动与资源 / 扇区与扫描 / 卡牌与任务 / 里程碑与终局计分 /
> 公司扩展 / 外星人），关键结论经主代理逐条亲自核实代码。外星人专属规则册 PDF 官方未提供，
> 外星人部分只核对通用规则与内部一致性（原始规则文本见 `assets/aliens/<物种>/face_detail.md`）。
>
> 状态图例：✅ 已修复并提交 ｜ ⬜ 待处理 ｜ ⚪ 已确认非问题 ｜ 🔍 需人工核对实体 ｜ 📝 仅文档/展示

## 一、已修复并提交（commit `1da9d40`）

| # | 问题 | 规则依据 | 代码位置 | 修复 |
|---|---|---|---|---|
| F1 | 末轮（第 4 轮 = 规则书第 5 轮）PASS 不执行太阳系公转、不弃牌至 4 张 | 基础 P19「在第 5 轮，玩家仍然需要执行太阳系公转，但无需再拿取太阳系公转标记」；PASS 步骤 1 弃牌至 4 无轮次豁免 | `effects/probe-turn-session.js` `buildPassEffects`（旧 `isFinalRound` 分支跳过全部 PASS 效果） | ✅ 公转与弃牌改为所有轮次执行；仅「一轮结束牌」保留在第 1–3 轮（末轮本无牌叠） |
| F2 | 信号标记每次扫描「最多 2 个额外信号」未封顶 | 扩展 P8 FAQ「玩家只能在每次扫描行动中最多通过弃置信号标记额外标记 2 个信号」 | `effects/science-session.js` PUBLIC_CARD_SCAN `max: 1 + additionalPublicScan` | ✅ `max` 封顶 3（1 基础 + 2 额外） |
| F3 | 紫4「发射」选项未校验探测器上限，满员时选中会中止整个扫描会话 | 基础 P8 发射受「太空中探测器上限」约束 | `effects/science-session.js` `listScanAction4Choices` 仅检查能量 | ✅ 达上限时不提供发射选项 |
| F4 | 紫1 强化扫描未实现「地球及相邻扇区三选一」 | 基础 P17「可以选择不在地球所在的扇区标记一个信号，而是在一个与地球所在扇区相邻的扇区标记一个信号」 | `effects/science-session.js` scanQueue IMPROVED_SECTOR_SCAN 与基础地球扫描等同 | ✅ 现提供 地球 + 左右相邻 三选一 |
| F5 | `card_free_move` 效果类型无执行器，触发即中止 Effect Session | 基础 P15 触发任务奖励必须可结算 | `cards/effects.js` b_2/b_20/b_25 触发槽；`cards/play-domain.js` 无对应 executor | ✅ 接入 CARD_MOVE 通用路径（免费移动，语义一致） |
| F6 | b_103 任务奖励类型为裸字符串 `"income"`（≠ `card_income`），结算中止 | 同上 | `cards/effects.js` b_103 任务 rewards | ✅ 改用 `incomeEffect` |

回归：`node tools/run_node_tests.js` 64/65 通过（唯一失败 `simulation-counterfactual-outcome.test.js` 为基线预先存在，与本次改动无关）。

## 二、严重级待处理 ⬜

| # | 问题 | 规则依据 | 代码位置 | 备注 |
|---|---|---|---|---|
| S1 | 中立里程碑（20/30 分中立首痕迹）完全未接线 | 基础 P5（2 人局每位置 2 个、3 人局 1 个、4 人局无）、P18（分数到达/超过 20、30 的回合结束后把中立标记放到外星人「最左侧未占用」发现位置，可能触发外星人发现；「永远最后结算」） | `aliens/state.js` `placeNeutralScoreTraceForThreshold` / `findNeutralScoreTraceTarget` / `NEUTRAL_SCORE_TRACE_ORDER` 已实现但**全仓零调用**（死代码）；回合结束 handoff 链（`probe-turn-session.js:446-448`）无里程碑结算步骤 | 三个审计代理独立确认；`docs/mechanics-reference.md:149` 却描述为已生效。附带：2 人局每阈值需 2 个中立标记，现实现每阈值仅 1 个。附带规则书 P20「先结算所有里程碑，再结算发现外星人」顺序未落实 |
| S2 | 金色里程碑即时结算，而非「回合结束之后结算」 | 基础 P18「这些事件会在当前玩家执行完所有的主要行动与免费行动，结束自己的回合之后再结算」；P18「若有多个玩家需要结算里程碑，则从刚结束回合的玩家开始，按顺时针顺序依次结算」 | `effects/residual-domain-session.js:1051-1078` 任意 effect 后立即 unshift FINAL_MARK；`listPendingFinalOwners`（:1238-1242）按固定座位序（蓝/绿/棕/白）而非顺时针 | 附带多玩家结算顺序 bug：同 effect 多人跨阈值时按固定颜色序，非本回合玩家可能抢先占高价值槽位 |
| S3 | 「每个行动或效果只能触发并覆盖一个任务」未实现 | 基础 P15「若某个行动或效果可触发多个任务……每个行动或效果只能触发并覆盖一个任务」 | `effects/residual-domain-session.js:1095-1112` 对同一事件每个匹配触发槽各生成一个独立 CARD_DECISION，可连续全部确认（实测 b_2 一次 visitPlanet 覆盖 3 槽） | 违反规则——任务牌可被单次行动直接刷完 |
| S4 | 完成任务牌 / 收入牌被弃入弃牌堆，可重洗回主牌库 | 基础 P15 触发任务完成「将其正面朝下与其他已完成的任务牌放在一起」；条件任务「将所有已完成的任务牌都保留在自己面前」；P6/P14 收入牌「插入起始收入牌下方」（牌出游戏） | `effects/residual-domain-session.js:1198-1201`（完成→弃牌堆）、`cards/play-domain.js:680` 与 `initial-setup.js:405-407`（收入牌→弃牌堆）；`cards/deck.js:406-415` 洗回时不排除 | 中后期牌库耗尽后已完成任务牌/收入牌可再次被盲抽，成为占保留区的「死牌」 |
| S5 | `card_corner_event_reward`（b_26）与 `card_count_aliens_resource`（b_46）仍无执行器；多张外星牌打出即中止 | 基础 P15 奖励必须可结算 | `cards/effects.js` b_26（×3 槽）、b_46 任务奖励；外星牌 `amiba_1`、`runezu_2~6`、`runezu_9`、`aomomo_2`、`yichangdian_0/1/4/5/7/8/9` | 与 F5 同类，需逐一补执行器；外星牌未在 `CARD_REFERENCE_MAP` 穷举测试覆盖内 |

## 三、中等级待处理（文档化的设计偏离）⬜

| # | 问题 | 规则依据 | 代码位置 | 备注 |
|---|---|---|---|---|
| M1 | 研究科技公转顺序：规则要求「先公转、后选科技」，实现为 选择→支付 6 推广→拿取→旋转→bonus | 基础 P16「当玩家研究一个科技时，首先需要执行一次太阳系公转。然后玩家选择一个自己还未拥有的科技」 | `tech/resolver.js` `executeTakeTech`（select→spend→take→rotate→bonus）；`abilities/tech.js` Take→Rotate 链 | 旋转推广收益晚于支付，存在窄收益差（推广上限 10 的边界交互） |
| M2 | 扇区即时结算：每次标记信号后立即 SETTLE 并重置，而非「主要行动结束后按当前玩家决定顺序统一结算」 | 基础 P13「当该玩家的主要行动结束之后，就会以当前玩家决定的顺序依次结算所有本回合中完成的扇区」 | `effects/science-session.js` SCAN_TARGET/PUBLIC_SCAN/HAND_SCAN 后各 spawn SETTLE（:842-849/926-943/1018-1021）；`session-runtime.js:615` 立即入队；`nebula-state.js:649-664` 按固定扇区顺序结算 | 同行动后续节点再扫同一扇区会错误地获得数据/第二槽 2 分；`orderSectorIdsByPlayerWinPriority`（当前玩家优先）已实现但生产未使用 |
| M3 | 条件任务只能回合末结算，不能「回合内任意时点用免费行动完成 / 立即完成」 | 基础 P15「在你回合中的任意时间，若你已经达成了任务所需的条件，就可以执行一个免费行动完成此任务」 | `effects/residual-domain-session.js` 类型 2 任务只在 `card_trigger:turn_end` 生成 Decision；无中途结算路径 | 打出时已满足条件不能立即完成，奖励无法当回合使用 |
| M4 | 钻探者（虫）卡牌「不计入手牌上限」与「不可用于资源转换」未实现 | 基础 P20「除钻探者卡牌以外，此类卡牌不被计入手牌上限」；P28 FAQ「钻探者卡牌不被视为手牌，不可被用于资源转换」 | `effects/probe-turn-session.js:342`（PASS 弃牌计数计入全部手牌）、:297-314（弃牌候选）；`production-composition.js:161-188`（资源转换候选） | 物种模块以「虫」(chong) 命名，未见「钻探者」对应实现 |
| M5 | 方舟揭示「按首痕迹数量各获得 1 次基础奖励」未实现 | `assets/aliens/方舟/implementation.md:18` | `effects/residual-domain-session.js:575-587` 对 fangzhou 显式跳过 `grantAlienCardsForFirstTraces`；`fangzhou.js:574-604` 只发 card2 解锁牌 | 文档-代码不一致 |
| M6 | 方舟解锁 card2 分支与「揭示后 state 额外痕迹位仍可用」不可达 | `assets/aliens/方舟/implementation.md:24-26`；`docs/alien-design.md:52`；`docs/mechanics-reference.md:156` | `fangzhou.js:467-527` `unlockCard2` 仅测试调用；`science-session.js:466-551` 对已揭示槽位只生成物种正面格位 | 后果：揭示后物种正面格位已满时奖励直接「落空」 |
| M7 | 快速起始牌 10/11（外星人痕迹）放置时授予首痕迹奖励 | 扩展 P5「上半部分效果会让玩家放置一个人造卫星，生命迹象，或是信号。如此做时，玩家不会获得任何效果奖励或资源」 | `initial-cards.js:531-548` `applyAlienStateTraceReward`（与卫星放置 `noReward: true` 不一致） | 🔍 若实体卡下半部分恰为同值奖励则总账正确但归属错误；需对照实体快速起始牌确认 |

## 四、轻微 / 展示 / 待核对 ⬜

| # | 问题 | 代码位置 | 备注 |
|---|---|---|---|
| L1 | 主牌库抽牌池 182 张 vs 官方 138+42=180（b_139 冥王星自定义保留牌、b_140 促销牌「Gateway to Mars」混入） | `card-catalog.js`；`cards/deck.js:351-357` | 🔍 促销牌有意混入属 house rule，需确认 |
| L2 | 轮次显示「第 1~4 轮」vs 规则书「第 2~5 轮」 | `resident-renderer.js:99`、`browser-read-model.js:86` | 功能等价，仅展示标签差 1 |
| L3 | 火星首登陆「任选两个数据位之一」简化为固定 2/1 数据 | `actions/planet-rewards.js:267-271` | 功能等价（2>1，无理性玩家会先选 1 数据位） |
| L4 | 冗余（额外）痕迹无限堆叠 vs 规则书「固定冗余位置」设计 | `aliens/state.js:203-207` | 规则书未明示上限，观察项 |
| L5 | 基础 5 轮模式未实现（实现 = 扩展 4 轮模式，与扩展规则书一致） | `turn-flow.js:17` `DEFAULT_FINAL_ROUND=4` | 若产品声明支持基础模式则为范围缺陷 |
| L6 | 紫4「移动」免费 vs 规则文本直译 1 能量 | `science-session.js:1035-1040` | 🔍 仓库文档与社区解读（Seti Fan Hub）支持免费移动，需官方确认 |
| L7 | 紫2/紫3 编号与官方实体版一致（紫2=水星、紫3=弃手牌），非 bug | `scan-effects.js:137-155` | ⚪ 已确认与实体一致 |
| L8 | 紫2/3/4 追加节点可行时强制、不可跳过（规则为「可以」） | `science-session.js` scanQueue | 标记信号本身强制正确；科技追加应为可选（加剧 F3 影响） |
| L9 | `TECH_TYPE_LABELS` 三色标签错位（蓝=探测器/橙=望远镜/紫=计算机，与官方及自身行为相反） | `tech/catalog.js:19-22` | 仅影响训练报告展示，不影响扫描逻辑 |
| L10 | 快速起始牌不能作为收入牌插入 | `initial-setup.js:368-377`（收入插入仅列手牌） | 扩展 P5 注「除非其如右图所示作为收入牌被插入」 |
| L11 | 收入「每个图标单独结算」（新卡可立即用于下一图标）未建模，聚合一次性结算 | `effects/residual-domain-session.js:1267-1301` | 扩展 P5；需对照公司收入图标实物确认影响 |
| L12 | 金色板块仅 3 个档位（1/2/3），实体疑为 4 槽 4 值 | `final-scoring.js:171-176`、`end-game-scoring.js:524-529` | 🔍 4 人局第 3/4 位玩家同取第 3 档；规则书 P18「各自价值不同的分数」、槽位数值为图片无法从 PDF 核对 |
| L13 | 文档「3 人局」vs 规则书「2-3 人局」中立里程碑 | `docs/mechanics-reference.md:149` | 与 S1 同源；仓库只支持 3/4 人局 |

## 五、已确认非问题 ⚪

- **外星人槽位 2 首痕迹 3 分 + 1 宣传**：规则书 P11 文本为「放标记到发现位置获得 1 推广 + 5 分」（两版图一致），但实体版图两槽位不对称（槽 1=5 分+1 宣传、槽 2=3 分+1 宣传、溢出 3 分），**经与项目 owner 确认，实现与实体一致，非 bug**。
- 核心机制确认无误项：发射（2 信用/上限 1）、移动（1 能量=1 移动力/离开小行星+1/进入行星彗星+1 推广）、绕行（1 信用+1 能量/首个 +3 分）、登陆（3 能量/有卫星 2/橙3 -1/首个得数据/卫星需橙4）、扫描（1 信用+2 能量/至少 2 信号/延迟补牌）、分析（1 能量/第 6 位/清空/蓝色痕迹）、研究（6 推广/首个拿取者 +2 分）、收入（插入即得/第 2 轮起）、资源转换（2 同种换 1）、买卡（3 宣传）、数据池 6/推广 10、扩展模式（起始推广 0/4 轮/内部 2-4 轮收入）、终局 8 板块公式（a1/a2/b1/b2/c1/c2/d1/d2 ↔ 规则书 8 面）、8 个扇区赢家奖励表、8 外星人配件数量与通用机制、11 家公司目录与能力、扫描码→颜色→扇区映射。

## 六、其他

- `randomizer/app/simulation-counterfactual-outcome.test.js` 在基线即失败（「正式结果目标根必须全部产生完整叶」断言，`node tools/run_node_tests.js` 中 64/65），与本次审计改动无关，另行排查。
- 审计期间并行工作区有他人改动（如 `tools/browser-smoke-inventory.js` 存在重复 id 的未提交修改），不在本清单范围。
