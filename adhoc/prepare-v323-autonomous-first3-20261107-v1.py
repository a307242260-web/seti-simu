from pathlib import Path
import hashlib,json,os,shutil,subprocess
candidate=Path('/private/tmp/seti-v323-committed-computer-recovery-20261107-v1')
evidence=Path(__file__).resolve().parents[1]
repo=Path('/Users/bilibili/code/seti-simu')
target=Path('/private/tmp/seti-v323-autonomous-first3-20261107-v1')
ref='2f333e67402df00c4442a82ee04d3a7e41828cb7'
name='ai-search-v323-white-first3-20261107'
m=json.loads((evidence/'reports/ai-foundation-20261107/committed-computer-recovery-v323-v1/source-manifest-20261107-v1.json').read_text())
env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'}
def git(*args):return subprocess.check_output(['git',*args],cwd=repo,env=env)
def siblings(src,dst,skip=()):
 dst.mkdir(parents=True,exist_ok=True)
 for p in src.iterdir():
  if p.name not in skip:(dst/p.name).symlink_to(p,target_is_directory=p.is_dir())
target.mkdir()
for d in ['randomizer','tools']:shutil.copytree(candidate/d,target/d,symlinks=True)
for d in ['adhoc','docs','assets','checkpoint']:
 if (candidate/d).exists():(target/d).symlink_to(candidate/d,target_is_directory=True)
siblings(evidence/'seti-saves',target/'seti-saves')
siblings(evidence/'reports',target/'reports',{'research','iteration','robot-iteration.html'})
siblings(evidence/'reports/research',target/'reports/research')
mutable={'versions.json','registry.json','page-template.html'}
siblings(evidence/'reports/iteration',target/'reports/iteration',mutable)
for f in ['reports/robot-iteration.html',*['reports/iteration/'+n for n in mutable]]:
 (target/f).write_bytes(git('show',ref+':'+f))
assert not any(name in p.name for p in (target/'seti-saves').iterdir())
versions=json.loads((target/'reports/iteration/versions.json').read_text())['versions']
assert not any(v['id']==name for v in versions)
for p,h in {**m['baseRuntimeHashes'],**m['sourceHashes']}.items():
 assert hashlib.sha256((target/p).read_bytes()).hexdigest()==h,p
print(json.dumps({'target':str(target),'provisionalExperiment':name,'runtimeVerified':True,'registryInheritedFrom':ref,'previousVersionExists':False,'performedAutonomousRun':False}))
