"""Restore only identified test inputs, then run the frozen source's inventory."""
import hashlib
import json
from pathlib import Path
import subprocess
import time

repo = Path(__file__).resolve().parents[1]
directory = repo / 'reports/ai-foundation-20261119'
manifest = json.loads((directory / 'blue-income-forecast-prototype-preflight-20261119-v2.json').read_text())
runtime = Path(manifest['runtime'])
output = directory / 'blue-income-admission-node-20261119-v1.json'
assert not output.exists(), 'Reuse the existing admission; do not rerun.'
prior = json.loads((repo / 'reports/ai-foundation-20261118/v514-route-admission-20261118-v1.json').read_text())
names = set()
for failure in prior['failures'].values():
    for name in failure.get('missing', []):
        for prefix in ['reports/', 'adhoc/', 'seti-saves/']:
            if prefix in name:
                name = name[name.index(prefix):]
                break
        names.add(name)

dependencies = []
for name in sorted(names):
    target = runtime / name
    if target.exists():
        continue
    process = subprocess.run(['git', 'show', manifest['sourceCommit'] + ':' + name],
                             cwd=repo, capture_output=True, timeout=20)
    if process.returncode:
        dependencies.append({'path': name, 'error': process.stderr.decode()[:300]})
        continue
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(process.stdout)
    dependencies.append({'path': name, 'bytes': len(process.stdout),
                         'sha256': hashlib.sha256(process.stdout).hexdigest()})

reused = ['randomizer/game/ai/state-value.test.js',
          'randomizer/game/ai/ready-analysis-capital.test.js']
command = ['node', 'tools/run_node_tests.js']
for name in reused:
    command.extend(['--exclude', name])
log = directory / 'blue-income-admission-node-20261119-v1.log'
assert not log.exists()
record = {'sourceCommit': manifest['sourceCommit'], 'runtime': str(runtime),
          'candidateChangedFiles': manifest['candidateChangedFiles'],
          'restoredInputs': dependencies, 'command': command,
          'previousExactSourcePassingTestsReused': reused,
          'log': str(log.relative_to(repo)), 'state': 'starting',
          'startedEpochSeconds': time.time(), 'newAutonomousGames': 0}
save = lambda: output.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
save()
print('Restored identified test inputs; starting frozen inventory.', flush=True)
with log.open('x') as stream:
    child = subprocess.Popen(command, cwd=runtime, stdout=stream, stderr=subprocess.STDOUT)
    record.update(state='running', pid=child.pid)
    save()
    while child.poll() is None:
        time.sleep(5)
        lines = log.read_text(errors='replace').splitlines()
        print(json.dumps({'pid': child.pid, 'elapsedSeconds': round(time.time() - record['startedEpochSeconds'], 1),
                          'logBytes': log.stat().st_size, 'lastLine': lines[-1][:200] if lines else ''}), flush=True)
    record.update(state='finished', exitCode=child.returncode, endedEpochSeconds=time.time())
record['summary'] = [line for line in log.read_text(errors='replace').splitlines()
                     if line.startswith(('SUMMARY ', 'FAIL '))]
record['logSha256'] = hashlib.sha256(log.read_bytes()).hexdigest()
save()
print(json.dumps({'exitCode': record['exitCode'], 'summary': record['summary']}), flush=True)
