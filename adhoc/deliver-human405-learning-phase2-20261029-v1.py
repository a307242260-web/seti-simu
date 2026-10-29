"""Deliver this tested snapshot through a private index; never edits the shared index."""
import hashlib
import json
import os
import pathlib
import subprocess
import tarfile

root = pathlib.Path('/Users/bilibili/code/seti-simu')
stage = pathlib.Path('/private/tmp/seti-human405-v42-reference-20261029-7lcfw4_3')
manifest_path = 'adhoc/human405-learning-phase2-snapshot-20261029.json'
manifest = json.loads((stage/manifest_path).read_text())
base = manifest['baseCommit']
working_overlays = manifest.get('workingTreeOverlays', {})

def git(*args, env=None, data=None):
    safe = dict(os.environ, GIT_OPTIONAL_LOCKS='0')
    if env: safe.update(env)
    return subprocess.check_output(['git', *args], cwd=root, env=safe, input=data)

def sha(data):
    return hashlib.sha256(data).hexdigest()

assert git('rev-parse', 'HEAD').decode().strip() == base
assert git('symbolic-ref', '--short', 'HEAD').decode().strip() == 'dev'
assert sha((root/'.git/index').read_bytes()) == manifest['sharedIndexSha256Before']
assert sha(git('ls-files','--stage','-z')) == manifest['sharedIndexEntriesSha256Before']
source_cache = {}
for report_path in manifest['sourceBoundReports']:
    report = json.loads((stage/report_path).read_text())
    binding = manifest.get('sourceBindings', {}).get(report_path, {})
    overlay = {}
    if binding.get('sourceSnapshot'):
        import gzip
        snapshot = json.loads(gzip.decompress((stage/binding['sourceSnapshot']).read_bytes()))
        assert snapshot['baseCommit'] == binding['baseCommit']
        overlay = snapshot['files']
    for path, expected in report['sourceHashes'].items():
        if path in overlay:
            data = overlay[path].encode()
        elif binding.get('baseCommit'):
            key = (binding['baseCommit'], path)
            if key not in source_cache: source_cache[key] = git('show', binding['baseCommit']+':'+path)
            data = source_cache[key]
        else:
            data = (stage/path).read_bytes()
        assert sha(data) == expected, ('runtime source drift', report_path, path)
    for row in report.get('rows', [report]) + ([report['coldRecheck']] if report.get('coldRecheck') else []):
        if row.get('rawPath'):
            assert sha((stage/row['rawPath']).read_bytes()) == row['rawSha256'], row['rawPath']
files = dict(manifest['files'])
files[manifest_path] = sha((stage/manifest_path).read_bytes())
for p, expected in files.items():
    assert sha((stage/p).read_bytes()) == expected, p
index_path = root/'.git/index'
shared_hash = sha(index_path.read_bytes())
base_tree = {}
for row in git('ls-tree', '-r', '-z', base).split(b'\0'):
    if not row:
        continue
    header, name = row.split(b'\t', 1)
    mode, kind, oid = header.decode().split()
    base_tree[name.decode()] = (mode, oid)
process = subprocess.Popen(['git', 'archive', base], cwd=root, stdout=subprocess.PIPE, env=dict(os.environ,GIT_OPTIONAL_LOCKS='0'))
unchanged = changed = 0
with tarfile.open(fileobj=process.stdout, mode='r|') as archive:
    for member in archive:
        if not member.isfile():
            continue
        p = member.name
        original = archive.extractfile(member).read()
        actual = (stage/p).read_bytes()
        if p in files:
            changed += 1
        else:
            assert actual == original, ('unowned snapshot change', p)
            unchanged += 1
        if p in files and (root/p).exists():
            if p in working_overlays:
                overlay = working_overlays[p]
                assert sha((root/p).read_bytes()) == overlay['beforeSha256'], ('root overlay changed',p)
                assert sha(pathlib.Path(overlay['path']).read_bytes()) == overlay['sha256']
            else:
                assert (root/p).read_bytes() in (original, actual), ('overlapping root edit', p)
assert process.wait() == 0
for p in files:
    if p not in base_tree and (root/p).exists():
        if p == manifest_path:
            prior_manifest = json.loads((root/p).read_text())
            assert prior_manifest['baseCommit'] == base and prior_manifest['snapshot'] == str(stage)
        else:
            assert (root/p).read_bytes() == (stage/p).read_bytes(), ('untracked overlap', p)
check_path = 'reports/ai-foundation-20261023/human405-learning-phase2-snapshot-check-20261029-v1.json'
check = {'baseCommit': base, 'testedSnapshot': str(stage), 'unchangedBaseFilesVerified': unchanged,
    'changedBaseFilesVerified': changed, 'sharedIndexSha256': shared_hash,
    'explicitFiles': len(files), 'runtimeImportsBoundToExplicitVersionSources': True,
    'notes': 'Every base file outside the explicit overlay is byte-identical to HEAD; runtime imports match the final candidate or its explicitly archived historical source binding.'}
(stage/check_path).write_text(json.dumps(check, indent=2)+'\n')
files[check_path] = sha((stage/check_path).read_bytes())
if os.environ.get('SETI_DELIVER_HUMAN405_LEARNING_PHASE2') != '1':
    print(json.dumps({'phase':'preflight', **check}, ensure_ascii=False))
    raise SystemExit(0)
remote = git('ls-remote', 'origin', 'refs/heads/dev').decode().split()[0]
assert remote == base, ('remote advanced', remote)
private = pathlib.Path('/private/tmp/seti-human405-learning-phase2-private-20261029.index')
assert not private.exists(), 'Do not reuse a partial delivery index without inspecting it'
env = dict(os.environ, GIT_INDEX_FILE=str(private))
git('read-tree', base, env=env)
for p, expected in sorted(files.items()):
    data = (stage/p).read_bytes()
    assert sha(data) == expected
    destination = root/p
    destination.parent.mkdir(parents=True, exist_ok=True)
    if p in working_overlays:
        overlay = working_overlays[p]
        assert sha(destination.read_bytes()) == overlay['beforeSha256']
        working_data = pathlib.Path(overlay['path']).read_bytes()
        assert sha(working_data) == overlay['sha256']
        destination.write_bytes(working_data)
    else:
        destination.write_bytes(data)
    mode = base_tree.get(p, ('100644', ''))[0]
    blob = git('hash-object', '-w', '--stdin', env=env, data=data).decode().strip()
    git('update-index', '--add', '--cacheinfo', mode, blob, p, env=env)
listed = set(git('diff', '--cached', '--name-only', base, env=env).decode().splitlines())
assert listed == set(files), (listed-set(files), set(files)-listed)
assert sha(index_path.read_bytes()) == shared_hash
message = stage/'adhoc/human405-learning-phase2-commit-message-20261029.txt'
message.write_text('学习405分轨迹并收敛公司换牌固定规划\n')
git('commit', '--file', str(message), env=env)
commit = git('rev-parse', 'HEAD').decode().strip()
committed = set(git('diff-tree', '--no-commit-id', '--name-only', '-r', commit).decode().splitlines())
assert committed == set(files)
assert sha(index_path.read_bytes()) == shared_hash
print(git('show', '--name-only', '--stat', '--format=short', 'HEAD').decode())
git('push', 'origin', 'HEAD:dev', env=env)
assert git('ls-remote', 'origin', 'refs/heads/dev').decode().split()[0] == commit
assert sha(index_path.read_bytes()) == shared_hash
for p, overlay in working_overlays.items():
    assert sha((root/p).read_bytes()) == overlay['sha256']
print(json.dumps({'phase':'delivered','preservedWorkingTreeOverlays':list(working_overlays), 'commit':commit,'files':len(files),'sharedIndexUnchanged':True,'originDevVerified':True}))
