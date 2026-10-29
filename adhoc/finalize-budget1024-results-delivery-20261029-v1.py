import pathlib,json,hashlib,subprocess,os
root=pathlib.Path('/Users/bilibili/code/seti-simu');stage=pathlib.Path.cwd();read=lambda p:json.loads((stage/p).read_text());sha=lambda b:hashlib.sha256(b).hexdigest();safe=dict(os.environ,GIT_OPTIONAL_LOCKS='0');base=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,env=safe,text=True).strip();assert base=='f0615b17e618ad3e6fec9de9b815ba7323d94be9'
prefix='reports/ai-foundation-20261023/search-budget1024-baseline-20261029-v1';summary=read(prefix+'.summary.json');record=read(summary['recordPath']);failure=read(prefix+'.failure.json');registry=read('reports/iteration/registry.json');version=next(v for v in registry['versions'] if v['id']==summary['experiment'])
assert not summary['eligibleAsCompleteBaseline'] and not summary['accepted180Seconds'] and not summary['allSearchDecisionsWithin2s'] and not record['terminal']
assert record['steps']==152 and record['failure']['failedDecisionCommitted'] is False
assert version['aiGeneration']=='v2' and version['baselineEligible'] is False and version['isHead'] is False and registry['generations']['v2']['currentBaseline']!=version['id']
assert all(s is None for s in version['results'][0]['scores'].values())
assert read(prefix+'.recovery-validation.json')['status']=='passed' and read(prefix+'.aggregation-validation.json')['status']=='passed'
assert (stage/(prefix+'.run.log')).read_text().count('[world]')==1
assert summary['budget']=={'transitions':1024,'nodes':1025,'frontier':1024,'milliseconds':2000}
for p,h in summary['sourceHashes'].items():
 assert sha((stage/p).read_bytes())==h,p
 assert sha(subprocess.check_output(['git','show',base+':'+p],cwd=root,env=safe))==h,p
logs={}
for name,src in {'reportTests':'/private/tmp/seti-budget1024-report-tests-20261029-v1.log','centerBuild':'/private/tmp/seti-budget1024-center-build-20261029-v2.log','registration':'/private/tmp/seti-budget1024-register-20261029-v1.log'}.items():
 dest=prefix+'.'+name+'.log';(stage/dest).write_bytes(pathlib.Path(src).read_bytes());logs[name]={'path':dest,'sha256':sha((stage/dest).read_bytes())}
assert 'SUMMARY unit passed=3 failed=0 total=3' in (stage/logs['reportTests']['path']).read_text()
source_files=['adhoc/finalize-budget1024-baseline-20261029-v1.js','adhoc/preserve-budget1024-center-worktree-20261029-v1.js']
for p in source_files:subprocess.run(['node','--check',str(stage/p)],check=True)
validation={'schemaVersion':'seti-ai-baseline-delivery-validation-v1','status':'passed','experimentOutcome':'failed-before-terminal','runtimeCodeCommit':base,'runtimeBytesMatchCommittedVersion':True,'onlyOneFullAttempt':True,'budget':summary['budget'],'failedInputNotCommitted':True,'saveAndReplayRecovery':'passed','baselineExcluded':True,'formalScoresEmpty':True,'generation':'v2','recordPath':summary['recordPath'],'savePath':record['savePath'],'reportPath':version['results'][0]['reportPath'],'reportTestsPassed':3,'sourceHashes':{p:sha((stage/p).read_bytes()) for p in source_files},'logs':logs}
vp=prefix+'.delivery-validation.json';(stage/vp).write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
s=(stage/'adhoc/deliver-search-baseline-20261029-v1.py').read_text();mp='adhoc/budget1024-results-snapshot-20261029.json'
for a,b in {'/private/tmp/seti-search-buffer-20261029-xjyrfvsf':str(stage),'adhoc/search-baseline-snapshot-20261029.json':mp,'search-baseline-snapshot-check-20261029-v1.json':'budget1024-results-snapshot-check-20261029-v1.json','SETI_DELIVER_SEARCH_BASELINE':'SETI_DELIVER_BUDGET1024_RESULTS','seti-search-baseline-private-20261029.index':'seti-budget1024-results-private-20261029.index','search-baseline-commit-message-20261029.txt':'budget1024-results-commit-message-20261029.txt','登记搜索AI首次单局失败证据并排除未完成基线':'登记1024次模拟和2秒试跑结果及第二轮超时现场'}.items():assert a in s,a;s=s.replace(a,b)
(stage/'adhoc/deliver-budget1024-results-20261029-v1.py').write_text(s)
m={'baseCommit':base,'snapshot':str(stage),'sharedIndexSha256Before':sha((root/'.git/index').read_bytes()),'sharedIndexEntriesSha256Before':sha(subprocess.check_output(['git','ls-files','--stage','-z'],cwd=root,env=safe)),'scope':'Register the one 1024/2s full attempt and exact R2T9 timeout evidence, preserve existing records and add the next single-decision fixture. AI runtime unchanged.','workingTreeOverlays':json.loads(pathlib.Path('/private/tmp/seti-budget1024-center-working-overlay-20261029/manifest.json').read_text())}
base_files=set(subprocess.check_output(['git','ls-tree','-r','--name-only',base],cwd=root,env=safe,text=True).splitlines());files=[]
for p in stage.rglob('*'):
 if not p.is_file():continue
 rel=str(p.relative_to(stage))
 if rel==mp or '.bak-' in rel or '-commit-message-' in rel:continue
 if rel not in base_files:files.append(rel)
env=dict(safe,GIT_DIR=str(root/'.git'),GIT_WORK_TREE=str(stage),GIT_INDEX_FILE='/private/tmp/seti-budget1024-review-20261029.index');files.extend(subprocess.check_output(['git','diff','--name-only'],cwd=stage,env=env,text=True).splitlines());files=sorted(set(files));m['files']={p:sha((stage/p).read_bytes()) for p in files};m['sourceBoundReports']=[prefix+'.summary.json',vp];(stage/mp).write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'files':len(files),'bytes':sum((stage/p).stat().st_size for p in files),'steps':152,'previousRunMatchingPrefix':76,'stop':'watchdog','terminal':False}))
