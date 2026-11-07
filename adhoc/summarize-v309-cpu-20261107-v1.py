from pathlib import Path
import json,hashlib,collections
P=Path(__file__).resolve().parents[1];D=P/'reports/ai-foundation-20261107/post-research-comparison-runtime-v1';src=D/'current-runtime-hotspots-20261107-v1.cpuprofile';p=json.loads(src.read_text());nodes={n['id']:n for n in p['nodes']};parents={c:n['id']for n in p['nodes']for c in n.get('children',[])};own=collections.Counter(p['samples']);inclusive=collections.Counter()
for sid in p['samples']:
 seen=set()
 while sid in nodes:
  f=nodes[sid]['callFrame'];key=(f['functionName'],f['url'].rsplit('/',1)[-1],f['lineNumber']+1)
  if key not in seen:inclusive[key]+=1;seen.add(key)
  sid=parents.get(sid)
def rows(count):return[dict(function=k[0],file=k[1],line=k[2],samples=v)for k,v in count.most_common(40)]
selfcounts=collections.Counter()
for sid,n in own.items():
 f=nodes[sid]['callFrame'];selfcounts[f['functionName'],f['url'].rsplit('/',1)[-1],f['lineNumber']+1]+=n
r={'scope':'Current V309 CPU diagnostic only, inclusive functions counted once per sample, stacks overlap; counts are not milliseconds or acceptance samples.','profileSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'samples':len(p['samples']),'self':rows(selfcounts),'inclusive':rows(inclusive)};out=D/'current-runtime-hotspot-summary-20261107-v1.json';assert not out.exists();out.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'samples':r['samples'],'self':r['self'][:12],'inclusive':r['inclusive'][:16]}))
