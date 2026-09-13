# INCOME-CHOICE-GREEDY-01 验证运行记录

受测提交5ef60d81（生产筛选实现4032cf58；后续只添加诊断与证据），基线data-corner-greedy-20260913/236c6969。

主目录与临时目录均已执行研究记录list查重。初次标准run因稀疏目录缺versions.json在执行AI前失败；复制主目录既有登记后开始唯一快速实验。快速40步31.1秒，记录`reports/research/ac7f0082.5ef60d81.quick-40.json`，存档`seti-saves/seti-save-research-income-choice-greedy-20260913-5ef60d81-quick-40-v9.json`。与基线world深相等、全部40步replaySteps深相等，阶段均分7.75不是终局成绩。

标准run已登记版本，但报告阶段因缺历史HTML试图重放旧世界而显式失败。补入主目录既有quick-timing/data-corner报告及page-template后，仅build --reports完成（不运行AI）；临时目录148项缺历史记录警告源于稀疏克隆。此稀疏总览不得覆盖主目录报告中心；最终只合新版本与证据，并在主目录全历史环境重建。新quick报告已生成。

完整局已用`node tools/run_research_validation.js --name income-choice-greedy-20260913 --full`从同提交quick第40步恢复，世界指纹仍为`2d9f8f5344864fcd683204661f0ab70c07dbd086b2ff8e2c00ea2ff283213d8c`。运行中不提交改变HEAD，不修改生产文件。终端会话60648，持续复用同一会话读取原始进度；会话号仅用于本次运行续接，不代表永久存活证据。

完整局已529步自然终局，60648会话exit0。full记录`ac7f0082.5ef60d81.full.json`、存档`seti-save-research-income-choice-greedy-20260913-5ef60d81-full-v272.json`。`compare-income-choice-full-20260913.js`核对world、两物种初始配置、quick恢复前缀和正式终局分均通过，规则失败为空。均分87.25→86，各席蓝84→75、绿108→116、棕73→70、白84→83。

总搜索节点174015→181713；战略搜索91→90，但战略截断43→44、控制截断4→3，合计仍47；执行截断39→36，frontier截断43→44。quick+full总耗时797118→816408ms。局部37节点族下降不等于整局更快，本局没有整体节点或时间改善。

第一次实际分歧在51蓝色免费科技选择：orange2→purple4，不是37后的绿色收入选择；前50步相同。必须继续分析该节点的旧路线保留/贪心删除/预算等待/更高评分替代，不能把37的证据当作51的结论。

正式计分差已核对：蓝-9＝基础-9+终局牌10-板块10；绿+8＝基础16-终局牌3-板块5；棕-3全为基础；白-1＝终局牌-6+板块5。此为分差账，不是策略因果已证明。已进入full登记与报告生成，完整验收归因未完，暂不合回。

第50/51步归因已完成：旧73.5橙路线在新版有真实完成叶；新74.5紫路线胜出。科技未来60与36的差额来自既有固定轮次估值，蓝色实际无标准扫描或紫4选择，缺口登记EFFECT-04/01。局部PASS与整体退化分别记录于`reports/iteration/income-choice-acceptance-20260913.md`，当前待合回。下一热点按4096并列取最慢为448白色place_data，正式搜索17436.17ms（不是整决策端到端耗时）。
