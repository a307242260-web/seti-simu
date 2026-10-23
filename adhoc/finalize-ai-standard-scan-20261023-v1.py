"""Bind final evidence and separately archive source-specific prototypes; never run a game."""
import gzip,hashlib,json,os,pathlib,subprocess,collections
stage=pathlib.Path.cwd();root=pathlib.Path('/Users/bilibili/code/seti-simu');mp='adhoc/ai-pick-boundary-stage40-snapshot-20261023.json';m=json.loads((stage/mp).read_text());base=m['baseCommit'];files=set();sha=lambda b:hashlib.sha256(b).hexdigest()
def read(p):
 b=(stage/p).read_bytes();return json.loads(gzip.decompress(b)if p.endswith('.gz')else b)
def write(p,d):(stage/p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def include(p):assert(stage/p).exists(),p;files.add(p)
def runtime(r):
 for p,h in r['sourceHashes'].items():assert sha((stage/p).read_bytes())==h,('final runtime',p)
def packed(r,pk='rawPath',hk='rawSha256'):
 p=r[pk];b=(stage/p).read_bytes();assert sha(b)==r[hk],p
 if not p.endswith('.gz'):
  out=gzip.compress(b,mtime=0);p+='.gz';(stage/p).write_bytes(out);r[pk]=p;r[hk]=sha(out);r['rawUncompressedSha256']=sha(b);r['rawEncoding']='gzip'
 include(p)
# Final frozen runtime and unchanged fixed acceptance budget.
cp='reports/ai-foundation-20261023/decision-corpus-audit-v28.json';c=read(cp);runtime(c);assert c['status']=='complete' and c['passed']==5 and len(c['rows'])==8
assert c['budget']==dict(transitions=256,nodes=257,frontier=256,milliseconds=600)
for row in c['rows']:assert row['rootUnchanged'];packed(row)
row008=next(r for r in c['rows']if r['caseId']=='case-008');raw=read(row008['rawPath']);prior=read('reports/ai-foundation-20261023/attained-case008-v2.json')
assert raw['complete'] and raw['value']==prior['value']==37.5 and raw['actionId']==prior['actionId'] and raw['lines'][0]['distance']==prior['distance']==10
assert raw['diagnostics']['transitions']==248
write(cp,c);include(cp)
lp='reports/ai-foundation-20261023/late-semantic-case062-v13.json';late=read(lp);runtime(late);assert not late['complete']and late['diagnostics']['transitions']==4096 and late['rootUnchanged'];packed(late);write(lp,late);include(lp)
ep='reports/ai-foundation-20261023/case062-effect-source-replay-v1.json';effect=read(ep);runtime(effect);assert effect['analysisSourceSha256']==sha((stage/'randomizer/game/ai/analysis-port.js').read_bytes());assert effect['nativeSubmissions']==4096 and effect['mappedNodes']==2348 and effect['equivalentChecks']==1749 and effect['boundaryChecks']==379 and effect['rootUnchanged']
# Graph compression changes only storage, not replayed bytes.
assert effect.get('graphUncompressedSha256',effect['graphSha256'])==late['rawUncompressedSha256'];effect.update(graphPath=late['rawPath'],graphEncoding='gzip',graphUncompressedSha256=late['rawUncompressedSha256'],graphSha256=late['rawSha256']);write(ep,effect);include(ep);assert sha((stage/effect['detailPath']).read_bytes())==effect['detailSha256'];include(effect['detailPath'])
# Source-bound scheduling prototypes. They are not timing evidence for final changed source.
archives={};candidates=collections.defaultdict(list)
for v in [1,2]:
 p=f'adhoc/ai-quiet-composed-schedulers-prototypes-20261023-v{v}.json.gz';a=read(p);archives[v]=a;include(p)
 for field,target in [('analysisSource','randomizer/game/ai/analysis-port.js'),('baselineSearchSource','randomizer/game/ai/decision-search.js')]:candidates[target].append((sha(a[field].encode()),p+'#'+field))
 for mode,source in a['variants'].items():candidates['randomizer/game/ai/decision-search.js'].append((sha(source.encode()),p+'#variants.'+mode))
basebytes={}
def base_file(p):
 if p not in basebytes:basebytes[p]=subprocess.check_output(['git','show',base+':'+p],cwd=root,env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'})
 return basebytes[p]
def prototype_binding(r):
 sources={}
 for p,h in r['sourceHashes'].items():
  if sha((stage/p).read_bytes())==h:sources[p]='final-snapshot'
  elif sha(base_file(p))==h:sources[p]='git:'+base+':'+p
  else:
   found=[ref for digest,ref in candidates[p]if digest==h];assert found,('unbound prototype source',p,h);sources[p]=found[0]
 r['prototypeRuntimeSources']=sources
for name in ['quiet-composed-case008-prototype-v1.json','quiet-scan-composed-case008-prototype-v1.json']:
 p='reports/ai-foundation-20261023/'+name;r=read(p);prototype_binding(r);assert r['complete']and r['value']==37.5 and r['distance']==10 and r['rootUnchanged'];packed(r);write(p,r);include(p)
for v in [1,2]:
 p=f'reports/ai-foundation-20261023/composed-scheduling-prototypes-v{v}.json';r=read(p);prototype_binding(r);assert r['terminal'] and sha((stage/r['archivePath']).read_bytes())==r['archiveSha256']
 for row in r['rows']:
  assert row['complete']and row['value']==37.5 and row['distance']==10 and row['rootUnchanged'];assert sha(archives[v]['variants'][row['mode']].encode())==row['searchSha256'];packed(row)
 write(p,r);include(p)
# Existing full008 graph replay was performed on HEAD before this runtime changed.
p='reports/ai-foundation-20261023/choice-boundary-replay-v1.json';r=read(p);assert r['nativeSubmissions']==577 and r['mappedNodes']==491 and r['rootUnchanged'];assert r['analysisSourceSha256']==sha(base_file('randomizer/game/ai/analysis-port.js'))
for key in ['graphPath','detailPath']:assert sha((stage/r[key]).read_bytes())==r[key.replace('Path','Sha256')]
include(r['detailPath']);b=(stage/p).read_bytes();archive=p+'.gz';(stage/archive).write_bytes(gzip.compress(b,mtime=0));include(archive)
summary={k:v for k,v in r.items()if k!='groups'};summary['groups']={k:{x:v for x,v in g.items()if x!='sample'}for k,g in r['groups'].items()};summary.update(baseCommit=base,originalReportArchive=archive,originalReportSha256=sha((stage/archive).read_bytes()))
sp='reports/ai-foundation-20261023/choice-boundary-replay-summary-v1.json';write(sp,summary);include(sp)
changed=['randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','randomizer/game/effects/science-session.js','randomizer/game/ai/search-agent.test.js','randomizer/game/ai/standard-scan-bound.test.js','randomizer/game/ai/quiet-bound-composition.test.js','randomizer/index.html','tools/node-test-inventory.js','tools/audit_v_state_inputs.js','docs/ai-development-workflow.md','docs/ai-implementation-20261022.md','docs/ai-interface-inventory-20261022.md','docs/ai-post-main-attained-bound-20261023.md','docs/ai-search-agent-contract-20261023.md','docs/ai-standard-scan-bound-20261023.md']
artifacts=['adhoc/ai-quiet-bound-composition-20261023-v1.md','adhoc/ai-scan-bound-design-20261023-v1.md','adhoc/replay-ai-choice-boundaries-20261023-v1.js','adhoc/replay-ai-case062-effect-sources-20261023-v1.js','adhoc/diagnose-ai-quiet-composed-case008-20261023-v1.js','adhoc/diagnose-ai-quiet-scan-composed-case008-20261023-v1.js','adhoc/experiment-ai-composed-scheduling-20261023-v1.js','adhoc/experiment-ai-composed-scheduling-20261023-v2.js','adhoc/audit-ai-decision-corpus-20261023-v28.js','adhoc/profile-ai-late-semantic-case062-20261023-v13.js','adhoc/finalize-ai-standard-scan-20261023-v1.py','adhoc/deliver-ai-standard-scan-20261023-v1.py']
logs=['standard-scan-node-v1.log','scan-bound-targeted-v3.log','standard-scan-browser-v1.log','standard-scan-v-input-audit-v1.log','decision-corpus-audit-v28.log','late-semantic-case062-v13.log','case062-effect-source-replay-v1.log']
for p in changed+artifacts+['reports/ai-foundation-20261023/'+x for x in logs]:include(p)
node=(stage/'reports/ai-foundation-20261023/standard-scan-node-v1.log').read_text();assert 'SUMMARY unit passed=136 failed=0 total=136'in node and 'SUMMARY fullFlow passed=1 failed=0 total=1'in node
browser=(stage/'reports/ai-foundation-20261023/standard-scan-browser-v1.log').read_text();assert 'SUMMARY browserSmoke passed=3 failed=0 total=3'in browser
audit=(stage/'reports/ai-foundation-20261023/standard-scan-v-input-audit-v1.log').read_text();independent=[l for l in audit.splitlines()if l.startswith('[PASS] independent-')];failed=[l for l in audit.splitlines()if l.startswith('[FAIL]')];assert len(independent)==30 and len(failed)==1 and'aomomo'in failed[0]
syntax=[]
for p in changed+artifacts:
 if p.endswith('.js'):
  run=subprocess.run(['node','--check',str(stage/p)],capture_output=True,text=True);assert run.returncode==0,(p,run.stderr);syntax.append({'path':p,'sha256':sha((stage/p).read_bytes()),'exitCode':0})
sy='reports/ai-foundation-20261023/standard-scan-syntax-v1.json';write(sy,{'rows':syntax});include(sy)
vp='reports/ai-foundation-20261023/standard-scan-validation-v1.json';report={'date':'2026-10-23','baseCommit':base,'runtimeVersion':'seti-complete-decision-search-v30','analysisPortCacheVersion':'v31','nativeScienceCacheVersion':'v20','scope':'Exact standard scan refill upper bound, composition with existing quiet continuation proof, exhaustive deterministic LIFO scheduling; no full games, weaker identity, or increased fixed budget.','fixedDecisionGate':{'path':cp,'passed':5,'total':8,'budget':c['budget'],'case008':{'transitions':248,'millisecondsIncludingRoot':row008['rootAndSearchMilliseconds'],'value':37.5,'distance':10,'samePriorFirstAction':True},'remaining':['case-062','case-105','case-152']},'node':{'unitPassed':136,'fullFlowPassed':1},'browser':{'passed':3,'actualChrome':True},'independentVInputPasses':30,'vInputLegacyFailure':failed,'syntaxChecks':len(syntax),'newSearchFullGames':0,'newSearchFinalScores':None,'fullGame180SecondAcceptance':'Unproved; do not run full games before fixed decision gates pass.','nextBottleneck':{'evidencePath':ep,'replayedInputs':4096,'dlc40FiveMovementInputs':2679,'movementDirections':2029,'movementSkip':650,'scope':'Counts from an incomplete window, not an optimum or game grade.'},'sourceHashes':{p:sha((stage/p).read_bytes())for p in changed},'evidenceHashes':{p:sha((stage/p).read_bytes())for p in sorted(files)if p not in changed}}
write(vp,report);include(vp);m.update(scope=report['scope'],validationPath=vp,files={p:sha((stage/p).read_bytes())for p in sorted(files)},notes='Final frozen runtime bound through all full Node, Chrome, corpus and native replay evidence; source-specific prototypes bound separately. Unrelated working tree, shared index, record registry and V1/V2 centers are not changed.');write(mp,m)
print(json.dumps({'files':len(files),'unitPassed':136,'browserPassed':3,'fixedGate':'5/8','syntaxChecks':len(syntax),'newSearchFullGames':0}))
