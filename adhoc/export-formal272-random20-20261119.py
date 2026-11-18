"""Publish the stopped baseline evaluation; archive replay decisions, not search graphs."""
from pathlib import Path
import collections
import copy
import gzip
import hashlib
import html
import json
import shutil
import statistics
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'reports/ai-foundation-20261119'
PREFLIGHT = json.loads((DATA / 'formal272-random20-runtime-preflight-20261119-v1.json').read_text())
RUNTIME = Path(PREFLIGHT['runtime'])
GROUP = 'formal272-original20-20261119'
DIRECTORY = ROOT / 'reports/iteration' / GROUP
assert not DIRECTORY.exists() or not any(DIRECTORY.iterdir())
DIRECTORY.mkdir(parents=True, exist_ok=True)
owned = []
digest = lambda data: hashlib.sha256(data).hexdigest()


def put(relative, data):
    path = ROOT / relative
    assert not path.exists(), relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    owned.append(relative)


def dump(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


# These audit utilities do not change any of the 533 frozen runtime files.
audit_tools = {}
for name in ['tools/archive_research_replay.js', 'tools/research-record-retention.js']:
    assert not (RUNTIME / name).exists()
    data = (ROOT / name).read_bytes()
    audit_tools[name] = {'sha256': digest(data), 'source': data.decode('utf8')}
    (RUNTIME / name).write_bytes(data)
put(f'reports/iteration/{GROUP}/verification-tool-inputs-20261119-v1.json.gz',
    gzip.compress(dump(audit_tools), mtime=0))

catalog = json.loads((RUNTIME / 'reports/fixed-boards/free-analyze-random20-20261104-v1.json').read_text())
by_seed = {}
files = []
native_replay_inputs = 0
for source in sorted((RUNTIME / 'reports/research').glob('*.full.json')):
    original = source.read_bytes()
    record = json.loads(original)
    board = next(board for board in catalog['boards'] if board['seed'] == record['seed'])
    searches = record.get('metrics', {}).get('searches', [])
    row = {'number': board['number'], 'name': board['name'], 'seed': record['seed'],
           'recordPath': str(source.relative_to(RUNTIME)), 'sourceRecordSha256': digest(original),
           'terminal': record['terminal'], 'wallMs': record['wallMs'],
           'roundEnds': record['roundEnds'], 'status': 'completed' if record['terminal'] else 'failed',
           'score': record.get('summary', {}).get('scores', {}).get('player-white'),
           'maxNativeInputs': max((s['diagnostics']['nativeExecutions'] for s in searches), default=0),
           'maxMilliseconds': max((s['rootAndSearchMilliseconds'] for s in searches), default=0)}
    if record['terminal']:
        archive_path = RUNTIME / ('board-' + str(board['number']) + '-replay.json')
        result = subprocess.run(['node', 'tools/archive_research_replay.js', str(source), str(archive_path)],
                                cwd=RUNTIME, capture_output=True, text=True, timeout=30)
        assert result.returncode == 0, (result.stdout, result.stderr)
        proof = json.loads(result.stdout.strip())
        assert proof['verified']
        native_replay_inputs += proof['inputs']
        archive = json.loads(archive_path.read_text())
        relative = f'reports/iteration/{GROUP}/board-{board["number"]:02d}-replay-20261119-v1.json.gz'
        packed = gzip.compress(archive_path.read_bytes(), mtime=0)
        assert gzip.decompress(packed) == archive_path.read_bytes()
        put(relative, packed)
        row['replayArchive'] = relative
        row['nativeReplayVerified'] = proof
        put(record['agentTracePath'], ('\n'.join(json.dumps(d, ensure_ascii=False) for d in archive['decisions']) + '\n').encode())
        put(record['savePath'], (RUNTIME / record['savePath']).read_bytes())
        report = f'reports/iteration/{record["name"]}/{source.stem}.action-log.html'
        put(report, (RUNTIME / report).read_bytes())
        row['actionReport'] = report
    else:
        attempts_path = RUNTIME / record['failure']['attemptTracePath']
        attempts = [json.loads(line) for line in attempts_path.read_text().splitlines()]
        assert len(attempts) == 1
        attempt = attempts[0]['search']
        row['maxNativeInputs'] = max(row['maxNativeInputs'], attempt['diagnostics']['nativeExecutions'])
        row['maxMilliseconds'] = max(row['maxMilliseconds'], attempt['rootAndSearchMilliseconds'])
        row['failedAttempt'] = {'round': attempts[0]['context']['observation']['publicState']['roundNumber'],
            'turn': attempts[0]['context']['observation']['publicState']['turnNumber'],
            'beforeInput': record['steps'] + 1, 'searchComplete': attempt['complete'],
            'nativeInputs': attempt['diagnostics']['nativeExecutions'],
            'milliseconds': attempt['rootAndSearchMilliseconds'], 'actionCommitted': False,
            'logicalTransitions': attempt['diagnostics']['transitions'],
            'logicalActionCounts': dict(collections.Counter(e['actionId'].split(':')[0]
                for e in attempt['sharedPrefixGraph']['edges'])),
            'note': 'Logical edges include proved fixed inputs and are not a Native input distribution.'}
        assert row['failedAttempt']['searchComplete'] and row['failedAttempt']['nativeInputs'] == 302
        for key in ['checkpointPath', 'attemptTracePath']:
            path = RUNTIME / record['failure'][key]
            relative = f'reports/iteration/{GROUP}/board-06-{key}-20261119-v1.json.gz'
            put(relative, gzip.compress(path.read_bytes(), mtime=0))
            row[key + 'Archive'] = relative
        # Preserve the raw failure's generic flag; the failed-attempt trace is authoritative for closure.
        row['originalFailure'] = record['failure']
        row['originalFailureMetadataIsNotClosureEvidence'] = True
    compact = subprocess.run(['node', '-e',
        "const fs=require('fs'),r=require('./tools/research-record-retention');const d=JSON.parse(fs.readFileSync(process.argv[1]));d.metrics.searches=d.metrics.searches.map(r.compactSearch);process.stdout.write(JSON.stringify(d));",
        str(source)], cwd=RUNTIME, capture_output=True, text=True, timeout=15)
    assert compact.returncode == 0, compact.stderr
    archived_record = json.loads(compact.stdout)
    archived_record['archiveRetention'] = {'mode': 'decisions-and-budgets', 'sourceRecordSha256': digest(original),
        'sourceCommit': PREFLIGHT['sourceCommit'], 'replayArchive': row.get('replayArchive'),
        'activeFailedCheckpoint': row.get('checkpointPathArchive'), 'roundAssetsRetained': True,
        'fullSearchGraphsOmitted': True, 'activeResearchSavesRetained': bool(record['terminal'])}
    put(row['recordPath'], dump(archived_record))
    by_seed[record['seed']] = row
    files.append(source.name)

rows = [by_seed.get(board['seed'], {**board, 'status': 'not-run'}) for board in catalog['boards']]
completed = [row for row in rows if row['status'] == 'completed']
scores = [row['score'] for row in completed]
assert scores and len(completed) == 5 and len(by_seed) == 6
summary = {'schemaVersion': 'seti-original20-baseline-evaluation-v1', 'sourceCommit': PREFLIGHT['sourceCommit'],
    'policyVersion': 'seti-complete-decision-search-v483/seti-purpose-capital-state-value-v71',
    'planned': 20, 'attempted': 6, 'completed': 5, 'failed': 1, 'notRun': 14,
    'completedOnly': {'mean': statistics.mean(scores), 'median': statistics.median(scores),
        'minimum': min(scores), 'maximum': max(scores), 'meanSeconds': statistics.mean(r['wallMs'] for r in completed) / 1000},
    'full20MeanEstablished': False, 'stageTargetOver200Established': False,
    'formalTeachingBoardScoreUnchanged': 272, 'newAutonomousGames': 6,
    'newCompletedAutonomousGames': 5, 'nativeReplayInputs': native_replay_inputs,
    'baselinePolicyChanged': False, 'stoppedAtFirstFailure': True,
    'roundBoundary': 'before-pass-card-and-income', 'rows': rows,
    'limits': 'Completed-only statistics are selected partial results, not the mean or completion rate of all20 boards. Remaining boards were not run. Existing validation debt is not waived.'}
put(f'reports/iteration/{GROUP}/summary-20261119-v1.json', dump(summary))
esc = lambda value: html.escape(str(value))
table = []
for row in rows:
    rounds = {r['round']: r['score'] for r in row.get('roundEnds', [])}
    details = ''
    if row.get('roundEnds'):
        cells = []
        for r in row['roundEnds']:
            income = r['income']; resources = r['resources']; tech = r['technology']
            cells.append('<tr><td>' + str(r['round']) + '</td><td>' + str(r['score']) + '</td><td>'
                + esc(' / '.join(str(income.get(k, 0)) for k in ['credits','energy','availableData','handSize','additionalPublicScan','publicity']))
                + '</td><td>' + esc(' / '.join(str(resources.get(k, 0)) for k in ['credits','energy','availableData','handSize','publicity']))
                + '</td><td>' + esc(', '.join(tech['ownedTiles'])) + '; 蓝槽 ' + esc(tech['blueBoardSlots']) + '</td></tr>')
        details = '<details><summary>逐轮资产</summary><table><tr><th>轮</th><th>盘面分</th><th>收入 钱/电/数据/牌/扫描/宣传</th><th>余额 钱/电/数据/牌/宣传</th><th>科技</th></tr>' + ''.join(cells) + '</table></details>'
    report = row.get('actionReport')
    links = ('<a href="../../' + esc(report.removeprefix('reports/')) + '">逐行动复盘</a>' if report else '')
    status = {'completed':'完整终局','failed':'门槛拒绝，未完成','not-run':'未运行'}[row['status']]
    table.append('<tr id="board-' + str(row['number']).zfill(2) + '"><td>' + str(row['number']).zfill(2) + '</td><td>'
        + status + '</td>' + ''.join('<td>' + str(rounds.get(i, '—')) + '</td>' for i in range(1,5))
        + '<td>' + str(row.get('score') if row.get('terminal') else '—') + '</td><td>'
        + (f'{row["wallMs"]/1000:.2f}' if 'wallMs' in row else '—') + '</td><td>' + str(row.get('maxNativeInputs','—'))
        + '</td><td>' + (f'{row["maxMilliseconds"]:.1f}' if 'maxMilliseconds' in row else '—') + '</td><td>' + links + details + '</td></tr>')
body = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>既有272分策略 · 原20盘面阶段评估</title><style>body{font:16px/1.65 system-ui,sans-serif;color:#233247;background:#f4f6fa;margin:0;padding:30px}main{max-width:1200px;margin:auto;background:white;padding:30px;border-radius:12px}h1{font-size:27px}p{max-width:940px}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:9px;border-bottom:1px solid #dde3eb;text-align:left;vertical-align:top}th{background:#eef2f8}a{color:#1560ad}details{font-size:12px;min-width:160px}details table{font-size:12px}section{overflow:auto}.note{padding:15px;background:#fff4d9;border-radius:6px}.stats{font-size:23px;color:#175c83}code{overflow-wrap:anywhere}</style><main><h1>既有272分策略：原20盘面阶段评估</h1><p class="stats">完成5盘 · 失败1盘 · 尚未运行14盘</p>
<p>已完成成绩为135、140、138、145、135分；均分138.6，中位数138，范围135–145。该局部结果距离均分超过200的阶段方向仍有明显差距。</p>
<p class="note">这里只统计已完成的5盘，不能当作全部20盘的均分。第6盘触发256次原生输入门槛后停止批次，其余14盘没有运行。</p>
<h2>速度与失败位置</h2><p>第6盘停在第四轮第2回合、第169个输入之前。失败搜索已经闭合，用时297.2毫秒，但原生输入为302次，超过256次门槛；建议动作未提交。图中578个逻辑步骤包含已证明的固定步骤，与302次原生输入是不同计数。未放宽预算继续执行。</p>
<h2>逐盘结果</h2><p>第一至第四轮分数均取PASS选牌与下一轮收入之前；终局分包含正式板块与卡牌计分。时间为游戏执行时间，不包含登记和生成报告的耗时。</p>
<section><table><thead><tr><th>盘面</th><th>状态</th><th>首轮</th><th>二轮</th><th>三轮</th><th>四轮</th><th>终局</th><th>秒</th><th>最高原生输入</th><th>最高毫秒</th><th>证据</th></tr></thead><tbody>'''
body += ''.join(table) + '''</tbody></table></section><h2>方法与数据边界</h2><p>使用2026-11-04生成的原20盘面，白席选择深空探测；其余三席只PASS及处理强制选择。策略保持已完成272分教学局的v483/v71，执行规则为838395727。272来自另一个教学盘面，不是随机盘面的预期分数。每次决策须闭合且不超过256次原生输入、600毫秒；整局不超过180秒。已有验证债务没有据此豁免，也没有采用冻结候选。</p>
<p>完成盘面保存紧凑种子／行动／决策记录，并以同一原生内核重放核对最终状态、会话和随机数。仅失败点保留额外检查点与完整搜索证据；未复制完成盘面的完整搜索图。</p>
<p><a href="summary-20261119-v1.json">结构化逐轮数据与来源</a></p>
</main></html>'''
put(f'reports/iteration/{GROUP}/summary-20261119-v1.html', body.encode())
assert sum(1 for row in rows if row['status'] == 'not-run') == 14
assert statistics.mean(scores) == 138.6
for name, expected in PREFLIGHT['sourceFiles'].items():
    assert digest((RUNTIME / name).read_bytes()) == expected, name
manifest = {'ownedPaths': owned, 'summary': summary['completedOnly'], 'newAutonomousGames': 6,
    'sourceFilesVerifiedUnchanged': len(PREFLIGHT['sourceFiles']), 'newNativeReplayInputs': native_replay_inputs,
    'newArtifactsBytes': sum((ROOT / p).stat().st_size for p in owned)}
put(f'reports/iteration/{GROUP}/export-manifest-20261119-v1.json', dump(manifest))
print(json.dumps(manifest, ensure_ascii=False))
