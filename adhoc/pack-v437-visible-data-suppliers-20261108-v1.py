from pathlib import Path
import gzip, hashlib, io, json, tarfile

base = Path(__file__).parent.resolve()
sha = lambda content: hashlib.sha256(content).hexdigest()
read = lambda name: json.loads((base/name).read_bytes())
gate_name = 'v437-cold-gate-20261108-v1.json'
g = read(gate_name)
assert (g['status'], g['namedCases'], g['uniqueRoots'], g['earlyExact']) == ('complete', 1333, 892, 304)
assert g['maxNativeInputs'] <= 256 and g['maxMilliseconds'] <= 600
trade = g['rows']['v436-a0-before-unprotected-trade']
assert (trade['actionId'], trade['value'], trade['nativeInputs']) == ('quick_trade:12411a2c', 190, 85)
formal = next(r for r in g['rows'].values() if 'deferred-sector-actual-179' in r['labels'])
assert (formal['actionId'], formal['value'], formal['nativeInputs']) == ('play_card:cb499bba', 170.5, 80)

controls = {gate_name, 'v437-cold-gate-20261108-v1.log', 'v437-source-manifest-20261108-v1.json',
            'v436-a0-before-unprotected-trade-20261108-v1.json', 'contract-v437-visible-supplier-rank-20261108-v1.md'}
for n, assets, inputs in (
    ('v436-r179-fixed-a0', [114,6,7,3,1], 67),
    ('v436-a0-one-scan-card', [116,6,7,4,1], 40),
    ('v436-a0-one-orange-pick', [116,6,7,4,1], 32),
    ('v437-a0-from-trade-autonomous', [116,6,7,4,1], 27),
    ('v437-r179-fixed-a0', [116,6,7,4,1], 74),
    ('v437-r179-masked-fixed-a0', [115,6,7,3,0], 73),
):
    name = n+'-20261108-v1.checkpoint.json'
    controls.add(name)
    q = read(name)
    assert q['rootAndRngRestored'] and q['nativeReplayExact'] and not q['newAutonomousRuns']
    s = q['summary']
    assert (s['stop'], s['assets'], s['inputs']) == ('settled-before-pass', assets, inputs)
    assert s['maxNative'] <= 256 and s['maxMs'] <= 600

for name, marker in [('focused-node', 'unit passed=6 failed=0'),
                     ('input-audit', 'V 输入审计全部通过'),
                     ('browser', 'browserSmoke passed=1 failed=0')]:
    name = f'v437-{name}-20261108-v1.log'
    assert marker in (base/name).read_text()
    controls.add(name)

out = base/'v437-visible-data-suppliers-evidence-20261108-v1.tar.gz'
with out.open('xb') as f, gzip.GzipFile(fileobj=f, filename='', mode='wb', mtime=0) as z, tarfile.open(fileobj=z, mode='w|') as archive:
    def add(path, content):
        info = tarfile.TarInfo(path)
        info.size = len(content)
        archive.addfile(info, io.BytesIO(content))
    index = {}
    for name in sorted(controls):
        raw = (base/name).read_bytes()
        index[name] = sha(raw)
        add(name, raw)
    for k,row in g['rows'].items():
        name = k+'.json.gz'
        raw = (base/'v437-cold-roots'/name).read_bytes()
        assert sha(raw) == row['rawSha256']
        q = json.loads(gzip.decompress(raw))
        assert q['complete'] and not q['unresolved'] and q['actionId'] == row['actionId'] and q['value'] == row['value']
        add('cold-roots/'+name, raw)
    add('control-index.json', json.dumps(index, indent=2).encode()+b'\n')
print(out, sha(out.read_bytes()), out.stat().st_size)
