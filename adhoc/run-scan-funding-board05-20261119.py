"""One registered autonomous teaching game for the isolated known-scan funding hypothesis."""
from pathlib import Path
import hashlib,json,os,signal,subprocess,time

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'reports/ai-foundation-20261119'
MANIFEST=Path('/private/tmp/seti-scan-funding-20261119.json')
m=json.loads(MANIFEST.read_text())
runtime=Path(m['runtime'])
name='v492-known-scan-funding-board05-20261119'
scenario='free-analyze-random20-guarded-v1'
output=DATA/(name+'-execution-v1.json')
assert not output.exists(),'Existing attempt must be reused'
proof={'status':'preflight','runtime':str(runtime),'sourceCommit':m['sourceCommit'],
       'acceptedPolicy':'e08665e697909c61d8e39b70cb0b25e9850de31e',
       'hypothesis':'Only an exact income utility tie uses known paid-scan currency funding',
       'newRegisteredAutonomousGames':0,'startedEpochSeconds':time.time(),
       'preparationFailures':0}
def persist():output.write_text(json.dumps(proof,indent=2)+'\n')
persist()
try:
 assert m['sourceAdmittedForSingleExperiment']
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()==m['parent']
 for p,h in m['sourceHashes'].items():assert hashlib.sha256((runtime/p).read_bytes()).hexdigest()==h,p
 gate=json.loads((DATA/'v492-known-scan-funding-teaching-20261119-execution-v1.json').read_text());assert gate['status']=='completed' and gate['score']==272 and gate['maxNative']<=256 and gate['maxMilliseconds']<=600
 teacher=json.loads((runtime/gate['record']).read_text());base=json.loads((ROOT/'reports/research/327c52b2.e08665e6.full.json').read_text());strip=lambda r:{k:v for k,v in r.items()if k not in ['checkpointPath','checkpointSha256']}
 assert [strip(r)for r in teacher['roundEnds']]==[strip(r)for r in base['roundEnds']],'Teaching round asset regression'
 assert json.loads((runtime/teacher['savePath']).read_text())['replaySteps']==json.loads((ROOT/base['savePath']).read_text())['replaySteps']
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=runtime,text=True).strip()==m['sourceCommit']
 for directory in [ROOT/'reports/research',runtime/'reports/research']:
  if not directory.exists():continue
  for p in directory.glob('*.full.json'):
   r=json.loads(p.read_text())
   assert not((r.get('scenario')or{}).get('id')==scenario and r.get('gitCommit','missing')==m['sourceCommit']),str(p)
 listing=subprocess.run(['node','tools/run_research_validation.js','--list'],cwd=runtime,capture_output=True,text=True)
 assert listing.returncode==0,listing.stderr
 (DATA/(name+'-dedup-list-v1.log')).write_text(listing.stdout+listing.stderr)
 command=['node','tools/robot_iterate.js','run','--name',name,'--version-name','v492 已知扫描收入付款实验','--full','--seed','seti-analyze-5001578c1141','--config','agentType=search,scenario='+scenario+',compactReplay=true','--summary','Exact income tie chooses the cheaper known paid-scan funding. Original random20 board05; same deterministic setup; autonomous rounds1-4; passive opponents; no V72 weight change; compare to v486135.','--date','2026-11-19']
 proof.update(status='running',command=command,newRegisteredAutonomousGames=1);persist()
 with (DATA/(name+'-execution-v1.stdout.log')).open('x')as out,(DATA/(name+'-execution-v1.stderr.log')).open('x')as err:
  child=subprocess.Popen(command,cwd=runtime,stdout=out,stderr=err,start_new_session=True)
  proof['runnerPid']=child.pid;persist()
  try:code=child.wait(timeout=195)
  except subprocess.TimeoutExpired:
   os.killpg(child.pid,signal.SIGTERM)
   try:child.wait(timeout=1)
   except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait()
   code=124
 matches=[]
 for p in (runtime/'reports/research').glob('*.full.json'):
  r=json.loads(p.read_text())
  if r.get('name')==name:matches.append((p,r))
 assert len(matches)==1,[str(p)for p,r in matches]
 p,r=matches[0];searches=r.get('metrics',{}).get('searches',[])
 native=max((x['diagnostics']['nativeExecutions']for x in searches),default=0)
 ms=max((x['rootAndSearchMilliseconds']for x in searches),default=0)
 good=code==0 and r.get('terminal') and searches and all(x['complete']for x in searches) and native<=256 and ms<=600 and r['wallMs']<=180000
 proof.update(status='completed'if good else'failed',exitCode=code,record=str(p.relative_to(runtime)),
              terminal=r.get('terminal'),score=(r.get('summary')or{}).get('scores',{}).get('player-white'),
              steps=r.get('steps'),wallMs=r.get('wallMs'),maxNative=native,maxMilliseconds=ms,
              roundEnds=r.get('roundEnds',[]),failure=r.get('failure'),endedEpochSeconds=time.time())
 persist();print(json.dumps({k:v for k,v in proof.items()if k not in ['roundEnds','command']}))
except Exception as error:
 proof.update(status='failed',collectionFailure=repr(error));persist();raise
