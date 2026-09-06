# 数据事件缺失字段：独立修复设计与验证（2026-09-07）

## 已确认事实与边界

`any-alien-divergence-v3-20260907.json`从既有42检查点正式重放共同前缀至410，
每步合法动作与存档动作、状态摘要一致，没有运行AI。408检查点内存对象有22条
undefined路径，集中于历史事件的clearedCount和蓝槽placementSlot，并含历史副本。
JSON序列化删除这些属性；对比文件与内存失败的v2证据保留，不能称为字段已修复。
首次诊断误把state.players当数组，属于脚本结构误用；v3已使用players.players。

| 字段 | 正式来源与现有错误 | 修复职责与证据义务 |
|---|---|---|
| analyze.clearedCount | data/state的付费、免能分析都返回清除数量；abilities/data放入payload，science-session误从顶层读取 | science按能力payload契约读取真实数量，不填0；付费与免能、计算机及蓝槽混合数据均核对清除前后数量、事件和恢复 |
| placeData.placementSlot | 正式计算机放置返回placementSlot；蓝槽返回blueSlot，不返回计算机位置。能力payload与事件无条件读取两者 | 保留placementKind判别的互斥位置字段，计算机只带实际placementSlot、蓝槽只带实际blueSlot；不伪造位置，不用默认数字。先复核所有消费者再冻结接口 |

唯一规则owner仍为data/state；不改变放置选择、奖励、分析费用、实体id、RNG、
主行动或Decision生命周期。输入能力层与事件层须保持同一语义，不扩为整个事件系统
迁移。缺失必需事实仍显式报错；合法不适用字段由判别类型表达，不写undefined。

实施前尚须完整读取两个受影响模块、现有测试及能力结果公共契约，闭合消费者、
恢复与序列化矩阵，再一次实现和验证；本文件不表示设计已冻结或生产已修复。
局部通过后按标准执行真实408/42单决策、固定唯一版本、文档同步和登记。
两处事件事实修复与移动需求式优化分开，不能将它们计作搜索节点收敛。

## 冻结矩阵（2026-09-07）

已完整读取abilities/data、abilities/index、science-session与science-scan-flow测试。
全仓clearedCount消费者只有data返回、能力payload、Science事件及data单元断言；
placementSlot/blueSlot的AI与projection消费者读取正式token或Action target，不读取
上述事件中的不适用字段。事件由Session journal保存并可能参与反事实状态身份，
因此不能仅凭资源无变化推断搜索等价，必须重新验证单决策及唯一完整局。

实现冻结为：能力placeData payload根据正式placementKind只拷贝适用位置；Science
事件同样按placementKind生成位置字段。analyze事件读取既有payload.clearedCount，
并校验其为非负整数，缺失直接抛错。位置结果验证正式kind及正整数槽位，不填默认值。
数据实体、序列、RNG仍只由data/state写入；Science不新增消耗、不变更事务边界，
不回填旧存档中已丢失的信息。蓝槽奖励的收入/精选后续继续原队列顺序。

验证闭包：计算机放置、四种蓝科技放置及奖励、付费/免能分析×含/不含蓝槽；
真实事件不存在undefined且JSON往返等价；Decision保存恢复、错误owner拒绝不变；
分析清除数量=操作前实际已放token数、池中未放token保留、费用与主行动正确。
不改family/choice/actionId，旧目标选择和原先全部回归仍需通过。

## 实施与局部验证

已按上述冻结方案完成两个生产模块，未改变data/state规则。新增蓝槽事件断言在
修复前明确失败（多出placementSlot:undefined），修复后通过。四蓝科技奖励均经
正式Science composition验证；每个放置Decision错误owner拒绝保持envelope不变，
保存/恢复后重新提交envelope一致。能力payload计算机/蓝槽八组往返无undefined。
分析四组为正式owner单元验证（付费/免能×含/不含蓝槽），验证真实6/7清除数量、
池token保留、能量及主行动；不冒充四组端到端完整Production恢复证明。

全量77/79 unit、1/1 fullFlow，仍为既有beam及data目标两项断言，没有新增失败；
data.test、Science单元、语法及V输入审计通过。42冷决策15.374秒，4096节点、
4804正式输入、0规则失败，30个计划输入正式重放成功，根place_data:dbe01b29不变。
证据data-event-decision-42-20260907.json。不是搜索超额解决或稳定提速证明。
408冷决策、唯一完整局及最终效果验收尚待执行；前版支付差异因果仍未关闭。

文档核对覆盖RL接口、mechanics、AI设计、README/AGENTS与测试清单；只有RL事件
契约、测试职责和本设计受影响，已同步。浏览器装配、部署入口及正式数据规则未变。
