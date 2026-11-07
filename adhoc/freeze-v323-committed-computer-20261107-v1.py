from pathlib import Path
import hashlib,json,re,shutil,subprocess
stage=Path(__file__).resolve().parents[1]
old=Path('/private/tmp/seti-v322-teacher-amiba-scan-coordinates-20261107-v1')
new=Path('/private/tmp/seti-v323-committed-computer-recovery-20261107-v1')
prefix=Path('reports/ai-foundation-20261107')
parent=prefix/'teacher-r3-after-amiba-scan-coordinate-v322-v1/source-manifest-20261107-v1.json'
dest=prefix/'committed-computer-recovery-v323-v1'
source_snapshot=dest/'source-snapshot'
m=json.loads((old/parent).read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(old/parent)=='5c7538bbb58dcb972499f6f5986418cfc47b289e24c200f3177700ec78a789d4'
for k,h in {**m['baseRuntimeHashes'],**m['sourceHashes']}.items():assert sha(old/k)==h,k
inputs={'randomizer/game/ai/analysis-port.js':'v322-winning-continuation-v1/analysis-port-retain-committed-computer-proof-20261107-v1.js'}
overlay=Path('/private/tmp/seti-v322-regression-overlay-20261107-v1')
tests=['known-postdraw-tail','post-main-inert-reservations','pre-main-data-plan','research-comparison-loop','research-single-window','trade-reservation-bound']
new.mkdir()
for name in ['randomizer','tools']:shutil.copytree(old/name,new/name,symlinks=True)
(new/'adhoc').mkdir()
for item in (old/'adhoc').iterdir():
 target=new/'adhoc'/item.name
 if item.is_file() and item.suffix in ['.js','.py']:shutil.copy2(item,target)
 else:target.symlink_to(item,target_is_directory=item.is_dir())
for name in ['reports','assets','seti-saves','docs','checkpoint']:
 if (stage/name).exists():(new/name).symlink_to(stage/name,target_is_directory=True)
for k,file in inputs.items():
 s=(stage/prefix/file).read_text()
 (new/k).write_text(s)
for name in tests:
 k='randomizer/game/ai/'+name+'.test.js'
 (new/k).write_bytes((overlay/k).read_bytes())
sfile='randomizer/game/ai/decision-search.js';p=new/sfile;s=p.read_text()
assert s.count('seti-complete-decision-search-v322')==1
p.write_text(s.replace('seti-complete-decision-search-v322','seti-complete-decision-search-v323'))
p=new/'randomizer/index.html';s=p.read_text()
for k in [*inputs,sfile]:
 name=k.removeprefix('randomizer/')
 expr=r'(src="\./'+re.escape(name)+r')(?:\?[^"]*)?(")'
 s,n=re.subn(expr,r'\1?committed-computer-v323\2',s);assert n==1,k
p.write_text(s)
changes=sorted([*inputs,sfile,'randomizer/index.html',*('randomizer/game/ai/'+name+'.test.js' for name in tests)])
for k in changes:
 if k.endswith('.js'):subprocess.run(['node','--check',str(new/k)],check=True)
 path=stage/source_snapshot/k;path.parent.mkdir(parents=True,exist_ok=True)
 with path.open('xb')as fd:fd.write((new/k).read_bytes())
source_hashes=dict(m['sourceHashes'])
source_hashes.update({k:sha(new/k) for k in changes})
for k,h in {**m['baseRuntimeHashes'],**source_hashes}.items():assert sha(new/k)==h,k
refs=[]
for label in ['teacher-r3-after-amiba-reveal','income-before-amiba','actual-v256-125','actual-v256-132','corpus-case-152']:
 ref=prefix/'v322-winning-continuation-v1'/f'committed-computer-{label}-diagnostic-20261107-v1.json'
 r=json.loads((stage/ref).read_text())
 assert r['ms']<=600 and r['nativeInputs']<=256 and r['fullNativeGraphAndRootExact']
 assert r['prototypeSha256']==sha(new/'randomizer/game/ai/analysis-port.js')
 refs.append(str(ref))
m.update(searchVersion='seti-complete-decision-search-v323',scope='Frozen isolated candidate, not admitted. V322 restores the complete real cold-recovery prefix when a fixed computer plan follows a committed move. Legacy theorem and Native observation tests validate their actual contract. No new game.',candidateAdmitted=False,sourceHashes=dict(sorted(source_hashes.items())),
 parentManifest=str(parent),parentManifestSha256=sha(old/parent),diagnosticReferences=refs,
 changedSourceSnapshot=str(source_snapshot),changedSources=changes,newAutonomousRuns=0)
out=stage/dest/'source-manifest-20261107-v1.json'
with out.open('x')as f:f.write(json.dumps(m,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'workspace':str(new),'manifest':str(out.relative_to(stage)),'sha256':sha(out),'sourceHashes':len(m['sourceHashes']),'changedFiles':len(changes)}))
