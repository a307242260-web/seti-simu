# coding: utf-8
"""Validate all before/intermediate/final checkpoints; never rerun timed decisions."""
import gzip,hashlib,json,os,pathlib,subprocess
stage=pathlib.Path.cwd();prefix='reports/ai-foundation-20261023/';base='7daf602d06b23a47fb83b3a1243bb3b5a5303a4b';root='/Users/bilibili/code/seti-simu';sha=lambda p:hashlib.sha256((stage/p).read_bytes()).hexdigest();digest=lambda b:hashlib.sha256(b).hexdigest();read=lambda p:json.loads((stage/p).read_text())
corpus_path=prefix+'search-hotpath-corpus-20261029-v3.json';single_path=prefix+'search-hotpath-case062-20261029-v3.json';control_path=prefix+'movement-copy-control-after-20261029-v1.json';corpus=read(corpus_path);single=read(single_path);control=read(control_path)
for r in [corpus,single,control]:
 for p,h in r['sourceHashes'].items():assert sha(p)==h,('final source drift',p)
 for row in r['rows']:
  assert row['rootUnchanged']
  if row.get('rawPath'):assert sha(row['rawPath'])==row['rawSha256']
assert corpus['status']=='complete' and corpus['passed']==8 and corpus['failed']==0 and len(corpus['rows'])==8
reused=dict(next(r for r in corpus['rows'] if r['caseId']=='case-062'));assert reused.pop('reusedCheckpoint')==single_path and reused==single['rows'][0]
old=read(prefix+'six-greedy-plans-corpus-20261028-v1.json');old_by_id={r['caseId']:r for r in old['rows']};rows=[]
for row in corpus['rows']:
 d=row['diagnostics'];assert row['complete'] and row['unresolved']==0 and row['rootAndSearchMilliseconds']<=600 and row['actionId'] is not None
 assert d['limits']=={'transitions':256,'nodes':257,'frontier':256,'milliseconds':600} and d['transitions']<=256 and d['nodes']<=257 and d['peakFrontier']<=256
 raw=read(row['fixture']);assert sha(row['fixture'])==row['fixtureSha256']
 recorded=json.loads(gzip.decompress((stage/row['rawPath']).read_bytes()));assert len(recorded['sharedPrefixGraph']['edges'])==d['nativeExecutions'];assert not recorded['unresolved']
 if old_by_id[row['caseId']]['complete']:
  assert row['value']==old_by_id[row['caseId']]['value'] and row['actionId']==old_by_id[row['caseId']]['actionId'],('completed baseline decision changed',row['caseId'])
 rows.append({'caseId':row['caseId'],'complete':True,'milliseconds':row['rootAndSearchMilliseconds'],'nativeInputs':d['nativeExecutions'],'states':d['nodes'],'searchGraphNodes':d['graphNodes'],'pendingStates':0,'movementTimingHits':row['port']['movementTimingCacheHits'],'movementTimingMisses':row['port']['movementTimingCacheMisses'],'observationMilliseconds':row['port']['milliseconds']['observation'],'rawPath':row['rawPath'],'rawSha256':row['rawSha256']})
assert sum(len(r['cases']) for r in control['rows'])==12
before_path=prefix+'movement-copy-control-before-20261029-v1.json';projections_path=prefix+'movement-copy-projections-before-20261029-v1.json';before=read(before_path);projections=read(projections_path)
for row in control['rows']:
 assert row['cases']==next(r for r in before['rows'] if r['name']==row['name'])['cases']
 assert row['observationSha256']==next(r for r in projections['rows'] if r['name']==row['name'])['observationSha256']
profile_path=prefix+'search-hotpath-profile-20261029-v1.json';profile=read(profile_path)
for r in [before,projections,profile]:
 for p,h in r['sourceHashes'].items():
  if sha(p)!=h:assert digest(subprocess.check_output(['git','show',base+':'+p],cwd=root,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')))==h,('baseline source mismatch',p)
 for row in r['rows']:
  if row.get('rawPath'):assert sha(row['rawPath'])==row['rawSha256']
variant_path='adhoc/search-hotpath-variants-20261029/manifest.json';variant=read(variant_path);variant_hashes={}
for p,v in variant['variants'].items():
 assert sha(p)==v['compressedSha256'];assert digest(gzip.decompress((stage/p).read_bytes()))==v['sha256'];variant_hashes[(v['reportVersion'],v['runtimePath'])]=v['sha256']
intermediate=[]
for version in [1,2]:
 path=prefix+f'search-hotpath-corpus-20261029-v{version}.json';r=read(path)
 for p,h in r['sourceHashes'].items():
  if sha(p)==h:continue
  if variant_hashes.get((version,p))==h:continue
  assert digest(subprocess.check_output(['git','show',base+':'+p],cwd=root,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')))==h,('intermediate source mismatch',version,p)
 for row in r['rows']:assert sha(row['rawPath'])==row['rawSha256'] and row['rootUnchanged']
 intermediate.append({'path':path,'sha256':sha(path),'passed':r['passed'],'failed':r['failed']})
logs={'node':prefix+'search-hotpath-node-regression-20261029-v1.log','focused':prefix+'search-hotpath-focused-20261029-v3.log','browser':prefix+'search-hotpath-browser-20261029-v1.log','value':prefix+'search-hotpath-value-audit-20261029-v1.log'}
assert 'SUMMARY unit passed=145 failed=0 total=145' in (stage/logs['node']).read_text();assert 'SUMMARY fullFlow passed=1 failed=0 total=1' in (stage/logs['node']).read_text();assert 'SUMMARY unit passed=5 failed=0 total=5' in (stage/logs['focused']).read_text();assert 'SUMMARY browserSmoke passed=11 failed=0 total=11' in (stage/logs['browser']).read_text()
v=(stage/logs['value']).read_text();fail=[s for s in v.splitlines() if s.startswith('[FAIL]')];assert len(fail)==1 and 'aomomo' in fail[0];count=sum(s.startswith('[PASS] independent-') for s in v.splitlines());assert count==39
syntax=['randomizer/game/production-kernel.js','randomizer/game/ai/analysis-port.js','randomizer/game/ai/movement-preview-copy.test.js','tools/node-test-inventory.js','tools/browser-smoke-inventory.js','tools/audit_v_state_inputs.js','adhoc/profile-search-hotpath-20261029-v1.js','adhoc/benchmark-movement-copy-20261029-v1.js','adhoc/capture-movement-projections-20261029-v1.js','adhoc/benchmark-movement-copy-after-20261029-v1.js']+[f'adhoc/audit-search-hotpath-{part}-20261029-v{n}.js' for n in [1,2,3] for part in ['case062','corpus']]
for p in syntax:subprocess.run(['node','--check',p],check=True)
report={'schemaVersion':'seti-search-hotpath-delivery-v1','baseCommit':base,'searchVersion':'seti-complete-decision-search-v37','scope':'Native movement previews clone only mutable slices, dependency-keyed timing reuse excludes economic-only facts, and analysis reuses complete immutable native observation fields. No strategy/pruning/state-equivalence/budget changes.','budget':corpus['budget'],'passed':8,'failed':0,'rows':rows,'checkpoints':[{'path':p,'sha256':sha(p)} for p in [corpus_path,single_path,control_path]],'baselineEvidence':[{'path':p,'sha256':sha(p)} for p in [profile_path,before_path,projections_path]],'intermediateCorpora':intermediate,'intermediateSources':{'path':variant_path,'sha256':sha(variant_path)},'parity':{'nativeTimingCasesEqual':12,'completeProjectionHashesEqual':4,'alreadyCompletedBaselineDecisionsUnchanged':6,'frozenRootsAndRngUnchanged':True,'nativeInputsNotSkipped':True},'validation':{'nodeUnitPassed':145,'nodeFullFlowPassed':1,'focusedPassed':5,'browserPassed':11,'independentValueInputsPassed':39,'knownLegacyValueFailure':fail,'syntaxChecked':syntax,'logs':{k:{'path':p,'sha256':sha(p)} for k,p in logs.items()}},'remaining':['The late case152 sample is close to 600ms; this is one reproducible eight-case run, not a broad latency guarantee.','Pre-main income/alternative tech acquisition menus are retained; this change does not narrow necessary decision lines.','No new complete-game score or 180-second whole-game acceptance.'],'timingNote':'Each code stage ran once and retained its checkpoint; profiler samples include profiling overhead. Sequential controls have JIT/host noise and do not establish a universal speed or strength ratio.','wholeGames':0,'wholeGame180sAccepted':False,'sourceHashes':corpus['sourceHashes']}
out=prefix+'search-hotpath-final-20261029-v1.json';(stage/out).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'report':out,'passed':8,'lateRows':rows[-2:]}))
