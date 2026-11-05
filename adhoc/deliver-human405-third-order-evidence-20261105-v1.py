"""Deliver only the new native three-action order control and its review."""
from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='5c53576bc58e8ad4b6164e2f60c6b4124c2e5615';folder='reports/ai-foundation-20261105/third-round-teacher-v1/';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args,data=None,private=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if private:env['GIT_INDEX_FILE']=private
 return subprocess.check_output(['git',*args],cwd=repo,input=data,env=env)
assert git('rev-parse','HEAD').decode().strip()==base and git('symbolic-ref','--short','HEAD').decode().strip()=='dev';shared=sha(repo/'.git/index');assert shared=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49'
manifest=json.loads((stage/'reports/ai-foundation-20261105/candidate-v197-stationary-prefix-20261105-v1/manifest.json').read_text())
for n,h in manifest['sourceHashes'].items():assert sha(stage/n)==h,n
reference=json.loads((stage/'reports/ai-foundation-20261104/two-rounds-teacher-v2/v189-first2-result-source-check-20261105-v1.json').read_text())
for n,h in reference['runtimeSourceHashes'].items():assert sha(repo/n)==h,n
r=json.loads((stage/folder/'v197-known-research-order-control-20261105-v2.json').read_text());assert r['inputs']==28 and r['rootAndRngRestored']and r['newAutonomousRuns']==0
rows=r['rows'];assert [v['after']['score']for v in rows]==[60,56]and[v['after']['maskedHandValue']['total']for v in rows]==[111,108]
ends=[]
for row in rows:
 assert sha(stage/row['endpointPath'])==row['endpointSha256'];ends.append(json.loads((stage/row['endpointPath']).read_text())['coreState']['compositionEnvelope'])
assert ends[0]==json.loads((stage/folder/'known-amiba-teacher-after140-20261105-v1.checkpoint.json').read_text())['coreState']['compositionEnvelope']
players=[next(p for p in json.loads(e['committedState'])['players']['players']if p['id']=='player-white')for e in ends];assert players[0]['techState']==players[1]['techState']and players[0]['income']==players[1]['income']
for key in ['credits','energy','publicity','availableData']:assert players[0]['resources'][key]==players[1]['resources'][key]
files={'docs/ai-design.md','docs/human405-third-round-plan-20261105.md','docs/human405-third-round-trigger-review-20261105.md','adhoc/human405-third-round-progress-20261105-v5.json','adhoc/control-human405-third-research-order-20261105-v1.js','adhoc/deliver-human405-third-order-evidence-20261105-v1.py'}
files.update(folder+n for n in ['v197-order-teacher-after-three-actions-20261105-v1.checkpoint.json','v197-order-teacher-after-three-actions-20261105-v2.checkpoint.json','v197-order-held-first-after-three-actions-20261105-v2.checkpoint.json','v197-research-order-harness-failure-20261105-v1.json','v197-known-research-order-control-cli-20261105-v1.log','v197-known-research-order-control-cli-20261105-v2.log','v197-known-research-order-control-20261105-v2.json','v197-research-order-independent-check-20261105-v1.json'])
for n in files:
 source=stage/n;assert source.is_file();target=repo/n
 if target.exists():assert target.read_bytes()==git('show',base+':'+n),'foreign overlap '+n
 if n.endswith('.js'):subprocess.run(['node','--check',n],cwd=stage,check=True)
 if n.endswith('.py'):compile(source.read_text(),n,'exec')
 if n.endswith('.json'):json.loads(source.read_text())
if os.environ.get('SETI_DELIVER_THIRD_ORDER_EVIDENCE')!='1':print(json.dumps({'preflight':'passed','files':len(files),'nativeControlInputs':28,'productionChanged':False}));raise SystemExit(0)
private=str(Path(tempfile.mkdtemp(prefix='seti-third-order-evidence-index-'))/'index');git('read-tree',base,private=private)
for n in sorted(files):
 h=git('hash-object','-w','--stdin',data=(stage/n).read_bytes(),private=private).decode().strip();git('update-index','--add','--cacheinfo','100644',h,n,private=private)
assert set(git('diff','--cached','--name-only',base,private=private).decode().splitlines())==files
git('diff','--cached','--check',private=private);tree=git('write-tree',private=private).decode().strip()
for n in files:assert git('show',tree+':'+n)==(stage/n).read_bytes()
for n in files:
 p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
git('commit','-m','验证第三轮研究顺序导致的区域符号奖励损失',private=private);commit=git('rev-parse','HEAD').decode().strip();assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(repo/'.git/index')==shared and not git('diff','--name-only',base,commit,'--','randomizer','tools','assets').strip()
for n,h in reference['runtimeSourceHashes'].items():assert sha(repo/n)==h,n
result={'commit':commit,'privateIndex':private,'stage':str(stage),'files':len(files),'productionChanged':False,'goalStatus':'active','newAutonomousRuns':0};Path('/private/tmp/seti-human405-third-order-delivery-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
