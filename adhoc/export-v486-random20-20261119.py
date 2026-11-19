"""Export the single-source guarded evaluation and verify compact Native replay archives."""
from pathlib import Path
import gzip
import hashlib
import html
import json
import statistics
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'reports/ai-foundation-20261119'
manifest = json.loads((DATA / 'v486-random20-runtime-preflight-20261119-v1.json').read_text())
runtime = Path(manifest['runtime'])
batch = json.loads((DATA / 'v486-random20-batch-20261119-v1.json').read_text())
assert batch['status'] != 'running'
GROUP = 'v486-original20-20261119'
directory = ROOT / 'reports/iteration' / GROUP
directory.mkdir(parents=True, exist_ok=True)
owned = []
digest = lambda b: hashlib.sha256(b).hexdigest()


def data(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


def put(name, content):
    target = ROOT / name
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        assert target.read_bytes() == content, name
    else:
        target.write_bytes(content)
    if name not in owned:
        owned.append(name)


tools = {}
for name in ['tools/archive_research_replay.js', 'tools/research-record-retention.js']:
    content = (ROOT / name).read_bytes()
    tools[name] = {'sha256': digest(content), 'source': content.decode('utf8')}
    target = runtime / name
    if target.exists():
        assert target.read_bytes() == content
    else:
        target.write_bytes(content)
put(f'reports/iteration/{GROUP}/verification-tools-20261119-v1.json.gz', gzip.compress(data(tools), mtime=0))
catalog = json.loads((runtime / 'reports/fixed-boards/free-analyze-random20-20261104-v1.json').read_text())
by_number = {}
replayed = 0
for attempt in batch['attempts']:
    source = runtime / attempt['record']
    raw = source.read_bytes()
    record = json.loads(raw)
    assert manifest['sourceCommit'].startswith(record['gitCommit'])
    row = {'number': attempt['boardNumber'], 'seed': record['seed'], 'status': attempt['status'],
           'recordPath': attempt['record'], 'sourceRecordSha256': digest(raw), 'terminal': record['terminal'],
           'score': attempt.get('score'), 'wallMs': attempt['wallMs'],
           'maxNativeInputs': attempt['maxNativeInputs'], 'maxMilliseconds': attempt['maxMilliseconds'],
           'roundEnds': record['roundEnds']}
    archive = None
    if row['status'] == 'completed':
        receipt = directory / f'board-{row["number"]:02d}-verification-20261119-v1.json'
        archive_file = runtime / f'v486-board-{row["number"]:02d}-replay.json'
        if receipt.exists():
            proof = json.loads(receipt.read_text())
            assert proof['sourceRecordSha256'] == digest(raw)
            archive = json.loads(archive_file.read_text())
        else:
            result = subprocess.run(['node', 'tools/archive_research_replay.js', str(source), str(archive_file)],
                                    cwd=runtime, capture_output=True, text=True, timeout=30)
            assert result.returncode == 0, (result.stdout, result.stderr)
            proof = json.loads(result.stdout.strip())
            proof['sourceRecordSha256'] = digest(raw)
            assert proof['verified']
            receipt.write_bytes(data(proof))
            archive = json.loads(archive_file.read_text())
        owned.append(str(receipt.relative_to(ROOT)))
        replayed += proof['inputs']
        relative = f'reports/iteration/{GROUP}/board-{row["number"]:02d}-replay-20261119-v1.json.gz'
        put(relative, gzip.compress(archive_file.read_bytes(), mtime=0))
        row['replayArchive'] = relative
        row['nativeReplayVerified'] = True
        put(record['agentTracePath'], ('\n'.join(json.dumps(d, ensure_ascii=False) for d in archive['decisions']) + '\n').encode())
        put(record['savePath'], (runtime / record['savePath']).read_bytes())
        report = f'reports/iteration/{record["name"]}/{source.stem}.action-log.html'
        put(report, ('\n'.join(line.rstrip() for line in (runtime / report).read_text().splitlines()) + '\n').encode())
        row['actionReport'] = report
    else:
        row['failure'] = record['failure']
        for key in ['checkpointPath', 'attemptTracePath']:
            name = record['failure'][key]
            put(name, (runtime / name).read_bytes())
        row['failedNativeInputs'] = attempt.get('failedNativeInputs')
        row['failedMilliseconds'] = attempt.get('failedMilliseconds')
        row['failedSearchComplete'] = attempt.get('failedSearchComplete')
    result = subprocess.run(['node', '-e',
        "const fs=require('fs'),r=require('./tools/research-record-retention');const d=JSON.parse(fs.readFileSync(process.argv[1]));d.metrics.searches=d.metrics.searches.map(r.compactSearch);process.stdout.write(JSON.stringify(d));",
        str(source)], cwd=runtime, capture_output=True, text=True, timeout=15)
    assert result.returncode == 0, result.stderr
    compact = json.loads(result.stdout)
    compact['archiveRetention'] = {'mode': 'decisions-and-budgets', 'sourceRecordSha256': digest(raw),
        'replayArchive': row.get('replayArchive'), 'fullSearchGraphsOmitted': True,
        'activeBenchmarkSavesRetained': True, 'roundAssetsRetained': True}
    put(attempt['record'], data(compact))
    by_number[row['number']] = row

rows = [by_number.get(b['number'], {**b, 'status': 'not-run'}) for b in catalog['boards']]
completed = [r for r in rows if r['status'] == 'completed']
failed = [r for r in rows if r['status'] not in ['completed', 'not-run']]
scores = [r['score'] for r in completed]
stats = {'mean': statistics.mean(scores), 'median': statistics.median(scores),
         'minimum': min(scores), 'maximum': max(scores),
         'meanSeconds': statistics.mean(r['wallMs'] for r in completed) / 1000,
         'maximumSeconds': max(r['wallMs'] for r in completed) / 1000}
distribution = [{'label': label, 'count': sum(low <= score < high for score in scores)}
    for label, low, high in [('<100', 0, 100), ('100–119', 100, 120), ('120–139', 120, 140),
                             ('140–159', 140, 160), ('160–199', 160, 200), ('≥200', 200, float('inf'))]]
rounds = []
for number in range(1, 5):
    states = [next(r for r in row['roundEnds'] if r['round'] == number) for row in completed]
    rounds.append({'round': number, 'meanBoardScore': statistics.mean(r['score'] for r in states),
        'meanTechCount': statistics.mean(len(r['technology']['ownedTiles']) for r in states),
        'meanCreditsIncome': statistics.mean(r['income']['credits'] for r in states),
        'meanEnergyIncome': statistics.mean(r['income']['energy'] for r in states),
        'meanCreditsRemaining': statistics.mean(r['resources']['credits'] for r in states),
        'meanEnergyRemaining': statistics.mean(r['resources']['energy'] for r in states)})
summary = {'schemaVersion': 'seti-v486-original20-evaluation-v1', 'sourceCommit': manifest['sourceCommit'],
    'policyVersion': manifest['policyVersion'], 'planned': 20, 'attempted': len(batch['attempts']),
    'completed': len(completed), 'failed': len(failed), 'notRun': 20-len(batch['attempts']),
    'completedOnly': stats, 'full20MeanEstablished': len(completed) == 20,
    'distributionCompletedOnly': distribution,
    'batchWallSecondsIncludingRegistryAndReports': batch['endedEpochSeconds'] - batch['startedEpochSeconds'],
    'gameSimulationSecondsTotal': sum(r['wallMs'] for r in completed) / 1000,
    'stageMeanOver200Passed': len(completed) == 20 and stats['mean'] > 200,
    'roundAveragesCompletedOnly': rounds, 'rows': rows, 'nativeReplayInputsVerified': replayed,
    'allCompletedReplayVerified': all(r['nativeReplayVerified'] for r in completed),
    'maximumNativeInputsIncludingFailedAttempt': max(r.get('maxNativeInputs', 0) for r in rows),
    'maximumMillisecondsIncludingFailedAttempt': max(r.get('maxMilliseconds', 0) for r in rows),
    'formalTeachingBoardScoreNotRerun': 272, 'oldVersionRecordsPreserved': True,
    'roundBoundary': 'before-pass-card-and-income'}
put(f'reports/iteration/{GROUP}/summary-20261119-v1.json', data(summary))
esc = lambda value: html.escape(str(value))
html_rows = []
for row in rows:
    by_round = {r['round']: r['score'] for r in row.get('roundEnds', [])}
    status = {'completed': '完整终局', 'failed': '失败，未完成', 'not-run': '未运行'}.get(row['status'], row['status'])
    links = ''
    if row.get('actionReport'):
        links = '<a href="../../' + esc(row['actionReport'].removeprefix('reports/')) + '">逐行动复盘</a>'
    details = []
    for r in row.get('roundEnds', []):
        income = r['income']; wallet = r['resources']; tech = r['technology']
        details.append('<tr><td>' + str(r['round']) + '</td><td>' + str(r['score']) + '</td><td>'
            + esc('/'.join(str(income.get(k, 0)) for k in ['credits','energy','availableData','handSize','additionalPublicScan','publicity']))
            + '</td><td>' + esc('/'.join(str(wallet.get(k, 0)) for k in ['credits','energy','availableData','handSize','publicity']))
            + '</td><td>' + esc(', '.join(tech['ownedTiles'])) + '; ' + esc(tech['blueBoardSlots']) + '</td></tr>')
    if details:
        links += '<details><summary>逐轮资产</summary><table><tr><th>轮</th><th>盘面分</th><th>收入：钱/电/数据/牌/扫描/宣传</th><th>余额：钱/电/数据/牌/宣传</th><th>科技与蓝槽</th></tr>' + ''.join(details) + '</table></details>'
    html_rows.append('<tr><td>' + f'{row["number"]:02d}' + '</td><td>' + status + '</td>'
        + ''.join('<td>' + str(by_round.get(i, '—')) + '</td>' for i in range(1,5))
        + '<td>' + str(row.get('score') if row.get('terminal') else '—') + '</td><td>'
        + (f'{row["wallMs"]/1000:.2f}' if 'wallMs' in row else '—') + '</td><td>' + str(row.get('maxNativeInputs','—'))
        + '</td><td>' + (f'{row["maxMilliseconds"]:.1f}' if 'maxMilliseconds' in row else '—') + '</td><td>' + links + '</td></tr>')
complete_text = f'完成{len(completed)}盘，失败{len(failed)}盘，未运行{20-len(batch["attempts"])}盘'
scope = '全部20盘的均分' if len(completed) == 20 else '仅已完成盘面的均分，不能当作20盘均分'
distribution_html = ''.join('<tr><td>' + esc(r['label']) + '</td><td>' + str(r['count'])
    + '</td><td><div style="height:12px;background:#2e789f;width:' + str(r['count'] * 5) + '%"></div></td></tr>' for r in distribution)
round_html = ''.join('<tr><td>' + str(r['round']) + '</td>' + ''.join('<td>' + f'{r[k]:.2f}' + '</td>' for k in
    ['meanBoardScore','meanTechCount','meanCreditsIncome','meanEnergyIncome','meanCreditsRemaining','meanEnergyRemaining']) + '</tr>' for r in rounds)
page = f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>v486原20盘面验收</title>
<style>body{{font:16px/1.6 system-ui;color:#243249;background:#f3f6fa;padding:24px}}
main{{max-width:1250px;margin:auto;background:white;padding:28px;border-radius:12px}}
h1{{font-size:28px}}table{{border-collapse:collapse;width:100%;font-size:14px}}
td,th{{padding:9px;text-align:left;border-bottom:1px solid #dde4ed;vertical-align:top}}
th{{background:#edf3fa}}section{{overflow:auto}}details{{font-size:12px}}details table{{font-size:12px}}
a{{color:#1566a8}}.stats{{font-size:24px;color:#165b80}}.note{{background:#fff4d9;padding:14px}}</style>
<main><h1>v486：原20个免电分析盘面验收</h1>
<p class="stats">{complete_text} · 均分 {stats['mean']:.2f} · 中位数 {stats['median']:.1f}</p>
<p>{scope}。分数范围{stats['minimum']}–{stats['maximum']}；完整局平均{stats['meanSeconds']:.2f}秒，最慢{stats['maximumSeconds']:.2f}秒。</p>
<p class="note">阶段目标为20盘全部完成且均分超过200。本批该目标{'通过' if summary['stageMeanOver200Passed'] else '尚未通过'}。
教学盘272分来自不同盘面，不代表这20盘的水平。失败与未运行盘面不按0分混入均分，也不从完成率分母中删除。</p>
<h2>分数分布</h2><table><tr><th>分数区间</th><th>盘数</th><th>占原20盘的比例</th></tr>{distribution_html}</table>
<h2>逐轮平均发展</h2>
<p>以下均值只包含完整终局盘面；科技数量包含已拥有的具体板块，逐盘明细可查看蓝槽位置。</p>
<table><tr><th>轮次</th><th>盘面分</th><th>科技数</th><th>钱收入</th><th>电收入</th><th>剩余钱</th><th>剩余电</th></tr>{round_html}</table>
<h2>逐盘结果与轮末资产</h2>
<p>轮末分数取PASS选牌及下一轮收入前；终局分包含正式板块与卡牌分。各盘均为同一提交版本，白席深空探测行动，其余三席只PASS和处理强制选择。</p>
<section><table><tr><th>盘面</th><th>状态</th><th>首轮</th><th>二轮</th><th>三轮</th><th>四轮</th><th>终局</th><th>秒</th><th>最高原生输入</th><th>最高毫秒</th><th>证据</th></tr>
{''.join(html_rows)}</table></section>
<h2>方法与限制</h2>
<p>固定原2026-11-04的20个随机盘面，不筛选起手牌。源码提交为{manifest['sourceCommit']}，策略v486-runezu-free-pick/v71。
每次决策须完整闭合且不超过256次原生输入、600毫秒，整局不超过180秒；任一盘失败即停止扩大批次。
记录保留失败尝试、源码身份和轮末资产；没有在批次中修改策略或放宽门槛。</p>
<p>游戏执行累计{summary['gameSimulationSecondsTotal']:.1f}秒；包含逐盘登记和逐行动报告生成的整批墙钟为{summary['batchWallSecondsIncludingRegistryAndReports']:.1f}秒。
单局秒数仅指游戏执行，不把登记和报告生成时间表述为AI决策时间。</p>
<p>完成局已通过同一Production内核的种子与行动重放，核对最终状态、会话和随机数；累计{replayed}次重放输入不计作新的自主对局。
完整搜索图不进入完成局历史归档，保留紧凑决策和预算；本批仍在研究的存档保留用于逐行动复盘。</p>
<p><a href="summary-20261119-v1.json">完整结构化数据与来源</a> ·
<a href="../formal272-original20-20261119/summary-20261119-v1.html">旧版本阶段记录</a></p></main></html>'''
put(f'reports/iteration/{GROUP}/summary-20261119-v1.html', page.encode())
for name, expected in manifest['sourceFiles'].items():
    assert digest((runtime / name).read_bytes()) == expected, name
export = {'ownedPaths': owned, 'sourceCommit': manifest['sourceCommit'], 'sourceFilesVerified': len(manifest['sourceFiles']),
          'newAutonomousGameAttempts': len(batch['attempts']), 'completed': len(completed), 'failed': len(failed),
          'replayInputsVerified': replayed, 'stats': stats,
          'newArtifactsBytes': sum((ROOT / p).stat().st_size for p in owned)}
put(f'reports/iteration/{GROUP}/export-manifest-20261119-v1.json', data(export))
print(json.dumps(export, ensure_ascii=False))
