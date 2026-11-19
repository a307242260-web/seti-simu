"""Run each original board at most once under the committed v486 policy."""
from pathlib import Path
import json
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'reports/ai-foundation-20261119'
preflight = json.loads((DATA / 'v487-source-admission-preflight-20261119-v1.json').read_text())
runtime = Path(preflight['runtime'])
catalog = json.loads((runtime / 'reports/fixed-boards/free-analyze-random20-20261104-v1.json').read_text())
boards = {board['number']: board for board in catalog['boards']}
output = DATA / 'v487-board08-full-20261119-v2.json'
assert not output.exists(), 'Reuse the existing batch checkpoint; do not restart games'
state = {'sourceCommit': preflight['sourceCommit'], 'runtime': str(runtime), 'plannedBoards': 1,
         'status': 'running', 'startedEpochSeconds': time.time(), 'attempts': []}


def save():
    output.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')


save()
for number in [8]:
    board = boards[number]
    name = f'v487-board{number:02d}-full-20261119'
    stdout = DATA / (name + '.attempt2.stdout.log')
    stderr = DATA / (name + '.attempt2.stderr.log')
    assert not stdout.exists() and not stderr.exists()
    args = ['node', 'tools/robot_iterate.js', 'run', '--name', name, '--full', '--seed', board['seed'],
            '--config', 'agentType=search,scenario=free-analyze-random20-guarded-v1',
            '--baseline', 'v486-original20-08-20261119', '--summary',
            'Committed v487 held-landing and deferred-income policy; one original board08 guarded full game; other three seats PASS.',
            '--date', '2026-11-19']
    row = {'boardNumber': number, 'seed': board['seed'], 'name': name, 'command': args,
           'startedEpochSeconds': time.time(), 'status': 'running',
           'stdout': str(stdout.relative_to(ROOT)), 'stderr': str(stderr.relative_to(ROOT))}
    state['attempts'].append(row)
    save()
    print('START', number, board['seed'], flush=True)
    with stdout.open('w') as out, stderr.open('w') as err:
        try:
            result = subprocess.run(args, cwd=runtime, stdout=out, stderr=err, timeout=195)
        except subprocess.TimeoutExpired:
            row.update(status='runner-timeout', endedEpochSeconds=time.time())
            state['status'] = 'stopped-at-first-failure'
            save()
            break
    row.update(exitCode=result.returncode, endedEpochSeconds=time.time())
    for file in (runtime / 'reports/research').glob('*.full.json'):
        record = json.loads(file.read_text())
        if record.get('name') != name:
            continue
        assert preflight['sourceCommit'].startswith(record['gitCommit'])
        searches = record.get('metrics', {}).get('searches', [])
        row.update(record=str(file.relative_to(runtime)), terminal=record.get('terminal'),
                   score=record.get('summary', {}).get('scores', {}).get('player-white'),
                   wallMs=record.get('wallMs'), stopReason=record.get('stopReason'),
                   maxNativeInputs=max((s['diagnostics']['nativeExecutions'] for s in searches), default=0),
                   maxMilliseconds=max((s['rootAndSearchMilliseconds'] for s in searches), default=0),
                   allSearchesComplete=all(s['complete'] for s in searches))
        if record.get('failure'):
            row['failure'] = record['failure']
            trace = runtime / record['failure']['attemptTracePath']
            if trace.exists():
                attempt = json.loads(trace.read_text().strip().splitlines()[-1])['search']
                row['failedSearchComplete'] = attempt['complete']
                row['failedNativeInputs'] = attempt['diagnostics']['nativeExecutions']
                row['failedMilliseconds'] = attempt['rootAndSearchMilliseconds']
                row['maxNativeInputs'] = max(row['maxNativeInputs'], row['failedNativeInputs'])
                row['maxMilliseconds'] = max(row['maxMilliseconds'], row['failedMilliseconds'])
        break
    admitted = result.returncode == 0 and row.get('terminal') and row.get('allSearchesComplete') \
        and row.get('maxNativeInputs', 9999) <= 256 and row.get('maxMilliseconds', 9999) <= 600 \
        and row.get('wallMs', 999999) <= 180000
    row['status'] = 'completed' if admitted else 'failed'
    save()
    print('RESULT', json.dumps(row, ensure_ascii=False), flush=True)
    if not admitted:
        state['status'] = 'stopped-at-first-failure'
        break
else:
    state['status'] = 'one-board-completed'
state['endedEpochSeconds'] = time.time()
save()
print('BATCH_END', state['status'], len(state['attempts']), flush=True)
