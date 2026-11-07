from pathlib import Path
import hashlib,json,re,shutil,subprocess
stage=Path(__file__).resolve().parents[1]
old=Path('/private/tmp/seti-v315-case152-lean-proof-path-20261107-v1')
new=Path('/private/tmp/seti-v316-case152-pending-copy-20261107-v1')
prefix=Path('reports/ai-foundation-20261107')
parent=prefix/'case152-lean-proof-path-v315-v1/source-manifest-20261107-v1.json'
dest=prefix/'case152-pending-copy-v316-v1'
source_snapshot=dest/'source-snapshot'
m=json.loads((old/parent).read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(old/parent)=='00a258058d116c19a53483ad103ca1c39ed1e2fd1e5a2d550bafd47ec91922f7'
for k,h in {**m['baseRuntimeHashes'],**m['sourceHashes']}.items():assert sha(old/k)==h,k
inputs={
 'randomizer/game/effects/session-runtime.js':'case152-pending-copy-v1/session-runtime-pending-copy-prototype-20261107-v1.js',
 'randomizer/game/production-kernel.js':'case152-pending-copy-v1/production-kernel-pending-copy-prototype-20261107-v1.js',
 'randomizer/game/rule-composition.js':'case152-native-copy-v1/rule-composition-prototype-20261107-v1.js',
 'randomizer/game/state/state-store.js':'case152-native-copy-v1/state-store-prototype-20261107-v1.js',
}
new.mkdir()
for name in ['randomizer','tools','adhoc']:shutil.copytree(old/name,new/name,symlinks=True)
for name in ['reports','assets','seti-saves','docs','checkpoint']:
 if (stage/name).exists():(new/name).symlink_to(stage/name,target_is_directory=True)
for k,file in inputs.items():(new/k).write_bytes((stage/prefix/file).read_bytes())
sfile='randomizer/game/ai/decision-search.js';p=new/sfile;s=p.read_text()
assert s.count('seti-complete-decision-search-v315')==1
p.write_text(s.replace('seti-complete-decision-search-v315','seti-complete-decision-search-v316'))
p=new/'randomizer/index.html';s=p.read_text()
for k in [*inputs,sfile]:
 name=k.removeprefix('randomizer/')
 expr=r'(src="\./'+re.escape(name)+r')(?:\?[^"]*)?(")'
 s,n=re.subn(expr,r'\1?pending-copy-v316\2',s);assert n==1,k
p.write_text(s)
changes=sorted([*inputs,sfile,'randomizer/index.html'])
for k in changes:
 if k.endswith('.js'):subprocess.run(['node','--check',str(new/k)],check=True)
 path=stage/source_snapshot/k;path.parent.mkdir(parents=True,exist_ok=True)
 with path.open('xb')as fd:fd.write((new/k).read_bytes())
source_hashes=dict(m['sourceHashes'])
source_hashes.update({k:sha(new/k) for k in changes})
for k,h in {**m['baseRuntimeHashes'],**source_hashes}.items():assert sha(new/k)==h,k
ref=prefix/'case152-pending-copy-v1/pending-copy-proofs-20261107-v1.json';r=json.loads((stage/ref).read_text())
assert r['wallMs']<=600 and r['prototypeNativeInputs']==256 and r['fullNativeEnvelopeAndRankParity'] and r['pendingCopies']==165
m.update(searchVersion='seti-complete-decision-search-v316',scope='Frozen isolated candidate, not admitted. V315 plus alias-preserving copying of trusted Native in-memory pending sessions. Canonical restore remains unchanged.',candidateAdmitted=False,sourceHashes=dict(sorted(source_hashes.items())),
 parentManifest=str(parent),parentManifestSha256=sha(old/parent),diagnosticReference=str(ref),changedSourceSnapshot=str(source_snapshot),changedSources=changes,workingCopyOnly=False,newAutonomousRuns=0)
out=stage/dest/'source-manifest-20261107-v1.json'
with out.open('x')as f:f.write(json.dumps(m,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'workspace':str(new),'manifest':str(out.relative_to(stage)),'sha256':sha(out),'sourceHashes':len(m['sourceHashes']),'changedFiles':len(changes)}))
