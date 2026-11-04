import pathlib, subprocess, os, tempfile, json, hashlib, gzip, functools

stage = pathlib.Path(__file__).resolve().parents[1]
root = pathlib.Path('/Users/bilibili/code/seti-simu')
base = 'bb7da4e1193f0de2497dde3b99e253100abc4fad'
folder = 'reports/ai-foundation-20261104/two-rounds-teacher-v2/'

def git(*args, data=None, env=None):
    return subprocess.check_output(['git', *args], cwd=root, input=data,
        env=dict(os.environ, GIT_OPTIONAL_LOCKS='0', **(env or {})))

@functools.lru_cache(maxsize=None)
def base_bytes(path):
    return git('show', base + ':' + path)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def sha(path):
    return digest(pathlib.Path(path).read_bytes())

def read(path):
    return json.loads((stage / path).read_text())

assert git('rev-parse', 'HEAD').decode().strip() == base
before = json.loads(pathlib.Path('/private/tmp/seti-v161-stage-code-deltas-20261105-v1.json').read_text())
assert before['baseCommit'] == base
shared = sha(root / '.git/index')
assert shared == before['sharedIndexSha256']
entries = digest(git('ls-files', '--stage', '-z'))
for p, h in before['foreignHashes'].items():
    assert sha(root / p) == h, p
core = set(before['paths'])
files = set(core) | {'adhoc/deliver-human405-v161-admission-20261105-v1.py'}
for pattern in ['adhoc/*20261105*.js', 'adhoc/*20261105*.json',
    'adhoc/human405-v158-native-20261105-v1/*', folder + '*20261105*',
    'adhoc/witness-v158-known-*-20261104-v*.js', folder + 'v158-known-*-20261104-v*']:
    files.update(str(p.relative_to(stage)) for p in stage.glob(pattern) if p.is_file())

archives = {}
for version in [159, 160]:
    directory = stage / f'reports/ai-foundation-20261104/rejected-v{version}-runtime-20261105-v1'
    m = read(str(directory.relative_to(stage)) + '/manifest.json')
    assert m['baseCommit'] == base and not m.get('admitted', False)
    for p, h in m['overlayFiles'].items():
        assert sha(directory / p) == h, p
    for p, h in m['allLoadedRuntimeHashes'].items():
        assert digest((directory / p).read_bytes() if p in m['overlayFiles'] else base_bytes(p)) == h, (version, p)
    files.update(str(p.relative_to(stage)) for p in directory.rglob('*') if p.is_file())
    archives[version] = (directory, m)

full = (stage / (folder + 'v161-node-full-20261105-v1.log')).read_text()
assert 'SUMMARY unit passed=166 failed=0 total=166' in full
assert 'SUMMARY fullFlow passed=1 failed=0 total=1' in full
chrome = (stage / (folder + 'v161-chrome-ai-eighteen-20261105-v1.log')).read_text()
assert 'SUMMARY browserSmoke passed=18 failed=0 total=18' in chrome
def audit_failures(name):
    return [x for x in (stage / (folder + name)).read_text().splitlines() if x.startswith('[FAIL]')]
fails = audit_failures('v161-value-input-audit-20261105-v1.log')
assert fails == audit_failures('v158-value-input-audit-20261104-v1.log') and len(fails) == 1 and 'aomomo' in fails[0]

gate = read(folder + 'v161-current-teacher-serial-gate-20261105-v1.json')
assert gate['status'] == 'complete' and len(gate['rows']) == 86 and not gate['overruns']
assert all(v is None for v in gate['productionBudgets'].values())
cold, sources = [], {}
for row in gate['rows']:
    r = read(row['evidence'])
    assert r['searchVersion'].endswith('v161') and r['valueModel'].endswith('v11')
    assert r['complete'] and r['rootAndRngUnchanged'] and r['nativeInputs'] <= 256 and r['milliseconds'] <= 600
    assert sha(stage / r['fixture']) == r['fixtureSha256'] and sha(stage / r['rawPath']) == r['rawSha256']
    raw = json.loads(gzip.decompress((stage / r['rawPath']).read_bytes()))
    assert raw['complete'] and not raw['unresolved'] and raw['diagnostics']['nativeExecutions'] == r['nativeInputs']
    assert all(v is None for v in raw['diagnostics']['limits'].values())
    for p, h in r['sourceHashes'].items():
        assert sha(stage / p) == h, p
        sources[p] = h
    cold.append(r)
    files.update([row['evidence'], r['rawPath'], r['fixture']])
assert max(r['nativeInputs'] for r in cold) == 252
assert max(r['milliseconds'] for r in cold) == 517.062541

parity = read(folder + 'v161-settled-tech-root-parity-20261105-v1.json')
assert parity['allRootValuesAndCompletionMetadataEqual'] and parity['rootActionAndValueEqual'] and parity['allBranchesClosed']
assert parity['nativeInputsBefore'] == 257 and parity['nativeInputsAfter'] == 252
for p, h in parity['recordHashes'].items():
    assert sha(stage / p) == h, p
for version in [160]:
    directory, m = archives[version]
    rejected = read(folder + f'v{version}-current-teacher-serial-gate-20261105-v1.json')
    assert rejected['status'] == 'complete' and len(rejected['rows']) == 86 and len(rejected['overruns']) == 1
    for row in rejected['rows']:
        r = read(row['evidence'])
        assert sha(stage / r['rawPath']) == r['rawSha256'] and sha(stage / r['fixture']) == r['fixtureSha256']
        for p, h in r['sourceHashes'].items():
            assert digest((directory / p).read_bytes() if p in m['overlayFiles'] else base_bytes(p)) == h, (version, p)

for name, inputs in [('v158-known-income-timing-native-20261104-v1', 52), ('v158-known-orbit-blue-funding-native-20261104-v2', 27)]:
    r = read(folder + name + '.json')
    assert r['status'] == 'complete' and r['nativeInputs'] == inputs
    assert r.get('originalRootAndRngRestored', r.get('originalRootsAndRngRestored'))
    for p, h in r['sourceHashes'].items():
        assert digest(base_bytes(p)) == h, p
activity = read(folder + 'teacher-technology-activity-20261105-v1.json')
assert sha(stage / activity['source']) == activity['sourceSha256']
assert activity['usefulTransportUses'] == 13 and activity['conservativeIntegerForecast'] == 4
prototype = read(folder + 'activity4-prototype-source-binding-20261105-v1.json')
assert prototype['baseCommit'] == base and prototype['allOriginalSourceHashesMatchBase'] and prototype['noProductionModification']

old, modes = {}, {}
unchanged = 0
for entry in git('ls-tree', '-rz', base).split(b'\0'):
    if not entry:
        continue
    meta, name = entry.split(b'\t', 1)
    mode, kind, blob = meta.decode().split()
    p = name.decode()
    old[p], modes[p] = blob, mode
    if p.startswith(('randomizer/', 'tools/', 'assets/')) and p not in core:
        b = (stage / p).read_bytes()
        assert hashlib.sha1(('blob ' + str(len(b)) + '\0').encode() + b).hexdigest() == blob, p
        unchanged += 1
for p in sorted(files):
    if p.endswith('.js'):
        subprocess.run(['node', '--check', str(stage / p)], check=True, stdout=subprocess.DEVNULL)
proof_path = folder + 'v161-admission-source-check-20261105-v1.json'
(stage / proof_path).write_text(json.dumps({'baseCommit': base, 'runtimeSourceHashes': sources,
    'unchangedCodeDataFiles': unchanged, 'coldRoots': 86, 'maxInputs': 252, 'maxMilliseconds': 517.062541,
    'unitPassed': 166, 'fullFlowPassed': 1, 'chromePassed': 18, 'knownUnchangedLegacyAuditFailure': fails,
    'rejectedVersions': [159, 160], 'teacherActivityForecast': 4, 'forecastIsGuaranteedReward': False,
    'productionBudgets': gate['productionBudgets'], 'roundEnd': 'before-PASS-card-and-next-income',
    'baselineUnchanged': 'ai-search-v41-baseline-20261029', 'newAutonomousRunPending': True,
    'goalStatus': 'active', 'goalAchieved': False}, indent=2) + '\n')
files.add(proof_path)
deltas = set()
for p in files:
    b = (stage / p).read_bytes()
    if old.get(p) != hashlib.sha1(('blob ' + str(len(b)) + '\0').encode() + b).hexdigest():
        deltas.add(p)
manifest = 'adhoc/human405-v161-admission-manifest-20261105-v1.json'
(stage / manifest).write_text(json.dumps({'baseCommit': base, 'files': {p: sha(stage / p) for p in sorted(files)},
    'changedFiles': sorted(deltas), 'sharedIndexSha256': shared, 'sharedIndexEntriesSha256': entries,
    'foreignRegistryHashes': before['foreignHashes'], 'byteExactArchiveWhitespaceExclusions': [159, 160],
    'goalStatus': 'active', 'goalAchieved': False}, indent=2) + '\n')
deltas.add(manifest)
for p in deltas:
    if (root / p).exists() and (root / p).read_bytes() != (stage / p).read_bytes():
        assert p in old and (root / p).read_bytes() == base_bytes(p), ('overlap', p)
if os.environ.get('SETI_DELIVER_V161') != '1':
    print(json.dumps({'preflight': True, 'files': len(deltas), 'coldRoots': 86, 'maxInputs': 252,
        'maxMilliseconds': 517.062541, 'runtimeSources': len(sources)}))
    raise SystemExit(0)
private = str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v161-admission-index-')) / 'index')
env = {'GIT_INDEX_FILE': private}
git('read-tree', base, env=env)
for p in sorted(deltas):
    blob = git('hash-object', '-w', '--stdin', data=(stage / p).read_bytes(), env=env).decode().strip()
    git('update-index', '--add', '--cacheinfo', modes.get(p, '100644'), blob, p, env=env)
assert set(git('diff', '--cached', '--name-only', base, env=env).decode().splitlines()) == deltas
git('diff', '--cached', '--check', '--', '.', *[':(exclude)' + str(d.relative_to(stage)) + '/**' for d, m in archives.values()], env=env)
for p in sorted(deltas):
    dest = root / p
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes((stage / p).read_bytes())
git('commit', '-m', '按教师活动频次修正科技估值并统一蓝槽筹资与已支付科技选择', env=env)
commit = git('rev-parse', 'HEAD').decode().strip()
print(git('show', '--name-only', '--stat', '--format=short', 'HEAD').decode())
assert set(git('diff-tree', '--no-commit-id', '--name-only', '-r', commit).decode().splitlines()) == deltas
assert sha(root / '.git/index') == shared and digest(git('ls-files', '--stage', '-z')) == entries
for p, h in before['foreignHashes'].items():
    assert sha(root / p) == h, p
result = {'commit': commit, 'baseCommit': base, 'privateIndex': private, 'files': len(deltas),
    'sharedIndexUnchanged': True, 'foreignRegistryUnchanged': True, 'goalStatus': 'active',
    'newAutonomousRunPending': True}
pathlib.Path('/private/tmp/seti-v161-admission-result-20261105-v1.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
