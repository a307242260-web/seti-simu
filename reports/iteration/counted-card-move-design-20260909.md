# 数量移动额度修复设计

2026-09-09，独立规则修复设计，尚未实现，不包含第五轮权重或选牌贪心。

## 规则来源与复现

已直接查看本地原始牌面assets/cards/basic/split/b_98.webp和b_87.webp。
发射前试验：发射后，每展示一张手牌中具有移动自由行动角效果的卡牌，获得1移动。
最佳发射窗口：发射后，地球所在扇区每个其他行星或彗星，获得1移动；地球本身不计。
这与两张牌现有模型一致，缺陷发生在执行额度，而非卡面录入。

正式复现检查点：counted-card-move-reproduction-20260909.json（b98：0/2都给1）；
counted-card-move-window-reproduction-20260909.json（b87：火星和彗星共2，却给1）。
后者仍使用原始太阳系旋转，无额外盘面摆放；完整输入与内容位置保存在JSON。

## 完整有限集合与职责

移动家族来自play-domain.MOVEMENT_EFFECT_TYPES，只有CARD_MOVE、FREE_MOVE、
COUNT_HAND_CORNER_MOVE、EARTH_SECTOR_CONTENT_MOVE四类。所有顶层/奖励/触发移动
共用createSpawnedCardEffect→genericExecute→listMoveChoices→resolveMove；继续步由
resolveMove直接生成带remaining的同类Decision。非这四类getMovementAllowance返回null。
唯一正式owner保持card_play，Browser与Simulation仍共用Production factory。

| 场景 | 额度来源 | 实现义务/可证伪证据 |
|---|---|---|
| 固定移动初次执行 | options.movementPoints，既有省略默认1 | 全部固定移动模型与原额度相同；不改费用/路线选择 |
| 手牌计数初次执行 | 此时actor.hand中正式getDiscardActionMoveRewardForCard可提供移动的牌数 | 每牌计1，不累加角标移动量；打出的本牌已离手；0/2例修复为0/2 |
| 扇区计数初次执行 | solar.createSolarSnapshot.visibleContents，x等于地球x，kind为planet/comet，排除earth | b87原盘面额度2；不把小行星、星云、太阳或地球加入 |
| 创建初次移动Decision | 将初次计算值写入payload.remaining | 读盘面只在初次初始化；开始后的奖励/转盘/手牌变化不能增加额度 |
| 额度0 | 正式效果完成，不提供移动Decision | 零手牌例不可凭默认值移动；事件记录0额度正常完成，非异常失败 |
| 后续移动 | remaining−本次正式requiredMovePoints | 两步1点各自扣减，2→1→结束；不能每步重新计算初始数量 |
| 提前结束 | 正式skip | 不返还额外资源、不再派生同类移动Effect |
| 探测需求读取 | production-kernel.readProbeMovementContext调用同一额度函数 | movementContext.cardRemaining与正式Decision完全一致，不另算AI额度 |
| 保存/恢复 | Effect payload保存remaining；初始未执行Effect仍按当前正式root初始化 | 第一Decision和中间剩余1的恢复均保持合法输入、额度、后续日志一致 |

getMovementAllowance需接受初始计算所需正式root；有remaining时只读它（允许0），
无remaining时才解析四类初始额度。genericExecute在生成初次Decision前保存计算结果。
listMoveChoices与production-kernel共享这个读取函数，不分别实现计数。
不得依赖DOM、全局玩家或AI观察补齐正式状态；缺少必要owner/盘面事实必须显式报错。

## 状态、事务和删除义务

- 不新增玩家字段/缓存；新额度只存现有Effect payload.remaining。RNG、实体ID、sequence
  不参与纯计数；正式移动仍由abilities.executeAbility(moveProbe)执行。
- 卡牌成本、本牌离手、发射与奖励的原事务顺序不变；初始计数位于前序效果完成之后。
- Decision仍归actor、沿用正式owner/version/stale验证，不添加自动择方向或旁路提交。
- 删除数量移动落到默认1、remaining被最低1抬高的旧判定；不保留第二份数量额度算法。
- 不改搜索4096/256、权重、状态去重或节点计数。实际执行每次输入仍正常记录。
- 不提前修所有动态卡牌；本方案只覆盖两张数量移动牌及共享四类移动额度读边界。

## 验证计划

正式夹具覆盖b98零/两牌、b87其他行星+彗星、固定移动不变；两点分两步消耗、skip，
初次和中途保存恢复及错误owner/version拒绝。需验证实际移动与剩余额度，不只测helper。
复用真实Production fixture，不另造第二个规则引擎；相关单测、V输入审计、唯一full-flow。
单点性能门槛通过后按标准登记唯一全盘，规则纠错分数如实记录，不要求保留错误移动收益。
这不豁免第五轮策略的节点减少/均分上升/截断减少三项验收。

文档计划：实现时同步mechanics-reference的卡牌移动规则、rl-simulation-env的额度契约，
核对ai-design与相关注释；本次只提交复现与设计，生产文档尚不改成已实现。
