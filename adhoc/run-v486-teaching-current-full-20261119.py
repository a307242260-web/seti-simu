"""One registered unchanged-source teaching baseline; never retry a record."""
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'reports/ai-foundation-20261119'
pre = json.loads((DATA / 'v486-random20-runtime-preflight-20261119-v1.json').read_text())
runtime = Path(pre['runtime'])
name = 'v486-teaching-current-full-20261119'
output = DATA / (name + '-v1.json')
assert not output.exists(), 'Reuse existing checkpoint; no identical rerun'
state = {'schemaVersion': 'seti-unchanged-source-teaching-baseline-v1',
         'sourceCommit': pre['sourceCommit'], 'runtime': str(runtime), 'status': 'preflight',
         'strategyChanged': False, 'newFullGameAttempts': 0, 'startedEpochSeconds': time.time()}


def persist():
    output.write_text(json.dumps(state, indent=2) + '\n')


def sha(content):
    return hashlib.sha256(content).hexdigest()


persist()
try:
    assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=runtime).decode().strip() == pre['sourceCommit']
    for relative, expected in pre['sourceFiles'].items():
        assert sha((runtime / relative).read_bytes()) == expected, relative
    point = json.loads((DATA / pre['pointAdmission']).read_text())
    assert point['complete'] and point['nativeInputs'] <= 256 and point['milliseconds'] <= 600
    for relative, expected in point['changedFiles'].items():
        assert sha((runtime / relative).read_bytes()) == expected, relative
    checks = json.loads((DATA / pre['relatedValidation']).read_text())
    def exit_codes(value):
        if isinstance(value, dict):
            if 'exitCode' in value:
                yield value['exitCode']
            for item in value.values():
                yield from exit_codes(item)
        elif isinstance(value, list):
            for item in value:
                yield from exit_codes(item)
    codes = list(exit_codes(checks))
    assert codes and all(code == 0 for code in codes), codes
    state['reusedRelatedCheckExitCodes'] = codes
    duplicates = []
    for directory in [ROOT / 'reports/research', runtime / 'reports/research']:
        for file in directory.glob('*.full.json'):
            record = json.loads(file.read_text())
            if pre['sourceCommit'].startswith(str(record.get('gitCommit', 'missing'))) \
                    and (record.get('scenario') or {}).get('id') == 'human405-white-current-full-v1':
                duplicates.append(str(file))
    assert not duplicates, duplicates
    proof_path = 'reports/ai-foundation-20261023/human405-white-only-opening-20261030-v1.json'
    proof_bytes = (ROOT / proof_path).read_bytes()
    proof = json.loads(proof_bytes)
    checkpoint_bytes = (ROOT / proof['checkpointPath']).read_bytes()
    assert sha(checkpoint_bytes) == proof['checkpointSha256']
    assert proof['checkpointSha256'] == 'ab9a0dbbb3c35c453604addd668bd2625a4580c0577924d87c6cb8eff9c01b9c'
    state['openingResources'] = {}
    for relative, content in [(proof_path, proof_bytes), (proof['checkpointPath'], checkpoint_bytes)]:
        destination = runtime / relative
        if destination.exists():
            assert destination.read_bytes() == content, relative
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(content)
        state['openingResources'][relative] = sha(content)
    command = ['node', 'tools/robot_iterate.js', 'run', '--name', name, '--full',
               '--seed', 'seti-free-analyze-v1', '--config',
               'agentType=search,scenario=human405-white-current-full-v1,compactReplay=true',
               '--summary', 'Unchanged accepted v486 source; first full fixed23 teaching-board baseline. White autonomous; other three PASS/forced. No strategy changes.',
               '--date', '2026-11-19']
    stdout = DATA / (name + '.stdout.log')
    stderr = DATA / (name + '.stderr.log')
    assert not stdout.exists() and not stderr.exists()
    state.update(command=command, stdout=str(stdout.relative_to(ROOT)), stderr=str(stderr.relative_to(ROOT)),
                 status='running', newFullGameAttempts=1, runnerStartedEpochSeconds=time.time())
    persist()
    print('START unchanged v486 fixed23 teaching full game', flush=True)
    with stdout.open('w') as out, stderr.open('w') as err:
        child = subprocess.Popen(command, cwd=runtime, stdout=out, stderr=err, start_new_session=True)
        state['runnerPid'] = child.pid
        persist()
        try:
            code = child.wait(timeout=195)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGTERM)
            try:
                child.wait(timeout=1)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGKILL)
                child.wait()
            state['runnerTimedOut'] = True
            code = 124
    state.update(exitCode=code, runnerEndedEpochSeconds=time.time())
    matches = []
    for file in (runtime / 'reports/research').glob('*.full.json'):
        record = json.loads(file.read_text())
        if record.get('name') == name:
            matches.append((file, record))
    assert len(matches) == 1, [str(file) for file, _ in matches]
    file, record = matches[0]
    assert pre['sourceCommit'].startswith(record['gitCommit'])
    assert record['scenario']['openingCheckpointSha256'] == proof['checkpointSha256']
    searches = record.get('metrics', {}).get('searches', [])
    maximum_native = max((row['diagnostics']['nativeExecutions'] for row in searches), default=0)
    maximum_ms = max((row['rootAndSearchMilliseconds'] for row in searches), default=0)
    failure = record.get('failure')
    if failure and failure.get('attemptTracePath'):
        trace = runtime / failure['attemptTracePath']
        if trace.exists():
            last = json.loads(trace.read_text().strip().splitlines()[-1])['search']
            maximum_native = max(maximum_native, last['diagnostics']['nativeExecutions'])
            maximum_ms = max(maximum_ms, last['rootAndSearchMilliseconds'])
            state['failedSearchComplete'] = last['complete']
    admitted = code == 0 and record.get('terminal') and searches \
        and all(row['complete'] for row in searches) and maximum_native <= 256 \
        and maximum_ms <= 600 and record['wallMs'] <= 180000
    state.update(status='completed' if admitted else 'failed', record=str(file.relative_to(runtime)),
                 terminal=record.get('terminal'), score=record.get('summary', {}).get('scores', {}).get('player-white'),
                 wallMs=record.get('wallMs'), stopReason=record.get('stopReason'), maxNative=maximum_native,
                 maxMilliseconds=maximum_ms, roundEnds=record.get('roundEnds', []), failure=failure)
    for relative, expected in pre['sourceFiles'].items():
        assert sha((runtime / relative).read_bytes()) == expected, relative
    state['sourceFilesUnchangedAfterRun'] = True
    persist()
    print(json.dumps({key: value for key, value in state.items() if key not in ['roundEnds', 'openingResources', 'command']}, ensure_ascii=False), flush=True)
except Exception as error:
    state.update(status='failed', preflightOrCollectionFailure=repr(error))
    persist()
    raise
