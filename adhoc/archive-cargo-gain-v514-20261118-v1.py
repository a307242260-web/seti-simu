"""Archive and independently restore the final v514 prototype before timing."""
from pathlib import Path
import difflib
import hashlib
import json
import subprocess
import tempfile

R = Path(__file__).resolve().parents[1]
M = R / 'reports/ai-foundation-20261118'
out = M / 'cargo-gain-v514-source-20261118-v1.json'
sha = lambda b: hashlib.sha256(b).hexdigest()
build = json.loads((M / 'cargo-gain-v514-build-20261118-v1.json').read_text())
parent_path = R / build['parentManifest']
parent = json.loads(parent_path.read_text())
base = Path(parent['runtime'])
runtime = Path(build['runtime'])
parent_paths = {**parent['unchangedParentPaths'], **parent['changedPaths']}
files = [*parent_paths, 'randomizer/game/ai/cargo-gain-reuse.test.js',
         'randomizer/game/ai/fixtures/cargo-gain-reuse-20261118-v1.json.gz']
paths = {p: sha((runtime / p).read_bytes()) for p in files}
if out.exists():
    assert json.loads(out.read_text())['paths'] == paths, 'Do not amend measured source'
    print('REUSE', out)
    raise SystemExit(0)
patch = []
changed = []
for p in files:
    if p.endswith('.gz'):
        continue
    before = (base / p).read_bytes() if (base / p).exists() else b''
    after = (runtime / p).read_bytes()
    if before == after:
        continue
    changed.append(p)
    patch.extend(difflib.unified_diff(before.decode().splitlines(True), after.decode().splitlines(True),
        fromfile='a/' + p if (base / p).exists() else '/dev/null', tofile='b/' + p, n=0))
patch_path = M / 'cargo-gain-v514-source-20261118-v1.patch'
patch_path.write_text(''.join(patch))
sealed = Path(tempfile.mkdtemp(prefix='seti-cargo-gain-v514-sealed-20261118-'))
subprocess.run(['cp', '-cR', str(base) + '/.', str(sealed)], check=True)
subprocess.run(['git', 'apply', '--unidiff-zero', str(patch_path)], cwd=sealed, check=True)
for p, source in build['fixtureMapping'].items():
    (sealed / p).write_bytes((R / source).read_bytes())
for p, h in paths.items():
    assert sha((sealed / p).read_bytes()) == h, p
for p, h in parent_paths.items():
    assert sha((base / p).read_bytes()) == h, p
for p in changed:
    if p.endswith('.js'):
        subprocess.run(['node', '--check', str(sealed / p)], check=True)
result = {'candidate': 'v514', 'promoted': False, 'parentManifest': str(parent_path.relative_to(R)),
          'parentManifestSha256': sha(parent_path.read_bytes()), 'paths': paths,
          'sourceFilesVerified': len(paths), 'changedTextPaths': changed,
          'incrementalPatch': str(patch_path.relative_to(R)), 'patchSha256': sha(patch_path.read_bytes()),
          'fixtureMapping': build['fixtureMapping'], 'sealedRoot': str(sealed),
          'keySourceSha256': sha((R / build['keySource']).read_bytes()),
          'restore': 'Restore the50-file parent and its named base/test dependencies, apply incrementalPatch with git apply --unidiff-zero, copy fixtureMapping, verify all52 paths. The formal v485 runtime remains unchanged.'}
out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'files': len(paths), 'changedText': len(changed), 'sealed': str(sealed)}))
