"""Restore explicit missing inputs from the frozen Git source, then retest failures."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time

repo = Path(__file__).resolve().parents[1]
directory = repo / 'reports/ai-foundation-20261119'
manifest = json.loads((directory / 'blue-income-forecast-prototype-preflight-20261119-v2.json').read_text())
runtime = Path(manifest['runtime'])
prior = json.loads((directory / 'blue-income-admission-node-20261119-v1.json').read_text())
log_text = (repo / prior['log']).read_text()
names = set()
for name in re.findall(r"(?:open|stat) '([^']+)'", log_text):
    if name.startswith(str(runtime) + '/'):
        name = name[len(str(runtime)) + 1:]
    if name.startswith(('reports/', 'adhoc/', 'seti-saves/')):
        names.add(name)
failed = [line.split()[1] for line in prior['summary'] if line.startswith('FAIL ')]
for test in failed:
    source = (runtime / test).read_text()
    # Inputs named directly in a read/require are reproducible dependencies;
    # files that do not exist at the frozen commit are never fabricated.
    for name in re.findall(r'(?:reports|adhoc|seti-saves)/[A-Za-z0-9_./-]+\.(?:json|js|gz|html)', source):
        names.add(name)
entries = []
for name in sorted(names):
    target = runtime / name
    if target.exists():
        continue
    process = subprocess.run(['git', 'show', manifest['sourceCommit'] + ':' + name],
                             cwd=repo, capture_output=True, timeout=20)
    if process.returncode:
        entries.append({'path': name, 'unavailableAtSource': True,
                        'error': process.stderr.decode()[:250]})
        continue
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(process.stdout)
    entries.append({'path': name, 'bytes': len(process.stdout),
                    'sha256': hashlib.sha256(process.stdout).hexdigest()})

record_path = directory / 'blue-income-admission-retest-20261119-v1.json'
log_path = directory / 'blue-income-admission-retest-20261119-v1.log'
assert not record_path.exists() and not log_path.exists()
command = ['node', 'tools/run_node_tests.js']
for test in failed:
    command.extend(['--match', test])
record = {'sourceCommit': manifest['sourceCommit'], 'candidateChangedFiles': manifest['candidateChangedFiles'],
          'restoredInputs': entries, 'tests': failed, 'command': command,
          'state': 'starting', 'startedEpochSeconds': time.time(), 'log': str(log_path.relative_to(repo)),
          'newAutonomousGames': 0, 'previousPassingTestsNotRepeated': True}
save = lambda: record_path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
save()
print(json.dumps({'restoredInputs': sum('bytes' in entry for entry in entries),
                  'restoredBytes': sum(entry.get('bytes', 0) for entry in entries),
                  'retestingFailures': len(failed)}), flush=True)
with log_path.open('x') as stream:
    child = subprocess.Popen(command, cwd=runtime, stdout=stream, stderr=subprocess.STDOUT)
    record.update(state='running', pid=child.pid)
    save()
    while child.poll() is None:
        time.sleep(5)
        print(json.dumps({'pid': child.pid, 'elapsedSeconds': round(time.time() - record['startedEpochSeconds'], 1),
                          'logBytes': log_path.stat().st_size}), flush=True)
    record.update(state='finished', exitCode=child.returncode, endedEpochSeconds=time.time())
record['summary'] = [line for line in log_path.read_text(errors='replace').splitlines()
                     if line.startswith(('SUMMARY ', 'FAIL '))]
record['logSha256'] = hashlib.sha256(log_path.read_bytes()).hexdigest()
save()
print(json.dumps({'exitCode': record['exitCode'], 'summary': record['summary']}), flush=True)
