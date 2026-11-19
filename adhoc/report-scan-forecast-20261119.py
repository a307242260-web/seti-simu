"""Close the forecast experiment and add its decision to the strategy reports."""
from pathlib import Path
import json,time

R=Path(__file__).resolve().parents[1]
B=R/'reports/ai-foundation-20261119'
H=R/'reports/expert-learning-20261119'
out=json.loads((B/'scan-forecast-outcome-20261119-v1.json').read_text())
assert out['status']=='rejected-policy-regression' and out['challenger']==161
assert out['nativeReplay']['expected']==out['nativeReplay']['actual']
rows=[]
for old,new in zip(out['roundEnds']['baseline'],out['roundEnds']['candidate']):
 def income(d):return ' / '.join(str(d['income'][k])for k in ['credits','energy','handSize'])
 def tech(d):return '、'.join(sorted(k for k,v in d['technology']['ownedTiles'].items()if v))
 rows.append(f'<tr><td>{old["round"]}</td><td>{old["score"]} / {new["score"]}</td>'
             f'<td>{income(old)} / {income(new)}</td><td>{tech(old)}<br>{tech(new)}</td></tr>')
section='''<h2 id="forecast-trial">降低紫4远期预期的整局试验：161分，未采用</h2>
<p>原20盘中18盘第一轮取得紫4，第二至四轮平均每盘实际选择其发射或移动效果0.2、0.4、0.25次，低于模型每后续轮4次的使用预期。但实际使用次数也受策略影响，低频本身不能证明降低其发展价值会更好。</p>
<p>仅将该远期使用预期从每轮4次降至1次，其他收入、科技与蓝槽循环参数不变。在相同23步开局、其他三席仅PASS的自主教学盘中，候选终局161分，现行策略272分，减少111分。候选第一轮盘面分26高于15，但只有蓝2，缺少紫4；钱收入4低于6。第二轮科技与钱收入继续落后。</p>
<div class="scroll"><table><tr><th>轮次</th><th>盘面分：现行 / 候选</th><th>钱电牌收入：现行 / 候选</th><th>科技：上行为现行，下行为候选</th></tr>
'''+''.join(rows)+'''</table></div>
<p>最早分歧为第38步；此前37条实际行动、该点完整观察与合法集一致。现行策略结束turn，候选开始填电脑收入位。整局差异不能全部归因于这一步，但它提供了一个可用相同状态继续验证的起点。后续应核对科技、收入与手牌的共同资金路径，而不是用较低的统一频次替代连续发展估值。</p>
<p class="note">候选游戏本身8.686秒、232条实际输入，所有决策闭合；单决策最高127次原生输入／156.089ms。232步独立重放验证终态、session和RNG。报告中心构建曾因模板缺失退出，补回已提交模板后完成构建，没有重跑AI。候选未采用，现行策略仍为V72，原20盘没有重测。</p>
<p><a href="../ai-foundation-20261119/scan-forecast-outcome-20261119-v1.json">完整轮末资产与裁决</a> · <a href="../iteration/v491-scan-forecast-teaching-20261119/281f35cd.1567cae1.full.action-log.html">232步图文复盘</a> · <a href="../ai-foundation-20261119/early-technology-usage-audit-20261119-v1.json">20盘使用次数明细</a></p>
'''
p=H/'income-development-diagnosis-20261119-v1.html';s=p.read_text();assert 'id="forecast-trial"'not in s
s=s.replace('本报告的新增调查没有运行AI搜索或新整局，也没有采用新的取牌、收入或科技策略。','20盘收入审计复用已有记录；后续频次校准仅运行一次自主教学整局，161分，未采用，也未扩大到20盘。')
s=s.replace('<h2>下一项策略验证</h2>',section+'<h2>下一项策略验证</h2>')
s=s.replace('从原20盘第一、二轮定位最早的收入获取或蓝科技分歧，核对当时已经可见的信息与资源；同时区分开局配置差异。','优先分析教学盘共同第38步的科技与收入取舍，核对当时已经可见的信息、可达资金与本轮后续；随后再与原20盘的早期发展节点对照，并区分开局配置差异。')
p.write_text(s)
p=H/'expert-strategy-trials-20261119-v1.html';s=p.read_text();assert 'id="forecast-trial"'not in s;s=s.replace('<h2>20盘发展诊断与组合牌裁决</h2>',section+'<h2>20盘发展诊断与组合牌裁决</h2>');p.write_text(s)
route=json.loads((B/'early-technology-native-route-20261119-v1.json').read_text());route.update(status='closed-candidate-rejected',closedEpochSeconds=time.time(),policyAdopted=False,newFullGames=1,acceptedPolicyUnchanged='e08665e697909c61d8e39b70cb0b25e9850de31e',outcome='scan-forecast-outcome-20261119-v1.json',nativePreparationInputs=50,nativeCounterfactualInputs=71,independentReplayInputs=359,validColdSearches=4,failedAssetEmptySearches=2,ownerPreflightFailures=2,nextCommonRootInput=38)
(B/'early-technology-native-route-20261119-v1.json').write_text(json.dumps(route,indent=2)+'\n')
for name in ['teaching-r2','teaching-r3']:
 p=B/('early-technology-'+name+'-cold-20261119-v1.json');d=json.loads(p.read_text());d.update(actualAISearches=0,failureBeforeSearchDecision=True);p.write_text(json.dumps(d,indent=2)+'\n')
print(json.dumps({'candidate':'rejected','baseline':272,'challenger':161,'firstDifference':38,'newGames':1,'acceptedPolicyUnchanged':True}))
