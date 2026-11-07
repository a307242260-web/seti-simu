from pathlib import Path
import gzip,hashlib,io,json,tarfile
b=Path(__file__).parent.resolve()
read=lambda n:json.loads((b/n).read_bytes())
sha=lambda x:hashlib.sha256(x).hexdigest()
g=read('v445-cold-gate-20261108-v1.json')
assert g['status']=='complete' and g['earlyExact']==304
assert g['maxNativeInputs']<=256 and g['maxMilliseconds']<=600
assert 'SUMMARY fullFlow passed=1 failed=0 total=1' in (b/'v445-full-node-20261108-v1.log').read_text()
names=['v445-source-manifest-20261108-v1.json','v445-cold-gate-20261108-v1.json',
 'v445-cold-gate-20261108-v1.log','v445-full-node-20261108-v1.log','v445-input-audit-20261108-v1.log','v445-browser-20261108-v1.log',
 'contract-v440-known-blue-market-20261108-v1.md','contract-v441-new-ready-sector-task-20261108-v1.md','contract-v444-known-research-launch-20261108-v1.md',
 'v440-pink-native-controls-20261108-v1.json','v441-matched-opaque-value-20261108-v1.json','v445-opaque-launch-guards-20261108-v1.json',
 'v440-formal-r179-20261108-v1.json.gz','v441-formal-r179-20261108-v1.json.gz','v444-known-funding-native-horizon-20261108-v1.json']
for kind,assets in [('normal',[116,6,7,4,1]),('masked',[115,6,7,3,0])]:
    n=f'v445-r179-{kind}-20261108-v1.checkpoint.json'
    q=read(n)
    assert q['nativeReplayExact'] and q['rootAndRngRestored'] and not q['fixed'] and q['summary']['assets']==assets
    assert q['accepted'][0]['action']['actionId']=='play_card:6bef76b1'
    assert q['summary']['maxNative']<=256 and q['summary']['maxMs']<=600
    names.append(n)
out=b/'v445-known-launch-evidence-20261108-v1.tar.gz'
with out.open('xb') as f, gzip.GzipFile(fileobj=f,filename='',mode='wb',mtime=0) as z, tarfile.open(fileobj=z,mode='w|') as t:
    def add(n,d):
        p=tarfile.TarInfo(n);p.size=len(d);t.addfile(p,io.BytesIO(d))
    controls={}
    for n in names:
        data=(b/n).read_bytes();controls[n]=sha(data);add(n,data)
    for k,r in g['rows'].items():
        path=b/'v445-cold-roots'/(k+'.json.gz');data=path.read_bytes()
        assert sha(data)==r['rawSha256']
        q=json.loads(gzip.decompress(data))
        assert (q['actionId'],q['value'])==(r['actionId'],r['value']) and q['complete'] and not q['unresolved']
        add('cold-roots/'+path.name,data)
    add('control-index.json',json.dumps(controls,indent=2).encode()+b'\n')
print(out,sha(out.read_bytes()),out.stat().st_size)
