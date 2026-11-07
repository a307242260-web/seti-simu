from pathlib import Path
import gzip, hashlib, io, json, tarfile

base = Path(__file__).parent.resolve()
previous = base.parent/'seti-v425-public-data-20261108-v1'
a3 = base.parent/'seti-v415-a3-region-20261108-v1'
sha = lambda content: hashlib.sha256(content).hexdigest()
read = lambda p: json.loads(p.read_bytes())
ungzip = lambda p: json.loads(gzip.decompress(p.read_bytes()))
gates = {}
for version,n in [('v430',881),('v432',885)]:
    gate = read(base/f'{version}-cold-gate-20261108-v1.json')
    assert gate['status'] == 'complete' and gate['namedCases'] == n + 441
    assert gate['uniqueRoots'] == n and gate['earlyExact'] == 304
    assert gate['maxNativeInputs'] <= 256 and gate['maxMilliseconds'] <= 600
    assert gate['rows']['reverse-blue3-overlimit']['nativeInputs'] == 255
    gates[version] = gate
parity = read(base/'v430-tail-rank-parity-20261108-v1.json')
assert parity['equal'] == 11 and parity['different'] == 0
d = base/'v432-cold-roots'
a,m,n = [ungzip(d/(x+'.json.gz')) for x in ('reverse-blue3-overlimit','reverse-blue3-mask-both','reverse-blue3-no-scan-supply')]
assert all(a[k] == m[k] for k in ('actionId','value','roots','candidates','sharedPrefixGraph'))
assert a['actionId'].startswith('research_tech:') and a['value'] == 162.5
assert not any(x.get('planSummary',{}).get('nextFundedScan') for x in n['lines'])
for name,want,inputs in [
    ('v430-blue3-autonomous',[105,5,7,3,0],48),
    ('v431-blue3-autonomous',[109,6,7,4,0],57),
    ('v432-a3-yellow-autonomous',[109,6,7,4,0],69),
    ('v432-a3-default-autonomous',[101,6,6,3,1],37),
    ('v432-a3-yellow-masked-autonomous',[111,6,7,3,0],72)]:
    q = read(base/f'{name}-20261108-v1.checkpoint.json')
    assert q['nativeReplayExact'] and q['rootAndRngRestored'] and q['newAutonomousRuns'] == 0
    assert q['summary']['assets'] == want and q['summary']['inputs'] == inputs
controls = {p for pattern in ('*20261108-v1.checkpoint.json', 'reverse-blue3-*-20261108-v1.json',
    '*20261108-v1.json.gz','v430-tail-rank-parity-20261108-v1.json','v426-*-20261108-v1.jsonl',
    'v43*-cold-gate-20261108-v1.json','v43*-source-manifest-20261108-v1.json',
    '*20261108-v1.log','contract-v4*.md') for p in base.glob(pattern)}
controls.add(previous/'v425-exact-blue3-root-20261108-v1.json.gz')
controls.update(a3/name for name in ('reverse-blue3-overlimit-root-20261108-v1.json','reverse-a0-symbol-root-20261108-v1.json','reverse-blue1-before-prep-root-20261108-v1.json'))
assert all((base/f'v432-{name}-20261108-v1.log') in controls for name in ('focused-node','input-audit','browser'))
out = base/'v432-blue3-evidence-20261108-v1.tar.gz'
with out.open('xb') as f, gzip.GzipFile(fileobj=f, filename='', mode='wb', mtime=0) as z, tarfile.open(fileobj=z, mode='w|') as archive:
    def add(path, content):
        info = tarfile.TarInfo(path)
        info.size = len(content)
        archive.addfile(info, io.BytesIO(content))

    index = {}
    for path in sorted(controls):
        content = path.read_bytes()
        assert path.name not in index
        index[path.name] = sha(content)
        add(path.name, content)
    for version,gate in gates.items():
        for k,row in gate['rows'].items():
            path = base/(version+'-cold-roots')/(k+'.json.gz')
            raw = path.read_bytes()
            assert sha(raw) == row['rawSha256']
            q = json.loads(gzip.decompress(raw))
            assert q['complete'] and not q['unresolved'] and q['actionId'] == row['actionId'] and q['value'] == row['value']
            add(version+'-cold-roots/'+path.name, raw)
    add('control-index.json', json.dumps(index, indent=2).encode()+b'\n')
print(out, sha(out.read_bytes()), out.stat().st_size)
