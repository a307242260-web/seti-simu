from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='5b5d3504c9b88a204e8787d92f4c50bcf9a47eb7';folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args,data=None,index=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if index:env['GIT_INDEX_FILE']=index
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base;assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev';shared=sha(repo/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();proof=json.loads((stage/folder/'v218-current-source-admission-20261106-v1.json').read_text())
for n,h in {**proof['runtimeSourceHashes'],**proof['ownedSourceHashes']}.items():assert sha(stage/n)==sha(repo/n)==h,n
central=['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html'];preserved={n:sha(repo/n)for n in central}
resultNames=['v218-paired-scan-setup-native-20261106-v1.json','v218-paired-visible-scan-native-20261106-v1.json','v218-paired-scan-income-analysis-native-20261106-v1.json','v218-scan-launch-reserve-gap-native-20261106-v2.json','v218-round3-scoring-gap-20261106-v1.json'];results={n:json.loads((stage/folder/n).read_text())for n in resultNames};assert sum(r['newNativeInputs']for r in results.values())==84;assert all(r['newAutonomousRuns']==0 for r in results.values());assert all(r.get('rootAndRngRestored',True)for r in results.values())
for n,r in results.items():
 if 'checkpoint'in r:assert sha(stage/r['checkpoint'])==r['checkpointSha256'],n
 if 'sourcePath'in r:assert sha(stage/r['sourcePath'])==r['sourceSha256'],n
 if 'manifest'in r:assert sha(stage/r['manifest'])==r['manifestSha256'],n
for b in results[resultNames[2]]['branches'].values():assert b['complete']and b['resources']['score']==69 and[b['income'][k]for k in ['credits','energy','handSize']]==[6,3,1]
summary=folder/'v218-paired-learning-summary-20261106-v1.json';(stage/summary).write_text(json.dumps({'status':'learning-evidence-verified','sourceCommit':base,'runtime':'V218/V37','sourceUnchanged':True,'newNativeInputs':84,'newAutonomousRuns':0,'partialRoundControlledScoreOnly':69,'controlIncomeCreditsEnergyCards':[6,3,1],'lastAutonomousRecord':'reports/research/768b7f09.341f6fad.quick-400.json','lastAutonomousR3':{'score':82,'tech':5,'incomeCreditsEnergyCards':[6,3,1]},'developmentAligned':False,'resultsSha256':{str(folder/n):sha(stage/folder/n)for n in resultNames},'knownPublicSwapWitness':{'DLC31Before':111.75,'after':123.58333333333333,'differenceComponent':'analysisPotential','anonymousIdentityNotUsed':True},'scanReserveWitness':{'standardCostEnergy':2,'launchExtraEnergy':1,'catalogScanGoals':6,'catalogBlueGoals':0,'noReserveNativeLaunchUnavailable':True,'fundedNativeLaunchAvailable':True},'provisionalR3ScoreGap':results[resultNames[4]]['difference'],'goalStatus':'active'},indent=2)+'\n')
progress='adhoc/human405-third-round-progress-20261106-v9.json';(stage/progress).write_text(json.dumps({'status':'active','runtime':'V218/V37','sourceCommit':base,'sourceAdmitted':True,'sourceAdmission':str(folder/'v218-current-source-admission-20261106-v1.json'),'existingPerformanceCoverage':{'namedCases':476,'uniqueRoots':387,'maxNativeInputs':256,'maxMilliseconds':584.39825},'additionalNativeControls':84,'additionalSearchTimings':0,'newAutonomousRuns':0,'lastAutonomousRecord':'reports/research/768b7f09.341f6fad.quick-400.json','lastR3Assets':proof['lastR3Assets'],'teacherR3Assets':proof['teacherR3Assets'],'developmentAligned':False,'learningSummary':str(summary),'nextContract':'adhoc/v219-third-round-scan-income-contract-20261106-v1.md','baseline':'V41 unchanged','stage':str(stage)},indent=2)+'\n')
files={str(summary),progress,'docs/human405-third-round-paired-scan-20261106.md','adhoc/v219-third-round-scan-income-contract-20261106-v1.md','adhoc/deliver-v218-paired-learning-20261106-v1.py'}
reportPrefixes=('v218-paired-','v218-scan-launch-reserve-gap-','v218-scan-reserve-menu-','v218-round3-scoring-gap-');scriptPrefixes=('control-v218-paired-','control-v218-scan-launch-reserve-gap-','correct-v218-scan-reserve-menu-','review-v218-round3-scoring-gap-');files|={str(p.relative_to(stage))for p in(stage/folder).iterdir()if p.is_file()and p.name.startswith(reportPrefixes)};files|={str(p.relative_to(stage))for p in(stage/'adhoc').iterdir()if p.is_file()and p.name.startswith(scriptPrefixes)}
old={}
for row in git('ls-tree','-rz',base).split(b'\0'):
 if row:meta,n=row.split(b'\t',1);mode,kind,digest=meta.decode().split();old[n.decode()]=(mode,digest)
blob=lambda b:hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
for n in sorted(files):
 p=stage/n;target=repo/n;assert not n.startswith(('randomizer/','tools/','assets/'))
 if target.exists():assert target.read_bytes()==p.read_bytes()or blob(target.read_bytes())==old.get(n,('',None))[1],'overlap:'+n
 if p.suffix=='.json':json.loads(p.read_text())
 if p.suffix=='.js':subprocess.run(['node','--check',n],cwd=stage,check=True,capture_output=True)
 if p.suffix=='.py':compile(p.read_text(),n,'exec')
if os.environ.get('SETI_DELIVER_V218_PAIRED')!='1':print(json.dumps({'preflight':'passed','files':len(files),'sourceUnchanged':True,'newNativeInputs':84,'newAutonomousRuns':0}));raise SystemExit(0)
index=str(Path(tempfile.mkdtemp(prefix='seti-v218-paired-index-'))/'index');git('read-tree',base,index=index);names=sorted(files);digests=git('hash-object','-w','--stdin-paths',data=''.join(str(stage/n)+'\n'for n in names).encode(),index=index).decode().splitlines();assert len(digests)==len(names)
for n,d in zip(names,digests):assert d==blob((stage/n).read_bytes()),n
git('update-index','--index-info',data=''.join(old.get(n,('100644',None))[0]+' '+d+'\t'+n+'\n'for n,d in zip(names,digests)).encode(),index=index);assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==files;tree=git('write-tree',index=index).decode().strip()
for n in files:assert git('show',tree+':'+n)==(stage/n).read_bytes(),n
for n in sorted(files):p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
git('commit','-m','记录第三轮扫描发射预算与公开收入准备的原生对照',index=index);commit=git('rev-parse','HEAD').decode().strip();Path('/private/tmp/seti-v218-paired-commit-show-20261106-v1.log').write_bytes(git('show','--name-only','--stat','HEAD'));assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files;assert sha(repo/'.git/index')==shared;assert hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for n,h in preserved.items():assert sha(repo/n)==h,n
for n,h in {**proof['runtimeSourceHashes'],**proof['ownedSourceHashes']}.items():assert sha(repo/n)==h,n
receipt={'commit':commit,'privateIndex':index,'files':len(files),'runtime':'V218/V37','sourceCommit':base,'sourceUnchanged':True,'newNativeInputs':84,'newAutonomousRuns':0,'sharedIndexByteAndEntriesExact':True,'experimentCenterPreserved':True,'developmentAligned':False,'goalStatus':'active'};Path('/private/tmp/seti-v218-paired-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
