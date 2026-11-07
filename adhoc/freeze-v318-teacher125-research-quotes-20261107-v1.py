from pathlib import Path
import hashlib,json,re,shutil,subprocess
stage=Path(__file__).resolve().parents[1]
old=Path('/private/tmp/seti-v317-case152-static-occupancy-20261107-v1')
new=Path('/private/tmp/seti-v318-teacher125-research-quotes-20261107-v1')
prefix=Path('reports/ai-foundation-20261107')
parent=prefix/'case152-static-occupancy-v317-v1/source-manifest-20261107-v1.json'
dest=prefix/'teacher125-research-quotes-v318-v1'
source_snapshot=dest/'source-snapshot'
m=json.loads((old/parent).read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(old/parent)=='6b5d3364e51f7e72f733ff75787115c3e8b23800a14d34163909340a47bf04a2'
for k,h in {**m['baseRuntimeHashes'],**m['sourceHashes']}.items():assert sha(old/k)==h,k
inputs={'randomizer/game/ai/state-value.js':'teacher125-research-quotes-v1/state-value-research-quote-memo-prototype-20261107-v2.js'}
new.mkdir()
for name in ['randomizer','tools','adhoc']:shutil.copytree(old/name,new/name,symlinks=True)
for name in ['reports','assets','seti-saves','docs','checkpoint']:
 if (stage/name).exists():(new/name).symlink_to(stage/name,target_is_directory=True)
for k,file in inputs.items():(new/k).write_bytes((stage/prefix/file).read_bytes())
sfile='randomizer/game/ai/decision-search.js';p=new/sfile;s=p.read_text()
assert s.count('seti-complete-decision-search-v317')==1
p.write_text(s.replace('seti-complete-decision-search-v317','seti-complete-decision-search-v318'))
p=new/'randomizer/index.html';s=p.read_text()
for k in [*inputs,sfile]:
 name=k.removeprefix('randomizer/')
 expr=r'(src="\./'+re.escape(name)+r')(?:\?[^"]*)?(")'
 s,n=re.subn(expr,r'\1?ordered-research-quotes-v318\2',s);assert n==1,k
p.write_text(s)
changes=sorted([*inputs,sfile,'randomizer/index.html'])
for k in changes:
 if k.endswith('.js'):subprocess.run(['node','--check',str(new/k)],check=True)
 path=stage/source_snapshot/k;path.parent.mkdir(parents=True,exist_ok=True)
 with path.open('xb')as fd:fd.write((new/k).read_bytes())
source_hashes=dict(m['sourceHashes'])
source_hashes.update({k:sha(new/k) for k in changes})
for k,h in {**m['baseRuntimeHashes'],**source_hashes}.items():assert sha(new/k)==h,k
refs=[]
for label in ['actual-v256-125','actual-v256-132','corpus-case-152']:
 ref=prefix/'teacher125-research-quotes-v1'/f'research-quote-memo-{label}-diagnostic-20261107-v2.json'
 r=json.loads((stage/ref).read_text())
 assert r['ms']<=600 and r['nativeInputs']<=256 and r['fullNativeGraphAndRootExact']
 assert r['prototypeSha256']==sha(new/'randomizer/game/ai/state-value.js')
 refs.append(str(ref))
m.update(searchVersion='seti-complete-decision-search-v318',scope='Frozen isolated candidate, not admitted. V317 plus bounded memo of exact derived default-weight research mark/trigger scalar quotes. All model equations and portfolio candidates unchanged.',candidateAdmitted=False,sourceHashes=dict(sorted(source_hashes.items())),
 parentManifest=str(parent),parentManifestSha256=sha(old/parent),diagnosticReferences=refs,
 changedSourceSnapshot=str(source_snapshot),changedSources=changes,newAutonomousRuns=0)
out=stage/dest/'source-manifest-20261107-v1.json'
with out.open('x')as f:f.write(json.dumps(m,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'workspace':str(new),'manifest':str(out.relative_to(stage)),'sha256':sha(out),'sourceHashes':len(m['sourceHashes']),'changedFiles':len(changes)}))
