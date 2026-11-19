from pathlib import Path
R=Path(__file__).resolve().parents[1]
section='''<h2 id="r4-development-controls">第四轮：提前部署单张牌没有延长扫描循环</h2>
<p>在完全相同的教师前三轮之后，V72第四轮续跑为267分。两组新对照都继承同一实际前262条输入，并清空临时AI状态。原路线两次均完整复现267分、342条实际行动及第四轮资产；提前部署虫族2的续跑238分，提前部署SETI研究所（B111）的续跑250分。现行自主教学盘仍为272分，不能将这些固定教师前三轮的成绩记为自主整局成绩。</p>
<div class="scroll"><table><tr><th>第四轮路线</th><th>轮末盘面分</th><th>科技数</th><th>扫描／分析</th><th>终局分</th></tr><tr><td>教师当前规则合法重放</td><td>239</td><td>11</td><td>8／5</td><td>384</td></tr><tr><td>V72同教师起点原路线</td><td>182</td><td>10</td><td>2／2</td><td>267</td></tr><tr><td>先部署虫族2，再完成相同登陆</td><td>156</td><td>9</td><td>1／1</td><td>238</td></tr><tr><td>先部署B111，后续由V72选择</td><td>161</td><td>10</td><td>0／1</td><td>250</td></tr></table></div>
<h3>局部多5分，失去第二次扫描的资金</h3>
<p>虫族2在共同起点花1钱即可部署，当前能计5分。但要完成与原路线相同的登陆，还需用2钱兑换移动所需的1电，并多用一个己方回合。原生对照的盘面分、科技、手牌、电脑与蓝槽数据、探测器、收入和RNG均相同，差别为少3钱、多5分卡牌计分；当前估值高2。</p>
<p>继续运行后，两条路线在第一轮扫描后的共同发展状态中分别剩5钱和2钱，电均为0。原路线能花4钱换2电，再用1钱支付第二次扫描；另一条路线无法筹齐这笔资金。最终提前部署路线少26盘面分、少7板块分、多4卡牌分，合计少29分。保留计分牌的局部优势不足以覆盖这一后续机会成本；这项证据不支持通用的计分牌保留规则。</p>
<h3>B111部署后的250分，没有检验到扫描任务收益</h3>
<p>B111花2钱部署并获得1宣传；同一实际扫描事件只允许结算该牌的一个剩余奖励。在已知相同扫描的原生对照中，选择4分奖励可使当前正式计分高4，扣除费用与手牌后估值高1.5；选择2数据则因池容量仅实际增加1数据，不能把三个奖励同时计算。</p>
<p>单独固定部署后交回V72，后续改走登陆、运输与科技路线，没有任何扫描，也没有触发B111奖励。250分因此只能说明提前部署本身不够，尚不能说明完整的部署与扫描计划低于267分。现有搜索已经评估了一条可支付的具体扫描方案，值220.5，低于被选中的登陆222.5；应先核查这条完整用途的后续表现，再判断是否需要改变估值或计划衔接。</p>
<p class="note">四次受控续跑均完成，游戏执行1.489—4.066秒；最高140次原生模拟／306.824ms，单点冷启动最高140次／326.311ms。1295条终局实际输入独立重放，完整终态、session及RNG一致；前缀另以1093条输入复核。报告模板缺失仅影响一次报告构建，已使用现有终局记录恢复，没有重跑AI。策略保持V72，原20盘没有重测。</p>
<p><a href="../ai-foundation-20261119/r4-chong2-terminal-control-outcome-20261119-v1.json">虫族2：终局、资产与正式计分</a> · <a href="../ai-foundation-20261119/r4-scan-engine-terminal-control-outcome-20261119-v1.json">B111：终局与实际行动统计</a> · <a href="../iteration/v498-r4-chong2-deployed-control-20261119/bdec4691.faf6cb24.full.action-log.html">238分逐行动复盘</a> · <a href="../iteration/v499-r4-scan-engine-deployed-control-20261119/a185d288.410c41e4.full.action-log.html">250分逐行动复盘</a> · <a href="../ai-foundation-20261119/r4-b111-visible-scan-existing-plan-20261119-v1.json">已评估的具体扫描方案</a></p>
'''
for name in ['expert-strategy-trials-20261119-v1.html','income-development-diagnosis-20261119-v1.html']:
 p=R/'reports/expert-learning-20261119'/name
 s=p.read_text()
 assert 'id="r4-development-controls"' not in s
 anchor='<h2 id="retained-amiba-controls">'
 assert anchor in s
 p.write_text(s.replace(anchor,section+anchor,1))
p=R/'reports/expert-learning-20261119/expert-strategy-review-20261119-v1.html'
s=p.read_text()
anchor='<h2>高分成绩所处的条件</h2>'
assert anchor in s
s=s.replace(anchor,'<p>第四轮同教师起点的两项新对照中，提前部署虫族2为238分，提前部署B111为250分，原路线两次均复现267分。前者失去第二次扫描的资金，后者没有进行扫描、尚未检验完整任务用途。具体计分与行动见<a href="expert-strategy-trials-20261119-v1.html#r4-development-controls">第四轮发展对照</a>。</p>\n'+anchor,1)
p.write_text(s)
