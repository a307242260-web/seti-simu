"""Distinguish new regressions from failed assertions in the exact V71 source."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time

repo = Path(__file__).resolve().parents[1]
directory = repo / 'reports/ai-foundation-20261119'
m = json.loads((directory / 'blue-income-forecast-prototype-preflight-20261119-v2.json').read_text())
runtime = Path(m['runtime'])
prior = json.loads((directory / 'blue-income-admission-per-test-20261119-v1.json').read_text())
output = directory / 'blue-income-admission-baseline-comparison-20261119-v1.json'
assert not output.exists()
names = set()
for row in prior['tests'].values():
    for name in row.get('missing', []):
        if name.startswith(str(runtime) + '/'):
            name = name[len(str(runtime)) + 1:]
        if name.startswith('../'):
            name = name[3:]
        if name.startswith(('reports/', 'adhoc/', 'seti-saves/')):
            names.add(name)
names.add('reports/research/7bb2c6d4.60f8cca6.quick-24.json')
library = subprocess.run(['node', '-e',
    "const l=require('./tools/robot-iteration-lib'),fs=require('node:fs');const x=JSON.parse(fs.readFileSync(l.REGISTRY_PATH));console.log(JSON.stringify(x.versions.filter(v=>v.id.startsWith('ai-foundation')).flatMap(v=>v.results.flatMap(r=>[r.recordPath,r.savePath,r.reportPath])).filter(Boolean)));"],
    cwd=runtime, capture_output=True, text=True)
if library.returncode == 0:
    names.update(json.loads(library.stdout))
restored = []
bytes_restored = 0
for name in sorted(names):
    if not name.startswith(('reports/', 'adhoc/', 'seti-saves/')):
        continue
    target = runtime / name
    if target.exists():
        continue
    blob = subprocess.run(['git', 'show', m['sourceCommit'] + ':' + name],
                          cwd=repo, capture_output=True, timeout=20)
    if blob.returncode:
        restored.append({'path': name, 'error': blob.stderr.decode()[:300]})
        continue
    bytes_restored += len(blob.stdout)
    assert bytes_restored <= 128 * 1024 * 1024
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(blob.stdout)
    restored.append({'path': name, 'bytes': len(blob.stdout),
                     'sha256': hashlib.sha256(blob.stdout).hexdigest()})

baseline = Path(tempfile.mkdtemp(prefix='seti-v71-admission-baseline-20261119-', dir='/private/tmp'))
for name, digest in m['sourceFiles'].items():
    source = Path(m['sourceRuntime']) / name
    assert hashlib.sha256(source.read_bytes()).hexdigest() == digest, name
    target = baseline / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
for name in ['reports', 'adhoc', 'seti-saves']:
    assert not (baseline / name).exists(), 'Do not replace baseline source with fixture links'
    (baseline / name).symlink_to(runtime / name, target_is_directory=True)

record = {'sourceCommit': m['sourceCommit'], 'baselineRuntime': str(baseline),
          'candidateRuntime': str(runtime), 'restoredInputs': restored, 'tests': {},
          'baselineSourceHashesVerified': True, 'newAutonomousGames': 0,
          'limits': 'The same failed assertion is not a pass; later assertions remain unverified.'}
save = lambda: output.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
save()
def signature(text, root):
    text = text.replace(str(root), '<runtime>')
    match = re.search(r'\n(?:AssertionError(?: \[[^\]]+\])?|TypeError|Error):', text)
    if not match:
        return text[-1200:]
    return text[match.start():].split('\n    at ')[0].strip()

for name, row in prior['tests'].items():
    if row['kind'] == 'passed':
        continue
    roots = [('baseline', baseline)]
    if row['kind'] in ['missing-file', 'missing-module'] or name.startswith('tools/robot-'):
        roots.append(('candidate', runtime))
    pair = {}
    for label, root in roots:
        log = directory / ('blue-income-admission-' + label + '-' + name.replace('/', '_') + '-20261119-v1.log')
        assert not log.exists()
        started = time.time()
        with log.open('x') as stream:
            child = subprocess.run(['node', name], cwd=root, stdout=stream, stderr=subprocess.STDOUT)
        text = log.read_text(errors='replace')
        pair[label] = {'exitCode': child.returncode, 'seconds': time.time() - started,
                       'signature': signature(text, root), 'log': str(log.relative_to(repo)),
                       'missing': re.findall(r"(?:open|stat) '([^']+)'", text)}
    candidate_signature = (pair['candidate']['signature'] if 'candidate' in pair else
                           signature((repo / row['log']).read_text(), runtime))
    pair['sameFailureSignature'] = pair['baseline']['exitCode'] != 0 and pair['baseline']['signature'] == candidate_signature
    record['tests'][name] = pair
    save()
    print(json.dumps({'file': name, 'baselineExit': pair['baseline']['exitCode'],
                      'candidateExit': pair.get('candidate', {}).get('exitCode', row['exitCode']),
                      'sameFailureSignature': pair['sameFailureSignature']}), flush=True)
