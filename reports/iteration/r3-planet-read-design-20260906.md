# R3-P2 行星坐标读取等价优化（2026-09-06设计冻结）

目的：真实棕方状态仍需10.59秒，未达10秒门槛。旧CPU剖析中太阳系快照累计包含耗时
约1.59秒；Production需要行星坐标的调用同时构建全盘visibleContents和nebulaLocations。
`solar.collectPlanetLocations`已公开，且是`createSolarSnapshot`内部的唯一行星坐标函数。
本方案只改调用到该正式primitive，不引入缓存、近似位置或第二份算法。

| 唯一owner/入口 | 当前所需语义 | 实现及义务 |
|---|---|---|
| Production/getEarthCoordinate | 同盘面地球坐标，用于发射、扫描范围和路线来源 | 直接collectPlanetLocations再find；原fallback不改 |
| Production/buildProbeRouteRequirements/context | 路线拓扑与行星能力查询的行星数组 | 回调直调同一primitive，字段与排序不变 |
| Production/createActionContext | 正式能力执行所需行星数组 | 回调直调同一primitive，Browser/Simulation共同使用 |
| solar/core | 旋转、奥陌陌激活、行星定义及排序 | 不修改函数；现有太阳系unit与正式全流程回归 |

无新状态owner、Decision、事务、RNG/id或恢复边界，无缓存失效义务；同一输入保持
完整行星数组语义。只省去未消费的可视格子与星云计算。完整快照接口与浏览器渲染不变。
先运行相关Node回归，再使用原棕方checkpoint一次搜索，逐根评分/优胜叶/计划/节点数
与原始记录等价且<=10秒；失败不重复碰运气，不运行批量实验。通过后中文提交、登记。

排除：standardScanSectorIds的紫2水星读取为planetLocations?.mercury，但正式返回是
数组；这是独立疑点，需要正式盘面复现后单独设计修复。此次保持该处原样，不把行为
修正混入等价优化。不要从静态疑点断言它导致第三轮均分下降。

## 验证结果

`r3-planet-read-verification-20260906.json`：真实棕方第42步checkpoint一次决策
9558.01ms（P1为10594.79ms，原始为11606.73ms），低于10秒。每根完整评分、优胜叶、
返回计划、4096节点与原始记录一致。输入与生产源码哈希保留；单样本不是普遍性能保证。
默认Node：unit 73通过/2指定旧失败；唯一fullFlow通过；production-kernel语法通过。
本次没有新V输入调用点，未重复V审计。已同步AI/RL说明，核对README、AGENTS、
PROJECT_MEMORY、Node测试标准、机制参考：无新接口或行为口径，不需更新其余文档。
