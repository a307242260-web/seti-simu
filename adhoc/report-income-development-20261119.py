"""Publish the completed native card investigation and descriptive cohort audit."""
from pathlib import Path
import json
import time

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'reports/ai-foundation-20261119'
REPORTS = ROOT / 'reports/expert-learning-20261119'


def read(name):
    return json.loads((BASE / f'{name}-20261119-v1.json').read_text())


def write(name, data):
    (BASE / f'{name}-20261119-v1.json').write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + '\n')


audit = read('original20-income-development-audit')
gap = read('original20-development-gap')
quality = read('original20-income-audit-quality')
native = read('fusion18-native-witness-proof')
outcome = read('fusion18-versus-trade-outcome')
assert quality['currencyAndHandIncomeChecks'] == 180
assert native['status'] == 'verified' and native['expected'] == native['actual']
assert outcome['status'] == 'not-supported-as-an-improvement'
summary = audit['summary']
reference = gap['teacherSeedAIReference']
choices = summary['choices'][:3]
assert sum(c['selections'] for c in choices) == 51
assert sum(c['creditOfferedButDeclined'] for c in choices) == 9

route = read('fusion18-native-route')
route.update(status='closed-no-profitable-witness', completedEpochSeconds=time.time(),
             nativePreparationInputs=61, nativeCounterfactualInputs=33,
             independentReplayInputs=183, newAISearches=0, newFullGames=0,
             policyChanged=False, outcome='fusion18-versus-trade-outcome-20261119-v1.json',
             replayProof='fusion18-native-witness-proof-20261119-v1.json',
             failedHypothesis='fusion18-r4-prefix-20261119-v1.json',
             disposition='Do not add fusion-card acquisition priority for this case.')
write('fusion18-native-route', route)
pointer = read('final-currency-next-resource-card')
pointer.update(status='closed-no-profitable-witness', policyChanged=False,
               outcome='fusion18-versus-trade-outcome-20261119-v1.json',
               reproducibility='fusion18-native-witness-proof-20261119-v1.json',
               nextEvidence='original20-development-gap-20261119-v1.json')
write('final-currency-next-resource-card', pointer)

def money(income):
    return ' / '.join(f'{income[k]:g}' for k in ['credits', 'energy', 'handSize'])


round_rows = []
for row, ref in zip(summary['rounds'], reference['roundEnds']):
    rnd = row['round']
    own = sum(c['selections'] for c in summary['choices'] if c['round'] <= rnd) / 20
    other = sum(v for k, v in reference['incomeChoicesByRound'].items() if int(k) <= rnd)
    round_rows.append(f'<tr><td>{rnd}</td><td>{money(row["meanIncome"])}</td>'
                      f'<td>{row["meanTech"]:g} / {gap["meanBlueByRound"][str(rnd)]:g}</td>'
                      f'<td>{own:g}</td><td>{money(ref["income"])}</td>'
                      f'<td>{len(ref["technology"]["ownedTiles"])} / '
                      f'{len(ref["technology"]["blueBoardSlots"])}</td><td>{other}</td></tr>')

board_rows = []
for record, tech in zip(audit['records'], gap['cohort']):
    assert record['board'] == tech['board']
    r3 = record['roundEnds'][2]
    count = sum(c['board'] == record['board'] and c['round'] <= 3 for c in audit['choices'])
    board_rows.append(f'<tr><td>{record["board"]}</td><td>{record["score"]}</td>'
                      f'<td>{money(record["initial"]["income"])}</td><td>{money(r3["income"])}</td>'
                      f'<td>{r3["techCount"]} / {tech["rounds"][2]["blue"]}</td><td>{count}</td></tr>')

html = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SETI 收入与科技发展诊断 · 2026-11-19</title>
<style>body{font:16px/1.85 system-ui,-apple-system,"PingFang SC",sans-serif;background:#f2f5f8;color:#25354a;max-width:1120px;margin:30px auto;padding:0 18px 50px}article{background:white;border:1px solid #dce4ee;border-radius:14px;padding:30px}h1{font-size:29px;line-height:1.45}h2{font-size:21px;margin-top:32px}a{color:#175a9e}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:10px;border-bottom:1px solid #dce4ee;text-align:left;vertical-align:top}th{background:#edf3f8}.scroll{overflow:auto}.lead{font-size:19px;color:#174468}.note{font-size:14px;color:#596c81}.callout{background:#fff6e5;border-left:4px solid #b8892e;padding:12px 16px}@media(max-width:650px){article{padding:16px}h1{font-size:24px}}</style><article>
<p class="note">原20盘完整终局与教学种子自主AI对照 · 2026-11-19</p>
<h1>发展差距集中在钱收入与收入获取次数，单纯补电不足以解决</h1>
<p class="lead">原20盘到第三轮平均已有3.95电收入，接近272分教学盘的4；钱收入只有3.85，对照为7。前三轮平均收入选择2.55次，对照为6次。下一项策略验证应定位早期科技与收入来源如何支持持续行动，而非统一提高电收入或某张资源牌的优先级。</p>
<p class="callout">已验收V72的教学种子自主终局仍为272分。原20盘的134.35均分来自旧v486，V72尚未重跑这20盘。本报告的新增调查没有运行AI搜索或新整局，也没有采用新的取牌、收入或科技策略。</p>
<h2>高手思路如何用于当前AI</h2>
<div class="scroll"><table><tr><th>高手的判断</th><th>当前策略与证据</th><th>改进应满足的条件</th></tr>
<tr><td>先确定要连续执行的行动，再配置科技与收入。</td><td>已有资源需求、蓝槽回补和用途估值，但不同盘面的发展水平差异较大。教学盘前三轮6次收入选择，原20盘平均2.55次。</td><td>从相同状态找出下一条已知、可支付且有净收益的路线，核查研究、扫描或电脑流程在哪一处断开。</td></tr>
<tr><td>关键资源牌要与持牌和支付能力配套。</td><td>燃料箱出现案例缺少足够能量收入手牌；第18盘聚变反应堆也未证明值得取得并打出。</td><td>扣除取牌、打出、手牌与宣传的机会成本；不能同时把同一张牌用于收入、角标和组合。</td></tr>
<tr><td>本轮的回补次数决定可持续执行多少次行动。</td><td>平均电收入已接近教学盘；钱收入、蓝科技和收入选择次数差距更明显。</td><td>区分收入选择来源、蓝槽即时回补和轮初收入，不把收入选择次数直接当作电脑循环次数。</td></tr>
<tr><td>移动与转板服务于登陆、宣传及后续资金。</td><td>移动已绑定目的；扫描、发射和手牌登陆的受控候选尚未带来自主提分。</td><td>继续使用目的明确的固定准备计划，共享相同前置，不恢复方向、兑换或弃牌组合的盲目枚举。</td></tr>
<tr><td>末轮也要区分可用资源与无法兑现的库存。</td><td>V72已修正一类无后续用途的末轮货币残值，教学盘保持272分。</td><td>可支付登陆和真实回补仍保留价值；不能把第四轮资源价值整体清零。</td></tr>
</table></div>
<p class="note">高手部分来自702与599两组共八集讲解；公司、卡池、物种、轮数和对手条件不同。详见<a href="expert-strategy-review-20261119-v1.html">高手思路与条件边界</a>。</p>
<h2>先分开开局配置，再比较后续发展</h2>
<div class="scroll"><table><tr><th>指标</th><th>原20盘均值</th><th>教学种子自主272分</th></tr>
<tr><td>实际开局收入：钱 / 电 / 牌</td><td>2.75 / 2.85 / 1.45</td><td>4 / 2 / 1</td></tr>
<tr><td>第三轮末收入：钱 / 电 / 牌</td><td>3.85 / 3.95 / 1.8</td><td>7 / 4 / 2</td></tr>
<tr><td>相对自身开局的增长</td><td>+1.1 / +1.1 / +0.35</td><td>+3 / +2 / +1</td></tr>
<tr><td>第三轮末科技总数 / 蓝科技</td><td>3.8 / 1.7</td><td>6 / 3</td></tr>
<tr><td>前三轮累计收入选择</td><td>2.55次</td><td>6次</td></tr>
</table></div>
<p>第三轮钱收入的3.15差距，按账面可拆为开局1.25和之后增长1.9。这是不同盘面的描述性差异，尚不能归因于单一策略。蓝科技较多也不自动等于高分：仍须检查取得时机、槽位、所需数据及实际回补。</p>
<p>前三轮收入菜单中，共9次出现“有钱收入可选、但选择了其他收入”。仅静态替换这些选择，平均每盘涉及0.45次；它提示应检查选牌理由，但不足以把整体差距归结为选错收入。改变早期选择还可能影响后续路线，静态统计不能充当整局因果估计。</p>
<h2>逐轮发展</h2>
<p class="note">收入均按钱 / 电 / 牌列示；科技按总数 / 蓝科技列示。轮末为本轮收益结算后、PASS选牌与下一轮收入前。收入选择为累计次数，可能来自电脑或其他正式效果。</p>
<div class="scroll"><table><tr><th rowspan="2">轮次</th><th colspan="3">原20盘均值</th><th colspan="3">教学种子自主272分</th></tr><tr><th>收入</th><th>科技</th><th>收入选择</th><th>收入</th><th>科技</th><th>收入选择</th></tr>
''' + ''.join(round_rows) + '''</table></div>
<h2>聚变反应堆：可取得，但此案例没有有利的使用见证</h2>
<p>第18盘第三轮第8turn公开出现该牌时，白席为0钱、0电、6宣传、5数据，主行动已完成。固定替代路线可以用宣传取牌，并保留第三轮末72盘面分、原科技与永久收入；代价是用新获虫牌的宣传角标支付原科技，改变手牌并少留1宣传。这证明取得路线合法，不证明它优于原路线。</p>
<p>第四轮开始后，该路线在6钱、2电、4张手牌的相同起点比较打牌与普通兑换。当前内核中，聚变反应堆按高于公司基础的电收入计数；此时2电收入全部属于公司基础，因此效果计数为0，只有自身加入收入带来的即时1电。</p>
<div class="scroll"><table><tr><th>同状态行动</th><th>行动后钱 / 电</th><th>手牌</th><th>本turn主行动</th><th>永久电收入</th></tr>
<tr><td>支付3钱打出聚变反应堆</td><td>3 / 3</td><td>3</td><td>已使用</td><td>3</td></tr>
<tr><td>普通2钱兑换1电</td><td>4 / 3</td><td>4</td><td>仍可用</td><td>2</td></tr></table></div>
<p>两者当前正式预计终局分均为106，额外永久电收入已没有后续常规轮初结算。尚未证明存在值得为之支付额外成本的后续按收入计数效果，因此不增加该牌取牌优先级；这一结论仅限本状态，不表示该牌在其他收入结构下没有价值。</p>
<h2>下一项策略验证</h2>
<ol><li>从原20盘第一、二轮定位最早的收入获取或蓝科技分歧，核对当时已经可见的信息与资源；同时区分开局配置差异。</li>
<li>在同一原生状态验证替代路线：取得科技、补数据、收入与后续受益行动逐笔记账，区分候选缺失、贪心准备和价值评估问题。</li>
<li>只修改有正收益见证的部分；先过单点256次原生输入／600ms，再运行唯一自主教学整局。实际行动和完整资产改善后，才扩大到原20盘；单局仍不超过180秒。</li></ol>
<h2>20盘明细</h2><p class="note">终局分为完整终局计分；收入和科技取第三轮末。</p>
<div class="scroll"><table><tr><th>盘面</th><th>终局分</th><th>开局收入</th><th>第三轮末收入</th><th>科技 / 蓝科技</th><th>前三轮收入选择</th></tr>
''' + ''.join(board_rows) + '''</table></div>
<h2>方法与可复现证据</h2>
<p class="note">统计仅计白席，复用原20盘已完成记录，校验20份轨迹SHA。前三轮60个轮末的钱、电、牌收入共180项检查通过，其收入增量均可由已记录的收入选择核对；第四轮部分效果会直接加入收入，不据菜单次数作同样推断。教学参考是AI自主272分记录，不是405分手操记录，也不是20盘的同种子对照。原20盘源码为94299f38；当前验收源码为e08665e6（v490／V72），本次未改Production。</p>
<p class="note">聚变反应堆受控调查使用61步历史准备及33步分支输入，没有调用AI搜索或运行新整局。另以183步独立原生重放验证完整状态、session和RNG；该存档为非终局见证，不作为成绩。最初高估即时电收益的失败断言单独保留，不作为通过记录。历史调查脚本含当时隔离目录路径；跨环境复现以存档指定ruleCommit和已提交重放工具为准。</p>
<ul>
<li><a href="../ai-foundation-20261119/original20-income-development-audit-20261119-v1.json">收入与全部候选明细</a> · <a href="../ai-foundation-20261119/original20-development-gap-20261119-v1.json">科技及教学盘对照</a> · <a href="../ai-foundation-20261119/original20-income-audit-quality-20261119-v1.json">180项检查与轨迹校验</a></li>
<li><a href="../ai-foundation-20261119/fusion18-versus-trade-outcome-20261119-v1.json">同状态打牌与兑换</a> · <a href="../ai-foundation-20261119/fusion18-native-witness-proof-20261119-v1.json">183步重放证明</a> · <a href="../ai-foundation-20261119/fusion18-native-witness-replay-20261119-v1.json.gz">精简重放存档</a></li>
<li><a href="../../docs/save-replay-guide.md">重放工具与存档说明</a> · <a href="expert-strategy-trials-20261119-v1.html">已完成策略对照与当前验收结果</a></li>
</ul></article></html>
'''
path = REPORTS / 'income-development-diagnosis-20261119-v1.html'
path.write_text(html)

path = REPORTS / 'expert-strategy-review-20261119-v1.html'
s = path.read_text()
s = s.replace('本次没有运行新对局或采用新策略。', '后续同状态验证未支持普遍提高资源登陆或组合牌优先级；V72已修正一类末轮货币残值，教学盘保持272分。详见<a href="expert-strategy-trials-20261119-v1.html">策略验证</a>与<a href="income-development-diagnosis-20261119-v1.html">20盘发展诊断</a>。')
s = s.replace('第18盘公开出现过，须先验证获得及使用成本，不能归为持牌未打。', '第18盘公开出现。受控路线可取得，但实际打出仅即时得1电，普通兑换成本更低；未支持增加取牌优先级。')
s = s.replace('按收入回能量及按手牌移动', '按高于公司基础的收入回能量及按手牌移动')
s = s.replace('现行AI源码以已验收提交94299f38为准', '原20盘源码为94299f38，现行已验收源码为e08665e6（V72）')
path.write_text(s)

path = REPORTS / 'expert-strategy-trials-20261119-v1.html'
s = path.read_text()
start = s.index('<h2>下一项改进的证据要求</h2>')
end = s.index('<h2>方法与证据</h2>', start)
s = s[:start] + '''<h2>20盘发展诊断与组合牌裁决</h2><p>第18盘聚变反应堆已完成合法获取与同状态使用对照。当前2电收入全部来自公司基础，打牌仅即时得1电；普通2钱换1电保留更多钱、手牌和主行动。未证明后续有净收益，因此不增加取牌优先级，也没有为此运行新整局。183步独立原生重放验证完整状态、session和RNG一致。</p><p>原20盘第三轮平均钱收入3.85、电收入3.95、蓝科技1.7项；教学种子自主272分分别为7、4、3项。前三轮收入选择平均2.55次，对照为6次。开局配置也有差异；下一项验证应定位早期科技与收入来源的真实断点，不能将差距直接归因于某个权重。</p><p><a href="income-development-diagnosis-20261119-v1.html">收入与科技发展诊断：逐轮对照、20盘明细和原生证据</a></p>''' + s[end:]
old = '自主候选源码提交f365a881b，验收策略仍为v486／94299f38。354条原生重放已验证终态、session及RNG一致。标准实验在终局和逐行动报告生成后，因隔离目录缺少总览模板退出；补回既有模板后完成总览输出，没有重跑AI。前两次准备检查也在AI执行前退出，均保留记录。'
new = '扫描候选源码为f365a881b；现行验收源码为e08665e6（v490／V72），原20盘成绩来源为v486／94299f38。完整重放已核对终态、session及RNG；各次候选的失败与正式结果均保留于所链接证据。'
assert old in s
s = s.replace(old, new)
path.write_text(s)
print(json.dumps({'report': str(REPORTS / 'income-development-diagnosis-20261119-v1.html'),
                  'qualityChecks': 180, 'independentNativeReplayInputs': 183,
                  'policyChanged': False, 'newGames': 0}, ensure_ascii=False))
