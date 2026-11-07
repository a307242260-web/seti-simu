from pathlib import Path
import gzip,hashlib,json,subprocess
b=Path(__file__).parent.resolve();v=b.parent/'seti-v399-income-funding-20261108-v1';z=b.parent/'seti-v398-scan-timing-20261108-v1';w=b/'work-v422';o=b.parent/'seti-v411-income-payment-20261108-v1';a=b.parent/'seti-v407-matched-development-20261108-v1'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_bytes())
manifest=b/'v422-source-manifest-20261108-v1.json'
for n,h in read(manifest)['runtimeHashes'].items():assert sha(w/n)==h,n
prior=read(b/'v419-cold-gate-20261108-v1.json');assert prior['status']=='complete' and len(prior['rows'])==869
prevroots=b/'v419-cold-roots';cache=b/'v422-cold-roots';cache.mkdir(exist_ok=True)
out=b/'v422-cold-gate-20261108-v1.json'
r=read(out) if out.exists() else {'version':'V422','status':'running','rows':{},'manifestSha256':sha(manifest),'previousGateSha256':sha(b/'v419-cold-gate-20261108-v1.json'),'newAutonomousRuns':0}
assert r['manifestSha256']==sha(manifest) and r['status']=='running'
def save():
 p=out.with_suffix('.tmp');p.write_text(json.dumps(r,ensure_ascii=False)+'\n');p.replace(out)
def norm(x):
 if isinstance(x,dict):return {k:norm(y) for k,y in x.items() if k!='milliseconds'}
 if isinstance(x,list):return [norm(y) for y in x]
 return x
priority=['deferred-sector-actual-179','actual-v256-125','income-before-amiba','corpus-case-152','actual-v256-132','teacher-r3-after-amiba-reveal','paid-tail-before-research-computer3','paid-tail-early-a0-analyzed','income-route-193-hidden']
priority=[f'launch-income-{i}' for i in [1,9,6,7]]+priority
older={'postscan-launch':o/'postscan-root-20261108-v1.json','late-pick':a/'v410-pick-root-20261108-v1.json',
 'late-pick-no-data':a/'v410-no-data-pick-root-20261108-v1.json','after-first-funded-corner':o/'after-corner-root-20261108-v1.json',
 'late-computer3-no-certificate':o/'computer3-root-20261108-v1.json'}
older.update({'reverse-three-corners':b/'reverse-three-corners-root-20261108-v1.json','reverse-missing-corner':b/'reverse-missing-corner-root-20261108-v1.json'})
extra=[('reverse-company-supply',b/'reverse-postlaunch-supply-root-20261108-v1.json'),
 ('reverse-launch-pick',b/'reverse-preserved-orange-pick-root-20261108-v1.json'),
 ('reverse-known-data-launch',b/'reverse-preserved-public-postscan-root-20261108-v1.json'),
 ('reverse-public-scan-menu',b/'reverse-public-scan-root-20261108-v1.json')]
order=[(label,{'fixture':p,'fixtureSha256':sha(p),'labels':[label],'early':False}) for label,p in extra]+sorted(prior['rows'].items(),key=lambda kv:(min([priority.index(x) for x in kv[1]['labels'] if x in priority]+[len(priority)]),-kv[1]['milliseconds']))
for k,o in order:
 if k in r['rows']:continue
 fixture=o.get('fixture',z/'cold-roots'/(k+'.fixture.json'))
 if k in older:fixture=older[k]
 if k.startswith('launch-income-'):fixture=a/'v408-fixtures'/(k+'.json')
 if k.startswith('income-route-'):
  label=k.removeprefix('income-route-')
  fixture=v/(f'r{label}-fixture-20261108-v1.json')
 raw=cache/(k+'.json.gz');prev=prevroots/(k+'.json.gz')
 assert not raw.exists(),'audit pending sample first'
 assert sha(fixture)==o['fixtureSha256'],(k,fixture)
 if 'fixture' not in o:assert sha(prev)==o['rawSha256']
 r['pending']={'identity':k,'label':o['labels'][0]};save()
 p=subprocess.run(['node',str(v/'measure-v406-gate-root-20261108-v1.js'),str(fixture),str(raw)],cwd=w,capture_output=True,text=True,timeout=30)
 if p.returncode:
  r.update(status='execution-failed',failure={'stderr':p.stderr,'stdout':p.stdout,**r['pending']});save();print(r['failure'],flush=True);break
 m=json.loads(p.stdout)
 x,y=(norm(json.loads(gzip.decompress(f.read_bytes()))) if f.exists() else {} for f in (prev,raw))
 changed=[n for n in sorted(x.keys()|y.keys()) if x.get(n)!=y.get(n)] if prev.exists() else []
 r['rows'][k]={'labels':o['labels'],'early':o['early'],'graphChanges':changed,'rawSha256':sha(raw),'fixtureSha256':sha(fixture),
  'oldActionId':o.get('actionId'),'oldValue':o.get('value'),**m}
 r['pending']=None;save()
 if not(m['complete'] and m['unresolved']==0 and m['rootAndRngUnchanged'] and m['nativeInputs']<=256 and m['milliseconds']<=600
        and all(x is None for x in m['diagnosticLimits'].values()) and (not o['early'] or not changed)):
  r.update(status='decision-gate-failed',failure={'identity':k,**r['rows'][k]});save();print(r['failure'],flush=True);break
 if len(r['rows'])<=24 or len(r['rows'])%60==0:
  print(json.dumps({'rows':len(r['rows']),'label':o['labels'][0],'action':m['actionId'],'value':m['value'],'native':m['nativeInputs'],'ms':m['milliseconds'],
    'maxMs':max(v['milliseconds'] for v in r['rows'].values())}),flush=True)
else:
 r.update(status='complete',namedCases=sum(len(x['labels']) for x in r['rows'].values()),uniqueRoots=len(r['rows']),
  earlyExact=sum(x['early'] for x in r['rows'].values()),maxNativeInputs=max(x['nativeInputs'] for x in r['rows'].values()),maxMilliseconds=max(x['milliseconds'] for x in r['rows'].values()))
 save();print(json.dumps({k:v for k,v in r.items() if k!='rows'}),flush=True)
