"""Bind final runtime evidence, archive older prototypes separately, and package the tested overlay."""
import gzip,hashlib,json,pathlib,subprocess
stage=pathlib.Path.cwd();root=pathlib.Path('/Users/bilibili/code/seti-simu');mp='adhoc/ai-attainment-stage39-snapshot-20261023.json';m=json.loads((stage/mp).read_text());sha=lambda b:hashlib.sha256(b).hexdigest();files=set()
def load(p):
 b=(stage/p).read_bytes();return json.loads(gzip.decompress(b) if p.endswith('.gz') else b)
def dump(p,d):(stage/p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def runtime(r,overrides=None):
 for p,h in r['sourceHashes'].items():assert sha((overrides or {}).get(p,(stage/p).read_bytes()))==h,('runtime mismatch',p)
def package(r):
 p=r['rawPath'];data=(stage/p).read_bytes();assert sha(data)==r['rawSha256']
 if p.endswith('.gz'):
  if r.get('rawUncompressedSha256'):assert sha(gzip.decompress(data))==r['rawUncompressedSha256']
 else:
  packed=gzip.compress(data,mtime=0);p+='.gz';(stage/p).write_bytes(packed);r.update(rawPath=p,rawEncoding='gzip',rawSha256=sha(packed),rawUncompressedSha256=sha(data))
 files.add(p)
# Final experiments all bind the same runtime files; none are full game grades.
corpus_path='reports/ai-foundation-20261023/decision-corpus-audit-v26.json';corpus=load(corpus_path);runtime(corpus);assert corpus['passed']==4 and len(corpus['rows'])==8
for r in corpus['rows']:assert r['rootUnchanged'];package(r)
dump(corpus_path,corpus);files.add(corpus_path)
actual_path='reports/ai-foundation-20261023/post-main-attainment-actual-window-v4.json';actual=load(actual_path);runtime(actual);assert actual['terminal'] and actual['boundaryReached'] and len(actual['rows'])==10
for i,r in enumerate(actual['rows']):
 assert r['complete'] and r['value']==43.5 and r['distance']==10-i and r['rootUnchanged'];assert r['diagnostics']['transitions']==(10 if i==0 else 0)
 cold=r['cold'];assert cold['complete'] and cold['actionId']==r['actionId'] and cold['value']==r['value'] and cold['distance']==r['distance'];package(r)
files.add(actual_path)
p008='reports/ai-foundation-20261023/attained-case008-v2.json';r008=load(p008);runtime(r008);assert r008['complete'] and r008['diagnostics']['transitions']==577 and r008['value']==37.5 and r008['distance']==10 and r008['rootUnchanged'];package(r008);dump(p008,r008);files.add(p008)
p062='reports/ai-foundation-20261023/late-semantic-case062-v12.json';r062=load(p062);runtime(r062);assert not r062['complete'] and r062['diagnostics']['transitions']==4096 and r062['rootUnchanged'];package(r062);dump(p062,r062);files.add(p062)
# Older scalar-only and attained-v28 measurements are evidence of prototypes, never final source timing.
scalar_bundle_path='adhoc/ai-post-main-value-prototypes-20261023-v1.json';scalar_bundle=load(scalar_bundle_path);scalar_path='reports/ai-foundation-20261023/post-main-value-actual-window-v1.json';scalar=load(scalar_path)
runtime(scalar,{'randomizer/game/ai/analysis-port.js':scalar_bundle['analysisSource'].encode(),'randomizer/game/ai/decision-search.js':scalar_bundle['scalarSearchSource'].encode()})
for r in scalar['rows']:assert r['rootUnchanged'];package(r)
assert not scalar['rows'][0]['complete'] and scalar['rows'][1]['complete'] and scalar['rows'][1]['diagnostics']['transitions']==3254
assert sha((stage/scalar['checkpointPath']).read_bytes())==scalar['checkpointSha256'];files.update([scalar_bundle_path,scalar_path,scalar['checkpointPath']])
proto_path='adhoc/ai-post-main-attainment-prototype-20261023-v1.json.gz';proto=load(proto_path)
for p,h in proto['sourceHashes'].items():assert sha(proto['sources'][p].encode())==h
files.add(proto_path)
cap_path='reports/ai-foundation-20261023/attained-publicity-cap-repro-v1.json';cap=load(cap_path);assert cap['error']=='SEARCH_ATTAINED_BOUND_WITNESS_MISMATCH' and cap['publicityCap']==10
cap.update(sourceBundlePath=proto_path,scope='Reproduction against pre-guard v28 prototype. Final v29 declines the shortcut at the cap, verified by final unit.');dump(cap_path,cap);files.add(cap_path)
node_path='reports/ai-foundation-20261023/post-main-attainment-full-node-v2.log';node=(stage/node_path).read_text();assert 'SUMMARY unit passed=134 failed=0 total=134' in node and 'SUMMARY fullFlow passed=1 failed=0 total=1' in node
unit_path='reports/ai-foundation-20261023/post-main-attainment-unit-v7.log';unit=load(unit_path);assert unit['postMainAttainment']=='passed' and unit['realFactoryInputs']==10 and unit['reusedInteriorPrefixes']==9 and len(unit['rows'])==8
browser_path='reports/ai-foundation-20261023/post-main-attainment-browser-v2.log';assert 'SUMMARY browserSmoke passed=3 failed=0 total=3' in (stage/browser_path).read_text()
audit_path='reports/ai-foundation-20261023/state-value-input-audit-v27.log';audit=(stage/audit_path).read_text().splitlines();independent=[l for l in audit if l.startswith('[PASS] independent')];failures=[l for l in audit if l.startswith('[FAIL]')];assert len(independent)==28 and any('independent-post-main-attainment' in l for l in independent);assert len(failures)==1 and 'aomomo' in failures[0]
changed=['randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/post-main-borrow.test.js','randomizer/game/ai/post-main-value-bound.test.js','randomizer/game/ai/post-main-attainment.test.js','randomizer/index.html','tools/node-test-inventory.js','tools/audit_v_state_inputs.js','docs/ai-post-main-attained-bound-20261023.md','docs/ai-implementation-20261022.md','docs/ai-development-workflow.md','docs/ai-interface-inventory-20261022.md','docs/ai-search-agent-contract-20261023.md',
 'adhoc/benchmark-ai-post-main-value-20261023-v1.js','adhoc/benchmark-ai-post-main-attainment-20261023-v4.js','adhoc/audit-ai-decision-corpus-20261023-v26.js','adhoc/diagnose-ai-attained-case008-20261023-v2.js','adhoc/profile-ai-late-semantic-case062-20261023-v12.js','adhoc/finalize-ai-attainment-20261023-v1.py','adhoc/deliver-ai-attainment-20261023-v1.py']
files.update(changed+[node_path,unit_path,browser_path,audit_path,'reports/ai-foundation-20261023/decision-corpus-audit-v26.log','reports/ai-foundation-20261023/post-main-attainment-actual-window-v4.log','reports/ai-foundation-20261023/attained-case008-v2.log','reports/ai-foundation-20261023/late-semantic-case062-v12.log'])
# Bind the bottleneck extraction to packaged final raw data.
bottleneck_path='reports/ai-foundation-20261023/attained-before-main-bottleneck-v1.json';bottleneck=load(bottleneck_path)
for label,r in [('008',r008),('062',r062)]:bottleneck['reports'][label].update(rawPath=r['rawPath'],rawSha256=r['rawSha256'])
dump(bottleneck_path,bottleneck);files.add(bottleneck_path)
syntax=[]
for p in changed:
 if p.endswith('.js'):
  r=subprocess.run(['node','--check',str(stage/p)],capture_output=True,text=True);assert r.returncode==0,r.stderr;syntax.append({'path':p,'sha256':sha((stage/p).read_bytes()),'exitCode':0})
syntax_path='reports/ai-foundation-20261023/post-main-attainment-syntax-v1.json';dump(syntax_path,{'rows':syntax});files.add(syntax_path)
validation_path='reports/ai-foundation-20261023/post-main-attainment-validation-v1.json'
report={'schemaVersion':'seti-ai-post-main-attainment-validation-v1','date':'2026-10-23','baseCommit':m['baseCommit'],'snapshot':str(stage),'searchVersion':'seti-complete-decision-search-v29','analysisEntryVersion':'v30','scope':'Default-V post-main scalar upper bound, actually attained shortest witnesses and certified interior prefixes. Exact identities, boundaries, all payment exits and fixed global budgets preserved.',
 'controlled':unit,'publicityCapGuard':{'reproducedPrototypeFailure':cap_path,'finalGuardVerified':True,'allowedAfterPublicitySlotPassed':True},'node':{'unitPassed':134,'fullFlowPassed':1,'logPath':node_path},'browser':{'passed':3,'logPath':browser_path},'valueAudit':{'independentPassed':28,'legacyFailures':failures,'exitCode':1,'logPath':audit_path},'syntaxPath':syntax_path,
 'fixedGate':{'path':corpus_path,'passed':4,'failed':4,'budget':corpus['budget']},'actualPostMain':{'path':actual_path,'firstSearchMilliseconds':actual['rows'][0]['milliseconds'],'initialTransitions':10,'initialGraphNodes':2,'initialCertificateNodes':9,'value':43.5,'distance':10,'reusedClicks':9,'coldControls':10,'limitation':'Search timings exclude openRoot, diagnostic boundary checks and independent cold controls; not a full game or isolated process speed ratio.'},
 'original008':{'path':p008,'complete':True,'transitions':577,'milliseconds':r008['milliseconds'],'distance':10,'value':37.5},'original062':{'path':p062,'complete':False,'transitions':4096,'milliseconds':r062['milliseconds'],'unresolved':r062['unresolvedCount']},'prototypeScope':{'scalarReport':scalar_path,'scalarSourceBundle':scalar_bundle_path,'attainedSourceBundle':proto_path,'finalSourceTiming':False},
 'newSearchFullGames':0,'newSearchFinalScores':None,'fullGame180SecondAcceptance':'Not run; fixed necessary decision gates remain 4/8.','nextEvidencePath':bottleneck_path,'sourceHashes':{p:sha((stage/p).read_bytes()) for p in changed},'evidenceHashes':{p:sha((stage/p).read_bytes()) for p in sorted(files) if p not in changed}}
dump(validation_path,report);files.add(validation_path)
m.update(validationPath=validation_path,files={p:sha((stage/p).read_bytes()) for p in sorted(files)},notes='Final v29 runtime frozen through the final full Node regression and 3 Chrome smokes. Pre-guard v28 prototype data is separately source-bound; no legacy registry, center generation or unrelated working-tree changes included.');dump(mp,m)
print(json.dumps({'files':len(files),'unitPassed':134,'browserPassed':3,'fixedGate':'4/8','newSearchFullGames':0}))
