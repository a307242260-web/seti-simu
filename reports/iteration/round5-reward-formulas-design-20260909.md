# 第五轮：条件、次数与数量奖励计算表

2026-09-09。状态：正式次数/公式已核对；估值计算提案，尚未接入生产。
证据：round5-reward-multiplicity-20260909.json，生成脚本audit-round5-reward-multiplicity-20260909.js。
核对覆盖182张牌、244个顶层效果、65个持续触发槽、45个任务槽（25类条件）、
3张临时任务牌、16个事件奖励、17张终局牌（10类公式×4席=68次正式计算）。
不是新一局模拟，也不是节点/分数/完整性验收通过。

## 统一计算顺序

1. 输入先按正式知识边界遮蔽。未知牌立即返回普通6/外星12，不解析其牌面。
2. 读取原始模型playEffects一次，支付打牌费用、本牌离手，然后按模型顺序计算。
   原始options.repeat只乘一次。若改用buildPlayEffects，则被展开的repeat已变为1；
   public_scan/any_sector_scan/probe_sector_scan/noAutoRepeatExpansion由handler保留倍数，不能再按展开数乘第二次。
3. 资源、手牌、收入、科技及标记计数取该效果执行时的公开状态，不统一取打牌前快照。
   只更新纯计算所需事实，不执行规则，不预测别人的行动，不生成牌面、RNG或实体ID。
4. 确定效果用全值；任务、持续触发与终局预期半值。已打出的即时效果不重复计入。
5. 净值N=收益−非本牌成本−6；手牌机会值H=max(收益−非本牌成本,角标)。
   实际支付或精选比较H，正式叶的资源/手牌变化已计入V时，不另加这次“方案收益”。

倍数守恒审计通过，不意味着额外条件已满足。例如repeat=3只是最多三次授权，
没有合法目标、需要支付或选择跳过时，不得擅自生成三次实际收益。

## 条件和未来数量：尚需统一的估值假设

下列是推荐的初始口径，**尚不是用户确认或已上线规则**：

- 即时条件按效果到达时的公开事实判断；不把“先不考虑收益是否需要”解释为忽略触发条件。
- 数量型终局按当前公开数量套正式公式，再乘0.5；暂不预测未来增长。
- 临时事件奖励不假设无限触发。一次性奖励最多一次；可重复事件先按一次合格机会估值，
  属于远期模型假设，不改变正式事件规则。已有实际目标路线时用路线事件，不凭牌的移动力
  捏造访问次数；这一项不得反过来扩展无目的移动目标。
- 卡牌扫描7建议包含通常获得的1数据6；不获数据的信号值1，公共额外扫描单位6。
  此项会改变扫描牌的排序，不能把另一种“纯信号7、数据再加6”的解释静默混入。

当前仍保留两套扫描算例；最后三项实现门禁中的数值口径不能靠测试程序替用户拍板。

## 任务与事件的次数、归属

| 类别 | 正式次数/状态 | 初始估值公式或边界 |
|---|---|---|
| 持续触发65槽 | 每个trigger.id最多消费一次；已消费ID不再可领 | 0.5×未消费槽奖励之和；同一事件能选多个槽不意味着每槽无限触发 |
| 普通任务45槽 | 每个task.id完成一次；completedTaskIds排除 | 0.5×未完成任务奖励；不因为当前未满足就取消全部远期预期 |
| 临时扇区任务3张 | 本卡完成扇区达到阈值后，每个临时任务领一次 | 0/1/2/8个结算的正式奖励数已验证为0/1/1/1；不是每个扇区领一次 |
| onceKey事件 | 领取后记录claimedKeys | 至多一次，不能因再次访问重复计入 |
| distinctBy事件 | 每个usedKey至多推进一次 | 只计不同地点；相同地点不再贡献 |
| minCount事件 | 达阈值前仅推进；达到后领取键锁定 | 《双行星飞越机动》是达2个不同行星领一次3分，不是第二个起每次3分 |
| 无领取键的扫描事件 | 每个符合颜色的真实信号事件可奖励 | 次数跟随该卡扫描；标准扫描替代费用之外只加明确额外分，不再加基础扫描收益 |
| 移动修正空rewards | 没有直接资源奖励 | 《无视小行星惩罚》按实际路径节省费用，不按“事件匹配一次”给移动奖励 |
| 宣传换移动followup | 访问奖励宣传>0才产生支付机会，每次付1宣传换1移动 | 每次净值=移动5−宣传4；不能只看到空rewards当0，也不能把移动当免费 |

正式来源：cards/effects的collectTemporaryTaskRewards、consumeTrigger/completeTask；
effects/residual-domain-session的describeEventBonusProgress与augmentEffectResult。
审计重放16种bonus各4个事件，并验证错误owner、重复地点与领取后状态；资格判断不修改输入。

## 动态数量和转换的公式

记U为共享单位函数，M=普通牌平均6，K为角标价值，I为剩余发放窗口价值。
本表是模型收益公式；实际搜索后状态仍由规则计算，不能靠本表执行游戏。

| 效果（card_前缀省略） | 计算与次数 | 关键边界 |
|---|---|---|
| count_hand_income_resource | 本牌离手后匹配收入角的已知手牌数×per×U | 未知牌不能读取真实收入角 |
| count_current_income_resource | 本效果时收入减公司基础收入，再×per×U | b42/b47/b79均在本牌插收入前计数 |
| count_aliens_resource | 正式玩家痕迹计数×per×U | 不是已揭示外星人数量 |
| earth_sector_content_move | 地球同扇区的行星/彗星数量×5，不含地球 | 已修复首次冻结额度；不按默认1计 |
| count_hand_corner_move | 正式可展示的已知移动角手牌数×5 | 展示不弃牌；未知牌不能用于预知额度 |
| count_rockets_reward | 正式countRocketsForReward×per×U | 尊重owner/location及虫族运输化石选项 |
| count_owned_tech_reward | 指定颜色已拥有数量×per×U | 按正式计数，不能把已禁用科技从“拥有”中删除 |
| count_tech_types_reward | 正式选项定义的颜色计数×per×U | DLC34取数量最多的颜色，不是颜色种类数 |
| conditional_reward | 条件判定后才算rewards | DLC27是效果当时能量为0，不是最初能量为0 |
| probe_location_reward | 在正式可选自己探测器中选一种位置奖励 | 不把所有探测器奖励相加；普通/邻近/位于小行星为0/1/2数据 |
| probe_stack_reward | 正式getProbeStackRewardMatch为真则领一次 | 多对重叠也不把3分乘对数 |
| income | 选一张手牌插入收入的即时发放及未来I，扣一张手牌机会 | 和普通“再发一次收入”不混淆；具体发放由正式INCOME流程定义 |
| tuck_played_card_to_income | 本牌已离手，按本牌收入角增加I及正式即时发放 | 不再扣第二张手牌，也不能再增加打出收益 |
| pick_card_corner_reward | 获得1牌的模型均值+所选公开牌K | 同时得到牌和角标；不是必须弃掉精选牌才有角标 |
| choose_hand_corner_reward | 选一个仍在手的已知牌K | 不弃牌，不扣M；互斥角标取一个 |
| draw_then_scan | 每次盲抽+合法扫描或跳过弃置的组合 | 抽牌前只用均值，不读取抽到的扫描颜色；repeat已展开 |
| discard_public_corner_rewards | 每次所选公共牌K | 不扣自己的手牌；补牌后未知牌面不能预读；count与repeat不能混为一谈 |
| optional_discard_scan / hand_scan | 可选的一次扫描收益−所弃手牌成本，允许0 | 选择方向不是只看最低牌值，还要看合法扫描效果；不得依据count字段臆造多次选择 |
| discard_card_corner_repeat | 一个非外星人手牌的3×K−手牌成本 | 本牌之外另弃1张，不能把3倍角标当3次弃牌 |
| discard_any_for_income | 所选弃牌收入角的**一次性**资源之和−弃牌成本 | 不增加永久收入；全部弃完再发牌，奖励新牌不参与这次弃牌 |
| discard_all_hand | rewards整组一次−剩余全部手牌成本 | DLC32不是每弃1牌抽2牌；奖励不乘弃牌数 |
| pay_credits_for_reward | 0到效果时可付钱数中选收益−支付最大值 | DLC17每付1钱得2分2宣传，次数有限；不乘折半概率后漏扣成本 |
| return_played_card_to_hand_if | 条件成立返还一个本牌实体 | 不递归计算“返还后再打再返还”的无限价值；估值用返还基础牌值而非递归H |
| return_unfinished_task_to_hand | 选一个正式可回手对象，手牌机会−原来未领取收益 | 保留该牌已消费状态，不能把其全部任务重置为未领取 |
| remove_planet_marker | 移除一个允许种类的自己标记，计失去的当前标记价值 | 不倒扣过去已领的分数；合法种类以正式规则为准，不能默认全种类 |
| pluto_reserve | 解锁两个各一次的独立行动机会 | orbitDone/landDone排除已消费能力；不是免费获得环绕和登陆奖励 |

前8类详细正式计数时机见round5-counted-rewards-20260909.md。
基础资源/扫描/标准行动公式分别延续card-value-topic及standard-action-values设计，
8个嵌入参数（研究后奖励、痕迹后奖励、登陆后奖励等）继续遵守contract文档，不遗漏。

卡牌互相消耗还需要保持无递归依赖：模型内部“花一张牌”可用平均M计算初始模型；
实际已知支付候选再用H比较。不能让A估值调用B，B又经精选/回手反向调用A。
该拆分需在生产设计冻结时统一收入、弃牌及旧V消费者，不做只改一个入口的局部上线。

## 十类终局公式与输入

统一正式入口end-game-scoring.scoreCardEndGameRule；卡牌在手时的半值是提案，
已打出终局牌仍由正式scoring投影全值计入一次。以下不另建AI版计分公式。

| kind | 公开输入与正式基数 |
|---|---|
| sectorWinsByColor | data.sectorSettlements中本人对应色胜利记录数 |
| traceCount | aliens中本人的指定颜色痕迹数 |
| techCount | 本人ownedTiles中对应颜色的已拥有科技数，含禁用科技 |
| planetOrbitOrLand | 指定行星的本人环绕/登陆/正式卫星标记数 |
| distinctSignalSectors | 本人在nebulae.tokens与sectorExtraMarks中出现的不同扇区 |
| probeLocation | 正式太阳系+探测器位置判定，命中给固定13分，否则0 |
| unmarkedFinalRightmost | 本人尚未标记的终局板块，正式公式×最右档倍率之和 |
| remainingResource | 本人对应资源当前数量×scorePer |
| planetLandingPairs | 达到指定登陆数量的行星个数×scorePer，不是每两枚标记算一对 |
| allOrbitOrLand | 正式全部环绕/登陆标记计数，按正式规则含冥王星与奥陌陌 |

本次直接复用已归档完整局终局公开状态，为17张牌各计算4席结果并保存；
这些是公式检查，不是假设这17张牌实际都在四席手上，也不是预测终局收益。
scoreUnmarkedFinalRightmost会ensureFinalScoringState，部分外星计数也会初始化；
所有正式计分调用在隔离的公开状态副本上运行，原盘面深比较保持不变。
生产接入需避免每次每牌深拷整个游戏：每次观察构建一次隔离计分事实，不得携带隐藏牌库。

## 本轮结论与实现边界

倍数/领取次数与10类正式终局公式已完成统一审计，未启动全盘或改变生产代码。
剩余不是继续逐张审计，而是确认上述数值假设，并将一次性模型计算与实际H支付选择
作为同一个完整方案接入；不把设计目录覆盖当作实现正确或性能通过。

文档一致性：更新本设计、contract、Goal计划、卡牌专题与迭代中心；
README、AGENTS、AI/RL接口、运行手册及生产注释检查后无需修改，因为本轮无生产行为变化。
