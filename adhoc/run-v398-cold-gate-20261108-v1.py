from pathlib import Path
import collections,gzip,hashlib,json,os,re,subprocess,tarfile
b=Path(__file__).parent.resolve(); w=b/'work';repo=Path('/Users/bilibili/code/seti-simu')
e=repo/'reports/ai-foundation-20261108/v397-source-admission-v1'
archive=e/'cold-admission-evidence-20261108-v1.tar.gz';manifest=b/'source-manifest-20261108-v1.json'
read=lambda p:json.loads(p.read_bytes());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
m=read(manifest)
for k,h in m['runtimeHashes'].items():assert sha(w/k)==h,k
out=b/'cold-gate-20261108-v1.json'
prior=read(e/'serial-cold-gate-20261108-v1.json');assert prior['status']=='complete'
early={x['identity'] for x in read(e/'first-two-full-graphs-20261108-v1.json')['details']}
by={}
for row in prior['rows']:by.setdefault(row['identity'],[]).append(row)
assert len(by)==844 and len(early)==304
priority=['deferred-sector-actual-179','income-before-amiba','actual-v256-125','corpus-case-152','actual-v256-132','teacher-r3-after-amiba-reveal','known-research-data-actual-192']
order=sorted(by,key=lambda k:(min([priority.index(x['label']) for x in by[k] if x['label'] in priority]+[len(priority)]),-by[k][0]['milliseconds']))
cur=read(out) if out.exists() else {'version':'V398','status':'running','manifestSha256':sha(manifest),'oldGateSha256':sha(e/'serial-cold-gate-20261108-v1.json'),'rows':{},'pending':None,'newAutonomousRuns':0}
assert cur['manifestSha256']==sha(manifest) and cur['status']=='running'
def save():
 p=out.with_suffix('.tmp');p.write_text(json.dumps(cur,ensure_ascii=False)+'\n');p.replace(out)
def normalize(x):
 if isinstance(x,dict):return {k:normalize(v) for k,v in x.items() if k!='milliseconds'}
 if isinstance(x,list):return [normalize(v) for v in x]
 if isinstance(x,str):return re.sub(r'seti-complete-decision-search-v(?:397|398)','seti-complete-decision-search-vBASE',x)
 return x
def root_file(ar,k,part):return ar.extractfile('roots/'+k+'/'+part).read()
cache=b/'cold-roots';cache.mkdir(exist_ok=True)
with tarfile.open(archive,'r:gz') as ar:
 index=json.load(ar.extractfile('root-artifact-index.json'));assert set(index)==set(by)
 # Extract once in archive order to avoid quadratic rewinds in gzip.
 for item in ar:
  n=item.name.split('/')
  if len(n)!=3 or n[2] not in ('fixture.json','search.json.gz'):continue
  k=n[1];ext='fixture.json' if n[2]=='fixture.json' else 'baseline.json.gz'
  p=cache/(k+'.'+ext)
  if not p.exists():
   with p.open('xb') as f:f.write(ar.extractfile(item).read())
for k in order:
 if k in cur['rows']:continue
 row=by[k][0];fixture=cache/(k+'.fixture.json');baseline=cache/(k+'.baseline.json.gz');raw=cache/(k+'.candidate.json.gz')
 assert sha(fixture)==index[k]['fixtureSha256'] and sha(baseline)==index[k]['rawSha256']
 cur['pending']={'identity':k,'label':row['label']};save()
 assert not raw.exists(),'audit the previous nonterminal root before resuming'
 q=subprocess.run(['node',str(b/'measure-v398-gate-root-20261108-v1.js'),str(fixture),str(raw)],cwd=w,capture_output=True,text=True,timeout=30)
 if q.returncode:
  cur.update(status='execution-failed',failure={'code':q.returncode,'stderr':q.stderr,'stdout':q.stdout,**cur['pending']});save();print(cur['failure'],flush=True);break
 d=json.loads(q.stdout);x,y=(normalize(json.loads(gzip.decompress(f.read_bytes()))) for f in (baseline,raw))
 changes=[n for n in sorted(x.keys()|y.keys()) if x.get(n)!=y.get(n)]
 cur['rows'][k]={'labels':[i['label'] for i in by[k]],'early':k in early,'earlyGraphEqual':k not in early or not changes,
  'graphChanges':changes,'rawSha256':sha(raw),'fixtureSha256':sha(fixture),'originalActionId':row['actionId'],'originalValue':row['value'],**d}
 cur['pending']=None;save()
 if not(d['complete'] and d['rootAndRngUnchanged'] and d['unresolved']==0 and d['nativeInputs']<=256 and d['milliseconds']<=600
        and all(x is None for x in d['diagnosticLimits'].values()) and (k not in early or not changes)):
  cur.update(status='decision-gate-failed',failure={'identity':k,**cur['rows'][k]});save();print(cur['failure'],flush=True);break
 if len(cur['rows'])<=14 or len(cur['rows'])%60==0:print(json.dumps({'rows':len(cur['rows']),'label':row['label'],'native':d['nativeInputs'],'ms':d['milliseconds'],
   'highest':max(x['milliseconds'] for x in cur['rows'].values()),'changedActions':sum(x['actionId']!=x['originalActionId'] for x in cur['rows'].values())}),flush=True)
else:
 cur.update(status='complete',earlyComplete=sum(x['early'] for x in cur['rows'].values()),namedCases=sum(len(x['labels']) for x in cur['rows'].values()),
  measuredUniqueRoots=len(cur['rows']),maxNativeInputs=max(x['nativeInputs'] for x in cur['rows'].values()),maxMilliseconds=max(x['milliseconds'] for x in cur['rows'].values()))
 assert cur['earlyComplete']==304 and cur['namedCases']==1285 and cur['measuredUniqueRoots']==844
 save();print(json.dumps({k:v for k,v in cur.items() if k!='rows'}),flush=True)
