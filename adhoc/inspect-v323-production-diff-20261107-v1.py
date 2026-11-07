from pathlib import Path
import hashlib,json,os,subprocess
repo=Path('/Users/bilibili/code/seti-simu')
candidate=Path('/private/tmp/seti-v323-committed-computer-recovery-20261107-v1')
evidence=Path('/private/tmp/seti-v263-research-completion-mark-20261106-v1')
base='2f333e67402df00c4442a82ee04d3a7e41828cb7'
env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'}
def git(*a):return subprocess.check_output(['git',*a],cwd=repo,env=env)
assert git('rev-parse','HEAD').decode().strip()==base
paths={}
for row in git('ls-tree','-r','-z',base,'--','randomizer','tools','assets').split(b'\0'):
 if not row:continue
 meta,path=row.split(b'\t',1); mode,kind,digest=meta.split();assert kind==b'blob'
 paths[path.decode()]=(mode.decode(),digest.decode())
changed=[];missing=[];unknown=[];overlap=[];wrong_mode=[]
blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
for n,(mode,digest) in paths.items():
 p=candidate/n
 if not p.exists():
  if mode=='120000' and p.is_symlink():pass
  else:missing.append(n);continue
 if mode=='120000':b=os.readlink(p).encode()
 else:
  if p.is_symlink() and n.startswith(('randomizer/','tools/')):wrong_mode.append(n)
  if (bool(p.stat().st_mode&0o111))!=(mode=='100755'):wrong_mode.append(n)
  b=p.read_bytes()
 if blob(b)!=digest:
  changed.append(n);q=repo/n
  if q.is_file() and blob(q.read_bytes()) not in [digest,blob(b)]:overlap.append(n)
for d in ('randomizer','tools','assets'):
 for p in (candidate/d).rglob('*'):
  if p.is_file() and not p.name.startswith('.'):
   n=str(p.relative_to(candidate))
   if n not in paths:unknown.append(n)
result=dict(sourceBase=base,tracked=len(paths),changed=changed,missing=missing,unknown=unknown,foreignOverlap=overlap,wrongMode=wrong_mode)
path=evidence/'reports/ai-foundation-20261107/committed-computer-recovery-v323-v1/production-runtime-scope-20261107-v1.json'
with path.open('x')as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({**result,'unknown':unknown[:10]}))
