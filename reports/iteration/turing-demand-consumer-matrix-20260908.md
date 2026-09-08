# 需求式借科技：正式消费者矩阵草案（2026-09-08）

状态：消费者与读取时机已定位，完整搜索绑定设计尚未闭合，禁止据此开始生产patch。
本项针对50/190/292/484的局部图灵压力，不代表通盘最大头或整体完成。

| 借用 | 正式消费者 | 真正用途与时机 | 不能采用的简化 |
| --- | --- | --- | --- |
| 橙1 | abilities/rocket.getRocketLimitForPlayer | 发射时提高数量上限；第二探测器可在同回合其他效果后才产生需求 | 当前只有一艘不等于无用途；不能只比较当前路线目录 |
| 橙2 | rocket.getRequiredMovePointsFromCoordinate及进入小行星奖励 | 出小行星减少所需移动点，进入小行星增加宣传，普通/免费移动共用 | 已有忽略小行星限制只覆盖出发成本，不自动覆盖进入奖励 |
| 橙3 | planet.getLandEnergyCost | 正式登陆费用计算时减能量，先执行公共环绕减费再取非负 | 卡牌免支付与普通登陆不能混同；已有环绕不必然使借用无价值 |
| 橙4 | planet.canLandOnSatellites | 卫星登陆合法性与具体来源/目标 | allowSatelliteWithoutTech来源可绕过需求，但不能据此删除其他来源 |
| 紫1 | scan-effects.buildScanEffectQueue→science.scanQueue | 整次扫描构建时将地球扇区改为地球/相邻扇区选择 | 借用不触发正式研究紫1时发放的2数据；队列已建后不能补入 |
| 紫2 | 同上，MERCURY_SECTOR_SCAN | 队列构建加入水星扫描；science.scanQueue还检查当时1宣传与来源 | 不只看根宣传不足；准备后创建扫描仍可能可用 |
| 紫3 | 同上，HAND_SCAN | 队列构建加入手牌扫描，之后选择具体手牌及扫描位置 | 手牌身份/后续资源准备不可当等价；不能默认所有牌值得消费 |
| 紫4 | 同上，SCAN_ACTION_4→abilities.scanAction4 | 队列构建加入发射/移动，在紫2/3前结算；发射1电、移动正式1移动点 | 扫描前可能无探测器但可发射；免费移动仍受地形所需移动点和目的约束 |

借用状态唯一owner是residual-domain-session turing_tech：合法选项只取未耗尽橙/紫
供应，提交写industryBorrowedTechTileId/Round/Turn，不消耗科技、不领奖、不旋转。
实际能力读取为players.playerOwnsTech和industry.passives.playerHasTechEffect，
各自接正式回合身份；借用到期由industry.state清理。永久科技有效/禁用与借用须分开。
紫科技只在buildScanEffectQueue构建读取，不能把扫描中的任意scanStep当作借用入口。
正式研究紫1的2数据位于science-session研究奖励流程，借用赋值不调用该流程。

| 跨边界义务 | 当前结论 | 尚缺证据/设计 |
| --- | --- | --- |
| 根/中间借用Decision | 通用decision目标会把八项当独立目标展开 | 将用途目标贯穿公司入口、借用选择、真正消费者的计划身份设计 |
| 卡牌/奖励嵌套 | 普通探测 primitive、整次scanQueue为复用入口 | 完整枚举能延后发射/移动/扫描的卡牌与followup闭包，不能只覆盖主行动 |
| 目标等价与去重 | 不改canonical state、RNG或实体来源 | 同一借用服务多目的时如何合并物理执行但保留所有来源 |
| 公司额度/期限 | 每轮仅一次公司额度，借用能力仅当前回合有效 | 跨回合计划须将唯一借用延后到消费回合，不能假设下个回合额度恢复 |
| 消费后恢复 | 正式合法集与玩家旧计划不改 | 目标完成、奖励未结束、其他消费者仍可用时的计划清理义务 |
| 观察/缓存 | 已有橙3/4借用缓存修复必须保留 | 需求目录读取不得自行改真实player或泄露隐藏未来牌 |
| 预算与性能 | 4096物理/256队列/30秒不变，先50同根 | 额外用途目录成本须计入；不增加副搜索却漏记物理执行 |
| 验收 | 50有效简化85分路径可用；190/292/484保留真实收益 | 批量设计完成后unit/单点，之后唯一完整局>=108.5；当前不运行 |

本草案没有冻结“看到相应动作就借”的弱判定：动作存在不等于能力改善该动作，
反之当前动作不存在也可能被同回合卡牌/奖励解锁。实现前必须补完上述闭包与状态归属。
不改科技top3、不调启发式权重，不恢复已证实无收益的立即借用结束路径。

## 卡牌入口与额度补充核对

`industry.state.isIndustryActionMarkedThisRound`仅比较round，不比较turn；借用有效性
则同时比较round/turn，residual-domain-session的回合结束清理会清除借用字段。
需求规划必须区分“本轮未使用额度”和“本回合当前有效能力”两种状态；不能每回合重开。

| 卡牌正式效果入口 | 共享执行路径 | 对借用设计的约束 |
| --- | --- | --- |
| SCAN_ACTION | cards/play-domain.createSpawnedCardEffect→science EXECUTE family=scan→scanQueue | 整次扫描，必须在队列构建前借紫科技；skipCost不取消紫效果 |
| PUBLIC_SCAN | 同转换函数→science SCAN_STEP mode=public | 不是完整扫描，不能仅据此生成紫1-4用途 |
| SCAN_NEBULA / ANY_SECTOR_SCAN / SCAN_COLOR_CHOICE | SCAN_STEP指定/任意/颜色模式 | 同上；不附加紫4发射移动等完整扫描后继 |
| PLANET_SECTOR_SCAN / LANDING_SECTOR_SCAN / PROBE_SECTOR_SCAN / CONDITIONAL_SECTOR_SCAN | SCAN_STEP对应模式；probe可附带回手条件后继 | 单次扫描不消费紫科技；回手后同回合再次打牌属于另一个用途，不得忽略 |
| LAUNCH | card LAUNCH executor→rocket.launchProbe | 按正式火箭上限判断；满额可跳过该效果但继续其余效果，借橙1可改变能否发射 |
| 卡牌行星选择 | card resolvePlanet→planet.orbitProbe/landProbe→正式星球奖励 | 不能把卡牌登陆当成普通付费登陆；options决定免付费/卫星权限，奖励仍要保留 |
| CARD_MOVE / FREE_MOVE / COUNT_HAND_CORNER_MOVE / EARTH_SECTOR_CONTENT_MOVE | card movement owner→正式移动原语 | 移动力数量、来源、目标和支付必须保持，不读文案识别用途 |

上述是正式入口的正向证据，不是所有卡牌/触发器闭包已经枚举完成。未完成项缩小为：
从公开卡牌效果、实际效果队列和具名目标提取可消费需求的统一入口；后继产生新牌/
回手/额外发射时的恢复；一个借用对应多个目标的origin携带。不得新建另一份卡牌DSL
解释器来填补它们，也不得通过“所有疑似扫描都保留”冒充需求式生成完成。

## 现有解析与来源合并的约束

`cards.effects.buildPlayEffects`仅展开model.playEffects的repeat，不包含triggers/tasks。
已对当前242个MODELS做静态相关效果位置清点，共73张出现探测/完整扫描等相关效果；
其中b2、b20、b25、b26、DLC24、DLC33的相关效果只出现在触发奖励，buildPlayEffects
中没有。故复用现有cardHasFreeLaunch的顶层some只能证明直接发射，不能据false
判定该牌或已打出的任务没有借用消费者。目录包含动态/异常点类型作待审项，非全部
效果都适用图灵，不据匹配数量推断可达性或收益。
静态证据：[卡牌消费者位置清单](turing-card-consumer-inventory-20260908.json)。

`rule-composition.exactNodeKey`用完整envelope、actionId、剩余深度、focalSeat；同一
借用物理动作服务多目标可以共用执行，但`originKey`只含根/当前target+plan、
movementPreparation、深度及pass/完成/隐藏标志。任意额外purpose字段不会参与身份。
`mergeNode`会按现有originKey合并并保留较优路径，所以新增用途状态若不进入正式
origin身份/传播/计划捕获链，会静默丢掉不同后续约束。不得借用movementPreparation
字段放图灵内容，也不能仅在目标名里塞标签而不实现消费/完成语义。

## 用途状态方案裁定（源码复核，未实现）

选择独立的搜索侧`borrowDemand`，不复用或改写`routeTargetId/routePlanId`，不写入
正式游戏envelope。理由不只是“缺少字段”：当前目标完成后，普通后继调用会主动
传入空target/plan（rule-composition约2964行），而借用是否消费取决于正式能力读取。
例如紫科技在完整扫描建队时读取，不等于最终扇区胜利目标完成。目标完成标志不能
兼任借用消费标志；同一目标/来源也可能有不同借用用途。

拟定最小身份：actorId、tileId、round、turn、consumerKind、sourceId、targetId、
planId。sourceId必须取现有真实卡牌/探测器/扫描来源身份，不用卡牌类型替代实体。
round/turn是借用有效期而非公司额度恢复期。无待消费需求用null；已消费后清空
搜索约束，正式借用仍由规则状态保持到期，允许同回合继续使用，不强制只消费一次。
消费者类型和sourceId取值目录仍需由完整提取方案定义，不能先写字符串特判。

| 边界 | 必须实现的行为 | 现有源码依据 / 可证伪证据 |
| --- | --- | --- |
| 公司入口 | 先生成有具名消费者的需求，再绑定同一正式industry输入；不先扩八选再找理由 | expected-score-evaluator.selectSecondaryAgentSuccessors的bindRoute当前只有路线三字段；根入口也须同契约 |
| 物理合并 | demand参与originKey，不参与exactNodeKey；相同正式状态和动作执行一次，不同需求分别继续 | 当前originKey只认movementPreparation等已列字段；必须测同节点两个需求都保留及真实执行数为1 |
| 条件Decision | 传入当前demand；借用选位只接受对应tile；后继显式继承或清空，不靠缺字段默认null | conditionalRoutes当前只映射路线和movementPreparation，任意扩展字段被丢弃 |
| 普通后继 | 目标完成清路线不自动清demand；消费者尚未发生时不能凭目标计数当成已消费 | 普通selectSuccessors在completedGoal时清路线；其selectedRoutes再次限定字段 |
| 消费确认 | 只在正式对应能力确实改善权限、成本、奖励或扫描队列时完成；“执行过move/scan”不足以证明 | 橙2出发费用与进入奖励独立；紫能力建队读取与后续扫描选择分离 |
| 期限 | 未消费需求不得作为跨回合目的继续携带；借用前的跨回合准备可延后使用本轮额度 | 图灵每轮一次、能力本回合有效；正式结束清理不由搜索替代 |
| 计划捕获 | 逐次真实提交记录提交前需求及正式消费证据，不用整批执行后的状态回填前面的输入 | rule-composition约2500行按probeSteps编译，一物理节点可含多个正式输入；capturePlanStep本身只读observation/action |
| 计划复用 | 核验有效期、公司额度/已借状态及具名消费者依赖；失效重搜，不在真实提交阶段偷偷换科技 | plan-continuation.stepScopes仅识别既有目标及movementPreparation，未知目标前缀会拒绝；须新增独立依赖而非伪装目标 |
| 已开启公司/旧计划 | 正式已开启Decision继续按合法集结算；不要求旧计划凭空带上新需求，不制造空Decision | 现有selectNonredundantTuringActions保留此恢复边界；新候选生成与既有正式会话须区分 |

风险与否决门槛：仅增加上述状态不会减少节点，反而可能增加来源数。若最终实现
仍对每个用途重复展开公司/借用物理动作，或只到叶末才丢弃无用途路径，就不满足
需求式生成目标。需要同时证明入口按需求收敛、物理合并和额外目录耗时；不能用
更多origin掩盖相同的4096截断。第50步85分链保留是必要条件，不是整局验收替代。

本次关闭的是“复用路线字段还是独立状态”的设计选择，不是完整开发设计。
剩余生产门禁为：公开卡牌/已打出任务/待执行效果的统一需求提取闭包，以及各消费者
可达性与真实改善证据的精确定义。若提取必须建立第二份规则解释器，该方案应否决，
回到正式只读能力接口设计；不得以静态73张匹配清单直接实现剪枝。

## 触发匹配复用边界（正式函数行为验证）

`collectMatchingTriggers`与`collectReadyTasks`均会调用`ensureCardEffectState`，
不是可直接喂冻结observation的纯函数。`task-state`的list/refresh入口也会初始化。
需求提取若复用这些函数，必须在私有分支数据或隔离副本上调用，不得修改共享观察，
也不得把匹配阶段的初始化/奖励消费写回正式游戏。无需另写event条件匹配逻辑。

已运行`adhoc/verify-turing-trigger-contract-20260908.js`，结果落在
[触发契约检查点](turing-trigger-contract-20260908.json)。六张牌的相关入口为：

| 卡牌 | 正式事件 | 匹配项数 | 对需求的意义 |
| --- | --- | ---: | --- |
| b2 | 访问非地球行星 | 3 | 能量/数据/移动择一，不能把三项同时计入准备资源 |
| b20 | 发射 | 3 | 三个独立移动奖励槽，单次事件不是自动获得三次移动 |
| b25 | 对应颜色signalMarked | 1 | 绑定实际扇区颜色事件，不以“存在扫描动作”代替 |
| b26 | 移动角标cardCorner | 1 | 绑定角标事件，不是任意打牌或任意资源角标 |
| DLC24 | 研究橙色科技 | 2 | 两个发射槽择一；借科技本身不产生研究事件 |
| DLC33 | PASS | 1 | PASS奖励链可能含发射，不能把PASS动作名当作已经完成过期清理 |

每张均验证了正例、错误事件不匹配、来源牌不能触发自身、消费一个槽后排除该槽、
相同卡牌类型的第二个实体仍独立匹配，以及私有副本初始化不改变原输入。
这些是正式匹配函数的契约证据，不是事件在固定盘面可达或借用收益的证明。

正式调度的`residual-domain-session`把同事件的多个match装为一个
`accept_optional_effect`选择，其source身份是cardInstanceId+ruleId。需求生成必须
保留此互斥关系，不能将每个match视为必得奖励再合并资源下界。已发生事件与尚未
发生事件也须分开：前者复用正式匹配，后者必须来自具名计划及实际执行证据，
不得为了发现消费者而伪造visitPlanet/researchTech等事件输入生产匹配器。

PASS期限已有完整正式事务证据：PASS_COMMIT产出pass事件后，即时触发Decision
在公司turn_end清理前结算；不能只按回合末handoff中company先于card_trigger排序
推断所有卡牌触发都在借用失效后。`adhoc/verify-turing-pass-consumption-20260908.js`
使用真实第50步根派生fixture（增加DLC33保留牌，将现有探测器改属蓝方），分别
不借用及正式启用图灵借橙1，再走正式PASS、预留牌选择、接受DLC33发射与回合推进。

| 对照 | DLC33奖励选择前 | 完成PASS后 | 判定 |
| --- | --- | --- | --- |
| 不借用 | 1艘、无借用 | 1艘、无借用 | 普通上限已满，卡牌发射按正式规则跳过 |
| 借橙1 | 1艘、橙1仍有效 | 2艘、借用已清空 | PASS即时奖励真实消费借用，之后正常失效 |

两条事务均完成并推进到棕方；唯一触发槽消费后DLC33移出保留区，完成任务数+1。
证据：[正式PASS对照](turing-pass-consumption-v2-20260908.json)。原始fixture一并保存，
不冒充历史第50步曾有DLC33，不是AI搜索、历史降分因果或性能测量。
首次诊断错误断言“消费标志仍可在保留牌中读取”，实际卡牌按规则移出保留区；
失败记录[turing-pass-consumption-20260908.json](turing-pass-consumption-20260908.json)
保留，修正诊断为保留区移出及完成数验证后通过，未改生产规则、未重跑AI完整局。

据此收敛期限契约：未消费需求的截止点是正式借用清理边界，不是提交PASS的瞬间。
PASS即时奖励消费必须保留；company.turn_end之后不得继续沿用该需求。仍需按八种
消费者完成统一需求提取与改善证据，不能把这个单一事务外推成全部设计已闭合。

## 入口接入位置复核

复用第50步85分完整链的16个已有逐步观察/合法集，调用候选954e51c0的目标目录：
11处可合法启用图灵，11处均没有任何compatibleActionIds绑定该入口。逐处输入
调用前后完全一致，根选择与目录准入一致；检查点为
[turing-entry-bindings-20260908.json](turing-entry-bindings-20260908.json)，脚本
`adhoc/profile-turing-entry-bindings-20260908.js`。这不是新运行4096搜索，也不把11处
机会计为全树无用节点数。

源码解释：`selectSecondaryAgentRootActions`仅准入目标目录兼容的输入；树内未绑定
后继却允许industry回补（UNTARGETED_MEANS_ONLY_FAMILIES只有quick_trade/card_corner/
move）。借用Decision再被通用conditional规则设为独立decision目标，目标未指定
具体能力消费者。由此确定必须成套改动的接入点：

1. 根目录生成具名借用需求，把公司入口挂到真正消费者；不能只改树内选择。
2. 树内无目标回补排除图灵入口，同时从相同需求目录补入有目标入口；不能直接删
   所有industry，否则丢失尚未进入根目录的有效借用以及其他公司能力。
3. 借用Decision继承需求，只允许对应tile，不登记为无用途的decision目标。
4. 正式已开启Decision继续按恢复契约结算；目的在消费/到期边界完成，不能等同
   任意conditional选择完成。

方舟补充纠错：`fangzhou-card1-queue.buildFollowUpNodes`能够生成card_scan_action，
但“生成器存在”不代表正式链已接入。追加正式play_card复现表明原候选954e51c0的方舟card2
仅扣费弃牌，未翻高级奖励，详见[独立缺陷](fangzhou-play-missing-reward-review-20260908.md)。
此前将它称为“正式动态入口”证据不足，撤销该历史表述。现在独立修复4d3711c5已
接通9种高级奖励并完成规则验收，见[独立验收](fangzhou-major-full-review-20260908.md)。
它增加12个解锁牌模型（共254），完整扫描奖励现在是正式可达消费者；不调整方舟
槽位策略，不依据旧版漏执行收益裁掉借用消费者。原静态242卡清单是修复前证据，
不再代表当前全部模型。mainActionCompleted是否能证明特定需求不可达仍须基于
完整正式闭包，不能由旧版未实现奖励外推肯定或否定。借用提取设计仍未闭合。

## 现有目录的复用边界（正式对照，2026-09-08）

已在候选81ee9ed6上复用第50步真实根，以及从该根正式发射一步后的状态；每种状态
分别正式启用图灵并选择八种科技，共16组对照。没有添加手牌、伪造事件或运行AI。
读取目录和正式能力前后全envelope保持一致。脚本：
`adhoc/inspect-turing-directory-delta-20260908.js`；证据：
[目录差分](turing-directory-delta-81ee9ed6-20260908.json)。

| 借用 | 探测目录变化 | 扇区目录变化 | 正式能力变化 |
| --- | --- | --- | --- |
| 橙1 | 无 | 无 | 探测器上限1→2；当前0艘或1艘均如此 |
| 橙2/3/4 | 有 | 无 | 路线成本或端点准入由现有正式目录反映 |
| 紫1 | 无 | 有 | 整次扫描首效果改为改进地球扫描 |
| 紫2/3/4 | 无 | 无 | 整次扫描效果队列分别增加水星扫描、手牌扫描、发射/移动 |

两种根上的结果一致。这里的“正式能力变化”来自正式能力/队列构造函数，
不声称16组都已实际消费奖励，更不把队列存在等同于当前付得起、值得执行。

**否决仅以目录差分作为无用途剪枝依据**：扇区目录对可访问扇区取集合，额外扫描
次数和手牌来源可以变化而集合不变；紫4本来就不是扇区访问项。探测目录仅在
activeRockets.length===0时加入launch来源，不能表达借橙1后的第二艘发射目的。
现有目录可以复用橙2/3/4路线与费用，不能单独充当八种能力的完整需求目录。

后续设计据此固定两条要求：扫描需求复用正式效果描述，保留次数、来源与顺序，
不使用sectorIds集合代替；橙1需求绑定具体发射来源和当时上限占用，不能用
当前probe候选有无变化代替。调用正式函数后得到的额外候选仍需可达性证明。
本对照仅否决一种有反例的实现方案，不批准逐节点做八个fork，也不新增规则解释器；
生产需求提取与绑定尚未实现，节点减少、分数及完整性仍无新结论。

## 最小能力改善判定输入（2026-09-08）

以下约束用于下一步需求提取设计；尚未接入搜索。改善判定与“消费者能在本回合
执行”分别证明，不能以有改善取代资源/路线/主行动状态的可达性检查。

| 能力 | 必须保留的输入 | 正向改善证据 | 明确不能算改善 |
| --- | --- | --- | --- |
| 橙1 | 发射来源及options、当时正式活动数量、上限、地球空位、支付资源 | 不借时仅因上限不可发射，借后该具名发射可执行 | ignoreRocketLimit=true；未达到原上限的本次发射 |
| 橙2 | 探测器、路线具体边、来源options、当回合movementModifiers、宣传状态 | 正式移动点减少，或该边进入小行星产生实际宣传收益 | 仅因存在move就算；忽略出小行星限制也不能顺带忽略进入奖励 |
| 橙3 | 登陆来源options、具体星球/卫星、环绕状态、当前支付成本 | 同一端点的正式cost.energy严格减少 | skipCost=true或固定自定义费用不变；只比较未覆盖options的energyCost字段 |
| 橙4 | 卫星身份、来源options、现有占位及重复登陆权限 | 同一卫星不借无权限，借后符合正式准入 | allowSatelliteWithoutTech=true；主星登陆 |
| 紫1 | 完整扫描来源、正式首扫描来源、具体备选扇区/槽位 | 具名扫描能够选择原先不可选的相邻扇区 | 只因队列type改变就算最终消费；最终仍选原地球扇区 |
| 紫2 | 完整扫描来源/顺序、水星位置、建队时宣传、扫描次数 | 队列保留水星追加扫描，并实际选择执行 | 只有地理来源但建队时支付不足或后续跳过 |
| 紫3 | 完整扫描来源/顺序、届时已知手牌实体与scan code、扫描位置 | 队列保留手牌追加扫描，并消费具名手牌选择 | 用公共牌/同类型牌替代该实体；用未知抽牌牌面生成用途 |
| 紫4 | 完整扫描来源/顺序、具体发射或移动需求、能量/上限/路线地形 | 正式紫4Choice可执行且推进具名发射或路线 | 只有任意移动方向可用；把地形需2移动点的方向当1步免费可达 |

正式复用位置：发射使用getActiveRocketCountForPlayer与getRocketLimitForPlayer；
移动使用getRequiredMovePointsFromCoordinate及正式进入奖励；登陆使用带原options的
listLandRequirementsAt；扫描使用buildScanEffectQueue及science.scanQueue的来源、费用
和Choice准入，不能在AI中重写这些条件。实际公司额度仍按round，消费期限按round/turn。

当前254模型的直接效果参数已核对：6张CARD_LAND（b29、b34、b91、DLC1、DLC6、
DLC31）全部skipCost=true，故这些具体登陆步骤不构成橙3需求；b34还明确
allowSatelliteWithoutTech=true，不构成橙4需求。b37两个LAUNCH均ignoreRocketLimit=true，
不构成橙1需求。不能将这一步的否定外推为整张牌/整个回合没有其他能力消费者。
动态方舟奖励、触发和任务不在该直接效果清点范围。证据：
[直接效果参数](turing-consumer-options-81ee9ed6-20260908.json)，脚本
`adhoc/inventory-turing-consumer-options-20260908.js`。正式模型构建前后卡表不变。

## 接入与消费确认补充（2026-09-08）

正式双发反例已完成：从既有第50步根增加b37派生fixture，分别不借、正式借橙1后
打牌，两条正式事务都产生同样的两次launch事件（同rocketId及source=card），
pieces、资源、手牌和RNG完全一致。借用后的公司额度/科技字段本来不同，未声称
完整游戏状态相同。证据：
[正式双发对照](turing-launch-consumption-81ee9ed6-20260908.json)，脚本
`adhoc/verify-turing-launch-consumption-20260908.js`。不运行AI，不作为历史轨迹。

因此消费确认不能复用现有probeSteps.executionEvents的“出现launch/orbit/land”
布尔判定。该流还会丢弃move和扫描事件；launch事件自身没有ignoreRocketLimit、
cardInstanceId或原效果参数。必须在正式消费者的执行时机取得原来源/options及改善
证据，再与当前需求匹配；不能在宏节点完成后从最后的cardPlayContext反查整批来源。
一物理节点可包含多次正式输入；每次输入的消费前后状态须分别推进，并对所有共用
物理执行的origin复用同一事实，不为每个需求重执行一次。

落实时必须同时覆盖以下具体入口，不能只在后继对象上添加字段：

1. `enumerateSecondaryAgentRootTargets.add`当前只按planId合并，需区分同计划不同
   borrowDemand的记录；普通无借用记录与借用准备记录不能互相覆盖。
2. `rootTargetsByActionId`到`initialFrontierByKey`的origin初始化必须保留需求。
   物理节点仍按envelope/action/depth合并，需求进入originKey，不改变物理键。
3. 条件/普通两处selectSuccessors调用都传入需求；两处selectedRoutes字段映射
   显式保留需求及其清空结果，不能把缺字段和已完成都当null处理。
4. 目标完成可清routeTargetId，但不自动结束尚未消费的借用需求。消费及正式到期
   分别判断；PASS奖励可能早于到期，已经证明不能提交PASS就清空。
5. 逐输入计划捕获保留当时需求，compilePlanSteps独立添加借用额度/有效期/来源
   依赖，不受目标分段提前截断；不把新需求前缀伪装成旧route目标。

以上关闭了字段传播和“事件即消费”的接口歧义，不代表完整需求生成已实现。
仍缺消费者执行时证据的统一生产读取方案与公开来源的完整提取，禁止用宽泛launch/
scan事件、卡牌文案或最后状态作替代。此处不引入另一套规则执行器，不增加搜索预算。

检查位置：players.js借用读取，industry/state.js与passives.js，
effects/residual-domain-session.js公司枚举/执行，abilities/rocket.js与planet.js，
actions/scan-effects.js全文，effects/science-session.js scanQueue/SCAN_ACTION_4及研究奖励，
abilities/scan.js scanAction4。当前仅源代码契约证据，不能充当全闭包行为验证。
生产未改；进度报告同步。无API/schema/运行方式变更，README/AGENTS与AI/RL设计无需修改。
