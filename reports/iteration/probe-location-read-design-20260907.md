# 探测器位置读模型缺失：独立缺陷

状态：独立修复b8be61a5已验证并登记，完整局均105.5低于108.5，整体Goal未通过。需求式移动尚未实施。

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
| 非太阳系实体 | 已核对：复用rockets.isControllablePlayerRocket，只统计solar-board普通探测器；排除化石/无owner/其他surface。复用getRocketSectorCoordinate，兼容正式极坐标实体；普通探测器缺位置显式抛错 |
| 正式消费者 | 至少用真实任务输入验证到小行星后任务可用，不只测新字段赋值 |
| 复盘/缓存 | 不新增跨状态缓存；旋转后重复读取应得到新位置事实 |
| AI | 不调权重、不新增虚拟奖励；这是正式条件修复，需求式搜索仍单独实施 |

验收顺序：读实体surface/位置契约及相关Node测试，冻结非太阳系边界；红绿正式
位置条件/任务回归；真实状态单决策检查与预算/计划验证；独立中文生产提交后查重
运行唯一完整局，登记均分及错误/截断变化。不得将本次取证冒充修复或性能收益。

最终边界：locationType取可见content.kind，非行星planetId为有定义的null；
distanceFromEarth与adjacentToEarth同源。residual的必需builder直接调用，删除缺依赖
时返回空位置的静默分支。final-read-model另有未装配的可选位置入口，属于终局读模型
独立问题，当前修复不声称覆盖该入口；先登记后独立验证，不能阻塞本次已闭合修复。

红测证据（2026-09-07，生产修改前）：`node randomizer/game/cards/play-domain.test.js`
在runAsteroidTaskSettlement失败：正式打出dlc11后小行星任务合法行动数实际0、预期1；
任务无自动领取，既有探测器已在正式可见小行星格，直接复现正式规则漏报。

## 当前验证

- 改动：从正式当前坐标解析地点类型/行星/格距；过滤非普通探测器；必需位置和依赖
  缺失显式失败，不静默返回空任务。
- 正式dlc11打牌→任务合法集→领取3分2能量→移牌/计数→不可重复领取→保存恢复
  重放均通过；空格不满足。64格（两次旋转状态）覆盖行星/彗星/小行星/空格、距离、
  邻接、owner隔离、不同星球；极坐标一致、缺位置抛错、冻结输入不变。
- 真实42：probe-location-decision-42-20260907.json，15.820秒、4096节点、4804成功
  输入、失败0，根动作place_data:dbe01b29；29步后续计划连同根动作共30输入正式
  fork重放成功。此前744单测15.522秒，本次+1.92%；不是性能优化收益。
- 全Node：unit77/79，唯一fullFlow1/1；两项既有失败仍为beam断言10638≠0、
  data:analyze目标释放断言。没有新增失败，不宣称全绿。V输入审计全通过；app及两
  生产文件语法通过，定向卡牌回归通过。
- 文档已核对README、AGENTS、PROJECT_MEMORY（入口/约定未变），机制参考、卡牌DSL、
  AI/Simulation契约、迭代中心和当前计划；更新机制/DSL/计划，未修改无关长期记忆。
- 完整局已按标准入口唯一运行并登记probe-location-read-20260907：记录
  beaacd3e.b8be61a5.full.json，562步109/88/118/107、均105.5；与b10ae543完整replay
  和终局状态相同。179次搜索、105127节点、129506成功输入、规则失败0；21次
  4096策略截断和8次1节点控制截断不变。378516ms，比372277ms增加1.68%，单次
  测量无性能收益。核验及SHA256见probe-location-full-verification-20260907.json。
- 满足本次独立规则修复行为，不满足整体均分和零截断门槛；保留正确修复。下一项
  独立终局位置输入漏报已复现，见final-probe-location-design-20260907.md，不调权重。
