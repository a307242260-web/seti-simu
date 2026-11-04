import pathlib,subprocess,os,tempfile,json,hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='38c657cfca097c532ca184a4d7f6ffa69f7b406c';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*args,data=None,env=None,quiet=False):return subprocess.check_output(['git',*args],cwd=root,input=data,stderr=subprocess.DEVNULL if quiet else None,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
before=json.loads(pathlib.Path('/private/tmp/seti-v152-root-before-20261104-v1.json').read_text())
for p,h in before['rootBeforeSha256'].items():assert sha(root/p)==h,p
shared=sha(root/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
files={'docs/ai-design.md','docs/ai-known-research-income-capital-20261104.md','adhoc/human405-two-rounds-progress-20261104-v11.json','adhoc/deliver-human405-research-income-evidence-20261104-v1.py'}
for pattern in ['adhoc/witness-v151-known-research-income-20261104-v1.js','adhoc/prototype-v152-*-20261104-v1.js','adhoc/verify-v152-*-20261104-v1.js','adhoc/summarize-v152-case105-profile-20261104-v1.js',folder+'v151-known-research-income-*',folder+'v152-*',folder+'v153-*','reports/ai-foundation-20261023/human405-v152-cold-*-20261104-v1.*','reports/ai-foundation-20261023/human405-v153-cold-*-20261104-v1.*']:
 for p in stage.glob(pattern):
  if p.is_file():files.add(str(p.relative_to(stage)))
for version in [152,153]:
 directory=f'reports/ai-foundation-20261104/rejected-v{version}-runtime-20261104-v1'
 manifest=read(directory+'/manifest.json');assert manifest['baseCommit']==base
 for p,h in manifest['overlayFiles'].items():assert sha(stage/directory/p)==h,p
 for p,h in manifest['allLoadedRuntimeHashes'].items():
  b=(stage/directory/p).read_bytes()if p in manifest['overlayFiles']else git('show',base+':'+p)
  assert hashlib.sha256(b).hexdigest()==h,p
 files.update(str(p.relative_to(stage))for p in(stage/directory).rglob('*')if p.is_file())
native=read(folder+'v152-research-income-native-controls-20261104-v2.json');assert native['status']=='complete'and len(native['rows'])==120 and native['nativePlans']==408 and native['nativeInputs']==4896 and native['originalRootAndRngUnchanged']
for p,h in native['sourceHashes'].items():assert hashlib.sha256(git('show',base+':'+p)).hexdigest()==h,p
assert sha(stage/'adhoc/prototype-v152-research-income-capital-20261104-v1.js')==native['prototypeSha256']
typed=read(folder+'v152-research-income-typed-parity-20261104-v1.json');assert typed['status']=='complete'and typed['nativePlans']==408 and typed['moneyControls']==648 and typed['stateAndFormalObservationParity'];assert sha(stage/typed['evidence'])==typed['evidenceSha256'];assert sha(stage/'adhoc/prototype-v152-research-income-typed-20261104-v1.js')==typed['prototypeSha256']
gate=read(folder+'v152-current-teacher-serial-gate-20261104-v1.json');assert gate['status']=='complete'and len(gate['rows'])==81 and len(gate['overruns'])==1 and gate['maxInputs']==256 and gate['maxMilliseconds']==672.418167
for row in gate['rows']:
 e=read(row['evidence']);assert sha(stage/e['rawPath'])==e['rawSha256'];assert e['rootAndRngUnchanged']and e['complete'];assert e['nativeInputs']<=256
 assert all(v is None for v in e['diagnostics']['limits'].values())
delta=read(folder+'v152-current-teacher-action-delta-20261104-v1.json');assert len(delta['changedActions'])==1 and delta['changedActions'][0]['label']=='teacher-024'and delta['changedActions'][0]['equalsTeacher']
slow=read('reports/ai-foundation-20261023/human405-v153-cold-serial-case-105-20261104-v1.json');assert slow['complete']and slow['nativeInputs']==256 and slow['milliseconds']>600 and slow['rootAndRngUnchanged'];assert sha(stage/slow['rawPath'])==slow['rawSha256']
parity=read(folder+'v153-journal-graph-parity-20261104-v1.json');assert all(parity[k]for k in ['rootsEqual','allLinesAndPoliciesEqual','allNativePrefixEdgesEqual']);assert not parity['timingPass']
checkpoint=read('adhoc/human405-two-rounds-progress-20261104-v11.json');assert checkpoint['goalStatus']=='active'and not checkpoint['goalAchieved']and checkpoint['candidate153']['officialRuns']==0
# Evidence-only publication: admitted runtime, registries, baseline and saves
# stay exactly as they were. Failed candidate sources live only in archives.
assert all(not p.startswith(('randomizer/','tools/','assets/','seti-saves/','reports/iteration/'))for p in files)
assert not any(p=='reports/robot-iteration.html'for p in files)
for p in sorted(files):
 if p.endswith('.js'):subprocess.run(['node','--check',str(stage/p)],cwd=stage,check=True,stdout=subprocess.DEVNULL)
 try:prior=git('show',base+':'+p,quiet=True)
 except subprocess.CalledProcessError:prior=None
 if(root/p).exists():assert prior is not None and(root/p).read_bytes()==prior,p
inherited_archive_spaces=[]
old_search=git('show',base+':randomizer/game/ai/decision-search.js').splitlines(keepends=True)
for version in [152,153]:
 p=f'reports/ai-foundation-20261104/rejected-v{version}-runtime-20261104-v1/randomizer/game/ai/decision-search.js'
 lines=(stage/p).read_bytes().splitlines(keepends=True);assert len(lines)==len(old_search)
 assert [i for i,(a,b)in enumerate(zip(lines,old_search))if a!=b]==[8]
 # Keep source-bound archives byte-exact, including the unchanged parent's
 # two whitespace-only lines. All authored content still passes diff --check.
 inherited_archive_spaces.append(p)
manifest='adhoc/human405-research-income-evidence-manifest-20261104-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p)for p in sorted(files)},'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'foreignRootHashes':before['rootBeforeSha256'],'goalStatus':'active','productionVersionUnchanged':'v151 / V9','newAutonomousRuns':0,'byteExactArchivesWithUnchangedParentWhitespace':inherited_archive_spaces},ensure_ascii=False,indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_RESEARCH_INCOME_EVIDENCE')!='1':print(json.dumps({'preflight':True,'files':len(files),'nativePlans':408,'cold152Roots':81,'productionRuntimeUnchanged':True,'goalStatus':'active'}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-research-income-evidence-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 b=(stage/p).read_bytes();blob=git('hash-object','-w','--stdin',data=b,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files
git('diff','--cached','--check','--','.',*[':(exclude)'+p for p in inherited_archive_spaces],env=env)
for p in sorted(files):
 dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
git('commit','-m','验证已知研究收入修正首轮分流，归档未过时限候选并保留生产基线',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files
print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,h in before['rootBeforeSha256'].items():assert sha(root/p)==h,p
assert not git('diff',base,commit,'--name-only','--','randomizer','tools','assets','seti-saves','reports/iteration','reports/robot-iteration.html').strip()
result={'commit':commit,'privateIndex':private,'baseCommit':base,'files':len(files),'sharedIndexUnchanged':True,'foreignV1AndV41BaselinePreserved':True,'productionRuntimeUnchanged':'v151 / V9','goalStatus':'active','newAutonomousRuns':0};pathlib.Path('/private/tmp/seti-research-income-evidence-delivery-20261104-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
