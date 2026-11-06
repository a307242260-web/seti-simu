from pathlib import Path
import subprocess,json,hashlib
P=Path(__file__).resolve().parents[1];D=P/'reports/ai-foundation-20261107/autonomous-first3-harness-v1';sha=lambda b:hashlib.sha256(b).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=P)
base=git('rev-parse','HEAD').decode().strip();assert base=='dc540a52f7210f4ae73135bdb0cd06bf5d188244'
# Reuse this isolated tree to verify the exact Production runtime. The complete
# candidate bytes are restored in finally; shared ROOT and its index are untouched.
names=git('diff','--name-only','HEAD','--','randomizer').decode().splitlines()+['tools/node-test-inventory.js']
backups={n:(P/n).read_bytes() for n in names};assert not (D/'production-validation-20261107-v1.json').exists()
entry='    entry("tools/research-human405-first3.test.js", "training/reporting", "原23输入完整Native信封/RNG开局、独立自主前三轮身份、轮末选牌收入前资产及正常失败去重", "teacher112冒充自主开局、R4收入污染R3分数和资产、失败重复或临时成绩进入终局榜"),\n'
try:
 for n in names:(P/n).write_bytes(git('show','HEAD:'+n))
 inv=P/'tools/node-test-inventory.js';s=inv.read_text();needle='    entry("tools/research-human405-third.test.js"';assert needle in s;inv.write_text(s.replace(needle,entry+needle,1))
 production={}
 for n in git('ls-tree','-r','--name-only','HEAD','--','randomizer').decode().splitlines():
  if not n.endswith(('.js','.html','.css')):continue
  expected=git('show','HEAD:'+n);actual=(P/n).read_bytes();assert expected==actual,n;production[n]=sha(actual)
 changed=json.loads((D/'before-hashes-20261107-v1.json').read_text());owned=list(changed)+['tools/research-human405-first3.test.js']
 sourceHashes={n:sha((P/n).read_bytes()) for n in owned}
 for n in owned:
  if n.endswith('.js'):subprocess.run(['node','--check',n],cwd=P,check=True)
 cmd=['node','tools/run_node_tests.js','--match','research-human405','--match','robot-ai-generation','--match','robot-report-link','--match','robot-report-replay']
 with (D/'related-node-production-20261107-v1.log').open('w') as log:result=subprocess.run(cmd,cwd=P,stdout=log,stderr=subprocess.STDOUT)
 assert result.returncode==0,result.returncode
 for n,h in sourceHashes.items():assert sha((P/n).read_bytes())==h,n
 for n,h in production.items():assert sha((P/n).read_bytes())==h,n
 for n in owned:
  dest=D/'source-snapshot'/n;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((P/n).read_bytes())
 (D/'production-validation-20261107-v1.json').write_text(json.dumps({'productionRuntimeCommit':base,'productionRuntimeHashes':production,'sourceHashes':sourceHashes,'command':cmd,'relatedLog':'reports/ai-foundation-20261107/autonomous-first3-harness-v1/related-node-production-20261107-v1.log','syntaxChecks':'all owned JS','newAutonomousRuns':0,'newAiQueries':0,'sharedRootUnchanged':True,'complete':True},indent=2)+'\n')
 print(json.dumps({'productionRuntimeFiles':len(production),'ownedFiles':len(owned),'complete':True}))
finally:
 for n,b in backups.items():(P/n).write_bytes(b)
 for n,b in backups.items():assert (P/n).read_bytes()==b,n
