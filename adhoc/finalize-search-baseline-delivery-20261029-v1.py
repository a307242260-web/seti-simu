import pathlib,json,hashlib,subprocess,os
root=pathlib.Path('/Users/bilibili/code/seti-simu');stage=pathlib.Path.cwd();sha=lambda data:hashlib.sha256(data).hexdigest();read=lambda p:json.loads((stage/p).read_text());safe=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
base=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,env=safe,text=True).strip();assert base=='95a140935b752152e1eebfbdacb7931bcdbd5763'
prefix='reports/ai-foundation-20261023/search-v38-baseline-20261029-v1';summary=read(prefix+'.summary.json');record=read(summary['recordPath']);failure=read(prefix+'.failure.json');registry=read('reports/iteration/registry.json');version=next(v for v in registry['versions'] if v['id']==summary['experiment'])
assert not summary['eligibleAsCompleteBaseline'] and not summary['accepted180Seconds'] and not record['terminal']
assert record['steps']==76 and record['failure']['failedDecisionCommitted'] is False
assert version['aiGeneration']=='v2' and version['baselineEligible'] is False and version['isHead'] is False and registry['generations']['v2']['currentBaseline']!=version['id']
assert all(s is None for s in version['results'][0]['scores'].values())
assert read(prefix+'.recovery-validation.json')['status']=='passed'
for p,h in summary['sourceHashes'].items():
 assert sha((stage/p).read_bytes())==h,p
 assert sha(subprocess.check_output(['git','show',base+':'+p],cwd=root,env=safe))==h,p
logs={}
for name,src in {'reportTests':'/private/tmp/seti-v38-report-tests-20261029-v1.log','eligibilityFinal':'/private/tmp/seti-v38-eligibility-final-20261029-v2.log','centerBuild':'/private/tmp/seti-v38-center-build-final-20261029-v3.log'}.items():
 data=pathlib.Path(src).read_bytes();dest=prefix+'.'+name+'.log';(stage/dest).write_bytes(data);logs[name]={'path':dest,'sha256':sha(data)}
assert 'SUMMARY unit passed=5 failed=0 total=5' in (stage/logs['reportTests']['path']).read_text()
assert 'SUMMARY unit passed=1 failed=0 total=1' in (stage/logs['eligibilityFinal']['path']).read_text()
source_files=['tools/robot-iteration-lib.js','tools/robot_iterate.js','tools/robot-ai-generation.test.js']
for p in source_files:subprocess.run(['node','--check',str(stage/p)],check=True)
validation={'schemaVersion':'seti-ai-baseline-delivery-validation-v1','status':'passed','experimentOutcome':'failed-before-terminal','runtimeCodeCommit':base,'runtimeBytesMatchCommittedVersion':True,'onlyOneFullAttempt':True,'failedInputNotCommitted':True,'saveAndReplayRecovery':'passed','baselineExcluded':True,'formalScoresEmpty':True,'generation':'v2','recordPath':summary['recordPath'],'savePath':record['savePath'],'reportPath':version['results'][0]['reportPath'],'reportTestsPassed':5,'eligibilityFinalTestsPassed':1,'sourceHashes':{p:sha((stage/p).read_bytes()) for p in source_files},'logs':logs}
vp=prefix+'.delivery-validation.json';(stage/vp).write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
s=(stage/'adhoc/deliver-search-buffer-20261029-v1.py').read_text()
for a,b in {'adhoc/search-buffer-snapshot-20261029.json':'adhoc/search-baseline-snapshot-20261029.json','search-buffer-snapshot-check-20261029-v1.json':'search-baseline-snapshot-check-20261029-v1.json','SETI_DELIVER_SEARCH_BUFFER':'SETI_DELIVER_SEARCH_BASELINE','seti-search-buffer-private-20261029.index':'seti-search-baseline-private-20261029.index','search-buffer-commit-message-20261029.txt':'search-baseline-commit-message-20261029.txt','保存搜索固定计划并复用完整状态计算扩大决策余量':'登记搜索AI首次单局失败证据并排除未完成基线'}.items():assert a in s,a;s=s.replace(a,b)
s=s.replace("base = manifest['baseCommit']", "base = manifest['baseCommit']\nworking_overlays = manifest.get('workingTreeOverlays', {})",1)
s=s.replace("            assert (root/p).read_bytes() in (original, actual), ('overlapping root edit', p)", "            if p in working_overlays:\n                overlay = working_overlays[p]\n                assert sha((root/p).read_bytes()) == overlay['beforeSha256'], ('root overlay changed',p)\n                assert sha(pathlib.Path(overlay['path']).read_bytes()) == overlay['sha256']\n            else:\n                assert (root/p).read_bytes() in (original, actual), ('overlapping root edit', p)",1)
s=s.replace("    destination.write_bytes(data)", "    if p in working_overlays:\n        overlay = working_overlays[p]\n        assert sha(destination.read_bytes()) == overlay['beforeSha256']\n        working_data = pathlib.Path(overlay['path']).read_bytes()\n        assert sha(working_data) == overlay['sha256']\n        destination.write_bytes(working_data)\n    else:\n        destination.write_bytes(data)",1)
s=s.replace("print(json.dumps({'phase':'delivered',", "for p, overlay in working_overlays.items():\n    assert sha((root/p).read_bytes()) == overlay['sha256']\nprint(json.dumps({'phase':'delivered','preservedWorkingTreeOverlays':list(working_overlays),",1)
(stage/'adhoc/deliver-search-baseline-20261029-v1.py').write_text(s)
manifest_path='adhoc/search-baseline-snapshot-20261029.json';m={'baseCommit':base,'snapshot':str(stage),'sharedIndexSha256Before':sha((root/'.git/index').read_bytes()),'sharedIndexEntriesSha256Before':sha(subprocess.check_output(['git','ls-files','--stage','-z'],cwd=root,env=safe)),'scope':'Register one incomplete fixed-world v38 full-game attempt, preserve exact failure/RNG/replay evidence, add the new cold checkpoint and explicitly exclude the attempt from current baseline; AI runtime unchanged.'}
m['workingTreeOverlays']=json.loads(pathlib.Path('/private/tmp/seti-v38-center-working-overlay-20261029/manifest.json').read_text())
base_files=set(subprocess.check_output(['git','ls-tree','-r','--name-only',base],cwd=root,env=safe,text=True).splitlines());files=[]
for p in stage.rglob('*'):
 if not p.is_file():continue
 rel=str(p.relative_to(stage))
 if rel==manifest_path or '.bak-' in rel or '-commit-message-' in rel:continue
 if rel not in base_files:files.append(rel)
env=dict(safe,GIT_DIR=str(root/'.git'),GIT_WORK_TREE=str(stage),GIT_INDEX_FILE='/private/tmp/seti-search-buffer-review-20261029.index');files.extend(subprocess.check_output(['git','diff','--name-only'],cwd=stage,env=env,text=True).splitlines());files=sorted(set(files));m['files']={p:sha((stage/p).read_bytes()) for p in files};m['sourceBoundReports']=[prefix+'.summary.json',vp];(stage/manifest_path).write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'files':len(files),'bytes':sum((stage/p).stat().st_size for p in files),'validation':validation},ensure_ascii=False))
