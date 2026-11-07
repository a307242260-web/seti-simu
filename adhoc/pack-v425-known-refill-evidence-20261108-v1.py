from pathlib import Path
import gzip, hashlib, io, json, tarfile

base = Path(__file__).parent.resolve()
old = base.parent/'seti-v415-a3-region-20261108-v1'
sha = lambda content: hashlib.sha256(content).hexdigest()
read = lambda name: json.loads((base/name).read_bytes())
gate = read('v425-cold-gate-20261108-v1.json')
assert gate['status'] == 'complete' and gate['namedCases'] == 1321
assert gate['uniqueRoots'] == 880 and gate['earlyExact'] == 304
assert gate['maxNativeInputs'] <= 256 and gate['maxMilliseconds'] <= 600
a = [read('v425-mask-'+name+'-20261108-v1.checkpoint.json') for name in ('base','alien','both')]
assert a[0]['publicRoots'] == a[1]['publicRoots'] == a[2]['publicRoots']
assert a[0]['summary']['assets'] == [107,6,7,4,1]
assert a[1]['summary']['assets'] == a[2]['summary']['assets'] == [114,6,7,3,0]
p = read('v425-mask-refill-autonomous-v3-20261108-v1.checkpoint.json')
assert p['nativeReplayExact'] and p['rootAndRngRestored'] and p['newAutonomousRuns'] == 0
assert p['summary']['assets'] == [107,6,7,4,1] and p['summary']['inputs'] == 22
assert [t['id'] for t in p['accepted'][7]['assets']['data']['poolTokens']] == ['data-token-'+str(i) for i in range(40,44)]
assert p['accepted'][16]['assets']['income']['energy'] == 4 and p['accepted'][18]['assets']['wallet']['publicity'] == 6
assert gate['rows']['masked-post-refill-root']['actionId'].startswith('industry:')
assert not gate['rows']['masked-no-supplier']['actionId'].startswith('industry:')
control = [read('v425-blue3-'+name+'-20261108-v1.checkpoint.json') for name in ('purple1','income-first')]
assert all(q['nativeReplayExact'] and len(q['fixed'])+len(q['accepted']) == 57 for q in control)
assert control[0]['end'] == control[1]['end']
left,right = [json.loads(q['stop']['e']['committedState']) for q in control]
assert [key for key in left if left[key] != right[key]] == ['cards']
assert [key for key in left['cards'] if left['cards'][key] != right['cards'][key]] == ['publicCards']
assert left['cards']['publicCards'] == list(reversed(right['cards']['publicCards']))
negative = json.loads(gzip.decompress((base/'v425-cold-roots/masked-no-supplier.json.gz').read_bytes()))
company = next(x for x in negative['roots'] if x['actionId'].startswith('industry:'))
assert company['value'] is None and company['completion'] == 'excluded-by-card-pick-policy'
controls = {p for pattern in ('*20261108-v1.checkpoint.json', 'masked-*-20261108-v1.json',
    '*20261108-v1.json.gz', 'v425-cold-gate-20261108-v1.json',
    'v425-source-manifest-20261108-v1.json', '*20261108-v1.log', 'contract-v4*.md')
    for p in base.glob(pattern)}
controls.update(old/name for name in ('reverse-blue3-overlimit-root-20261108-v1.json','reverse-public-scan-root-20261108-v1.json'))
assert all((base/f'v425-{name}-20261108-v1.log') in controls for name in ('focused-node','input-audit','browser'))
out = base/'v425-known-refill-evidence-20261108-v1.tar.gz'
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
    for k, row in gate['rows'].items():
        path = base/'v425-cold-roots'/(k+'.json.gz')
        raw = path.read_bytes()
        assert sha(raw) == row['rawSha256']
        q = json.loads(gzip.decompress(raw))
        assert q['complete'] and not q['unresolved'] and q['actionId'] == row['actionId'] and q['value'] == row['value']
        add('cold-roots/'+path.name, raw)
    add('control-index.json', json.dumps(index, indent=2).encode()+b'\n')
print(out, sha(out.read_bytes()), out.stat().st_size)
