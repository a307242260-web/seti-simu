from pathlib import Path
import gzip,hashlib,io,json,tarfile
b=Path(__file__).parent.resolve()
names=set()
def read(n,ext='.json'):
    name=n+'-20261108-v1'+ext;names.add(name);x=(b/name).read_bytes()
    return json.loads(gzip.decompress(x) if ext=='.json.gz' else x)
q={}
counts={'v461-before-first-task-cold':625,'v463-before-first-known-blue-cold':625,'v464-first-blue-route-audit':625,
        'v465-native-equivalence-audit':625,'v466-before-first-fixed-blue-cold':625,'v469-before-first-intent-guards':625,
        'v470-before-first-completed-blue-cold':577,'v471-first-route-real-currency-cold':565,
        'v472-first-wallet-purpose-cold':566,'v472-second-fixed-blue-cold':307,
        'v472-r227-negative-cold':85,'v453-formal-r227-baseline':85}
for n,count in counts.items():
    r=q[n]=read(n,'.json.gz')
    assert r['complete'] and not r['unresolved'] and r['diagnostics']['nativeExecutions']==count
es=q['v465-native-equivalence-audit']['sharedPrefixGraph']['edges']
for k in ('identity','physical','exact'):
    assert len({(e['audit'][k],e['actionId']) for e in es})==625
assert sum((e['audit'].get('target') or {}).get('blueSlot')==2 for e in es)==55
assert sum(e['audit']['summary']=='dlc_16.png' for e in es)==49
assert q['v469-before-first-intent-guards']['sharedPrefixGraph']['blueAudit']['initial:intent:["advance-before-rotation","orbit",0,true,false]']==28
def roots(x):
    return [(r['actionId'],r['value'],(r.get('goal') or {}).get('id')) for r in x['roots'] if r['value'] is not None]
a=q['v461-before-first-task-cold'];m=q['v470-before-first-completed-blue-cold'];z=q['v472-first-wallet-purpose-cold']
assert a['actionId']==m['actionId'] and roots(a)==roots(m)
assert sum(bool((e.get('turnTailPlanValue') or {}).get('bluePublicPick')) for l in m['lines'] for e in l['edges'])==16
assert any(g=='rocket:6:land:saturn:planet:' and aid==z['actionId'] and v==200 for aid,v,g in roots(z))
def norm(v):
    if isinstance(v,dict):return {k:norm(x) for k,x in v.items() if k!='milliseconds'}
    if isinstance(v,list):return [norm(x) for x in v]
    return v
assert norm(q['v472-r227-negative-cold'])==norm(q['v453-formal-r227-baseline'])
for n in ('v458-before-first','v458-before-second','v445-official-r13-fixture'):
    read(n)
for n in ('v473-r4-third-scan-funding','v473-r4-third-scan-settlement'):
    r=read(n);assert r['replayExact'] and r['rootAndRngRestored']
    if n.endswith('funding'):
        assert r['rows'][0]['cash']['spend']=={'credits':5,'energy':0} and r['rows'][1]['cash'] is None
    else:
        assert [[x['after']['wallet'][k] for k in ('score','credits','availableData','handSize')] for x in r['rows']]==[[135,3,3,3],[141,1,2,1]]
        def actions(x):return [(s['actionId'],s['target']) for s in x['inputs']]
        assert actions(r['rows'][0])==actions(r['rows'][1])
names.update([n+'-20261108-v1.js' for n in ('measure-v406-gate-root','control-v473-r4-third-scan-funding','control-v473-r4-third-scan-settlement')])
names.update([f'v{v}-candidate-20261108-v1.patch' for v in (466,470,471,472)])
names.update([n+'-20261108-v1.md' for n in ('contract-v466-final-blue-stationarity','contract-v470-completed-free-prefix-blue','contract-v471-route-real-currency','contract-v472-route-wallet-only')])
archive=b/'v473-fixed-blue-and-wallet-evidence-20261108-v1.tar.gz'
sha=lambda x:hashlib.sha256(x).hexdigest()
with archive.open('xb') as f,gzip.GzipFile(fileobj=f,filename='',mode='wb',mtime=0) as g,tarfile.open(fileobj=g,mode='w|') as z:
    def add(n,raw):
        t=tarfile.TarInfo(n);t.size=len(raw);z.addfile(t,io.BytesIO(raw))
    h={}
    for n in sorted(names):
        raw=(b/n).read_bytes();h[n]=sha(raw);add(n,raw)
    add('control-index.json',json.dumps(h,indent=2).encode()+b'\n')
with tarfile.open(archive) as z:
    assert all(sha(z.extractfile(n).read())==x for n,x in h.items())
print(sha(archive.read_bytes()),archive.stat().st_size)
