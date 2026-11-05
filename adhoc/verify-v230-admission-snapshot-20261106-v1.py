from pathlib import Path
import hashlib,io,json,re,subprocess,tarfile,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1');base='00a48d10b62c39ff9f17a8f58d0500e52eb1c7d1';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();m=json.loads((stage/'reports/ai-foundation-20261106/candidate-v230-negative-tail-purpose-guard-v1/manifest.json').read_text());out=stage/folder/'v230-admission-independent-snapshot-20261106-v1.json';assert not out.exists()
expected=m['sourceHashes']
owned=set(m['sourceHashes'])
for n,h in m['baseRuntimeHashes'].items():assert sha(stage/n)==expected.get(n,h),n
for n,h in expected.items():assert sha(stage/n)==h,n
fixtures=set()
tests=[f'randomizer/game/ai/{x}.test.js' for x in ['fixed-tail-purpose-guard','amiba-blind-income','scan-launch-plan','amiba-quiet-end','amiba-currency-tail','analysis-port','computer-prefix-plan','research-mark-capital','research-trigger-capital','computer-preinvestment','ready-analysis-capital','amiba-analysis-capital','known-symbol-capital','sector-card-capital','sector-mission-composition','known-movement-tool','stationary-computer-tail','income-plan-value','quiet-data-tail','resource-demand']]+['randomizer/game/end-game-scoring.test.js','randomizer/game/data/data.test.js','randomizer/game/ai/amiba-analysis-capital.test.js','tools/research-human405-third.test.js','randomizer/full-flow/standard-flow.test.js']
tests=list(dict.fromkeys(tests))
scan=tests+['tools/research-human405-round1.js','tools/research-human405-full.js']
for name in scan:
 source=(stage/name).read_text()
 fixtures.update(re.findall(r"((?:reports|adhoc|seti-saves)/[^'\"\n]+?\.json(?:\.gz|l)?)",source))
 for base_folder in re.findall(r"\bfolder\s*=\s*['\"]((?:reports|adhoc|seti-saves)/[^'\"]+/)['\"]",source):
  fixtures.update(base_folder+n for n in re.findall(r"read\(folder\s*\+\s*['\"]([^'\"]+\.json)['\"]",source))

pending=list(fixtures)
while pending:
 name=pending.pop();assert(stage/name).is_file(),name
 if name.endswith(('.gz','.jsonl')):continue
 def visit(value):
  if isinstance(value,dict):
   for x in value.values():visit(x)
  elif isinstance(value,list):
   for x in value:visit(x)
  elif isinstance(value,str)and value.startswith(('reports/','adhoc/','seti-saves/'))and value.endswith(('.json','.json.gz','.jsonl'))and(stage/value).is_file()and value not in fixtures:fixtures.add(value);pending.append(value)
 visit(json.loads((stage/name).read_text()));assert len(fixtures)<2500,'unexpected dependency fanout'
snapshot=Path(tempfile.mkdtemp(prefix='seti-v230-admission-clean-'));tracked=[];additional=[]
for name in sorted(fixtures):
 r=subprocess.run(['git','--no-optional-locks','cat-file','-e',base+':'+name],cwd=repo,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);(tracked if r.returncode==0 else additional).append(name)
archive=subprocess.check_output(['git','--no-optional-locks','archive','--format=tar',base,'randomizer','tools','assets',*tracked],cwd=repo)
with tarfile.open(fileobj=io.BytesIO(archive))as stream:
 for member in stream.getmembers():assert not Path(member.name).is_absolute()and'..'not in Path(member.name).parts and(member.isfile()or member.isdir())
 stream.extractall(snapshot)
for name in additional:
 target=snapshot/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((stage/name).read_bytes())
for name in sorted(owned):
 target=snapshot/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((stage/name).read_bytes());assert sha(target)==sha(stage/name)
 if name.endswith('.js'):subprocess.run(['node','--check',name],cwd=snapshot,check=True)
for name in fixtures:assert sha(stage/name)==sha(snapshot/name)
logs={}
for number,name in enumerate(tests):
 log=folder/f'v230-admission-independent-{number+1:02d}-{Path(name).stem}-20261106-v1.log';assert not(stage/log).exists();r=subprocess.run(['node',name],cwd=snapshot,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=60);(stage/log).write_bytes(r.stdout);assert r.returncode==0,r.stdout.decode();logs[str(log)]=sha(stage/log)
r={'status':'passed','baseCommit':base,'snapshot':str(snapshot),'runtimeByteIdenticalToFrozenV230':True,'runtimeUnchangedAfterColdGates':True,'ownedSourceHashes':{n:sha(stage/n)for n in sorted(owned)},'fixtureHashes':{n:sha(stage/n)for n in sorted(fixtures)},'logsSha256':logs,'testsPassed':len(tests),'newAutonomousRuns':0,'scope':'Clean 00a48d10 committed production plus exact twelve V230 source/test/tool overlays. Twenty-four affected native ledger/search/domain/research-host/full-flow tests, including funded scan launch, exact identity and public-Amiba end, negative bound blue goals, exact stationary objective query and actual blind-income boundary; no autonomous game. Full runtime and fixture hashes retained.'};out.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'out':str(out.relative_to(stage)),'status':'passed','tests':len(tests),'fixtures':len(fixtures),'snapshot':str(snapshot)}))
