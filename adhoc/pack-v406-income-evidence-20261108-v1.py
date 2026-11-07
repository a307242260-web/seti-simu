from pathlib import Path
import gzip,hashlib,json,tarfile,io
b=Path(__file__).parent.resolve()
sha=lambda x:hashlib.sha256(x).hexdigest()
control=['r181-fixture-20261108-v1.json','r186-fixture-20261108-v1.json','r189-fixture-20261108-v1.json','r193-fixture-20261108-v1.json','r193-hidden-fixture-20261108-v1.json',
 'later-prefixes-20261108-v1.checkpoint.json','r193-v399-improved-20261108-v1.checkpoint.json','r189-v400-diag-20261108-v1.log',
 'r189-v401-first-20261108-v1.checkpoint.json','r186-v402-hidden-20261108-v1.checkpoint.json','r181-v403-actual-20261108-v1.checkpoint.json',
 'r179-v403-actual-20261108-v1.checkpoint.json','v403-cold-gate-20261108-v1.json','v404-cold-gate-20261108-v1.json','v404-first-income-prefixes-20261108-v1.checkpoint.json',
 'v404-postscan-technology-20261108-v1.checkpoint.json','v404-hidden-supply-20261108-v1.checkpoint.json','v406-hidden-supply-20261108-v1.checkpoint.json',
 'v406-native-computer-equivalence-20261108-v1.checkpoint.json','r193-hidden-v405-20261108-v1.checkpoint.json','r193-hidden-v406-20261108-v1.checkpoint.json',
 'v406-source-manifest-20261108-v1.json','v406-cold-gate-20261108-v1.json','v406-cold-gate-20261108-v1.log','contract-20261108-v1.md','v406-focused-node-20261108-v1.log','v406-browser-20261108-v1.log','v406-complete-income-launch-20261108-v1.checkpoint.json']
gate=json.loads((b/'v406-cold-gate-20261108-v1.json').read_bytes())
assert gate['status']=='complete' and gate['uniqueRoots']==849 and gate['earlyExact']==304 and gate['maxNativeInputs']<=256 and gate['maxMilliseconds']<600
out=b/'v406-income-funding-evidence-20261108-v1.tar.gz'
with out.open('xb') as f,gzip.GzipFile(fileobj=f,filename='',mode='wb',mtime=0) as z,tarfile.open(fileobj=z,mode='w|') as a:
 def add(k,x):
  i=tarfile.TarInfo(k);i.size=len(x);a.addfile(i,io.BytesIO(x))
 entries={}
 for n in control:
  x=(b/n).read_bytes();entries[n]=sha(x);add(n,x)
 for k,r in gate['rows'].items():
  x=(b/'v406-cold-roots'/(k+'.json.gz')).read_bytes()
  assert sha(x)==r['rawSha256']
  q=json.loads(gzip.decompress(x))
  assert q['complete'] and not q['unresolved'] and q['actionId']==r['actionId'] and q['value']==r['value']
  add('cold-roots/'+k+'.json.gz',x)
 add('control-index.json',json.dumps(entries,indent=2).encode()+b'\n')
print(sha(out.read_bytes()),out.stat().st_size)
