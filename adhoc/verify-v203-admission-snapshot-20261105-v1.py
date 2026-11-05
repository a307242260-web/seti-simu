from pathlib import Path
import hashlib,io,json,re,subprocess,tarfile,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1');base='85c78b17248df28e13406319c085abc85549b080';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();m=json.loads((stage/'reports/ai-foundation-20261105/candidate-v203-fixed-analysis-20261105-v1/manifest.json').read_text());out=stage/folder/'v203-admission-independent-snapshot-20261105-v1.json';assert not out.exists()
owned={n for n in m['sourceHashes']if n.startswith(('randomizer/','tools/'))}|{'tools/research-human405-round1.js','tools/run_research_validation.js','tools/research-human405-third.test.js'}
for n,h in m['baseRuntimeHashes'].items():assert sha(stage/n)==m['sourceHashes'].get(n,h),n
for n,h in m['sourceHashes'].items():
 if n.startswith('randomizer/'):assert sha(stage/n)==h,n
proof=json.loads((stage/folder/'v203-independent-candidate-verification-20261105-v1.json').read_text());fixtures=set(proof['fixtureHashes'])
tests=['randomizer/game/state/state-store.test.js']+[f'randomizer/game/ai/{x}.test.js'for x in ['amiba-analysis-capital','known-symbol-capital','research-trigger-capital','research-mark-capital','computer-prefix-plan','stationary-computer-tail','winning-income-plan','probe-capital-value','probe-data-capital-key','ready-analysis-capital','settled-tech-funding','income-plan-value']]+[f'tools/{x}.test.js'for x in ['research-human405-round1','research-human405-first2','research-human405-full','research-human405-third','research-world-resume','research-search-statistics']]
scan=tests+['tools/research-human405-round1.js','tools/research-human405-full.js']
for name in scan:fixtures.update(re.findall(r"((?:reports|adhoc|seti-saves)/[^'\"\n]+?\.json(?:\.gz|l)?)",(stage/name).read_text()))
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
snapshot=Path(tempfile.mkdtemp(prefix='seti-v203-admission-clean-'));tracked=[];additional=[]
for name in sorted(fixtures):
 r=subprocess.run(['git','cat-file','-e',base+':'+name],cwd=repo,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);(tracked if r.returncode==0 else additional).append(name)
archive=subprocess.check_output(['git','archive','--format=tar',base,'randomizer','tools','assets',*tracked],cwd=repo)
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
 log=folder/f'v203-admission-independent-{number+1:02d}-{Path(name).stem}-20261105-v1.log';assert not(stage/log).exists();r=subprocess.run(['node',name],cwd=snapshot,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=60);(stage/log).write_bytes(r.stdout);assert r.returncode==0,r.stdout.decode();logs[str(log)]=sha(stage/log)
r={'status':'passed','baseCommit':base,'snapshot':str(snapshot),'runtimeByteIdenticalToFrozenV203':True,'ownedSourceHashes':{n:sha(stage/n)for n in sorted(owned)},'fixtureHashes':{n:sha(stage/n)for n in sorted(fixtures)},'logsSha256':logs,'testsPassed':len(tests),'newAutonomousRuns':0,'scope':'Clean committed production tree plus exact final AI/tool overlay, 13 native value/search tests and six standard research host/identity tests. Same frozen V203 runtime as all314 root samples; no legacy/runtime fallback added.'};out.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'out':str(out.relative_to(stage)),'status':'passed','tests':len(tests),'fixtures':len(fixtures),'snapshot':str(snapshot)}))
