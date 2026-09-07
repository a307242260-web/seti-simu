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
| 公司额度/期限 | 一个回合只能借一项且结束失效；不能跨回合保留能力 | 跨回合计划须将借用延后到消费回合，不能在前一回合预借 |
| 消费后恢复 | 正式合法集与玩家旧计划不改 | 目标完成、奖励未结束、其他消费者仍可用时的计划清理义务 |
| 观察/缓存 | 已有橙3/4借用缓存修复必须保留 | 需求目录读取不得自行改真实player或泄露隐藏未来牌 |
| 预算与性能 | 4096物理/256队列/30秒不变，先50同根 | 额外用途目录成本须计入；不增加副搜索却漏记物理执行 |
| 验收 | 50有效简化85分路径可用；190/292/484保留真实收益 | 批量设计完成后unit/单点，之后唯一完整局>=108.5；当前不运行 |

本草案没有冻结“看到相应动作就借”的弱判定：动作存在不等于能力改善该动作，
反之当前动作不存在也可能被同回合卡牌/奖励解锁。实现前必须补完上述闭包与状态归属。
不改科技top3、不调启发式权重，不恢复已证实无收益的立即借用结束路径。

检查位置：players.js借用读取，industry/state.js与passives.js，
effects/residual-domain-session.js公司枚举/执行，abilities/rocket.js与planet.js，
actions/scan-effects.js全文，effects/science-session.js scanQueue/SCAN_ACTION_4及研究奖励，
abilities/scan.js scanAction4。当前仅源代码契约证据，不能充当全闭包行为验证。
生产未改；进度报告同步。无API/schema/运行方式变更，README/AGENTS与AI/RL设计无需修改。
