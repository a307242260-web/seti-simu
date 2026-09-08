# 第五轮：数量奖励时机与移动额度缺陷

2026-09-09，源码基于ae493706；生产未修改。

## 已复现：发射前试验的数量移动没有按数量结算

正式模型b98《发射前试验》：先免费发射，随后按手牌移动角标数量获得移动。
reproduce-counted-card-move-20260909.js使用blue50真实存档派生夹具，经正式
createSimulationRuleComposition、合法play_card、正式发射结算，进入数量移动Decision。
仅替换手牌，使用createCommittedCardInstance维护正式实体字段与序列；不运行AI。

| 发射后剩余手牌移动角标 | 模型要求的额度 | 当前正式Decision额度 |
|---|---:|---:|
| 0 | 0 | 1 |
| 2 | 2 | 1 |

证据counted-card-move-reproduction-20260909.json保存正式输入、Effect与全部移动选择。
getMovementAllowance只读取remaining/options.movementPoints，缺省1且最低1；
COUNT_HAND_CORNER_MOVE模型没有movementPoints。genericExecute、listMoveChoices和
createSpawnedCardEffect未补入手牌数量，因而两种夹具均得到1。
这是模型与执行不一致的正式复现；尚未补牌面资料核对，不称为规则修复已通过。

《最佳发射窗口》b87的EARTH_SECTOR_CONTENT_MOVE同样进入该函数且没有movementPoints，
属于同入口待验证项；本检查点没有实际执行b87，不能把它列为已正式复现。

夹具调试的失败不是游戏缺陷：初稿误用展示实例造成HOST_FIELD/sequence门禁拒绝，
改用正式实例工厂；另一断言发现选定示例牌并非移动角标，改为按正式catalog字段选取。
上述失败均显式暴露，未输出成功检查点。当前成功结果才是缺陷证据。

## 已核对的数量与时机

| 卡牌/类型 | 数量来源与时机 | 估值必须保留的边界 |
|---|---|---|
| b41手牌能量收入牌 | play-domain先支付、移出本牌，再在DIRECT读actor.hand收入码 | 不把打出的本牌算入手牌；未知收入码不能查未来牌面 |
| b42/b47/b79当前收入 | DIRECT读取actor.income减公司baseIncome，后续才将本牌插收入 | 排除公司默认收入；不提前加本牌收入；b79先获得2宣传不改变收入计数 |
| b46任务每个外星人 | residual按存在己方任一颜色痕迹的槽计数，每槽只计一次 | 不是已揭示物种数，也不是痕迹枚数；这是任务奖励，预期另乘0.5 |
| b98手牌移动角标 | 模型要求发射后、卡已离手时计数 | 当前实现缺陷另案；不能把缺省1当正确估值基数 |
| b87地球扇区内容 | 模型要求行星/彗星数量 | 同入口待复现，须区分地球、内容种类及固定盘面位置 |
| DLC27探测器/搬运化石 | 条件奖励执行时countRocketsForReward，己方太阳系标准探测器及未锁定虫族运输化石 | 复用正式pure helper；不能数全部pieces或把着陆化石计入 |
| DLC30拥有蓝科技 | 环绕效果完成后读ownedTiles真值、blue前缀 | 失效但仍拥有的科技仍参与数量奖励，不复用能力有效性过滤 |
| DLC34最大同色科技数 | 收入效果后，橙/紫/蓝计数取最大值，再盲抽 | 不是颜色种类数、不是总科技数；盲抽只计数量，不看抽到什么 |

正式来源：cards/play-domain.js PLAY、DIRECT、genericExecute；
effects/residual-domain-session.js applyFormalCardEffects；cards/effects.js countRocketsForReward。
这里只完成上述8类数量奖励的时机核对，不声称48类估值全部设计闭合。

## 下一步与范围

数量移动缺陷单独修复：先核对牌面规则，复现b87；统一首次额度计算、零额度结束、
逐步扣减与保存恢复，核对共享getMovementAllowance消费者。禁止每步重新按变化后的
手牌/太阳系数量增加额度，禁止用Math.max(1)补成免费移动。正式输入、ID/RNG和搜索
需求读取须共享冻结的额度，完成完整设计后再写生产代码。

第五轮估值仍继续：这些数量与先后义务进入完整模型，不拿未知牌面计算收益；
未解决条件奖励/数量型终局的估值基数口径保持待确认。新缺陷不用于解释历史降分，
除非后续证据证明关联。三项验收仍未完成，没有新全盘成绩。

验证为脚本语法及正式规则夹具两例；没有全量Node或AI模拟。
文档同步范围为本报告、第五轮契约、Goal与迭代中心；README、AI/RL生产契约未变化。
