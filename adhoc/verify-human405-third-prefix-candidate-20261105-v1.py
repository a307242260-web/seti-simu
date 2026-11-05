"""Verify the frozen candidate on a clean base export, without changing production."""
from pathlib import Path
import hashlib
import io
import json
import subprocess
import tarfile
import tempfile

stage = Path(__file__).resolve().parents[1]
repo = Path('/Users/bilibili/code/seti-simu')
manifest_path = Path('reports/ai-foundation-20261105/candidate-v192-computer-prefix-20261105-v1/manifest.json')
manifest = json.loads((stage / manifest_path).read_text())
folder = Path('reports/ai-foundation-20261105/third-round-teacher-v1')
output = folder / 'v192-independent-candidate-verification-20261105-v1.json'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
if (stage / output).exists():
    saved = json.loads((stage / output).read_text())
    assert saved['manifestSha256'] == sha(stage / manifest_path)
    for path, digest in saved['logsSha256'].items():
        assert sha(stage / path) == digest
    print(json.dumps({'reused': True, 'output': str(output)}))
    raise SystemExit(0)

snapshot = Path(tempfile.mkdtemp(prefix='seti-v192-clean-candidate-'))
paths = ['randomizer', 'assets/cards/card_model.json',
    'reports/ai-foundation-20261105/third-round-teacher-v1/teacher-r3-before-safety-protocol-root-20261105-v1.json',
    'adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-024-20261030-v1.json',
    'reports/ai-foundation-20261104/two-rounds-teacher-v2/v148-first-launch-timing-native-20261104-v1.json']
archive = subprocess.check_output(['git', 'archive', '--format=tar', manifest['baseCommit'], *paths], cwd=repo)
with tarfile.open(fileobj=io.BytesIO(archive)) as stream:
    for member in stream.getmembers():
        assert not Path(member.name).is_absolute() and '..' not in Path(member.name).parts
        assert member.isfile() or member.isdir(), member.name
    stream.extractall(snapshot)
for name, digest in manifest['sourceHashes'].items():
    source = stage / manifest_path.parent / name
    assert sha(source) == digest
    dest = snapshot / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(source.read_bytes())
    if name.endswith('.js'):
        subprocess.run(['node', '--check', name], cwd=snapshot, check=True)
for name, digest in manifest['baseRuntimeHashes'].items():
    assert sha(snapshot / name) == manifest['sourceHashes'].get(name, digest), name
assert sha(snapshot / 'assets/cards/card_model.json') == sha(stage / 'assets/cards/card_model.json')
subprocess.run(['node', '-e', 'const a=require("./randomizer/game/ai/value-arithmetic");if(!(a.scale>0&&a.incomePopulation>0))throw Error("missing catalog in verification export")'], cwd=snapshot, check=True)

logs = {}
for label, test in [('computer-prefix', 'randomizer/game/ai/computer-prefix-plan.test.js'), ('winning-preparation', 'randomizer/game/ai/winning-income-plan.test.js')]:
    result = subprocess.run(['node', test], cwd=snapshot, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=55)
    log = folder / f'v192-independent-{label}-20261105-v2.log'
    assert not (stage / log).exists(), 'preserve first independent test output'
    (stage / log).write_bytes(result.stdout)
    assert result.returncode == 0, result.stdout.decode()
    logs[str(log)] = sha(stage / log)
result = {'status': 'passed', 'candidateAdmitted': False, 'baseCommit': manifest['baseCommit'],
    'manifest': str(manifest_path), 'manifestSha256': sha(stage / manifest_path),
    'snapshot': str(snapshot), 'baseExportPaths': paths, 'allBaseRuntimeAndOverlayHashesMatched': True,
    'productionChanged': False, 'newAutonomousRuns': 0,
    'logsSha256': logs,
    'earlierVerificationSetupFailure': {'log': str(folder / 'v192-independent-computer-prefix-20261105-v1.log'), 'reason': 'First sparse export omitted assets/cards/card_model.json; empty catalog produced scale0. Candidate source unchanged; add committed catalog to clean export.'},
    'scope': 'Clean committed base plus exact archived overlay; two changed behavior tests only, not full source admission.'}
(stage / output).write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'output': str(output), 'status': result['status'], 'productionChanged': False}))
