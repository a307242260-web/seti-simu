from pathlib import Path
import gzip, hashlib, io, json, tarfile

base = Path(__file__).parent.resolve()
ref = base.parent/'seti-v411-income-payment-20261108-v1'
sha = lambda content: hashlib.sha256(content).hexdigest()
read = lambda name: json.loads((base/name).read_bytes())
g = read('v436-cold-gate-20261108-v1.json')
assert g['status'] == 'complete' and g['namedCases'] == 1332
assert g['uniqueRoots'] == 891 and g['earlyExact'] == 304
assert g['maxNativeInputs'] <= 256 and g['maxMilliseconds'] <= 600
assert g['rows']['v433-orange-income-root']['actionId']=='choose_card:871e74c8'
assert g['rows']['v433-yellow-research-menu']['actionId']=='choose_target:03fdb62d'
assert g['rows']['v433-yellow-orange1-pick']['actionId']=='choose_card:0280e615'
a,b=[next(r for r in read(n)['rows'] if r['removal']['actionId']=='choose_target:5b1b18db') for n in (
 'v433-r179-native-prefix-20261108-v1.json','v436-r179-masked-native-prefix-20261108-v1.json')]
assert a['quote']==b['quote'] and a['quote']['value']==11
assert a['atStart']['knownHand']==b['atStart']['knownHand']
for n,x,k in [('v436-frozen-yellow',[105,6,7,4,1],65),('v436-r179-autonomous',[101,6,6,3,1],38),
 ('v436-v433-yellow-before-research-autonomous',[105,6,7,4,1],27),
 ('v436-v433-yellow-masked-before-research-autonomous',[111,6,7,3,0],34),
 ('v436-yellow-one-trace',[104,6,7,4,1],18)]:
    q = read(n+'-20261108-v1.checkpoint.json')
    assert q['nativeReplayExact'] and q['rootAndRngRestored'] and q['newAutonomousRuns']==0
    assert q['summary']['assets']==x and q['summary']['inputs']==k
payment = read('v436-round4-payment-control-20261108-v1.json')
assert payment['replayExact']
c,e = payment['rows']
assert [a['actionId'] for a in c['accepted']]==[a['actionId'] for a in e['accepted']]
find = lambda row: next(x for x in row['costs'] if x['planet']=='saturn' and x['family']=='land')
assert find(c)['cost']==find(e)['cost']=={'energy':5}
assert find(c)['payment']['spend']=={'credits':4,'energy':3}
assert find(e)['payment']['spend']=={'credits':0,'energy':5}

controls = {p for pattern in ('*.checkpoint.json','v433-yellow-*.json','v434-free-pick-step-*.json',
 '*20261108-v1.json.gz','v43*-native-prefix-20261108-v1.json','v433-orange-income-root-20261108-v1.json',
 'v436-round4-payment-control-20261108-v1.json','v436-cold-gate-20261108-v1.json',
 'v436-source-manifest-20261108-v1.json','*20261108-v1.log','contract-v4*.md') for p in base.glob(pattern)}
controls.update(ref/name for name in ('formal-r179-root-20261108-v1.json','formal-r179-masked-root-20261108-v1.json'))
assert all((base/f'v436-{name}-20261108-v1.log') in controls for name in ('focused-node','input-audit','browser'))
out = base/'v436-launch-income-evidence-20261108-v1.tar.gz'
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
    for k,row in g['rows'].items():
        path = base/'v436-cold-roots'/(k+'.json.gz')
        raw = path.read_bytes()
        assert sha(raw) == row['rawSha256']
        q = json.loads(gzip.decompress(raw))
        assert q['complete'] and not q['unresolved'] and q['actionId'] == row['actionId'] and q['value'] == row['value']
        add('cold-roots/'+path.name, raw)
    add('control-index.json', json.dumps(index, indent=2).encode()+b'\n')
print(out, sha(out.read_bytes()), out.stat().st_size)
