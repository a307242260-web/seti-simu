import pathlib,subprocess,hashlib,json,os,tempfile,ast
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='09989ac099a824c3d4b54099072658e670b943b1';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
assert shared=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49'
control=read(folder+'public-income-option-native-20261105-v1.json');assert control['status']=='complete' and control['nativeInputs']==105 and control['originalRootAndRngRestored']
complete=read(folder+'public-income-round1-controlled-completion-20261105-v1.json');assert complete['status']=='complete' and complete['nativeInputs']==22 and complete['allComparedTeacherAssetsMatch'] and complete['originalRootAndRngRestored'];assert complete['score']==15 and complete['income']['credits']==6 and complete['income']['energy']==2
profile=read(folder+'public-income-candidate-all-inputs-20261105-v1.json');assert [r['nativeInputs']for r in profile['rows']]==[186,264]
gate=read(folder+'v174-current-teacher-serial-gate-20261105-v1.json');assert gate['status']=='complete' and len(gate['rows'])==95 and len(gate['overruns'])==2 and gate['maxInputs']==264 and gate['maxMilliseconds']<=600
for row in gate['rows']:
 e=read(row['evidence']);assert e['complete'] and e['rootAndRngUnchanged'] and sha(stage/e['rawPath'])==e['rawSha256']
candidate='reports/ai-foundation-20261104/candidate-v174-public-income-option-20261105-v1/';m=read(candidate+'manifest.json');assert m['baseCommit']==base and m['sourceHashesCoverAll95ColdRoots'] and not m['admitted'] and m['officialRuns']==0
for p,h in m['overlayFiles'].items():assert sha(stage/candidate/p)==h
for p,h in m['allLoadedRuntimeHashes'].items():assert sha(stage/p)==h;assert hashlib.sha256((stage/candidate/p).read_bytes() if p in m['overlayFiles'] else git('show',base+':'+p)).hexdigest()==h
materialized=(stage/(folder+'public-income-candidate-materialized-native-20261105-v1.log')).read_text();r=json.loads(materialized.strip().splitlines()[-1]);assert r['publicIncomeOption']=='passed' and r['nativeInputs']==121 and r['preparedInputs']==13 and r['rootAndRngRestored'];assert all(x['actionId']=='orbit:44937d1f' and abs(x['value']-(64.5+62/182))<1e-12 for x in r['searchControls'])
for version in range(167,178):
 a=f'reports/ai-foundation-20261104/rejected-v{version}-runtime-20261105-v1/';manifest=read(a+'manifest.json');assert manifest['baseCommit']==base and not manifest['admitted'] and manifest['officialRuns']==0
 for p,h in manifest['overlayFiles'].items():assert sha(stage/a/p)==h
 for p,h in manifest['allLoadedRuntimeHashes'].items():assert hashlib.sha256((stage/a/p).read_bytes() if (stage/a/p).exists() else git('show',base+':'+p)).hexdigest()==h,(version,p)
production=['randomizer/game/ai/'+n+'.js' for n in ['state-value','probe-capital','research-income-capital','resource-demand','card-pick-planning','local-decision-plans','analysis-port','decision-search']]+['randomizer/index.html','tools/node-test-inventory.js','tools/browser-smoke-inventory.js']
for p in production:assert (root/p).read_bytes()==git('show',base+':'+p),p
record='reports/research/8b8b00a9.92dc8669.quick-400.json';assert (root/record).read_bytes()==git('show',base+':'+record);old=read(record);assert old['wallMs']==3113 and old['steps']==93
versions=read('reports/iteration/versions.json');before=json.loads(git('show',base+':reports/iteration/versions.json'));assert len(versions['versions'])==len(before['versions']);own='ai-search-v166-white-first2-20261105'
for v,w in zip(versions['versions'],before['versions']):assert {**v,'summary':w['summary']}==w if v['id']==own else v==w
reg=read('reports/iteration/registry.json');assert reg['currentBaseline']=='ai-search-v41-baseline-20261029' and next(v for v in reg['versions'] if v['id']==own)['isHead'] is False
assert all('v174' not in v['id'] for v in versions['versions']);assert '264' in next(v for v in versions['versions'] if v['id']==own)['summary']
overlays=json.loads(pathlib.Path('/private/tmp/seti-public-income-center-overlays-20261105-v1/overlays.json').read_text())
for p,o in overlays.items():assert sha(root/p)==o['beforeSha256'] and sha(o['path'])==o['sha256']
work=json.loads(pathlib.Path(overlays['reports/iteration/versions.json']['path']).read_text());assert any(v['id']=='perf-baseline-lowload-20260913' for v in work['versions'])
files={'docs/ai-design.md','docs/ai-public-income-option-20261105.md','reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html','adhoc/prototype-public-income-option-20261105-v1.js','adhoc/witness-public-income-option-20261105-v1.js','adhoc/reproduce-v168-unknown-slot-parity-20261105-v1.js','adhoc/witness-public-income-round1-completion-20261105-v1.js','adhoc/profile-public-income-candidate-20261105-v1.js','adhoc/materialize-public-income-candidate-20261105-v1.py','adhoc/prepare-public-income-center-overlays-20261105-v1.js','adhoc/deliver-public-income-evidence-20261105-v1.py','adhoc/benchmark-human405-decision-20261105-v4.js','adhoc/benchmark-human405-current-first2-20261105-v4.js','adhoc/human405-two-rounds-progress-20261105-v9.json'}
for pattern in ['public-income-*']+[f'v{v}-*' for v in range(167,178)]:files.update(str(p.relative_to(stage)) for p in (stage/folder).glob(pattern) if p.is_file())
for prefix in [candidate]+[f'reports/ai-foundation-20261104/rejected-v{v}-runtime-20261105-v1/' for v in range(167,178)]:files.update(str(p.relative_to(stage)) for p in (stage/prefix).rglob('*') if p.is_file())
old_modes={};old_blobs={}
for entry in git('ls-tree','-rz',base).split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t',1);mode,kind,blob=meta.decode().split();old_modes[name.decode()]=mode;old_blobs[name.decode()]=blob
for p in files:
 assert not p.startswith(('randomizer/','tools/','assets/')) and not (root/p).is_symlink(),p
 if (root/p).exists() and p not in overlays and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old_blobs and (root/p).read_bytes()==git('show',base+':'+p),p
 if p.endswith('.js'):subprocess.run(['node','--check',str(stage/p)],check=True,stdout=subprocess.DEVNULL)
 if p.endswith('.py'):ast.parse((stage/p).read_text())
archived_whitespace=sorted(p for p in files if p.endswith('/randomizer/game/ai/decision-search.js') and p.startswith('reports/ai-foundation-20261104/'));assert len(archived_whitespace)==12
proof=folder+'public-income-delivery-source-check-20261105-v1.json';(stage/proof).write_text(json.dumps({'baseCommit':base,'productionRuntime':'v166 / V15','productionCoreFilesUnchanged':production,'noNewAutonomousRuns':True,'candidateRuntime':'v174 / V16','candidateColdRoots':95,'candidateMaxNativeInputs':264,'candidateMaxMilliseconds':gate['maxMilliseconds'],'candidateAdmitted':False,'controlledRound1NativeInputs':22,'controlledRound1Score':15,'controlledRound1Technology':['blue2@1','purple4'],'controlledRound1IncomeCreditsEnergyCards':[6,2,1],'allComparedTeacherAssetsMatch':True,'candidateMaterializedFromBaseAndOverlay':True,'materializedNativeControls':121,'materializedFullSearchControls':r['searchControls'],'archiveVersions':list(range(167,178)),'sourceModules':len(m['allLoadedRuntimeHashes']),'goalStatus':'active','goalAchieved':False,'baselineUnchanged':'ai-search-v41-baseline-20261029','foreignV1Preserved':True,'sharedIndexSha256':shared,'archivedSourceWhitespaceExemptions':archived_whitespace,'archiveWhitespaceReason':'Preserve exact source bytes and their validated cold-runtime SHA256; ordinary new content still passes diff whitespace checks.'},indent=2)+'\n');files.add(proof)
manifest='adhoc/public-income-option-delivery-manifest-20261105-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p) for p in sorted(files)},'workingTreeOverlays':overlays,'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_PUBLIC_INCOME_EVIDENCE')!='1':print(json.dumps({'preflight':True,'files':len(files),'productionCodeUntouched':True,'candidateAdmitted':False,'noNewAutonomousRuns':True}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-public-income-evidence-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 blob=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo',old_modes.get(p,'100644'),blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check','--','.',*[':(exclude)'+p for p in archived_whitespace],env=env)
for p in sorted(files):dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(pathlib.Path(overlays[p]['path']).read_bytes() if p in overlays else (stage/p).read_bytes())
git('commit','-m','验证公共补牌筹资选择并归档首轮资产对齐候选，保留264次未准入证据',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files
pathlib.Path('/private/tmp/seti-public-income-evidence-commit-review-20261105-v1.log').write_bytes(git('show','--name-only','--stat','--format=short','HEAD'))
assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,o in overlays.items():assert sha(root/p)==o['sha256']
for p in production:assert (root/p).read_bytes()==git('show',base+':'+p)
result={'commit':commit,'baseCommit':base,'stage':str(stage),'privateIndex':private,'files':len(files),'productionRuntime':'v166 / V15','candidateRuntime':'v174 / V16','candidateAdmitted':False,'sharedIndexUnchanged':True,'foreignV1Preserved':True,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-public-income-evidence-delivery-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
