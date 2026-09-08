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

另否决一个过早简化：不能以mainActionCompleted单字段证明紫科技无消费者。
`fangzhou-card1-queue.buildFollowUpNodes`可把动态effect.scanAction转成正式
card_scan_action，不在cards.MODELS静态清单中。图灵消费者提取必须覆盖这个正式
动态入口，但不调整方舟槽位策略。此前242卡模型清点仍只证明其声明的静态范围。
当前没有对该动态入口做可达性或完整事务测试，不外推“主行动后必可扫描”。

检查位置：players.js借用读取，industry/state.js与passives.js，
effects/residual-domain-session.js公司枚举/执行，abilities/rocket.js与planet.js，
actions/scan-effects.js全文，effects/science-session.js scanQueue/SCAN_ACTION_4及研究奖励，
abilities/scan.js scanAction4。当前仅源代码契约证据，不能充当全闭包行为验证。
生产未改；进度报告同步。无API/schema/运行方式变更，README/AGENTS与AI/RL设计无需修改。
