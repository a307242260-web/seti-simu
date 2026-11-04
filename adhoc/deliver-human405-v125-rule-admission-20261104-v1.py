import pathlib,subprocess,os,tempfile,json,hashlib,gzip
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='1cdfdb0021512c02a967af1cfa503634986cfa75';f1='reports/ai-foundation-20261104/two-rounds-teacher-v1/';f2='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base;ih=sha(root/'.git/index');eh=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();assert ih=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49';foreign={p:sha(root/p) for p in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']}
files={'randomizer/game/cards/play-domain.js','randomizer/game/effects/science-session.js','randomizer/game/ai/decision-search.js','randomizer/index.html','randomizer/game/cards/conditional-sector-flow.test.js','tools/node-test-inventory.js','tools/browser-smoke-inventory.js','tools/robot-report-compact.test.js','docs/mechanics-reference.md','docs/ai-design.md','docs/human405-conditional-scan-v125-20261104.md','adhoc/diagnose-dlc37-all-matching-20261104-v1.js','adhoc/replay-teacher-conditional-scan-20261104-v1.js','adhoc/benchmark-human405-current-first2-20261104-v1.js','adhoc/human405-two-rounds-progress-20261104-v3.json','adhoc/deliver-human405-v125-rule-admission-20261104-v1.py'}
for p in (stage/f2).rglob('*'):
 if p.is_file():files.add(str(p.relative_to(stage)))
for p in (stage/f1).iterdir():
 if p.is_file() and p.name.startswith(('v125-','conditional-sector-flow-','conditional-scan-','dlc37-all-matching-')):files.add(str(p.relative_to(stage)))
for p in (stage/'reports/ai-foundation-20261023').glob('human405-v125-cold-*-20261104-v1*'):files.add(str(p.relative_to(stage)))
gate=read(f2+'v125-current-teacher-serial-gate-20261104-v1.json');assert gate['status']=='complete' and len(gate['rows'])==81 and not gate['overruns'];assert gate['maxInputs']<=256 and gate['maxMilliseconds']<=600;sources={}
for row in gate['rows']:
 r=read(row['evidence']);assert r['complete'] and r['rootAndRngUnchanged'];assert sha(stage/r['fixture'])==r['fixtureSha256'];assert sha(stage/r['rawPath'])==r['rawSha256'];raw=json.loads(gzip.decompress((stage/r['rawPath']).read_bytes()));assert raw['complete'] and not raw['unresolved'];assert r['rawPath'] in files
 for p,h in r['sourceHashes'].items():
  if p in sources:assert sources[p]==h;continue
  assert sha(stage/p)==h,p;sources[p]=h
loaded=read(f1+'v125-first2-cold-gate-20261104-v1.json');assert len(loaded['overruns'])==1 and loaded['overruns'][0]['label']=='case-105';assert loaded['overruns'][0]['milliseconds']>600
teacher=read(f2+'conditional-scan-teacher-replay-20261104-v1.json');assert teacher['historicalInputActionsPreserved'] and teacher['nativeInputsReplayed']==83 and teacher['allHistoricalSummaryDifferencesExactlyTwoWhiteScore'];assert [r['score'] for r in teacher['rounds']]==[15,34]
for row in teacher['rounds']:assert sha(stage/row['checkpoint'])==row['checkpointSha256']
for row in teacher['changedRoots']:assert sha(stage/row['fixture'])==row['fixtureSha256']
for p,h in teacher['sourceHashes'].items():assert sha(stage/p)==h,p
before=read(f1+'dlc37-all-matching-before-20261104-v1.json');assert len(before['eligible'])==2 and before['actualScans']==1
for p,h in before['sourceHashes'].items():assert hashlib.sha256(git('show',base+':'+p)).hexdigest()==h
full=(stage/(f1+'v125-node-full-20261104-v1.log')).read_text();assert 'SUMMARY unit passed=158 failed=1 total=159' in full and 'SUMMARY fullFlow passed=1 failed=0 total=1' in full;assert [l for l in full.splitlines() if l.startswith('FAIL ')]==['FAIL tools/robot-report-compact.test.js status=1 signal=none'];assert 'SUMMARY unit passed=2 failed=0 total=2' in (stage/(f1+'v125-report-and-flow-regression-20261104-v1.log')).read_text();assert 'SUMMARY browserSmoke passed=11 failed=0 total=11' in (stage/(f1+'v125-chrome-eleven-20261104-v1.log')).read_text()
old=set(git('ls-tree','-r','--name-only',base).decode().splitlines());unchanged=0
for p in old:
 if p.startswith(('randomizer/','tools/','assets/')) and p not in files:assert (stage/p).read_bytes()==git('show',base+':'+p),p;unchanged+=1
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
proof=f2+'v125-rule-admission-source-check-20261104-v1.json';(stage/proof).write_text(json.dumps({'parentCommit':base,'runtimeSourceHashes':sources,'unchangedCodeDataFiles':unchanged,'ruleCorrection':'DLC37 allMatching, DLC22 repeat','teacherNativeBoardScores':[15,34],'historicalTeacherPreserved':True,'fullNodeInitial':{'unitPassed':158,'reportFixtureFailed':1,'fullFlowPassed':1},'fixedReportAndFlowFocusedPassed':2,'chromePassed':11,'serialColdRoots':81,'maxNativeInputs':gate['maxInputs'],'maxMilliseconds':gate['maxMilliseconds'],'parallelOverrunPreserved':loaded['overruns'],'goalStatus':'active','goalAchieved':False,'newAutonomousRunPending':True,'baselineUnchanged':'ai-search-v41-baseline-20261029'},indent=2)+'\n');files.add(proof)
manifest='adhoc/human405-v125-rule-admission-manifest-20261104-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p) for p in sorted(files)},'sharedIndexSha256':ih,'sharedIndexEntriesSha256':eh,'foreignRegistryHashes':foreign,'goalStatus':'active'},indent=2)+'\n');files.add(manifest)
for p in files:
 if (root/p).exists() and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and (root/p).read_bytes()==git('show',base+':'+p),p
if os.environ.get('SETI_DELIVER_V125_RULE')!='1':print(json.dumps({'preflight':True,'files':len(files),'runtimeSourceFiles':len(sources),'goalStatus':'active'}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v125-rule-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 b=(stage/p).read_bytes();d=root/p;d.parent.mkdir(parents=True,exist_ok=True);d.write_bytes(b);blob=git('hash-object','-w','--stdin',data=b,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env);git('commit','-m','修复条件扫描漏目标与重复次数，重放教师前两轮并验证v125',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files;print(git('show','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==ih and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==eh
for p,h in foreign.items():assert sha(root/p)==h
print(json.dumps({'commit':commit,'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'foreignRegistryUnchanged':True,'goalStatus':'active'}))
