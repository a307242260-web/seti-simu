from pathlib import Path
import gzip,hashlib,json,tarfile,io
b=Path(__file__).parent.resolve()
sha=lambda x:hashlib.sha256(x).hexdigest()
control=['contract-20261108-v1.md','payment-root-20261108-v1.json','postscan-root-20261108-v1.json',
 'launch-root-20261108-v1.json','after-a0-root-20261108-v1.json','formal-r179-root-20261108-v1.json',
 'formal-r179-masked-root-20261108-v1.json','after-corner-root-20261108-v1.json','computer3-root-20261108-v1.json','ordinary-income-root-20261108-v1.json',
 'v411-payment-root-20261108-v1.json.gz','v412-payment-root-20261108-v1.json.gz','v412-postscan-root-20261108-v1.json.gz',
 'v414-postscan-root-20261108-v1.json.gz','v414-formal-r179-20261108-v1.json.gz','v414-formal-r179-masked-20261108-v1.json.gz',
 'v412-after-corner-root-20261108-v1.json.gz','v413-computer3-root-20261108-v1.json.gz','v414-ordinary-income-root-20261108-v1.json.gz',
 'v412-launch-autonomous-cold-20261108-v1.checkpoint.json','v412-launch-autonomous-saved-20261108-v1.checkpoint.json',
 'v412-postscan-autonomous-saved-20261108-v1.checkpoint.json','v413-launch-autonomous-cold-20261108-v1.checkpoint.json',
 'v414-postscan-autonomous-saved-20261108-v1.checkpoint.json','v414-after-a0-autonomous-saved-20261108-v1.checkpoint.json',
 'v414-a0-masked-20261108-v1.checkpoint.json','v414-ordinary-a0-20261108-v1.checkpoint.json','v414-alien-a0-20261108-v1.checkpoint.json',
 'v414-ordinary-income-a1-20261108-v1.checkpoint.json','v414-preserveMoneyAndPublicDisplay-20261108-v1.checkpoint.json',
 'v414-publicDisplayPink3-20261108-v1.checkpoint.json','v414-orange-preserveMoneyAndPublicDisplay-20261108-v1.checkpoint.json',
 'v414-orange-publicDisplayPink3-20261108-v1.checkpoint.json','v414-source-manifest-20261108-v1.json',
 'v414-cold-gate-20261108-v1.json','v414-cold-gate-20261108-v2.log','v414-focused-node-20261108-v1.log','v414-input-audit-20261108-v1.log','v414-browser-20261108-v1.log']
gate=json.loads((b/'v414-cold-gate-20261108-v1.json').read_bytes())
assert gate['status']=='complete' and gate['uniqueRoots']==867 and gate['earlyExact']==304 and gate['maxNativeInputs']<=256 and gate['maxMilliseconds']<=600
out=b/'v414-income-payment-evidence-20261108-v1.tar.gz'
with out.open('xb') as f,gzip.GzipFile(fileobj=f,filename='',mode='wb',mtime=0) as z,tarfile.open(fileobj=z,mode='w|') as a:
 def add(k,x):
  i=tarfile.TarInfo(k);i.size=len(x);a.addfile(i,io.BytesIO(x))
 entries={}
 for n in control:
  x=(b/n).read_bytes();entries[n]=sha(x);add(n,x)
 for k,r in gate['rows'].items():
  x=(b/'v414-cold-roots'/(k+'.json.gz')).read_bytes()
  assert sha(x)==r['rawSha256']
  q=json.loads(gzip.decompress(x))
  assert q['complete'] and not q['unresolved'] and q['actionId']==r['actionId'] and q['value']==r['value']
  add('cold-roots/'+k+'.json.gz',x)
 add('control-index.json',json.dumps(entries,indent=2).encode()+b'\n')
print(sha(out.read_bytes()),out.stat().st_size)
