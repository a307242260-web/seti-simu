from pathlib import Path
import json,html
R=Path(__file__).resolve().parents[1]
a=json.loads((R/'reports/ai-foundation-20261119/retained-probe-terminal-control-outcome-20261119-v1.json').read_text());b=json.loads((R/'reports/ai-foundation-20261119/amiba-engine-terminal-control-outcome-20261119-v1.json').read_text())
rows=''
for label,x in [('原路线对照',a['cases'][0]),('保留现金与探测器后交回AI',a['cases'][1]),('同一起点先部署阿米巴1',b['cases'][1])]:
 roundrows={r['round']:r for r in x['roundEnds']}
 vals=[]
 for n in [2,3,4]:
  r=roundrows[n];i=r['income'];vals.append(f"{r['score']}／{sum(bool(v)for v in r['technology']['ownedTiles'].values())}／{i['credits']}-{i['energy']}-{i['handSize']}")
 rows+='<tr><td>'+label+'</td>'+''.join('<td>'+v+'</td>'for v in vals)+f"<td>{x['score']}</td></tr>"
section='''<h2 id="retained-amiba-controls">保留教师第二轮资产仍未改善终局；研究引擎在同起点增加17分</h2>
<p>同一实际前83条输入之后，一边完成现行AI的海王星路线，另一边完成已知教师第二轮路线。后者交接时的钱、电、收入、科技槽位、电脑数据、手牌、已打出的牌和在途探测器均与当前规则教师参考一致；没有导入教师隐藏手牌或未来抽牌。原路线完整复现272分和354条实际行动，教师路线交回V72后仅133分。</p>
<p>V72没有等待第三轮：它立即兑换并登陆木星，揭示阿米巴，随后部署阿米巴0，在第117步把阿米巴1用作钱收入。这是实际出现的后续选择，不能将全部139分差归因于其中某一步。</p>
<p>以这条续跑的实际前112条输入为共同起点，仅把第113步改为先部署已知的阿米巴1，后续仍由V72决定。终局从133升到150分，增加的17分全部来自盘面分；终局板块分均为29，卡牌分均为0。该分支在第二轮研究蓝4、第三轮研究橙1时实际兑现研究奖励，但仍比自主272分低122分。</p>
<div class="scroll"><table><tr><th>路线</th><th>第二轮</th><th>第三轮</th><th>第四轮</th><th>终局</th></tr>'''+rows+'''</table></div>
<p class="note">轮次列为盘面分／科技数／钱-电-牌收入；轮末均在PASS选牌和下一轮收入前。上述均为固定前缀的受控续跑，不能记为自主AI提分。</p>
<p>这些证据支持按完整组合评估科技、启动资金、在途探测器和关键牌的后续兑现，尚不支持增加通用蓝1、提前登陆或保留探测器的优先级。现行策略保持V72；自主教学盘272分，原20盘仍为v486的134.35均分，未重跑。</p>
<p class="note">四次续跑均完成，游戏执行5.008—10.882秒；单决策最高163次原生输入／386.404ms，均在256次／600ms内。四次终局共1052条实际输入独立重放，完整终态、session和RNG一致。对照入口与隔离源码已分别登记，历史保留种子、实际动作、必要前缀和决策额度，省略重复搜索图及轮末大快照。</p>
<p><a href="../ai-foundation-20261119/retained-probe-terminal-control-outcome-20261119-v1.json">两条第二轮路线完整资产与计分</a> · <a href="../ai-foundation-20261119/amiba-engine-terminal-control-outcome-20261119-v1.json">阿米巴首张部署同起点对照</a> · <a href="../iteration/v496-r2-retained-route-control-20261119/0a797f9f.5757b29e.full.action-log.html">133分逐步复盘</a> · <a href="../iteration/v497-amiba1-first-control-20261119/7662691d.d01b9ad4.full.action-log.html">150分逐步复盘</a></p>
'''
for name in ['expert-strategy-trials-20261119-v1.html','income-development-diagnosis-20261119-v1.html']:
 p=R/'reports/expert-learning-20261119'/name;s=p.read_text();assert 'id="retained-amiba-controls"'not in s
 s=s.replace('只改变科技，尚不能复制这些条件；下一项应对照这条已知行动路线，而非继续提高通用现金、牌收入或蓝1权重。','只改变科技无法复制这些条件。完整的已知第二轮路线及阿米巴部署顺序也已分别对照，结果见下。')
 anchor='<h2 id="r2-scan-controls">';assert anchor in s;s=s.replace(anchor,section+anchor,1);p.write_text(s)
p=R/'reports/expert-learning-20261119/expert-strategy-review-20261119-v1.html';s=p.read_text();s=s.replace('当前自主教学盘为272分，原20盘均分134.35，均未因本次研究改变。','当前自主教学盘仍为272分，原20盘均分134.35。单独换蓝1的受控续跑174分，保留教师第二轮资产后续跑133分；在后者同起点先部署阿米巴1可升至150分，仍未超过现行自主策略。这些局部对照不计为自主提分。');p.write_text(s)
