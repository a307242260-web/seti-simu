# 探测器位置读模型缺失：独立缺陷

状态：已由真实位置输入复现，生产未修改。优先修复后再接入需求式移动。

## 证据与影响

probe-location-read-20260907.json：真实42根位置位于地球，已保存的正式公司移动
首步到达火星；两种输入经cardPlayDomain.buildProbeLocationData均返回locationType
恒solar、planetId恒null、没有distanceFromEarth。原始位置与正式solar可见内容对照
已保存，不运行搜索；火星例只复用已正式执行保存的位置，不声称整个后续游戏状态重放。

源码同一方法被residual.buildCardTaskContext与卡牌条件执行消费。
taskConditionMet的probeLocation、probeAdjacentEarthAsteroid、probesOnDifferentPlanets、
otherProbeAtPlanet、probeDistanceFromEarth依赖这些事实，因此当前缺失会使相应条件
错误判否。probeAdjacentEarth当前已有正确的环向折返曼哈顿邻接计算，必须保留。
牌面b101（assets/cards/basic/split/b_101.webp）明确“距离地球至少5格”，距离不是
消耗能量或包含小行星移出加价的移动点，不可直接使用付费路线成本代替。

## 拟修复边界与义务

唯一owner仍为buildProbeLocationData；复用solar.resolveVisibleContent解析当前旋转后
位置的内容，补locationType/planetId与距地球格数，不新增第二位置解析器。
太阳系显示坐标与content底层坐标不同，距离必须由探测器sectorX/Y和当前地球显示
坐标计算；环向距离取两方向较短值，再加径向距离，与现有邻接口径同源。

| 边界 | 验证义务 |
|---|---|
| 小行星/彗星/行星/空格 | 当前可见内容类型正确；行星身份仅来自可见内容，不固定null |
| 距离/邻接 | 地球0、正交邻接1、跨x=7/0折返；格距不含小行星额外移动成本 |
| owner | index保留playerId/color索引，己方与对手不得串用；多探测器不同星球正确 |
| 状态所有权 | 纯读，不修改输入、分配ID、消费RNG或改变规则执行与Decision状态 |
| 非太阳系实体 | 开工前核对rocket surface/coordinate契约，不把参考图棋子当作在轨探测器 |
| 正式消费者 | 至少用真实任务输入验证到小行星后任务可用，不只测新字段赋值 |
| 复盘/缓存 | 不新增跨状态缓存；旋转后重复读取应得到新位置事实 |
| AI | 不调权重、不新增虚拟奖励；这是正式条件修复，需求式搜索仍单独实施 |

验收顺序：读实体surface/位置契约及相关Node测试，冻结非太阳系边界；红绿正式
位置条件/任务回归；真实状态单决策检查与预算/计划验证；独立中文生产提交后查重
运行唯一完整局，登记均分及错误/截断变化。不得将本次取证冒充修复或性能收益。
