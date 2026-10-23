"""Resume an inspected, tested center delivery without rebuilding or touching the shared index."""
import hashlib,json,os,pathlib,subprocess
root=pathlib.Path('/Users/bilibili/code/seti-simu');stage=pathlib.Path('/private/tmp/seti-ai-stage38-centers-20261023-uwwzt6fx');mp='adhoc/ai-generation-centers-stage38-snapshot-20261023.json';m=json.loads((stage/mp).read_text());base=m['baseCommit'];sha=lambda b:hashlib.sha256(b).hexdigest();safe_env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
def git(*args,env=None,data=None):return subprocess.check_output(['git',*args],cwd=root,env=env or safe_env,input=data)
assert git('rev-parse','HEAD').decode().strip()==base;assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
files=dict(m['files']);files[mp]=sha((stage/mp).read_bytes());shared=sha((root/'.git/index').read_bytes());entries=git('ls-files','--stage','-z');assert sha(entries)==m['deliveryResume']['sharedIndexEntriesSha256']
for p,h in files.items():assert sha((stage/p).read_bytes())==h,p
preserved={'reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html'}
for p in files:
 if p not in preserved and p!=mp and (root/p).exists():assert (root/p).read_bytes()==(stage/p).read_bytes() or p in ['adhoc/finalize-ai-generation-centers-20261023-v1.py','reports/ai-foundation-20261023/generation-centers-validation-v1.json'],('prepared root source differs',p)
rv=json.loads((root/'reports/iteration/versions.json').read_text());sv=json.loads((stage/'reports/iteration/versions.json').read_text());byid={v['id']:v for v in rv['versions']};assert all(byid[v['id']]==v for v in sv['versions'])
reg=json.loads((root/'reports/iteration/registry.json').read_text());assert reg['defaultGeneration']=='v2' and reg['generations']['v2']['recordCount']==9
assert (root/'reports/iteration/page-template.html').read_bytes()==(stage/'reports/iteration/page-template.html').read_bytes()
print(json.dumps({'phase':'resume-preflight','files':len(files),'sharedIndexEntries':len(entries.split(b'\0'))-1,'sharedIndexSha256':shared,'rootExtraVersionsPreserved':len(rv['versions'])-len(sv['versions'])}))
if os.environ.get('SETI_DELIVER_AI_GENERATION_CENTERS')!='1':raise SystemExit(0)
assert git('ls-remote','origin','refs/heads/dev').decode().split()[0]==base
private=pathlib.Path('/private/tmp/seti-ai-stage38-centers-resume-v2.index');assert not private.exists(),'Inspect an existing resume index before reuse';env=dict(safe_env,GIT_INDEX_FILE=str(private));git('read-tree',base,env=env)
for p,h in sorted(files.items()):
 data=(stage/p).read_bytes();assert sha(data)==h
 if p not in preserved:
  destination=root/p;destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(data)
 blob=git('hash-object','-w','--stdin',env=env,data=data).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==set(files)
assert sha((root/'.git/index').read_bytes())==shared and git('ls-files','--stage','-z')==entries
message=stage/'adhoc/generation-centers-commit-message-20261023.txt';message.write_text('隔离V2新AI与V1历史实验并补齐基础对局记录\n');git('commit','--file',str(message),env=env)
commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==set(files)
print(git('show','--name-only','--stat','--format=short','HEAD').decode());git('push','origin','HEAD:dev',env=env);assert git('ls-remote','origin','refs/heads/dev').decode().split()[0]==commit;assert sha((root/'.git/index').read_bytes())==shared and git('ls-files','--stage','-z')==entries
print(json.dumps({'phase':'delivered','commit':commit,'files':len(files),'sharedIndexUnchangedDuringResume':True,'v2Records':9,'newSearchCompleteGames':0}))
