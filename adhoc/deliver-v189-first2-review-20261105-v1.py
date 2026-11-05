import pathlib,subprocess,os,tempfile,json,hashlib
stage=pathlib.Path(__file__).resolve().parents[1]
root=pathlib.Path('/Users/bilibili/code/seti-simu')
base='1609bf504b36deb2fc7053bb7d90ef6609df432c'
def git(*args,data=None,env=None):
 return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==base
assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
shared=sha(root/'.git/index')
proof=json.loads((stage/'reports/ai-foundation-20261104/two-rounds-teacher-v2/v189-first2-result-source-check-20261105-v1.json').read_text())
for p,h in proof['runtimeSourceHashes'].items():assert sha(root/p)==h and sha(stage/p)==h,p
prefix='reports/review/v189-first2-every-input-20261105-v1'
files={prefix+x for x in ['.html','.json','.browser-check.json','.step104.png','.step108.png','.step112.png','.mobile.png']}
files.update('adhoc/'+p for p in ['review-v189-first2-every-input-20261105-v1.js','render-v189-first2-review-20261105-v1.js','verify-v189-first2-review-html-20261105-v1.js','deliver-v189-first2-review-20261105-v1.py'])
files.add('docs/human405-v189-first2-result-20261105.md')
browser=json.loads((stage/(prefix+'.browser-check.json')).read_text())
assert browser['all85WhiteInputsRendered'] and browser['allVisibleCardAndTechImagesDecoded'] and not browser['browserErrors']
ledger=json.loads((stage/(prefix+'.json')).read_text())
assert ledger['all102ActionsLegalAndFinalStateSessionExact'] and ledger['whitePlayerExactlyEqualsTeacherAfter104'] and ledger['policyQueries']==0
for p in sorted(files):
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
 if (root/p).exists() and (root/p).read_bytes()!=(stage/p).read_bytes():assert (root/p).read_bytes()==git('show',base+':'+p),p
manifest='adhoc/v189-first2-review-delivery-manifest-20261105-v1.json'
(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p)for p in sorted(files)},'sharedIndexSha256':shared,'policyQueries':0,'nativeInputsReplayed':102,'browserWhiteInputsVerified':85,'runtimeUnchanged':True},indent=2)+'\n')
files.add(manifest)
if os.environ.get('SETI_DELIVER_V189_REVIEW')!='1':print(json.dumps({'preflight':True,'files':len(files),'nativeReplayInputs':102,'browserInputs':85}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v189-review-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 h=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',h,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files
git('diff','--cached','--check',env=env)
for p in sorted(files):
 dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
git('commit','-m','增加V189前两轮逐行动图解复盘及原生账本与浏览器验证',env=env)
commit=git('rev-parse','HEAD').decode().strip()
assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(root/'.git/index')==shared
result={'commit':commit,'privateIndex':private,'sharedIndexUnchanged':True,'runtimeUnchanged':True,'html':str(root/(prefix+'.html'))}
pathlib.Path('/private/tmp/seti-v189-first2-review-delivery-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
