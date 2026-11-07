from pathlib import Path
import hashlib,json,re,shutil,subprocess
stage=Path(__file__).resolve().parents[1]
old=Path('/private/tmp/seti-v318-teacher125-research-quotes-20261107-v1')
new=Path('/private/tmp/seti-v319-income-before-amiba-probe-20261107-v1')
prefix=Path('reports/ai-foundation-20261107')
parent=prefix/'teacher125-research-quotes-v318-v1/source-manifest-20261107-v1.json'
dest=prefix/'income-before-amiba-probe-v319-v1'
source_snapshot=dest/'source-snapshot'
m=json.loads((old/parent).read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(old/parent)=='a4f5673be01445cdfff37891799eb2c183560de3dace958a4cc363f79e7f718d'
for k,h in {**m['baseRuntimeHashes'],**m['sourceHashes']}.items():assert sha(old/k)==h,k
inputs={
 'randomizer/game/ai/state-value.js':'income-before-amiba-probe-ref-v1/state-value-probe-symbol-key-prototype-20261107-v9.js',
 'randomizer/game/ai/probe-capital.js':'income-before-amiba-probe-ref-v1/probe-capital-funded-list-prototype-20261107-v6.js',
}
new.mkdir()
for name in ['randomizer','tools','adhoc']:shutil.copytree(old/name,new/name,symlinks=True)
for name in ['reports','assets','seti-saves','docs','checkpoint']:
 if (stage/name).exists():(new/name).symlink_to(stage/name,target_is_directory=True)
for k,file in inputs.items():
 s=(stage/prefix/file).read_text()
 if k.endswith('/state-value.js'):
  # Only the ordinary four own data fields of the public symbol DTO can
  # use its immutable fragment key. All other inputs use full old JSON.
  guard='&& Object.keys(symbols).length===4 && Object.keys(trigger).length===8'
  assert s.count(guard)==1
  s=s.replace(guard,guard+"""
      && !Object.hasOwn(symbols,"toJSON")
      && (Object.getPrototypeOf(symbols)===Object.prototype||Object.getPrototypeOf(symbols)===null)
      && ["revealInitialized","revealedSlotId","symbolSlots","symbolsById"].every(key=>{
        const d=Object.getOwnPropertyDescriptor(symbols,key);
        return d?.enumerable===true&&Object.hasOwn(d,"value");
      })""")
 (new/k).write_text(s)
sfile='randomizer/game/ai/decision-search.js';p=new/sfile;s=p.read_text()
assert s.count('seti-complete-decision-search-v318')==1
p.write_text(s.replace('seti-complete-decision-search-v318','seti-complete-decision-search-v319'))
p=new/'randomizer/index.html';s=p.read_text()
for k in [*inputs,sfile]:
 name=k.removeprefix('randomizer/')
 expr=r'(src="\./'+re.escape(name)+r')(?:\?[^"]*)?(")'
 s,n=re.subn(expr,r'\1?funded-probe-scalar-v319\2',s);assert n==1,k
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
for label in ['income-before-amiba','actual-v256-125','actual-v256-132','corpus-case-152']:
 ref=prefix/'income-before-amiba-probe-ref-v1'/f'probe-capital-funded-list-{label}-diagnostic-20261107-v9.json'
 r=json.loads((stage/ref).read_text())
 assert r['ms']<=600 and r['nativeInputs']<=256 and r['fullNativeGraphAndRootExact']
 assert r['prototypeSha256']==sha(new/'randomizer/game/ai/probe-capital.js')
 assert r['valuePrototypeSha256']==sha(stage/prefix/inputs['randomizer/game/ai/state-value.js'])
 refs.append(str(ref))
m.update(searchVersion='seti-complete-decision-search-v319',scope='Frozen isolated candidate, not admitted. V318 plus exact immutable probe geometry references, private affordable endpoints and scalar value path, and exact immutable symbol key parts. Full probe explanation API remains available.',candidateAdmitted=False,sourceHashes=dict(sorted(source_hashes.items())),
 parentManifest=str(parent),parentManifestSha256=sha(old/parent),diagnosticReferences=refs,
 changedSourceSnapshot=str(source_snapshot),changedSources=changes,newAutonomousRuns=0)
out=stage/dest/'source-manifest-20261107-v1.json'
with out.open('x')as f:f.write(json.dumps(m,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'workspace':str(new),'manifest':str(out.relative_to(stage)),'sha256':sha(out),'sourceHashes':len(m['sourceHashes']),'changedFiles':len(changes)}))
