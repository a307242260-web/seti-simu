# coding: utf-8
import pathlib,json,hashlib
stage=pathlib.Path.cwd()
s=pathlib.Path('adhoc/deliver-fixed-decisions-20261028-v1.py').read_text()
for a,b in {
 '/private/tmp/seti-fixed-decisions-20261028-jpodyn9s':str(stage),
 'adhoc/fixed-decisions-snapshot-20261028.json':'adhoc/data-plan-no-borrow-snapshot-20261028.json',
 'fixed-decisions-snapshot-check-20261028-v1.json':'data-plan-no-borrow-snapshot-check-20261028-v1.json',
 'SETI_DELIVER_FIXED_DECISIONS':'SETI_DELIVER_DATA_PLAN_NO_BORROW',
 'seti-fixed-decisions-private-20261028.index':'seti-data-plan-no-borrow-private-20261028.index',
 'fixed-decisions-commit-message-20261028.txt':'data-plan-no-borrow-commit-message-20261028.txt',
 '固定终局标记与扫描目的并减少可信分支恢复复制':'暂禁AI借科技并将数据收入奖励固定在计划内执行',
}.items():
 assert a in s,a
 s=s.replace(a,b)
pathlib.Path('adhoc/deliver-data-plan-no-borrow-20261028-v1.py').write_text(s)
files=[
 'randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/resource-demand.js',
 'randomizer/game/ai/fixed-data-plan.test.js','randomizer/game/ai/post-main-borrow.test.js','randomizer/game/ai/search-agent.test.js',
 'randomizer/index.html','tools/node-test-inventory.js','tools/browser-smoke-inventory.js','tools/audit_v_state_inputs.js',
 'docs/ai-fixed-data-no-borrow-20261028.md','docs/ai-local-decisions-20261028.md','docs/ai-search-agent-contract-20261023.md','docs/ai-development-workflow.md',
 'adhoc/data-plan-no-borrow-design-20261028-v1.md','adhoc/audit-data-plan-no-borrow-case062-20261028-v2.js','adhoc/audit-data-plan-no-borrow-corpus-20261028-v2.js',
 'adhoc/finalize-data-plan-no-borrow-20261028-v1.py','adhoc/prepare-data-plan-no-borrow-delivery-20261028-v1.py','adhoc/deliver-data-plan-no-borrow-20261028-v1.py',
]
p='reports/ai-foundation-20261023/data-plan-no-borrow-final-20261028-v1.json';final=json.loads(pathlib.Path(p).read_text());files.append(p)
reports=[r['path'] for r in final['checkpoints']]
files.extend(reports);files.extend(r['path'] for r in final['validation']['logs'].values());files.extend(r['rawPath'] for r in final['rows']);files=list(dict.fromkeys(files))
manifest=pathlib.Path('adhoc/data-plan-no-borrow-snapshot-20261028.json');m=json.loads(manifest.read_text());m['files']={p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in files};m['sourceBoundReports']=reports+[p];manifest.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'files':len(files)}))
