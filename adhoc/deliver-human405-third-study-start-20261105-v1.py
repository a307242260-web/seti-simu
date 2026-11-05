import pathlib,subprocess,os,tempfile,json,hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='04dd41deece9882e71ba0a777b66f268f5fee55b';folder='reports/ai-foundation-20261105/third-round-teacher-v1/'
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
def blob(b):return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');proof=read('reports/ai-foundation-20261104/two-rounds-teacher-v2/v189-first2-result-source-check-20261105-v1.json')
for p,h in proof['runtimeSourceHashes'].items():assert sha(root/p)==h and sha(stage/p)==h,p
initial=read(folder+'initial-native-audit-20261105-v1.json');assert initial['ai']['finalNativeStateSessionRngAndTerminalScoresExact'] and initial['ai']['first125ExactlyPreserved'] and initial['policyQueries']==0
teacher=read(folder+'teacher-third-current-replay-20261105-v2.json');assert teacher['status']=='complete' and not teacher['mismatch'];t=teacher['roundEnd'];assert t['assets']['player']['resources']['score']==105 and t['assets']['player']['income']['energy']==4 and sha(stage/t['checkpointPath'])==t['checkpointSha256']
for label in ['first-white','after-amiba-reveal','before-safety-protocol']:
 b=read(folder+'v189-cold-teacher-r3-'+label+'-20261105-v1.json');assert b['decisionGatePassed'] and b['rootAndRngUnchanged'];assert sha(stage/b['fixture'])==b['fixtureSha256'] and sha(stage/b['rawPath'])==b['rawSha256']
 for p,h in b['sourceHashes'].items():assert sha(stage/p)==h,p
assert read('reports/review/v189-first2-every-input-20261105-v1.browser-check.json')['all85WhiteInputsRendered']
record='reports/research/db594a2e.1609bf50.full.json';r=read(record);source=read('reports/research/e01243ba.93989585.quick-400.json');assert r['terminal'] and r['summary']['scores']['player-white']==120 and r['wallMsIncludingSourcePrefix']==9403 and r['steps']==201 and len(r['metrics']['searches'])==147
assert r['metrics']['searches'][:86]==source['metrics']['searches'];trace=(stage/r['agentTracePath']).read_text().strip().splitlines();assert len(trace)==178 and trace[:102]==(stage/source['agentTracePath']).read_text().strip().splitlines()
for p,h in initial['sourceHashes'].items():assert sha(stage/p)==h,p
versions=read('reports/iteration/versions.json');oldv=json.loads(git('show',base+':reports/iteration/versions.json'));own='ai-search-v189-white-full-20261105';assert [v for v in versions['versions']if v['id']!=own]==oldv['versions'];assert next(v for v in versions['versions']if v['id']==own)['baselineEligible']is False
reg=read('reports/iteration/registry.json');assert reg['currentBaseline']=='ai-search-v41-baseline-20261029';v=next(v for v in reg['versions']if v['id']==own);assert not v['isHead'] and v['results'][0]['reportExists'];report=v['results'][0]['reportPath']
files={record,r['savePath'],report,'reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html','docs/ai-design.md','docs/human405-third-round-plan-20261105.md','docs/human405-third-round-initial-review-20261105.md','adhoc/human405-third-round-progress-20261105-v1.json','adhoc/audit-human405-third-round-20261105-v1.js','adhoc/replay-human405-teacher-third-20261105-v1.js','adhoc/resume-human405-teacher-third-20261105-v2.js','adhoc/control-human405-third-known-prefix-20261105-v1.js','adhoc/benchmark-third-round-decision-20261105-v1.js','adhoc/capture-human405-third-controls-20261105-v1.js','adhoc/prepare-v189-full-root-overlays-20261105-v1.js','adhoc/deliver-human405-third-study-start-20261105-v1.py','adhoc/render-v189-first2-review-20261105-v1.js'}
files.update(str(p.relative_to(stage))for p in(stage/folder).iterdir()if p.is_file());files.update(str(p.relative_to(stage))for p in(stage/'reports/research').glob(pathlib.Path(record).name+'.*')if p.is_file());files.update(str(p.relative_to(stage))for p in(stage/'reports/review').glob('v189-first2-every-input-20261105-v1.*')if p.is_file())
old={}
for item in git('ls-tree','-rz',base).split(b'\0'):
 if item:
  meta,name=item.split(b'\t',1);old[name.decode()]=meta.decode().split()[2]
files={p for p in files if p not in old or blob((stage/p).read_bytes())!=old[p]}
overlays=json.loads(pathlib.Path('/private/tmp/seti-v189-full-root-overlays-20261105/overlays.json').read_text())
for p,o in overlays.items():assert sha(root/p)==o['beforeSha256'] and sha(o['path'])==o['sha256']
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
 if(root/p).exists() and p not in overlays and(root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and blob((root/p).read_bytes())==old[p],p
manifest='adhoc/human405-third-study-start-manifest-20261105-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p)for p in sorted(files)},'sharedIndexSha256':shared,'rootOverlays':overlays,'runtimeUnchanged':True,'goalStatus':'active','sameTeacherR3StateFirst':True,'reviewR2OnlyAfterR3':True,'newAutonomousRuns':0,'coldRoots':3,'teacherRound3Score':105,'fullRecordNativeVerified':True,'fullScore':120,'baselineUnchanged':'ai-search-v41-baseline-20261029'},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_THIRD_STUDY')!='1':print(json.dumps({'preflight':True,'files':len(files),'runtimeUnchanged':True,'goalStatus':'active','teacherRound3Score':105,'newAutonomousRuns':0}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-third-study-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 h=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',h,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env)
for p in sorted(files):
 dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(pathlib.Path(overlays[p]['path']).read_bytes()if p in overlays else(stage/p).read_bytes())
git('commit','-m','验证V189整局并建立教师第三轮同状态学习与阿米巴准备缺口证据',env=env)
commit=git('rev-parse','HEAD').decode().strip();assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files;assert sha(root/'.git/index')==shared;assert not git('diff','--name-only',base,commit,'--','randomizer','tools','assets').strip()
for p,o in overlays.items():assert sha(root/p)==o['sha256']
result={'commit':commit,'privateIndex':private,'stage':str(stage),'sharedIndexUnchanged':True,'foreignV1Preserved':True,'baselineUnchanged':True,'runtimeUnchanged':True,'goalStatus':'active','files':len(files),'fullRecord':record};pathlib.Path('/private/tmp/seti-human405-third-study-delivery-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
