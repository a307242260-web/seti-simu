from pathlib import Path
import gzip,hashlib,json,tarfile,io
b=Path(__file__).parent.resolve()
sha=lambda x:hashlib.sha256(x).hexdigest()
control=['contract-v407-20261108-v1.md','matched-v406-20261108-v1.checkpoint.json','launch-income-prefixes-v406-20261108-v1.checkpoint.json',
 'launch-income-prefixes-v407-20261108-v1.checkpoint.json','launch-income-prefixes-v408-20261108-v1.checkpoint.json',
 'after-launch-analysis-v407-20261108-v1.checkpoint.json','retained-supplier-v407-20261108-v1.checkpoint.json',
 'post-launch-combined-v408-20261108-v1.checkpoint.json','v408-hidden-preparation-20261108-v1.checkpoint.json',
 'v408-cold-gate-20261108-v1.json','v408-cold-gate-20261108-v1.log','v408-source-manifest-20261108-v1.json',
 'v408-focused-node-20261108-v1.log','v408-input-audit-20261108-v1.log','v408-browser-20261108-v1.log',
 'v408-data-payment-duplicate-20261108-v1.checkpoint.json','v409-distinct-data-payment-20261108-v1.checkpoint.json',
 'v409-source-manifest-20261108-v1.json','v409-cold-gate-20261108-v1.json','v409-cold-gate-20261108-v1.log',
 'v409-browser-20261108-v1.log','v409-post-launch-combined-20261108-v1.checkpoint.json','v409-hidden-preparation-20261108-v1.checkpoint.json',
 'contract-v410-20261108-v1.md','v410-pick-root-20261108-v1.json','v410-no-data-pick-root-20261108-v1.json',
 'v410-pick-root-measure-20261108-v1.json.gz','v410-no-data-pick-root-measure-20261108-v1.json.gz','v409-pick-root-baseline-20261108-v1.json.gz',
 'v409-no-data-pick-baseline-20261108-v1.json.gz','v410-pick-handoff-20261108-v1.checkpoint.json','v410-source-manifest-20261108-v1.json']
gate=json.loads((b/'v409-cold-gate-20261108-v1.json').read_bytes())
assert gate['status']!='running'
out=b/'v409-matched-development-evidence-20261108-v1.tar.gz'
with out.open('xb') as f,gzip.GzipFile(fileobj=f,filename='',mode='wb',mtime=0) as z,tarfile.open(fileobj=z,mode='w|') as a:
 def add(k,x):
  i=tarfile.TarInfo(k);i.size=len(x);a.addfile(i,io.BytesIO(x))
 entries={}
 for n in control:
  x=(b/n).read_bytes();entries[n]=sha(x);add(n,x)
 for p in sorted((b/'v408-fixtures').glob('*.json')):
  x=p.read_bytes();k='fixtures/'+p.name;entries[k]=sha(x);add(k,x)
 for k,r in gate['rows'].items():
  x=(b/'v409-cold-roots'/(k+'.json.gz')).read_bytes()
  assert sha(x)==r['rawSha256']
  q=json.loads(gzip.decompress(x))
  assert q['complete']==r['complete'] and len(q['unresolved'])==r['unresolved'] and q['actionId']==r['actionId'] and q['value']==r['value']
  add('cold-roots/'+k+'.json.gz',x)
 add('control-index.json',json.dumps(entries,indent=2).encode()+b'\n')
print(sha(out.read_bytes()),out.stat().st_size)
