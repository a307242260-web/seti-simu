# 数据事件缺失字段：独立修复设计（2026-09-07，尚未实施）

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
