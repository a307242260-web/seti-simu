"""Restore candidate from archived Git inputs and a thin incremental patch."""
from pathlib import Path
import difflib,hashlib,io,json,subprocess,tarfile,tempfile
R=Path(__file__).resolve().parents[1];M=R/'reports/ai-foundation-20261118';D=R/'reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1';sha=lambda b:hashlib.sha256(b).hexdigest();r=Path(json.loads(Path('/private/tmp/seti-main-owned-v513-20261118.json').read_text())['root']);parent=json.loads((M/'cargo-suffix-v512-source-20261118-v1.json').read_text());old=json.loads((D/'native-route-facts-candidate-source-20261118-v1.json').read_text());files=[*parent['paths'],'randomizer/game/ai/resource-demand.js','randomizer/game/ai/main-owned-preparation.test.js'];paths={p:sha((r/p).read_bytes()) for p in files};out=M/'r4-main-owned-v513-source-20261118-v1.json'
if out.exists():
 done=json.loads(out.read_text())
 if done['paths']==paths:print('SOURCE_CHECKPOINT_REUSED',done['sealedRoot']);raise SystemExit
 delta={p for p,h in paths.items() if done['paths'].get(p)!=h};assert delta<= {'tools/audit_v_state_inputs.js','tools/browser-smoke-inventory.js'},'Only verification-only expectation/case revisions may amend the unpublished archive'
base=Path(tempfile.mkdtemp(prefix='seti-v513-git-parent-20261118-'));raw=subprocess.check_output(['git','archive',old['base'],'randomizer','tools','docs','assets/cards/card_model.json'],cwd=R)
with tarfile.open(fileobj=io.BytesIO(raw)) as a:a.extractall(base)
subprocess.run(['git','apply','--unidiff-zero',str(D/old['patch'])],cwd=base,check=True)
for p,f in old['fixtures'].items():t=base/p;t.parent.mkdir(parents=True,exist_ok=True);t.write_bytes((D/f).read_bytes())
subprocess.run(['git','apply','--unidiff-zero',str(R/parent['incrementalPatch'])],cwd=base,check=True)
for p,f in parent['fixtureMapping'].items():(base/p).write_bytes((R/f).read_bytes())
for p,h in parent['paths'].items():assert sha((base/p).read_bytes())==h,p
patch=[];changed=[]
for p in files:
 if p.endswith('.gz'):continue
 before=(base/p).read_bytes() if (base/p).exists() else b'';after=(r/p).read_bytes()
 if before==after:continue
 changed.append(p);patch.extend(difflib.unified_diff(before.decode().splitlines(True),after.decode().splitlines(True),fromfile='a/'+p if (base/p).exists() else '/dev/null',tofile='b/'+p,n=0))
pp=M/'r4-main-owned-v513-source-20261118-v1.patch';pp.write_text(''.join(patch));sealed=Path(tempfile.mkdtemp(prefix='seti-main-owned-v513-sealed-20261118-'));subprocess.run(['cp','-cR',str(base)+'/.',str(sealed)],check=True);subprocess.run(['git','apply','--unidiff-zero',str(pp)],cwd=sealed,check=True)
for p,h in paths.items():assert sha((sealed/p).read_bytes())==h,p
unchanged=0
for p in base.rglob('*'):
 if p.is_file() and str(p.relative_to(base)) not in paths:assert (sealed/p.relative_to(base)).read_bytes()==p.read_bytes();unchanged+=1
extra=json.loads((M/'r4-main-owned-v513-test-dependencies-20261118-v1.json').read_text());audit=json.loads((M/'r4-main-owned-v513-audit-dependencies-20261118-v1.json').read_text());dependencies=set(old['testDependenciesFromBase'])|set(parent['additionalTestDependenciesFromBase']['paths'])|set(extra['paths'])|set(audit['paths']);proof={}
for p in sorted(dependencies):
 data=subprocess.check_output(['git','show',old['base']+':'+p],cwd=R);t=sealed/p;t.parent.mkdir(parents=True,exist_ok=True);t.write_bytes(data);proof[p]=sha(data)
for p in changed:
 if p.endswith('.js'):subprocess.run(['node','--check',str(sealed/p)],check=True)
result={'candidate':'v513/resourcev29/movementv8/valuev71','promoted':False,'parentManifest':'reports/ai-foundation-20261118/cargo-suffix-v512-source-20261118-v1.json','parentManifestSha256':sha((M/'cargo-suffix-v512-source-20261118-v1.json').read_bytes()),'paths':paths,'sourceFilesVerified':len(paths),'verificationOnlyRevisionsAfterMeasurement':['tools/audit_v_state_inputs.js','tools/browser-smoke-inventory.js'],'measurementRuntimeUnchanged':True,'incrementalPatch':str(pp.relative_to(R)),'patchSha256':sha(pp.read_bytes()),'changedTextPaths':changed,'unchangedBaseFiles':unchanged,'testDependenciesFromBase':{'base':old['base'],'paths':proof},'sealedRoot':str(sealed),'restore':'Restore the v512 parent via its manifests, including Git card catalog; git apply --unidiff-zero incrementalPatch; restore named testDependenciesFromBase; verify every paths SHA. No shared runtime promotion.'};out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'sourceFiles':len(paths),'unchangedBaseFiles':unchanged,'changedText':len(changed),'testDependencies':len(proof),'sealed':str(sealed)}))
