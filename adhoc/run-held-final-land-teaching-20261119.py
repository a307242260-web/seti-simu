"""One registered R4 continuation, with a verified teacher-controlled prefix."""
import hashlib,json,os,signal,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'reports/ai-foundation-20261119'
M=Path('/private/tmp/seti-r4-held-land-20261119.json');m=json.loads(M.read_text());runtime=Path(m['runtime'])
name='v489-held-final-land-teaching-20261119';scenario='human405-white-current-full-v1'
output=DATA/(name+'-execution-v1.json');assert not output.exists(),'Existing attempt must be reused, never rerun'
state={'schemaVersion':'seti-funded-scan-launch-teaching-execution-v1','status':'preflight','runtime':str(runtime),'experimentCommit':m['sourceCommit'],'policyCommit':m['sourceCommit'],'acceptedBaselineCommit':'94299f385450f80f2720b3dc0d15ea92c9d771f7','strategyChanged':True,'newRegisteredAutonomousGames':0,'controlledTeacherRounds':[],'autonomousScope':'rounds1-4','startedEpochSeconds':time.time()}
def persist():output.write_text(json.dumps(state,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
persist()
try:
 assert m['sourcePushed'];assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip()==m['sourceCommit']
 subprocess.check_call(['git','update-ref','refs/heads/dev',m['sourceCommit']],cwd=runtime)
 subprocess.check_call(['git','symbolic-ref','HEAD','refs/heads/dev'],cwd=runtime)
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=runtime).decode().strip()==m['sourceCommit']
 for p,h in m['sourceHashes'].items():
  if not p.startswith('reports/'):assert sha(runtime/p)==h,p
 for p,h in m['sourceHashes'].items():
  if not p.startswith('reports/'):assert sha(runtime/p)==h,p
 duplicates=[]
 for directory in [ROOT/'reports/research',runtime/'reports/research']:
  for file in directory.glob('*.json'):
   try:r=json.loads(file.read_text())
   except (ValueError,UnicodeError):continue
   if (r.get('scenario')or{}).get('id')==scenario and (r.get('gitCommit','')==m['sourceCommit'] or m['sourceCommit'].startswith(r.get('gitCommit','missing'))):duplicates.append(str(file))
 assert not duplicates,duplicates
 state['existingRecordsCheckedForDuplicate']=True;persist()
 # Keep this isolated catalog bounded to this experiment. The published catalog
 # is merged separately, preserving every existing entry and generation.
 p=runtime/'reports/iteration/versions.json';p.parent.mkdir(parents=True,exist_ok=True)
 catalog=json.loads(subprocess.check_output(['git','show',m['sourceCommit']+':reports/iteration/versions.json'],cwd=ROOT));catalog['versions']=[];p.write_text(json.dumps(catalog,indent=2)+'\n')
 listed=subprocess.run(['node','tools/run_research_validation.js','--list'],cwd=runtime,capture_output=True,text=True,timeout=20);assert listed.returncode==0,listed.stderr
 (DATA/(name+'-dedup-list-v1.log')).write_text(listed.stdout+listed.stderr)
 command=['node','tools/robot_iterate.js','run','--name',name,'--version-name','v489 末轮手牌登陆自主教学整局','--full','--seed','seti-free-analyze-v1','--config','agentType=search,scenario='+scenario+',compactReplay=true','--summary','Candidate v489: named route to a planet with held conditional-return free landing card; protect landing supplier and use existing greedy movement payments. Same23-input opening, autonomous rounds1-4, passive opponents, evaluator unchanged.','--date','2026-11-19']
 state.update(command=command,status='running',newRegisteredAutonomousGames=1);persist()
 stdout=DATA/(name+'-execution-v1.stdout.log');stderr=DATA/(name+'-execution-v1.stderr.log')
 with stdout.open('x')as out,stderr.open('x')as err:
  childEnv=dict(os.environ)
  child=subprocess.Popen(command,cwd=runtime,stdout=out,stderr=err,start_new_session=True,env=childEnv);state['runnerPid']=child.pid;persist()
  try:code=child.wait(timeout=195)
  except subprocess.TimeoutExpired:
   os.killpg(child.pid,signal.SIGTERM)
   try:child.wait(timeout=1)
   except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait()
   code=124
 matches=[]
 for file in (runtime/'reports/research').glob('*.full.json'):
  r=json.loads(file.read_text())
  if r.get('name')==name:matches.append((file,r))
 assert len(matches)==1,[str(p)for p,_ in matches]
 file,r=matches[0];searches=r.get('metrics',{}).get('searches',[])
 native=max((x['diagnostics']['nativeExecutions']for x in searches),default=0);ms=max((x['rootAndSearchMilliseconds']for x in searches),default=0)
 state.update(exitCode=code,record=str(file.relative_to(runtime)),terminal=r.get('terminal'),score=(r.get('summary')or{}).get('scores',{}).get('player-white'),steps=r.get('steps'),newInputs=r.get('steps',23)-23,wallMs=r.get('wallMs'),maxNative=native,maxMilliseconds=ms,roundEnds=r.get('roundEnds',[]),failure=r.get('failure'),endedEpochSeconds=time.time())
 good=code==0 and r.get('terminal') and searches and all(x['complete']for x in searches) and native<=256 and ms<=600 and r['wallMs']<=180000
 state['status']='completed'if good else'failed';persist();print(json.dumps({k:v for k,v in state.items()if k not in ['command','roundEnds']},ensure_ascii=False),flush=True)
except Exception as error:state.update(status='failed',collectionFailure=repr(error));persist();raise
