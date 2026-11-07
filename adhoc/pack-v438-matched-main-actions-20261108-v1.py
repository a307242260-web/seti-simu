from pathlib import Path
import gzip, hashlib, io, json, tarfile

b=Path(__file__).parent.resolve()
read=lambda n:json.loads((b/n).read_bytes())
sha=lambda data:hashlib.sha256(data).hexdigest()
names=[]
def pair(name):
    k=name+'-20261108-v1.json'
    names.append(k)
    return read(k)
a=pair('v438-r179-visible-horizon')
m=pair('v438-r179-masked-visible-horizon')
assert a['rootAndRngRestored'] and m['rootAndRngRestored']
assert [x['states'] for x in a['rows']]==[x['states'] for x in m['rows']]
a=pair('v438-six-known-main-actions')
m=pair('v438-six-known-main-actions-masked')
assert a['rootAndRngRestored'] and m['rootAndRngRestored']
assert all(len(x['rounds'])==6 for z in (a,m) for x in z['rows'])
def known_assets(result):
    return [[{k:v for k,v in y['asset'].items() if k!='researchDisplay'} for y in x['rounds']] for x in result['rows']]
assert known_assets(a)==known_assets(m)
assert a['rows'][0]['rounds'][2]['asset']['researchDisplay']!=m['rows'][0]['rounds'][2]['asset']['researchDisplay']

for n, assets in (
    ('v438-blue4-scan',[94,5,6,3,0]),('v438-blue4-scan-earth',[94,5,6,3,0]),
    ('v438-blue-buy-fodder',[99,6,6,3,0]),('v438-blue-buy-fodder-pink3',[106,5,6,3,0]),
    ('v438-six-autonomous',[116,6,7,4,1]),('v438-six-analyze',[109,6,7,4,1]),('v438-six-analyze-blue2',[107,6,7,3,1]),
    ('v438-six-masked-autonomous',[109,6,8,3,1]),('v438-six-masked-analyze-blue2',[109,6,7,4,1]),
    ('v438-six-masked-credit-income',[109,6,8,3,1]),('v438-six-masked-energy-income',[109,6,7,4,1]),
    ('v438-six-masked-card-income',[109,6,7,3,1]),
):
    name=n+'-20261108-v1.checkpoint.json'
    names.append(name)
    q=read(name)
    assert q['rootAndRngRestored'] and q['nativeReplayExact'] and q['newAutonomousRuns']==0
    assert q['summary']['assets']==assets and q['summary']['stop']=='settled-before-pass'
    assert q['summary']['maxNative']<=256 and q['summary']['maxMs']<=600
x=pair('v438-income-r4-requirements')
assert x['replayExact']
c,e=x['rows']
def actions(row):
    return [(a['actionId'],a['target']) for a in row['accepted']]
assert actions(c)==actions(e)
assert c['assets']['hand']==e['assets']['hand']
for row, spend in [(c,{'credits':4,'energy':3}),(e,{'credits':0,'energy':5})]:
    goal=next(g for g in row['costs'] if g['planet']=='saturn' and g['family']=='land')
    assert goal['cost']=={'energy':5} and goal['payment']['spend']==spend
x=pair('v439-explain-income')
assert x['chosen']['actionId']=='card-64-0'
assert [r['computer'] for r in x['results']]==[5,16.5,16.5,16.5]
for label in ('masked-income','masked-before-analysis'):
    files=[f'v{v}-{label}-20261108-v1.json.gz' for v in (437,439)]
    a,m=[json.loads(gzip.decompress((b/n).read_bytes())) for n in files]
    assert {k:v for k,v in a.items() if k!='diagnostics'}=={k:v for k,v in m.items() if k!='diagnostics'}
    assert a['diagnostics']['nativeExecutions']==m['diagnostics']['nativeExecutions']
    names.extend(files)
names.extend(['v439-formal-r179-20261108-v1.json.gz','v438-masked-income-20261108-v1.json','v438-masked-before-analysis-20261108-v1.json',
              'v438-blue-a7-funding-20261108-v1.log','v438-six-masked-card-income-20261108-v1.log',
              'contract-v439-common-move-income-20261108-v1.md'])
p=b/'v438-matched-main-actions-evidence-20261108-v1.tar.gz'
with p.open('xb') as f, gzip.GzipFile(fileobj=f,filename='',mode='wb',mtime=0) as g, tarfile.open(fileobj=g,mode='w|') as t:
    def add(name,data):
        entry=tarfile.TarInfo(name)
        entry.size=len(data)
        t.addfile(entry,io.BytesIO(data))
    checks={}
    for name in sorted(names):
        data=(b/name).read_bytes()
        checks[name]=sha(data)
        add(name,data)
    add('control-index.json',json.dumps(checks,indent=2).encode()+b'\n')
print(p,sha(p.read_bytes()),p.stat().st_size)
