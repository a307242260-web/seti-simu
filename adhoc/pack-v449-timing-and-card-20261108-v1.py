from pathlib import Path
import gzip, hashlib, io, json, tarfile
b=Path(__file__).parent.resolve()
names=set()
def read(stem,suffix='.json'):
    name=stem+'-20261108-v1'+suffix
    names.add(name)
    raw=(b/name).read_bytes()
    return json.loads(gzip.decompress(raw) if suffix=='.json.gz' else raw)
for key,energy,hand in [('swap',4,[]),('plain',3,['dlc_25.png','dlc_20.png'])]:
    q=read('v446-research-a5-'+key+'-blue3','.checkpoint.json')
    assert q['rootAndRngRestored'] and q['nativeReplayExact'] and q['newAutonomousRuns']==0
    assert q['summary']['assets']==[116,6,7,energy,1] and q['summary']['projectedFinal']==162
    assert q['end']['wallet']['publicity']==1 and [c[1] for c in q['end']['hand']]==hand
q=read('v446-r4-saturn-native')
assert q['replayExact']
wallets=[r['afterLanding']['wallet'] for r in q['rows']]
assert [w['score'] for w in wallets]==[124]*5 and [w['availableData'] for w in wallets]==[2]*5
assert [w['credits'] for w in wallets]==[7,7,7,5,5] and [w['publicity'] for w in wallets]==[1,2,2,2,2]
q=read('v447-v189-jupiter-matched-invest')
assert q['nativeReplayExact'] and q['rootAndRngRestored']
assert [r['beforePass']['wallet']['score'] for r in q['rows']]==[34,46,50]
q=read('v447-r3-matched-two-main')
assert q['nativeReplayExact'] and q['rootAndRngRestored']
assert [r['assetsAfterTwo']['wallet']['score'] for r in q['rows']]==[50,50,52]
for k,cost,n in [('same-uranus-purpose',5,2),('defer-outbound',7,3)]:
    q=read('v447-v189-'+k)
    assert q['nativeReplayExact'] and q['rootAndRngRestored']
    assert [(r['result']['kind'],r['result']['cost']['energy']) for r in q['rows']]==[('insufficient-funding',cost)]*n
q=read('v448-v189-dlc31-titania')
assert q['replayExact'] and q['rootAndRngRestored']
assert [r['after']['wallet']['score'] for r in q['rows']]==[77]*6
assert [r['after']['wallet']['credits'] for r in q['rows']]==[5,4,4,2,2,3]
q=read('v448-final-marks')
assert q['replayExact'] and [r['scoring']['result']['totalScore'] for r in q['rows']]==[162,155,158]
q=read('v449-dlc31-r4-held-purpose')
assert q['replayExact'] and q['rootAndRngRestored']
a,z=q['rows']
actions=lambda row:[(x['actionId'],x['actorId'],x['target']) for x in row['accepted']]
assert actions(a)==actions(z) and len(a['accepted'])==42
assert [r['after']['wallet']['credits'] for r in q['rows']]==[4,9]
q=read('v449-dlc31-funded-final')
assert q['replayExact'] and q['rootAndRngRestored']
assert [r['after']['projectedFinal'] for r in q['rows']]==[120,120,132]
assert all(json.loads(r['end']['committedState'])['turn']['gameEnded'] for r in q['rows'])
q=read('v451-held-landing-options')
assert q['replayExact'] and q['rootAndRngRestored'] and len(q['rows'])==14
best=max(q['rows'],key=lambda r:r['value'])
assert best['goal']['requirementId'].endswith(':titania') and best['after']['wallet']['credits']==5
for name,value,native in [('v449-v445-cold-historical-titania',129,57),('v450-historical-titania',123.83333333333333,47),
                          ('v451-historical-titania',129,63),('v451-formal-r179',176.5,80)]:
    q=read(name,'.json.gz')
    assert q['complete'] and not q['unresolved'] and q['value']==value and q['diagnostics']['nativeExecutions']==native
    assert not any(x is not None for x in q['diagnostics']['limits'].values())
    if name=='v451-historical-titania':
        assert any((r.get('goal') or {}).get('id','').startswith('rocket:5:land:uranus:satellite:titania:held-card:') and r['completion']=='complete' for r in q['roots'])
q=read('v451-held-landing-leaves')
assert q['replayExact'] and q['rootAndRngRestored']
a,z=q['rows']
assert [(r['planet'],r['searchValue'],r['graphBoundary']) for r in (a,z)]==[
    ('mercury',129,'hidden_card_draw'),('uranus',127.83333333333333,'quiet-turn-tail-value')]
assert [a['after']['wallet'][k] for k in ('score','credits','availableData','handSize')]==[65,1,4,2]
assert [z['after']['wallet'][k] for k in ('score','credits','availableData','handSize')]==[77,5,0,0]
for k in ('v446-r4-preland-controls','v446-pass-rotation-audit','v447-one-rotation-options','v447-v189-jupiter-timing',
          'v445-official-r13-fixture','v449-v189-before-titania'):
    read(k)
for k in ('v449-v445-cold-historical-jupiter','v450-formal-r179'):
    read(k,'.json.gz')
for k in ('control-v446-r13-research-funding','compare-v446-next-income-payment','control-v446-same-saturn-landing',
          'audit-v446-pass-rotation','audit-v447-one-rotation-options','control-v447-v189-jupiter-timing',
          'control-v447-v189-jupiter-matched-invest','control-v447-r3-matched-two-main','control-v447-v189-same-uranus-purpose',
          'control-v447-v189-defer-outbound','control-v448-v189-dlc31-titania','control-v448-v445-final-marks',
          'control-v449-dlc31-r4-held-purpose','control-v449-dlc31-funded-final','control-v451-held-landing-options',
          'control-v451-held-landing-leaves','measure-v406-gate-root'):
    names.add(k+'-20261108-v1.js')
names.update(['contract-v450-held-card-satellite-20261108-v1.md','contract-v451-held-satellite-score-20261108-v1.md',
              'v450-candidate-20261108-v1.patch','v451-candidate-20261108-v1.patch',
              'formal-r179-root-20261108-v1.json','v451-cold-samples-20261108-v1.json'])
archive=b/'v449-timing-and-card-evidence-20261108-v1.tar.gz'
def sha(raw):return hashlib.sha256(raw).hexdigest()
with archive.open('xb') as f, gzip.GzipFile(fileobj=f,filename='',mode='wb',mtime=0) as g, tarfile.open(fileobj=g,mode='w|') as t:
    def add(name,data):
        entry=tarfile.TarInfo(name)
        entry.size=len(data)
        t.addfile(entry,io.BytesIO(data))
    sums={}
    for name in sorted(names):
        raw=(b/name).read_bytes()
        sums[name]=sha(raw)
        add(name,raw)
    add('control-index.json',json.dumps(sums,indent=2).encode()+b'\n')
with tarfile.open(archive) as t:
    assert t.getnames()==[*sorted(names),'control-index.json']
    assert all(sha(t.extractfile(name).read())==digest for name,digest in sums.items())
print(archive.name,sha(archive.read_bytes()),archive.stat().st_size)
