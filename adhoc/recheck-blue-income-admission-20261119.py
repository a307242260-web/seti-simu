"""Per-test checkpointed recheck of the remaining frozen-source failures."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time

repo = Path(__file__).resolve().parents[1]
directory = repo / 'reports/ai-foundation-20261119'
m = json.loads((directory / 'blue-income-forecast-prototype-preflight-20261119-v2.json').read_text())
runtime = Path(m['runtime'])
prior = json.loads((directory / 'blue-income-admission-retest-20261119-v1.json').read_text())
text = (repo / prior['log']).read_text()
names = set()
for name in re.findall(r"(?:open|stat) '([^']+)'", text) + re.findall(r"Cannot find module '([^']+)'", text):
    if name.startswith(str(runtime) + '/'):
        name = name[len(str(runtime)) + 1:]
    if name.startswith('../'):
        name = name[3:]
    if name.startswith(('reports/', 'adhoc/', 'seti-saves/')):
        names.add(name)
restored = []
for name in sorted(names):
    target = runtime / name
    if target.exists():
        continue
    result = subprocess.run(['git', 'show', m['sourceCommit'] + ':' + name], cwd=repo,
                            capture_output=True, timeout=20)
    if result.returncode:
        restored.append({'path': name, 'error': result.stderr.decode()[:300]})
        continue
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(result.stdout)
    restored.append({'path': name, 'bytes': len(result.stdout),
                     'sha256': hashlib.sha256(result.stdout).hexdigest()})

record_path = directory / 'blue-income-admission-per-test-20261119-v1.json'
if record_path.exists():
    record = json.loads(record_path.read_text())
    assert record['sourceCommit'] == m['sourceCommit']
    assert record['candidateChangedFiles'] == m['candidateChangedFiles']
else:
    record = {'sourceCommit': m['sourceCommit'], 'candidateChangedFiles': m['candidateChangedFiles'],
              'restoredInputs': restored, 'tests': {}, 'newAutonomousGames': 0}
save = lambda: record_path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
save()
for line in prior['summary']:
    if not line.startswith('FAIL '):
        continue
    test = line.split()[1]
    if test in record['tests']:
        assert record['tests'][test]['state'] == 'finished'
        continue
    log = directory / ('blue-income-admission-case-' + test.replace('/', '_') + '-20261119-v1.log')
    assert not log.exists()
    started = time.time()
    with log.open('x') as stream:
        result = subprocess.run(['node', 'tools/run_node_tests.js', '--match', test], cwd=runtime,
                                stdout=stream, stderr=subprocess.STDOUT)
    content = log.read_text(errors='replace')
    missing = re.findall(r"(?:open|stat) '([^']+)'", content)
    module = re.findall(r"Cannot find module '([^']+)'", content)
    kind = ('passed' if result.returncode == 0 else 'missing-file' if missing else
            'missing-module' if module else 'assertion' if 'AssertionError' in content else 'other-error')
    record['tests'][test] = {'state': 'finished', 'exitCode': result.returncode, 'kind': kind,
                            'missing': missing or module, 'seconds': time.time() - started,
                            'log': str(log.relative_to(repo)), 'logSha256': hashlib.sha256(log.read_bytes()).hexdigest()}
    save()
    print(json.dumps({'file': test, 'kind': kind, 'missing': missing or module}), flush=True)
record['counts'] = {kind: sum(row['kind'] == kind for row in record['tests'].values())
                    for kind in sorted({row['kind'] for row in record['tests'].values()})}
save()
print(json.dumps({'counts': record['counts']}), flush=True)
