from html import escape as esc
from pathlib import Path
from statistics import mean,median
import json,sys
verified,output=map(Path,sys.argv[1:3])
data=json.loads(verified.read_text());rows=data['rows'];ok=[x for x in rows if x['terminal']]
assert len(rows)==20 and all(x['nativeStateSessionRngExact'] for x in rows)
scores=[x['score'] for x in ok]
byround=[[x['rounds'][i][1] for x in ok] for i in range(4)]
bins=[(a,a+19,sum(a<=s<a+20 for s in scores)) for a in range(70,170,20)]
bars=[]
for i,(a,b,n) in enumerate(bins):
 x=52+i*100;h=n*19
 bars.append(f'<rect x="{x}" y="{188-h}" width="64" height="{h}" rx="4" fill="#477d8a"/><text x="{x+32}" y="{180-h}" text-anchor="middle">{n}</text><text x="{x+32}" y="211" text-anchor="middle">{a}–{b}</text>')
line=[];xs=[70,210,350,490];ys=[195-mean(v)*1.35 for v in byround]
for x,y,i in zip(xs,ys,range(4)):
 line.append(f'<circle cx="{x}" cy="{y}" r="5" fill="#1a6868"/><text x="{x}" y="{y-12}" text-anchor="middle">{mean(byround[i]):.1f}</text><text x="{x}" y="215" text-anchor="middle">第{i+1}轮</text>')
rows_html=[]
for row in rows:
 rnd=dict(row['rounds']);score=row['score']
 p=Path(row['record']).name.removesuffix('.json')+'.action-log.html'
 report=(f'<a href="{esc(p)}">逐行动复盘</a>' if (output.parent/p).is_file() else '待生成复盘')
 failure='未到终局'
 if not row['terminal']:
  k=row['failure']['message'].split(': ')[-1]
  failure=f"第{row['failedRound']}轮，第{row['failedAfterInput']+1}步前停止 · {esc(k)}"
 cells=[f'{row["number"]:02}',*(rnd.get(i,'—') for i in range(1,5)),score if score is not None else '—',
        f'{row["wallMs"]/1000:.2f}',row['overBudget'],report if row['terminal'] else f'{failure} · {report}']
 rows_html.append('<tr>'+''.join(f'<td>{c}</td>' for c in cells)+'</tr>')
table_round=''.join(f'<tr><td>第{i+1}轮</td><td>{mean(v):.1f}</td><td>{median(v):.0f}</td><td>{min(v)}–{max(v)}</td></tr>' for i,v in enumerate(byround))
table_breakdown=''.join(f'<tr><td>{k}</td><td>{mean([r[f] for r in ok]):.1f}</td></tr>' for k,f in [('盘面','boardScore'),('终局板块','tileScore'),('卡牌','cardScore')])
style="""*{box-sizing:border-box}body{font:16px/1.55 system-ui,sans-serif;color:#182b32;background:#f4f7f7;margin:0}main{max-width:1160px;margin:2rem auto;padding:0 1rem}section,.card{background:white;padding:1rem 1.25rem;border:1px solid #d8e2e3;border-radius:12px;margin-bottom:1rem}h1{font-size:clamp(1.6rem,4vw,2.5rem);line-height:1.2}h2{font-size:1.2rem;margin:.25rem 0 .8rem}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem}.card b{display:block;font-size:1.55rem;color:#176563}.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem}svg{width:100%;font-size:14px;fill:#263c43}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:.42rem .55rem;text-align:right;border-bottom:1px solid #e1e9e9;white-space:nowrap}th:first-child,td:first-child,th:last-child,td:last-child{text-align:left}.scroll{overflow-x:auto}a{color:#0d6069}.hint{color:#4a6069}code{white-space:normal}"""
content=f"""<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SETI V661 · 20 局免电分析盘面</title><style>{style}</style><main>
<h1>V661 · 20 局免电分析盘面</h1>
<p>使用之前生成的原 20 个种子。白席选深空探测，由相同 V661 策略自主；其余三席在开局后只 PASS 和处理强制选择。未手选强开局，失败局不计入终局均值。</p>
<div class="cards"><div class="card">到达终局<b>{len(ok)} / {len(rows)}</b></div><div class="card">平均终局<b>{mean(scores):.1f} 分</b></div><div class="card">中位数<b>{median(scores):.0f} 分</b></div><div class="card">最低–最高<b>{min(scores)}–{max(scores)} 分</b></div></div>
<div class="charts"><section><h2>终局分布 · 只统计完成局</h2><svg viewBox="0 0 560 232" role="img" aria-label="终局得分区间分布"><path d="M45 188H545" stroke="#bacacc"/>{''.join(bars)}</svg></section>
<section><h2>轮末平均盘面分 · 固定使用同 17 局</h2><svg viewBox="0 0 560 232" role="img" aria-label="各轮平均盘面分"><path d="M50 195H520" stroke="#bacacc"/><polyline points="{' '.join(f'{x},{y}' for x,y in zip(xs,ys))}" fill="none" stroke="#1a6868" stroke-width="3"/>{''.join(line)}</svg></section></div>
<div class="charts"><section><h2>逐轮分布</h2><table><thead><tr><th>轮次</th><th>均分</th><th>中位数</th><th>最低–最高</th></tr></thead><tbody>{table_round}</tbody></table></section><section><h2>终局分数构成</h2><table><thead><tr><th>项目</th><th>完成局均分</th></tr></thead><tbody>{table_breakdown}</tbody></table></section></div>
<section><h2>20 局明细</h2><p class="hint">R1–R4 均为本轮 PASS 选牌和下一轮收入之前的盘面分。耗时为并行批测时的单局墙钟；超线次数按每个决策超过 256 个原生输入或 600 毫秒计。</p><div class="scroll"><table><thead><tr><th>盘面</th><th>R1</th><th>R2</th><th>R3</th><th>R4</th><th>终局</th><th>秒</th><th>单点超线</th><th>结果／复盘</th></tr></thead><tbody>{''.join(rows_html)}</tbody></table></div></section>
<section><h2>可以下什么结论</h2><p>完成局用时 {min(r['wallMs'] for r in ok)/1000:.2f}–{max(r['wallMs'] for r in ok)/1000:.2f} 秒，均低于 3 分钟。全部尝试共 {sum(r['overBudget'] for r in rows)} 次单点超线，最重 {max(r['maxNative'] for r in rows)} 次输入，最慢 {max(r['maxMs'] for r in rows)/1000:.2f} 秒。04、05、13 在原生效果模拟失败时停止；未提交失败的动作。全部已提交输入均独立原生复放，完整终局和失败存档都与原记录一致。</p>
<p><a href="../../ai-foundation-20261109/v661-random20-v1/v661-random20-verified-20261109-v1.json">原始统计和原生回放校验</a> · <a href="../../robot-iteration.html?ai=v2">V2 实验中心</a></p></section></main></html>"""
if len(sys.argv)>3:
 repaired=json.loads(Path(sys.argv[3]).read_text())
 add=''.join(f"<tr><td>{x['board']:02}</td><td>{x['score']}</td><td>{x['newInputs']}</td><td>{x['over']}</td></tr>" for x in repaired)
 appendix=("<section><h2>规则修复后的 3 局续跑</h2><p>从原失败存档继续；这 3 个分数单列，不计入上面的 V661 分布。</p>"
          "<table><thead><tr><th>盘面</th><th>终局分</th><th>续跑输入</th><th>续跑单点超线</th></tr></thead>"
          f"<tbody>{add}</tbody></table><p><a href='../../ai-foundation-20261109/v661-random20-repair-v1/repaired-terminals-20261109-v1.json'>查看续跑核验</a></p></section>")
 content=content.replace('</main>',appendix+'</main>')
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(content+'\n',encoding='utf-8')
