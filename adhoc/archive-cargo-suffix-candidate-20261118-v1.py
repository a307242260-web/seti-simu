"""Seal the isolated candidate using archived parent sources, never the shared index."""
from pathlib import Path
import difflib,hashlib,io,json,subprocess,tarfile,tempfile
repo=Path(__file__).resolve().parents[1];M=repo/'reports/ai-foundation-20261118';D=repo/'reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1';sha=lambda b:hashlib.sha256(b).hexdigest()
r=Path(json.loads(Path('/private/tmp/seti-cargo-whole-suffix-20261118.json').read_text())['root']);baseManifest=D/'native-route-facts-candidate-source-20261118-v1.json';old=json.loads(baseManifest.read_text());out=M/'cargo-suffix-v512-source-20261118-v1.json'
new=['randomizer/game/ai/cargo-task-assignment.test.js','randomizer/game/ai/cargo-unbound-suffix.test.js','randomizer/game/ai/fixtures/cargo-unbound-suffix-20261118-v1.json.gz'];asset='assets/cards/card_model.json';paths={p:sha((r/p).read_bytes()) for p in [*old['paths'],*new,asset]};assert (r/asset).read_bytes()==subprocess.check_output(['git','show',old['base']+':'+asset],cwd=repo)
if out.exists():
 done=json.loads(out.read_text())
 if done['paths']==paths:
  for rel,h in done.get('additionalTestDependenciesFromBase',{}).get('paths',{}).items():
   target=Path(done['sealedRoot'])/rel;data=subprocess.check_output(['git','show',old['base']+':'+rel],cwd=repo);assert sha(data)==h;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
  print('SOURCE_CHECKPOINT_REUSED',done['sealedRoot']);raise SystemExit
 assert len(done['paths'])==46 and all(paths[p]==h for p,h in done['paths'].items()),'Only missing catalog dependency may amend the unpublished manifest'
base=Path(tempfile.mkdtemp(prefix='seti-cargo-v512-parent-20261118-'));raw=subprocess.check_output(['git','archive',old['base'],'randomizer','tools','docs',asset],cwd=repo)
with tarfile.open(fileobj=io.BytesIO(raw)) as archive:archive.extractall(base)
subprocess.run(['git','apply','--unidiff-zero',str(D/old['patch'])],cwd=base,check=True)
for p,f in old['fixtures'].items():target=base/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((D/f).read_bytes())
for p,h in old['paths'].items():assert sha((base/p).read_bytes())==h,p
patch=[];changed=[]
for p in paths:
 if p.endswith('.gz'):continue
 before=(base/p).read_bytes() if (base/p).exists() else b'';after=(r/p).read_bytes()
 if before==after:continue
 changed.append(p);patch.extend(difflib.unified_diff(before.decode().splitlines(True),after.decode().splitlines(True),fromfile='a/'+p if (base/p).exists() else '/dev/null',tofile='b/'+p,n=0))
pp=M/'cargo-suffix-v512-source-20261118-v1.patch';pp.write_text(''.join(patch));newFixture=M/'cargo-unbound-suffix-fixture-20261118-v1.json.gz';newFixture.write_bytes((r/new[-1]).read_bytes())
sealed=Path(tempfile.mkdtemp(prefix='seti-cargo-v512-sealed-20261118-'));subprocess.run(['cp','-cR',str(base)+'/.',str(sealed)],check=True);subprocess.run(['git','apply','--unidiff-zero',str(pp)],cwd=sealed,check=True);(sealed/new[-1]).write_bytes(newFixture.read_bytes())
for p,h in paths.items():assert sha((sealed/p).read_bytes())==h,p
unchanged=0
for p in base.rglob('*'):
 if p.is_file() and str(p.relative_to(base)) not in old['paths']:
  assert (sealed/p.relative_to(base)).read_bytes()==p.read_bytes();unchanged+=1
for p in old['testDependenciesFromBase']:
 target=sealed/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(subprocess.check_output(['git','show',old['base']+':'+p],cwd=repo))
for p in changed:
 if p.endswith('.js'):subprocess.run(['node','--check',str(sealed/p)],check=True)
result={'candidate':'v512/movementv8/valuev71','promoted':False,'baseManifest':str(baseManifest.relative_to(repo)),'baseManifestSha256':sha(baseManifest.read_bytes()),'paths':paths,'incrementalPatch':str(pp.relative_to(repo)),'patchSha256':sha(pp.read_bytes()),'fixtureMapping':{new[-1]:str(newFixture.relative_to(repo))},'changedTextPaths':changed,'unchangedBaseFiles':unchanged,'allSourceFilesVerified':len(paths)==47,'sourceFileCount':len(paths),'runtimeAssetsFromBase':{asset:paths[asset]},'initialRestoreFailure':'Initial eight tests failed because catalog was omitted and parent relied on an external assets symlink. Restored exact base Git catalog; no runtime change.','sealedRoot':str(sealed),'restore':'Restore parent using its manifest, then git apply --unidiff-zero incrementalPatch; copy fixtureMapping and verify paths. Historical test dependencies and runtimeAssetsFromBase come from parent base. No formal runtime changes.'};out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'files':len(paths),'unchanged':unchanged,'changedText':len(changed),'sealed':str(sealed),'patchBytes':pp.stat().st_size}))
