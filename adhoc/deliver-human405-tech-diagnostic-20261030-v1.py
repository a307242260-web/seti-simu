"""Deliver only the reviewed diagnostic files through an independent Git index."""
import hashlib,json,os,pathlib,signal,subprocess,tarfile
root=pathlib.Path('/Users/bilibili/code/seti-simu')
stage=pathlib.Path(__file__).resolve().parent.parent
context=json.loads((stage/'adhoc/human405-tech-diagnostic-context-20261030.json').read_text())
base=context['baseCommit']
files=['adhoc/human405-tech-diagnostic-context-20261030.json','adhoc/audit-human405-tech-value-20261030-v1.js','adhoc/prepare-human405-white-only-20261030-v1.js','adhoc/deliver-human405-tech-diagnostic-20261030-v1.py','docs/ai-human405-learning-20261029.md','reports/ai-foundation-20261023/human405-tech-value-diagnostic-20261030-v1.json','reports/ai-foundation-20261023/human405-white-only-opening-20261030-v1.json','reports/ai-foundation-20261023/human405-white-only-opening-20261030-v1.checkpoint.json','reports/ai-foundation-20261023/human405-learning-validation-20261030-v1.json']
sha=lambda b:hashlib.sha256(b).hexdigest()
env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
def git(*args,data=None,private=None):
    return subprocess.check_output(['git',*args],cwd=root,env=dict(env,**({'GIT_INDEX_FILE':str(private)} if private else {})),input=data)
assert git('rev-parse','HEAD').decode().strip()==base
assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
assert sha((root/'.git/index').read_bytes())==context['sharedIndexSha256']
shared_entries=sha(git('ls-files','--stage','-z'))
for p in files[5:7]:
    r=json.loads((stage/p).read_text())
    for source,h in r['sourceHashes'].items():assert sha((stage/source).read_bytes())==h,(p,source)
white=json.loads((stage/files[6]).read_text())
assert sha((stage/white['checkpointPath']).read_bytes())==white['checkpointSha256']
base_paths=set();unchanged=0
process=subprocess.Popen(['git','archive',base],cwd=root,env=env,stdout=subprocess.PIPE)
with tarfile.open(fileobj=process.stdout,mode='r|') as archive:
    for member in archive:
        if not member.isfile():continue
        p=member.name;original=archive.extractfile(member).read();base_paths.add(p)
        if p in files:
            if (root/p).exists():assert (root/p).read_bytes() in (original,(stage/p).read_bytes()),('overlap',p)
        else:assert (stage/p).read_bytes()==original,('unowned snapshot edit',p);unchanged+=1
assert process.wait()==0
for p in files:
    if p not in base_paths and (root/p).exists():assert (root/p).read_bytes()==(stage/p).read_bytes(),('untracked overlap',p)
manifest_path='adhoc/human405-tech-diagnostic-snapshot-20261030-v1.json'
manifest={'baseCommit':base,'snapshot':str(stage),'files':{p:sha((stage/p).read_bytes()) for p in files},'unchangedBaseFilesVerified':unchanged,'sharedIndexSha256':context['sharedIndexSha256'],'sharedIndexEntriesSha256':shared_entries,'runtimeSourceHashesVerified':True,'baselinePromoted':False}
(stage/manifest_path).write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');files.append(manifest_path)
if os.environ.get('SETI_DELIVER_HUMAN405_DIAGNOSTIC')!='1':
    print(json.dumps({'phase':'preflight','files':len(files),'unchangedBaseFiles':unchanged,'runtimeSourceHashesVerified':True,'sharedIndexUnchanged':True}));raise SystemExit(0)
private=pathlib.Path('/private/tmp/seti-human405-tech-diagnostic-delivery-20261030.index');assert not private.exists()
git('read-tree',base,private=private)
for p in files:
    data=(stage/p).read_bytes();destination=root/p;destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(data)
    blob=git('hash-object','-w','--stdin',data=data,private=private).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,private=private)
assert set(git('diff','--cached','--name-only',base,private=private).decode().splitlines())==set(files)
git('commit','-m','明确405分学习计划并诊断科技估值与单白席开局',private=private)
commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==set(files)
assert sha((root/'.git/index').read_bytes())==context['sharedIndexSha256'];assert sha(git('ls-files','--stage','-z'))==shared_entries
print(git('show','--name-only','--stat','--format=short',commit).decode(),flush=True)
# HTTP408 occurred twice on the previous delivery. Bound this retry and leave a
# durable, explicit status instead of holding the learning task indefinitely.
remote_before=None;remote_after=None;push_error=None
try:
    remote_before=subprocess.check_output(['git','ls-remote','origin','refs/heads/dev'],cwd=root,env=env,timeout=15).decode().split()[0]
    assert subprocess.run(['git','merge-base','--is-ancestor',remote_before,commit],cwd=root,env=env).returncode==0,'remote advanced outside this history'
    pushed=subprocess.Popen(['git','-c','http.version=HTTP/1.1','-c','http.postBuffer=157286400','-c','http.lowSpeedLimit=1','-c','http.lowSpeedTime=30','push','origin',commit+':refs/heads/dev'],cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
    try:
        stdout,stderr=pushed.communicate(timeout=45)
    except subprocess.TimeoutExpired:
        os.killpg(pushed.pid,signal.SIGTERM)
        try:stdout,stderr=pushed.communicate(timeout=5)
        except subprocess.TimeoutExpired:os.killpg(pushed.pid,signal.SIGKILL);stdout,stderr=pushed.communicate()
        push_error='Push timed out after45s; only its own process group terminated.'
    if pushed.returncode and not push_error:push_error=stderr[-1200:]
except (subprocess.TimeoutExpired,subprocess.CalledProcessError) as e:push_error=type(e).__name__
try:remote_after=subprocess.check_output(['git','ls-remote','origin','refs/heads/dev'],cwd=root,env=env,timeout=15).decode().split()[0]
except (subprocess.TimeoutExpired,subprocess.CalledProcessError):pass
status={'localCommit':commit,'originBefore':remote_before,'originAfter':remote_after,'pushComplete':remote_after==commit,'pushError':push_error,'sharedIndexUnchanged':sha((root/'.git/index').read_bytes())==context['sharedIndexSha256']}
(root/'adhoc/human405-tech-diagnostic-delivery-status-20261030-v1.json').write_text(json.dumps(status,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(status,ensure_ascii=False),flush=True)
