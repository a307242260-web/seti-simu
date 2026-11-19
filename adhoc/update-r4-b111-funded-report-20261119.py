from pathlib import Path
R=Path(__file__).resolve().parents[1]
for name in ['expert-strategy-trials-20261119-v1.html','income-development-diagnosis-20261119-v1.html']:
 p=R/'reports/expert-learning-20261119'/name
 s=p.read_text()
 s=s.replace('两组新对照都继承同一实际前262条输入','本组对照都继承同一实际前262条输入')
 s=s.replace('提前部署SETI研究所（B111）的续跑250分。','提前部署SETI研究所（B111）的续跑250分；再固定兑现其已知扫描用途后续跑247分。')
 needle='<tr><td>先部署B111，后续由V72选择</td><td>161</td><td>10</td><td>0／1</td><td>250</td></tr>'
 assert needle in s
 s=s.replace(needle,needle+'<tr><td>部署B111并兑现已知扫描，再交回V72</td><td>167</td><td>9</td><td>2／2</td><td>247</td></tr>',1)
 s=s.replace('250分因此只能说明提前部署本身不够，尚不能说明完整的部署与扫描计划低于267分。现有搜索已经评估了一条可支付的具体扫描方案，值220.5，低于被选中的登陆222.5；应先核查这条完整用途的后续表现，再判断是否需要改变估值或计划衔接。','250分只说明提前部署本身不够。另将现有搜索中最好的已知扫描方案以8条原生输入完整兑现，包括实际付款、免费移动、单次4分任务奖励与回合结束，再交回V72，终局247分。这条完整用途仍未超过原267分；虽然第四轮同样完成2次扫描、2次分析，但盘面分少15、板块分少11、卡牌分多6，合计少20分。现有证据不支持为这条用途新增跨回合承诺或统一提高B111优先级；不能据此推断该牌的所有使用时机均较差。')
 s=s.replace('四次受控续跑均完成，游戏执行1.489—4.066秒','五次受控续跑均完成，游戏执行1.489—4.066秒')
 s=s.replace('1295条终局实际输入独立重放','1619条终局实际输入独立重放')
 s=s.replace('前缀另以1093条输入复核','前缀另以1365条输入复核')
 link='<a href="../ai-foundation-20261119/r4-b111-visible-scan-existing-plan-20261119-v1.json">已评估的具体扫描方案</a>'
 s=s.replace(link,link+' · <a href="../ai-foundation-20261119/r4-b111-funded-scan-terminal-control-outcome-20261119-v1.json">完整扫描用途续跑与正式计分</a> · <a href="../iteration/v500-r4-b111-funded-scan-control-20261119/a38f3a42.79e6d94d.full.action-log.html">247分逐行动复盘</a>',1)
 p.write_text(s)
p=R/'reports/expert-learning-20261119/expert-strategy-review-20261119-v1.html'
s=p.read_text()
s=s.replace('后者没有进行扫描、尚未检验完整任务用途。','后者没有进行扫描；补齐其已知扫描完整用途后续跑247分，仍未超过267分。')
p.write_text(s)
