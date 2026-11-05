"""Rebuild committed production plus frozen V203 overlay; verify affected native behavior."""
from pathlib import Path
import hashlib,io,json,re,subprocess,tarfile,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1');manifest_path=Path('reports/ai-foundation-20261105/candidate-v203-fixed-analysis-20261105-v1/manifest.json');manifest=json.loads((stage/manifest_path).read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();output=stage/folder/'v203-independent-candidate-verification-20261105-v1.json'
if output.exists():
 r=json.loads(output.read_text());assert r['manifestSha256']==sha(stage/manifest_path)
 for n,h in r['logsSha256'].items():assert sha(stage/n)==h
 print(json.dumps({'reused':True,'output':str(output.relative_to(stage))}));raise SystemExit(0)
fixtures_extra={'reports/ai-foundation-20261105/third-round-teacher-v1/teacher-before-input-160-20261105-v1.checkpoint.json','reports/ai-foundation-20261105/third-round-teacher-v1/teacher-before-input-163-20261105-v1.checkpoint.json','reports/ai-foundation-20261105/third-round-teacher-v1/teacher-before-input-133-20261105-v1.checkpoint.json','reports/ai-foundation-20261105/third-round-teacher-v1/teacher-before-input-136-20261105-v1.checkpoint.json'}
labels=['state-store','amiba-analysis-capital','known-symbol-capital','research-trigger-capital','research-mark-capital','computer-prefix-plan','stationary-computer-tail','winning-income-plan','probe-capital-value','probe-data-capital-key','ready-analysis-capital','settled-tech-funding','income-plan-value'];fixtures=set(fixtures_extra)
test_path=lambda label: 'randomizer/game/state/state-store.test.js' if label=='state-store' else f'randomizer/game/ai/{label}.test.js'
for label in labels:
 text=(stage/test_path(label)).read_text()
 fixtures.update(re.findall(r"((?:reports|adhoc|seti-saves)/[^'\"\n]+?\.json(?:\.gz)?)",text))
# Recorded controls sometimes name the original native fixture in their JSON.
pending=list(fixtures)
while pending:
 name=pending.pop();assert (stage/name).is_file(),name
 if name.endswith('.gz'):continue
 def visit(v):
  if isinstance(v,dict):
   for x in v.values():visit(x)
  elif isinstance(v,list):
   for x in v:visit(x)
  elif isinstance(v,str)and v.startswith(('reports/','adhoc/','seti-saves/'))and v.endswith(('.json','.json.gz'))and(stage/v).is_file()and v not in fixtures:fixtures.add(v);pending.append(v)
 visit(json.loads((stage/name).read_text()))
snapshot=Path(tempfile.mkdtemp(prefix='seti-v203-clean-candidate-'));tracked=[];additional=[]
for name in sorted(fixtures):
 r=subprocess.run(['git','cat-file','-e',manifest['baseCommit']+':'+name],cwd=repo,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 (tracked if r.returncode==0 else additional).append(name)
archive=subprocess.check_output(['git','archive','--format=tar',manifest['baseCommit'],'randomizer','assets/cards/card_model.json',*tracked],cwd=repo)
with tarfile.open(fileobj=io.BytesIO(archive))as stream:
 for member in stream.getmembers():assert not Path(member.name).is_absolute()and'..'not in Path(member.name).parts and(member.isfile()or member.isdir()),member.name
 stream.extractall(snapshot)
for name in additional:
 p=snapshot/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/name).read_bytes())
for name,h in manifest['sourceHashes'].items():
 source=stage/manifest_path.parent/name;assert sha(source)==h,name
 p=snapshot/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(source.read_bytes())
 if name.endswith('.js'):subprocess.run(['node','--check',name],cwd=snapshot,check=True)
for name,h in manifest['baseRuntimeHashes'].items():assert sha(snapshot/name)==manifest['sourceHashes'].get(name,h),name
for name in fixtures:assert sha(snapshot/name)==sha(stage/name),name
logs={}
for label in labels:
 log=folder/f'v203-independent-{label}-20261105-v1.log';assert not(stage/log).exists()
 r=subprocess.run(['node',test_path(label)],cwd=snapshot,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=55);(stage/log).write_bytes(r.stdout);assert r.returncode==0,r.stdout.decode();logs[str(log)]=sha(stage/log)
r={'status':'passed','candidateAdmitted':False,'baseCommit':manifest['baseCommit'],'manifest':str(manifest_path),'manifestSha256':sha(stage/manifest_path),'snapshot':str(snapshot),'allBaseRuntimeAndOverlayHashesMatched':True,'fixtureHashes':{n:sha(snapshot/n)for n in sorted(fixtures)},'additionalNativeEvidenceFixtures':additional,'logsSha256':logs,'productionChanged':False,'newAutonomousRuns':0,'scope':'Thirteen affected native behavior tests on clean committed runtime plus byte-exact archived overlay; not full source admission.'};output.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'output':str(output.relative_to(stage)),'status':'passed','tests':len(logs),'fixtures':len(fixtures)}))
