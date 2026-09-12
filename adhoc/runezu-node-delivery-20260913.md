# 符文面板奖励与节点投影复用：主目录交付

2026-09-13主目录从1e3cc2e6快进至ec10d1a1，61个本次文件逐个blob核验一致；
共享index字节保持不变，所有无关文件哈希/缺席状态保持不变。临时生成的稀疏总览未导入。
主目录执行robot_iterate build --refresh-report-metadata，刷新128份报告元数据，未运行AI。
verify-runezu-node-delivery-20260913.js通过：当前baseline、受测bea7de03、482步、
正式67/93/70/81均77.75、168搜索166159节点、执行截断39和队列42、21链接正确；
113份历史正文与原提交一致。既有4孤儿+1提交归属警告保留；fold-chain-real缺原始
提交正文仍不能做历史正文等价验证。没有声称Chrome视觉检查覆盖报告页面。

当前base策略HTML已更新本版快照、指标、分数拆分与动作构成；降分未完全归因的边界
保留。正式数据见reports/iteration/runezu-panel-node-acceptance-20260913.md。
该文与版本注记的“待主目录交付”为当时阶段状态，本记录补充后续交付完成事实。

后续正在独立目录进行PLAN-SYMBOL-DEPENDENCY-01完整局1937b954。没有把它的未验收
生产代码合主，也没有在其运行中修改该目录代码或HEAD。公开推送限制不重试。
