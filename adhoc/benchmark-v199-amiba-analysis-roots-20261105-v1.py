from pathlib import Path
import hashlib,json,os,subprocess
stage=Path(__file__).resolve().parents[1];folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1');manifest='reports/ai-foundation-20261105/candidate-v199-amiba-analysis-20261105-v1/manifest.json'
rows=[{'label': 'actual-v197-after-orange1', 'fixture': 'reports/ai-foundation-20261105/third-round-teacher-v1/v197-actual-orange1-after-turn-root-20261105-v1.json'}, {'label': 'case-105', 'fixture': 'adhoc/ai-decision-corpus-20261023-v1/case-105-20261023-v1.json'}, {'label': 'teacher-039', 'fixture': 'reports/ai-foundation-20261104/two-rounds-teacher-v1/teacher-step-039-20261104-v1.json'}, {'label': 'teacher-r3-after-amiba-reveal', 'fixture': 'reports/ai-foundation-20261105/third-round-teacher-v1/teacher-r3-after-amiba-reveal-20261105-v1.json'}, {'label': 'teacher-r3-before-first-research', 'fixture': 'reports/ai-foundation-20261105/third-round-teacher-v1/teacher-r3-before-first-research-root-20261105-v1.json'}, {'label': 'teacher-r3-before-safety-protocol', 'fixture': 'reports/ai-foundation-20261105/third-round-teacher-v1/teacher-r3-before-safety-protocol-root-20261105-v1.json'}, {'label': 'teacher-r3-first-white', 'fixture': 'reports/ai-foundation-20261105/third-round-teacher-v1/teacher-r3-first-white-root-20261105-v1.json'}, {'label': 'teacher-r3-before-ready-analysis', 'fixture': 'reports/ai-foundation-20261105/third-round-teacher-v1/teacher-r3-before-ready-analysis-root-20261105-v1.json'}]
for row in rows:
 output=folder/f"v199-cold-{row['label']}-20261105-v1.json"
 if(stage/output).exists():
  r=json.loads((stage/output).read_text());assert r['candidateSourceManifest']==manifest
  print(json.dumps({'reused':True,'label':r['label'],'gate':r['decisionGatePassed']}),flush=True);continue
 log=folder/f"v199-cold-{row['label']}-20261105-v1.log";assert not(stage/log).exists()
 with(stage/log).open('wb')as stream:r=subprocess.run(['node','adhoc/benchmark-third-round-decision-20261105-v1.js',row['label'],row['fixture']],cwd=stage,env=dict(os.environ,SETI_CANDIDATE_SOURCE_MANIFEST=manifest),stdout=stream,stderr=subprocess.STDOUT,timeout=55)
 assert r.returncode==0,(stage/log).read_text()[:3000]
 d=json.loads((stage/output).read_text());print(json.dumps({k:d[k]for k in ['label','value','complete','nativeInputs','milliseconds','decisionGatePassed']}),flush=True)
