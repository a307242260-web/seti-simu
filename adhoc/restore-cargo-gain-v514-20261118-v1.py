"""Restore archived v514 without any previous temporary checkout or AI run."""
from pathlib import Path
import hashlib
import io
import json
import subprocess
import tarfile
import tempfile

R = Path(__file__).resolve().parents[1]
M = R / 'reports/ai-foundation-20261118'
D = R / 'reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1'
sha = lambda b: hashlib.sha256(b).hexdigest()
read = lambda p: json.loads(p.read_text())
final_path = M / 'cargo-gain-v514-source-20261118-v1.json'
final = read(final_path)
checks_path = R / final['parentManifest']
assert sha(checks_path.read_bytes()) == final['parentManifestSha256']
checks = read(checks_path)
v513_path = R / checks['parentManifest']
assert sha(v513_path.read_bytes()) == checks['parentManifestSha256']
v513 = read(v513_path)
v512_path = R / v513['parentManifest']
assert sha(v512_path.read_bytes()) == v513['parentManifestSha256']
v512 = read(v512_path)
old_path = R / v512['baseManifest']
assert sha(old_path.read_bytes()) == v512['baseManifestSha256']
old = read(old_path)
out = Path(tempfile.mkdtemp(prefix='seti-v514-standalone-20261118-'))
blob = subprocess.check_output(['git', 'archive', old['base'], 'randomizer', 'tools', 'docs', 'assets/cards/card_model.json'], cwd=R)
with tarfile.open(fileobj=io.BytesIO(blob)) as archive:
    archive.extractall(out)
subprocess.run(['git', 'apply', '--unidiff-zero', str(D / old['patch'])], cwd=out, check=True)
for p, f in old['fixtures'].items():
    target = out / p
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes((D / f).read_bytes())
for manifest in [v512, v513, checks, final]:
    patch = R / manifest['incrementalPatch']
    assert sha(patch.read_bytes()) == manifest['patchSha256']
    subprocess.run(['git', 'apply', '--unidiff-zero', str(patch)], cwd=out, check=True)
    for p, f in manifest.get('fixtureMapping', {}).items():
        target = out / p
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes((R / f).read_bytes())
    paths = manifest.get('paths') or {**manifest['unchangedParentPaths'], **manifest['changedPaths']}
    for p, h in paths.items():
        assert sha((out / p).read_bytes()) == h, p
dependencies = {**v513['testDependenciesFromBase']['paths'],
                **read(M / 'cargo-gain-v514-browser-dependencies-20261118-v1.json')['paths']}
for p, h in dependencies.items():
    data = subprocess.check_output(['git', 'show', old['base'] + ':' + p], cwd=R)
    assert sha(data) == h, p
    target = out / p
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
for p in final['changedTextPaths']:
    if p.endswith('.js'):
        subprocess.run(['node', '--check', str(out / p)], check=True)
receipt = {'sourceManifestSha256': sha(final_path.read_bytes()), 'restoredRoot': str(out),
           'sourceFilesVerified': len(final['paths']), 'namedTestDependenciesVerified': len(dependencies),
           'priorTemporaryCheckoutUsed': False, 'newAISearches': 0, 'newGames': 0}
receipt_path = M / 'cargo-gain-v514-restoration-20261118-v1.json'
if receipt_path.exists():
    # Multiple independent restores do not rerun an experiment; preserve the
    # first receipt and avoid silently changing its recorded filesystem path.
    print(json.dumps(receipt))
else:
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(receipt))
