from pathlib import Path
import gzip,hashlib,io,json,tarfile
b=Path(__file__).parent;g=b/'cold-gate-20261108-v1.json';m=b/'source-manifest-20261108-v1.json'
gate=json.loads(g.read_bytes());sha=lambda q:hashlib.sha256(q).hexdigest()
assert gate['status']=='complete' and gate['manifestSha256']==sha(m.read_bytes()) and len(gate['rows'])==844
a=b/'cold-graphs-20261108-v1.tar.gz'
with a.open('xb') as f,gzip.GzipFile(fileobj=f,filename='',mode='wb',mtime=0) as z,tarfile.open(fileobj=z,mode='w|') as ar:
 def add(n,data):
  k=tarfile.TarInfo(n);k.size=len(data);ar.addfile(k,io.BytesIO(data))
 add('cold-gate.json',g.read_bytes());add('source-manifest.json',m.read_bytes())
 for k,r in gate['rows'].items():
  data=(b/'cold-roots'/(k+'.candidate.json.gz')).read_bytes()
  assert sha(data)==r['rawSha256']
  q=json.loads(gzip.decompress(data))
  assert q['actionId']==r['actionId'] and q['value']==r['value'] and q['complete'] and not q['unresolved']
  add('roots/'+k+'/search.json.gz',data)
print(sha(a.read_bytes()),a.stat().st_size)
