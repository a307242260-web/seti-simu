from pathlib import Path
import hashlib,json,re,shutil,subprocess
old=Path(__file__).resolve().parents[1]
new=Path('/private/tmp/seti-v315-case152-lean-proof-path-20261107-v1')
prefix=Path('reports/ai-foundation-20261107')
parent=prefix/'analysis-lazy-trace-contexts-v1/source-manifest-20261107-v1.json'
dest=prefix/'case152-lean-proof-path-v315-v1'
source_snapshot=dest/'source-snapshot'
m=json.loads((old/parent).read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(old/parent)=='eded403ee0a90b8eb180adc2de639eeab3c39aac3fa68aacc056e9e265f51a91'
for k,h in {**m['baseRuntimeHashes'],**m['sourceHashes']}.items():assert sha(old/k)==h,k
inputs={
 'randomizer/game/ai/decision-search.js':'case152-primary-bound-v1/decision-search-primary-bound-prototype-20261107-v1.js',
 'randomizer/game/ai/analysis-port.js':'case152-rotation-reuse-v1/analysis-port-rotation-reuse-prototype-20261107-v1.js',
 'randomizer/game/ai/local-decision-plans.js':'case152-score-readonly-data-v1/local-decision-plans-readonly-data-prototype-20261107-v1.js',
 'randomizer/game/ai/funded-movement-tail.js':'case152-score-readonly-data-v1/funded-movement-readonly-data-prototype-20261107-v1.js',
 'randomizer/game/ai/goal-movement.js':'case152-planet-location-v1/goal-movement-planet-location-prototype-20261107-v2.js',
 'randomizer/game/effects/probe-turn-session.js':'case152-completed-prefix-v1/probe-turn-shared-payments-prototype-20261107-v4.js',
 'randomizer/game/production-kernel.js':'case152-route-gap-v1/production-kernel-route-gap-prototype-20261107-v1.js',
 'randomizer/game/state/low-coupling-slices.js':'case152-validator-paths-v1/low-coupling-slices-prototype-20261107-v2.js',
 'randomizer/game/state/high-coupling-slices.js':'case152-validator-paths-v1/high-coupling-slices-prototype-20261107-v2.js',
 'randomizer/game/state/state-store.js':'case152-native-copy-v1/state-store-prototype-20261107-v1.js',
}
new.mkdir()
for name in ['randomizer','tools','adhoc']:shutil.copytree(old/name,new/name,symlinks=True)
for name in ['reports','assets','seti-saves','docs','checkpoint']: 
 if (old/name).exists():(new/name).symlink_to(old/name,target_is_directory=True)
for k,file in inputs.items():
 text=(old/prefix/file).read_text()
 if k.endswith('/decision-search.js'):text=text.replace('seti-complete-decision-search-v314','seti-complete-decision-search-v315')
 if k.endswith('/state-store.js'):
  # Production's StateStore facade never supplied copyForkData to the runtime.
  # Keep the demonstrated use for committed working copies only.
  assert text.count('    copyForkData,\n')==1
  text=text.replace('    copyForkData,\n','')
 (new/k).write_text(text)
 subprocess.run(['node','--check',str(new/k)],check=True)
p=new/'randomizer/index.html'
s=p.read_text()
for k in inputs:
 name=k.removeprefix('randomizer/')
 expr=r'(src="\./'+re.escape(name)+r')(?:\?[^"]*)?(")'
 s,n=re.subn(expr,r'\1?lean-native-path-v315\2',s);assert n==1,k
p.write_text(s)
assert sha(new/'randomizer/game/effects/session-runtime.js')==sha(old/'randomizer/game/effects/session-runtime.js')
assert sha(new/'randomizer/game/rule-composition.js')==sha(old/'randomizer/game/rule-composition.js')
changes=sorted([*inputs,'randomizer/index.html'])
assert len(changes)==11
for k in changes:
 path=old/source_snapshot/k;path.parent.mkdir(parents=True,exist_ok=True)
 with path.open('xb')as fd:fd.write((new/k).read_bytes())
source_hashes=dict(m['sourceHashes'])
source_hashes.update({k:sha(new/k) for k in changes})
for k,h in {**m['baseRuntimeHashes'],**source_hashes}.items():assert sha(new/k)==h,k
ref=prefix/'case152-route-gap-v1/route-gap-proofs-20261107-v1.json';r=json.loads((old/ref).read_text())
assert r['wallMs']<=600 and r['prototypeNativeInputs']==256 and r['fullNativeEnvelopeAndRankParity']
m.update(searchVersion='seti-complete-decision-search-v315',scope='Frozen isolated candidate, not admitted. Retains only proved fixed-tail strict bounds and geometry reductions; ordinary raw writes and effect journals unchanged.',candidateAdmitted=False,sourceHashes=dict(sorted(source_hashes.items())),
 parentManifest=str(parent),parentManifestSha256=sha(old/parent),diagnosticReference=str(ref),
 changedSourceSnapshot=str(source_snapshot),changedSources=changes,workingCopyOnly=True,newAutonomousRuns=0)
out=old/dest/'source-manifest-20261107-v1.json'
with out.open('x')as f:f.write(json.dumps(m,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'workspace':str(new),'manifest':str(out.relative_to(old)),'sha256':sha(out),'sourceHashes':len(m['sourceHashes']),'changedFiles':len(changes)}))
