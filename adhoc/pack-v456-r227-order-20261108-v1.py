from pathlib import Path
import gzip,hashlib,io,json,tarfile
b=Path(__file__).parent.resolve()
names=set()
def read(name,suffix='.json'):
    name+='-20261108-v1'+suffix
    names.add(name)
    raw=(b/name).read_bytes()
    return json.loads(gzip.decompress(raw) if suffix=='.json.gz' else raw)
a=read('v453-matched-r227')
z=read('v453-matched-r227-masked')
for q in (a,z):
    assert q['replayExact'] and q['rootAndRngRestored']
def visible(q):
    return [[(r['asset'],r['value']) for r in row['checkpoints']] for row in q['rows']]
assert visible(a)==visible(z)
for row,score,energy,publicity in zip(a['rows'],[[102,111,116],[103,107,116],[103,107,116]],[4,4,3],[0,1,1]):
    assert [s['asset']['wallet']['score'] for s in row['checkpoints']]==score
    v=row['checkpoints'][-1]['asset']
    assert v['income']['energy']==energy and v['wallet']['publicity']==publicity and v['projectedFinal']==162
    assert len(v['tech']['ownedTiles'])==6 and len(v['probes'])==1
for stem,expected in [('v454-r227-analysis-choices',[(112,3),(114,3),(116,4),(112,3),(110,3),(114,3),(116,3),(110,3)]),
                      ('v456-a5-research-before-analysis',[(114,3)]*2)]:
    q=read(stem)
    assert q['replayExact'] and q['rootAndRngRestored']
    assert all(r['stop']['reason']=='settled-before-pass' for r in q['rows'])
    assert [(r['after']['wallet']['score'],r['after']['income']['energy']) for r in q['rows']]==expected
    assert all(s['n']<=256 and s['ms']<=600 for r in q['rows'] for s in [*r['accepted'],r['stop']])
for stem,n,value in [('v453-formal-r227-baseline',85,190),('v445-after-a5-cold',0,190),('v455-after-a5-cold',0,190),
                     ('v455-after-a5-masked-cold',3,190),('v456-r227-after-one-research-swap-cold',25,190),
                     ('v456-r227-after-one-official-cold',47,190)]:
    r=read(stem,'.json.gz')
    assert r['complete'] and not r['unresolved'] and r['value']==value and r['diagnostics']['nativeExecutions']==n
    if stem=='v455-after-a5-masked-cold':
        assert r['lines'][0]['cardPickPolicy']['companySwap']['goal']['netGain']==.5
        assert r['actionId']=='end_turn:b2f9b29d'
for k in ('v445-official-r13-fixture','v455-r227-after-a5','v455-r227-after-a5-masked','v456-r227-after-one-official','v456-r227-after-one-research-swap'):
    read(k)
for k in ('control-v453-matched-r227','control-v454-r227-analysis-choices','capture-v455-r227-after-a5','control-v456-a5-research-before-analysis','measure-v406-gate-root'):
    names.add(k+'-20261108-v1.js')
names.update(['v455-candidate-20261108-v1.patch','contract-v455-empty-pool-income-20261108-v1.md'])
archive=b/'v456-r227-order-evidence-20261108-v1.tar.gz'
sha=lambda x:hashlib.sha256(x).hexdigest()
with archive.open('xb') as f,gzip.GzipFile(fileobj=f,filename='',mode='wb',mtime=0) as g,tarfile.open(fileobj=g,mode='w|') as z:
    def add(n,raw):
        entry=tarfile.TarInfo(n);entry.size=len(raw);z.addfile(entry,io.BytesIO(raw))
    hashes={}
    for name in sorted(names):
        raw=(b/name).read_bytes();hashes[name]=sha(raw);add(name,raw)
    add('control-index.json',json.dumps(hashes,indent=2).encode()+b'\n')
with tarfile.open(archive) as z:
    assert all(sha(z.extractfile(n).read())==h for n,h in hashes.items())
print(sha(archive.read_bytes()),archive.stat().st_size)
