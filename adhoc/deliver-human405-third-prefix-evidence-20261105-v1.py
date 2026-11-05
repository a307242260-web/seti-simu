"""Deliver candidate evidence and scope only; production runtime stays at V189."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import tempfile

stage = Path(__file__).resolve().parents[1]
repo = Path('/Users/bilibili/code/seti-simu')
base = 'c5e8ca89fe9964a1832cc41051cf63c3bd30acc5'
folder = Path('reports/ai-foundation-20261105/third-round-teacher-v1')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
blob = lambda b: hashlib.sha1(('blob ' + str(len(b)) + '\0').encode() + b).hexdigest()

def git(*args, data=None, private=None):
    env = dict(os.environ, GIT_OPTIONAL_LOCKS='0')
    if private:
        env['GIT_INDEX_FILE'] = private
    return subprocess.check_output(['git', *args], cwd=repo, input=data, env=env)

assert git('rev-parse', 'HEAD').decode().strip() == base
assert git('symbolic-ref', '--short', 'HEAD').decode().strip() == 'dev'
shared_index = sha(repo / '.git/index')
reference = json.loads((stage / 'reports/ai-foundation-20261104/two-rounds-teacher-v2/v189-first2-result-source-check-20261105-v1.json').read_text())
for name, digest in reference['runtimeSourceHashes'].items():
    assert sha(repo / name) == digest, 'production runtime changed: ' + name
proof = json.loads((stage / folder / 'v192-independent-candidate-verification-20261105-v1.json').read_text())
assert proof['status'] == 'passed' and not proof['productionChanged'] and not proof['candidateAdmitted']
assert sha(stage / proof['manifest']) == proof['manifestSha256']
for name, digest in proof['logsSha256'].items():
    assert sha(stage / name) == digest
summary = json.loads((stage / folder / 'v192-computer-prefix-review-20261105-v1.json').read_text())
assert not summary['candidateAdmitted'] and summary['newAutonomousRuns'] == 0
for name, digest in summary['evidenceSha256'].items():
    assert sha(stage / name) == digest

old = {}
for row in git('ls-tree', '-rz', base).split(b'\0'):
    if row:
        meta, name = row.split(b'\t', 1)
        old[name.decode()] = meta.decode().split()[2]
files = {
    'docs/human405-third-round-plan-20261105.md',
    'docs/human405-third-round-prefix-review-20261105.md',
    'adhoc/human405-third-round-progress-20261105-v2.json',
    'adhoc/benchmark-third-round-decision-20261105-v1.js',
    'adhoc/third-round-computer-prefix-contract-20261105-v1.md',
    'adhoc/diagnose-v190-income-certificate-20261105-v1.js',
    'adhoc/disable-computer-prefix-diagnostic-20261105-v1.cjs',
    'adhoc/summarize-human405-third-prefix-20261105-v1.py',
    'adhoc/verify-human405-third-prefix-candidate-20261105-v1.py',
    'adhoc/deliver-human405-third-prefix-evidence-20261105-v1.py',
}
for version in [190, 191, 192]:
    files.add(f'adhoc/archive-v{version}-computer-prefix-candidate-20261105-v1.py')
    archive = stage / f'reports/ai-foundation-20261105/candidate-v{version}-computer-prefix-20261105-v1'
    files.update(str(p.relative_to(stage)) for p in archive.rglob('*') if p.is_file())
files.update(str(p.relative_to(stage)) for p in (stage / folder).iterdir() if p.is_file())
files = {name for name in files if old.get(name) != blob((stage / name).read_bytes())}
assert not any(name.startswith(('randomizer/', 'tools/', 'assets/')) for name in files)
for name in files:
    source = stage / name
    if source.suffix in ['.js', '.cjs']:
        subprocess.run(['node', '--check', name], cwd=stage, check=True)
    if source.suffix == '.py':
        compile(source.read_text(), name, 'exec')
    if source.suffix == '.json':
        json.loads(source.read_text())
    dest = repo / name
    if dest.exists():
        assert dest.read_bytes() == source.read_bytes() or blob(dest.read_bytes()) == old.get(name), 'overlapping foreign edit: ' + name

manifest_name = 'adhoc/human405-third-prefix-delivery-manifest-20261105-v1.json'
manifest = {'baseCommit': base, 'status': 'active', 'productionRuntime': 'V189/V22',
    'candidate': 'V192/V22', 'candidateAdmitted': False, 'newAutonomousRuns': 0,
    'scopeOrder': summary['scopeOrder'], 'productionChanged': False,
    'candidateCleanVerification': str(folder / 'v192-independent-candidate-verification-20261105-v1.json'),
    'sharedIndexSha256': shared_index, 'filesSha256': {p: sha(stage / p) for p in sorted(files)}}
(stage / manifest_name).write_text(json.dumps(manifest, indent=2) + '\n')
files.add(manifest_name)
if os.environ.get('SETI_DELIVER_THIRD_PREFIX_EVIDENCE') != '1':
    print(json.dumps({'preflight': 'passed', 'files': len(files), 'productionChanged': False, 'candidateAdmitted': False}))
    raise SystemExit(0)

private = str(Path(tempfile.mkdtemp(prefix='seti-third-prefix-evidence-index-')) / 'index')
git('read-tree', base, private=private)
for name in sorted(files):
    digest = git('hash-object', '-w', '--stdin', data=(stage / name).read_bytes(), private=private).decode().strip()
    git('update-index', '--add', '--cacheinfo', '100644', digest, name, private=private)
assert set(git('diff', '--cached', '--name-only', base, private=private).decode().splitlines()) == files
# Preserve byte-exact frozen sources, including two whitespace-only lines
# already present in the base search file. All other staged files are checked.
base_search = git('show', base + ':randomizer/game/ai/decision-search.js').decode().splitlines()
blank_whitespace = lambda lines: [(i + 1, line) for i, line in enumerate(lines) if line and not line.strip()]
frozen_search = [f'reports/ai-foundation-20261105/candidate-v{version}-computer-prefix-20261105-v1/randomizer/game/ai/decision-search.js' for version in [190, 191, 192]]
for name in frozen_search:
    assert blank_whitespace((stage / name).read_text().splitlines()) == blank_whitespace(base_search)
git('diff', '--cached', '--check', '--', '.', *[':(exclude)' + name for name in frozen_search], private=private)
assert not git('diff', '--cached', '--name-only', base, '--', 'randomizer', 'tools', 'assets', private=private).strip()
tree = git('write-tree', private=private).decode().strip()
for name in files:
    assert git('show', tree + ':' + name) == (stage / name).read_bytes(), name
for name in sorted(files):
    dest = repo / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes((stage / name).read_bytes())
git('commit', '-m', '保存第三轮电脑准备候选证据并明确第二轮轮末回查标准', private=private)
commit = git('rev-parse', 'HEAD').decode().strip()
assert set(git('show', '--pretty=format:', '--name-only', 'HEAD').decode().splitlines()) == files
assert sha(repo / '.git/index') == shared_index
for name, digest in reference['runtimeSourceHashes'].items():
    assert sha(repo / name) == digest, name
assert not git('diff', '--name-only', base, commit, '--', 'randomizer', 'tools', 'assets').strip()
result = {'commit': commit, 'privateIndex': private, 'stage': str(stage), 'files': len(files),
    'productionChanged': False, 'candidateAdmitted': False, 'sharedIndexUnchanged': True,
    'goalStatus': 'active', 'scopeOrder': summary['scopeOrder'], 'deliveryManifest': manifest_name}
Path('/private/tmp/seti-human405-third-prefix-delivery-20261105-v1.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
