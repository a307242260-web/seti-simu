# RUNEZU-PANEL-TRACE-01 / POLICY-OBSERVATION-COST-01 完整局待验收

受测bea7de03，标准入口robot_iterate run，完整局仅运行一次。
record=reports/research/22249691.bea7de03.full.json；save=seti-saves/seti-save-research-runezu-panel-node-projection-20260913-bea7de03-full-v238.json。
复盘reports/iteration/runezu-panel-node-projection-20260913/22249691.bea7de03.full.action-log.html已生成，入口进程正常exit0。

482步自然终局，正式67/93/70/81，均77.75；所有搜索failedNodeCountByCode为空。
耗时756474ms；168次搜索166159节点，87次战略搜索166078节点/572727.082578ms。
执行截断39次、队列截断42次；控制81次，叶上限触顶78次无叶截断；战略8叶未启用。
基线629步均101.75/1209700ms；分数下降24，整局缩短包含更少行动和搜索的影响，
不能把整局耗时差全归为投影复用提速。单独性能证据仍是相同334输入65.12→23.56秒。

前230条action/after记录一致，首次可见分歧231：蓝色收入dlc_30.png→runezu_3.webp。
这些after只含简化玩家资源，不能证明完整规则状态此前完全相同。前231条中显式符文
species痕迹选择仅225白色蓝3，未见1/4位；不能据此排除其他效果入口或未来反事实
奖励变化。下一步重建231共同决策，区分原规则、只修符文、叠加投影复用的结果。
不重跑完整局、不先调权重，不将单个334的等价证明外推到所有输入。

按节点数再耗时的新热点第一为434白色quick_trade:49c75492，4096节点/16640.812834ms；
其他候选460蓝研究、390蓝打牌、436白PASS、413白交易。先处理当前验收归因，再恢复预算循环。

临时目录只有本次研究记录，自动总览143项缺记录警告来自稀疏检出，不作为主报告中心。
本次只归档新记录/存档/单局报告/版本注记；临时registry与总览不合主。
尚未接受本候选，主目录仍保持原baseline；公开推送限制不在本轮重试。
