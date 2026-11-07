from pathlib import Path
import gzip, hashlib, io, json, tarfile

base = Path(__file__).parent.resolve()
sha = lambda content: hashlib.sha256(content).hexdigest()
gate = json.loads((base/'v424-cold-gate-20261108-v1.json').read_bytes())
assert gate['status'] == 'complete' and gate['namedCases'] == 1316
assert gate['uniqueRoots'] == 875 and gate['earlyExact'] == 304
assert gate['maxNativeInputs'] <= 256 and gate['maxMilliseconds'] <= 600
controls = {p for pattern in ('*20261108-v1.checkpoint.json', '*root-20261108-v1.json',
    'reverse-*.json', '*20261108-v1.json.gz', 'v4*-cold-gate-20261108-v1.json',
    'v4*-source-manifest-20261108-v1.json', '*20261108-v1.log', 'contract-v4*.md')
    for p in base.glob(pattern)}
assert all((base/f'v424-{name}-20261108-v1.log') in controls for name in ('focused-node','input-audit','browser'))
out = base/'v424-a3-income-evidence-20261108-v1.tar.gz'
with out.open('xb') as f, gzip.GzipFile(fileobj=f, filename='', mode='wb', mtime=0) as z, tarfile.open(fileobj=z, mode='w|') as archive:
    def add(path, content):
        info = tarfile.TarInfo(path)
        info.size = len(content)
        archive.addfile(info, io.BytesIO(content))

    index = {}
    for p in sorted(controls):
        content = p.read_bytes()
        index[p.name] = sha(content)
        add(p.name, content)
    for k, row in gate['rows'].items():
        p = base/'v424-cold-roots'/(k+'.json.gz')
        raw = p.read_bytes()
        assert sha(raw) == row['rawSha256']
        q = json.loads(gzip.decompress(raw))
        assert q['complete'] and not q['unresolved'] and q['actionId'] == row['actionId'] and q['value'] == row['value']
        add('cold-roots/'+p.name, raw)
    add('control-index.json', json.dumps(index, indent=2).encode()+b'\n')
print(out, sha(out.read_bytes()), out.stat().st_size)
