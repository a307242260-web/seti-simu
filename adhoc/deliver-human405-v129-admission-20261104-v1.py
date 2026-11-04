import pathlib,subprocess,os,tempfile,json,hashlib,gzip
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='013730ec57ca11357e007662e9ca850126d76b2e';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
manifest='adhoc/human405-v129-admission-manifest-20261104-v1.json';prior_manifest=read_root_manifest=json.loads((root/manifest).read_text()) if (root/manifest).exists() else None;prior_manifest_hash=sha(root/manifest) if prior_manifest else None
if prior_manifest:assert prior_manifest['baseCommit']==base
assert git('rev-parse','HEAD').decode().strip()==base;ih=sha(root/'.git/index');eh=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();assert ih=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49';foreign={p:sha(root/p) for p in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']}
files=set('''randomizer/game/ai/analysis-port.js
randomizer/game/ai/decision-search.js
randomizer/game/ai/local-decision-plans.js
randomizer/game/ai/probe-capital.js
randomizer/game/ai/state-value.js
randomizer/index.html
randomizer/game/ai/inert-reservation.test.js
randomizer/game/ai/post-main-movement.test.js
randomizer/game/ai/probe-capital-value.test.js
randomizer/game/ai/probe-travel-tail.test.js
tools/node-test-inventory.js
tools/browser-smoke-inventory.js
tools/audit_v_state_inputs.js
docs/ai-design.md
docs/ai-funded-travel-v129-20261104.md
adhoc/witness-funded-travel-v129-20261104-v1.js
adhoc/witness-v125-dlc37-blue4-assets-20261104-v1.js
adhoc/human405-two-rounds-progress-20261104-v5.json
adhoc/deliver-human405-v129-admission-20261104-v1.py'''.splitlines())
archives={126:'rejected-v126-runtime-source-20261104-v1',127:'v127-before-movement-guard-runtime-20261104-v1',128:'v128-before-mode-cache-guard-runtime-20261104-v1'}
base_sources={};sources={};gates={}
for version in [126,127,128,129]:
 gatepath=folder+f'v{version}-current-teacher-serial-gate-20261104-v1.json';log=gatepath.replace('.json','.log');gate=read(gatepath);assert gate['status']=='complete' and len(gate['rows'])==81;files.update([gatepath,log]);gates[version]=gate
 assert all(v is None for v in gate['productionBudgets'].values())
 if version==126:assert len(gate['overruns'])==1 and gate['maxMilliseconds']>600
 else:assert not gate['overruns'] and gate['maxInputs']<=256 and gate['maxMilliseconds']<=600
 if version<129:
  archive=stage/'reports/ai-foundation-20261104'/archives[version]
  for p in archive.rglob('*'):
   if p.is_file():files.add(str(p.relative_to(stage)))
 for row in gate['rows']:
  r=read(row['evidence']);assert r['complete'] and r['rootAndRngUnchanged'];assert sha(stage/r['fixture'])==r['fixtureSha256'];assert sha(stage/r['rawPath'])==r['rawSha256'];raw=json.loads(gzip.decompress((stage/r['rawPath']).read_bytes()));assert raw['complete'] and not raw['unresolved'];files.update([row['evidence'],r['rawPath']])
  for p,h in r['sourceHashes'].items():
   key=(version,p)
   if key in base_sources:assert base_sources[key]==h;continue
   base_sources[key]=h
   if version==129:assert sha(stage/p)==h,p;sources[p]=h
   else:
    a=archive/p
    expected=sha(a) if a.exists() else hashlib.sha256(git('show',base+':'+p)).hexdigest()
    assert expected==h,(version,p)
for suffix in ['v129-node-full-20261104-v1.log','v129-chrome-twelve-20261104-v1.log','v129-chrome-twelve-local-20261104-v1.log','v129-chrome-ai-twelve-20261104-v1.log','v129-value-input-audit-20261104-v1.log','v128-movement-mode-regression-red-20261104-v1.log','v129-movement-mode-native-proof-20261104-v1.log','v129-funded-travel-native-witness-20261104-v1.json','v129-funded-travel-native-witness-20261104-v1.log','v125-dlc37-blue4-assets-witness-20261104-v1.json','v125-dlc37-blue4-assets-witness-20261104-v1.log']:
 assert (stage/(folder+suffix)).exists(),suffix;files.add(folder+suffix)
full=(stage/(folder+'v129-node-full-20261104-v1.log')).read_text();assert 'SUMMARY unit passed=160 failed=0 total=160' in full and 'SUMMARY fullFlow passed=1 failed=0 total=1' in full
chrome=(stage/(folder+'v129-chrome-ai-twelve-20261104-v1.log')).read_text();assert 'SUMMARY browserSmoke passed=12 failed=0 total=12' in chrome
fails=[l for l in (stage/(folder+'v129-value-input-audit-20261104-v1.log')).read_text().splitlines() if l.startswith('[FAIL]')];assert len(fails)==1 and 'aomomo' in fails[0] and 'decisionObs' in fails[0]
prooflog=(stage/(folder+'v129-movement-mode-native-proof-20261104-v1.log')).read_text();r=json.loads(prooflog);assert r['nativeProofControls']==6 and r['movementModeGuard'] and r['completeRootValueParity'] and [r['optimizedInputs'],r['fullNativeInputs']]==[232,266]
assert 'a cached movement-policy proof must not survive disabling that policy' in (stage/(folder+'v128-movement-mode-regression-red-20261104-v1.log')).read_text()
w=read(folder+'v129-funded-travel-native-witness-20261104-v1.json');assert w['rootAndRngRestored'];assert sha(stage/w['fixture'])==w['fixtureSha256'];assert w['before']['v6']['components']['probePotential']==0 and w['before']['v7']['components']['probePotential']==4.5 and w['after']['value']['components']['probePotential']==5.5
for p,h in w['sourceHashes'].items():assert sha(stage/p)==h,p
for p,h in w['baselineSourceHashes'].items():assert hashlib.sha256(git('show',base+':'+p)).hexdigest()==h
checked=0;old=set()
for entry in git('ls-tree','-rz',base).split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t',1);p=name.decode();old.add(p)
 if p.startswith(('randomizer/','tools/','assets/')) and p not in files:
  b=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==meta.decode().split()[2],p;checked+=1
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
proof=folder+'v129-admission-source-check-20261104-v1.json';(stage/proof).write_text(json.dumps({'baseCommit':base,'runtimeSourceHashes':sources,'unchangedCodeDataFiles':checked,'coldRoots':81,'maxInputs':gates[129]['maxInputs'],'maxMilliseconds':gates[129]['maxMilliseconds'],'rejectedV126Retained':True,'priorV127V128NotAdmitted':True,'archiveWhitespace':'Byte-exact rejected source copies retain inherited whitespace. Diff whitespace gate excludes only those hash-verified three archive trees.','unitPassed':160,'fullFlowPassed':1,'relatedChromePassed':12,'broadChromeAttempt':'Timed out at pre-existing complete-game UI smoke after5passes; retained, no complete-browser-suite pass claimed.','legacyAuditFailure':fails,'proofNativeControls':6,'proofRootValuesIdentical':True,'productionBudget':gates[129]['productionBudgets'],'userBoundary':'before-PASS-card-and-next-income','goalStatus':'active','goalAchieved':False,'newAutonomousRunPending':True,'baselineUnchanged':'ai-search-v41-baseline-20261029'},indent=2)+'\n');files.add(proof)
manifest='adhoc/human405-v129-admission-manifest-20261104-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p) for p in sorted(files)},'sharedIndexSha256':ih,'sharedIndexEntriesSha256':eh,'foreignRegistryHashes':foreign,'goalStatus':'active'},indent=2)+'\n');files.add(manifest)
for p in files:
 if (root/p).exists() and (root/p).read_bytes()!=(stage/p).read_bytes():assert (p in old and (root/p).read_bytes()==git('show',base+':'+p)) or (prior_manifest and (sha(root/p)==prior_manifest['files'].get(p) or p==manifest and sha(root/p)==prior_manifest_hash)),('overlap',p)
if os.environ.get('SETI_DELIVER_V129')!='1':print(json.dumps({'preflight':True,'files':len(files),'runtimeSources':len(sources),'goalStatus':'active'}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v129-admission-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 b=(stage/p).read_bytes();d=root/p;d.parent.mkdir(parents=True,exist_ok=True);d.write_bytes(b);blob=git('hash-object','-w','--stdin',data=b,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check','--','.',*[f':(exclude)reports/ai-foundation-20261104/{directory}/**' for directory in archives.values()],env=env);git('commit','-m','计入在途探测器已筹资任务价值，证明固定收尾并通过v129验收',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files;print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==ih and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==eh
for p,h in foreign.items():assert sha(root/p)==h
result={'commit':commit,'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'foreignRegistryUnchanged':True,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-v129-admission-result-20261104.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
