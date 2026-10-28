# coding: utf-8
import pathlib,json,hashlib
stage=pathlib.Path.cwd();s=pathlib.Path('adhoc/deliver-data-plan-no-borrow-20261028-v1.py').read_text()
for a,b in {
 '/private/tmp/seti-data-plan-no-borrow-20261028-io4yfpla':str(stage),
 'adhoc/data-plan-no-borrow-snapshot-20261028.json':'adhoc/six-greedy-plans-snapshot-20261028.json',
 'data-plan-no-borrow-snapshot-check-20261028-v1.json':'six-greedy-plans-snapshot-check-20261028-v1.json',
 'SETI_DELIVER_DATA_PLAN_NO_BORROW':'SETI_DELIVER_SIX_GREEDY_PLANS',
 'seti-data-plan-no-borrow-private-20261028.index':'seti-six-greedy-plans-private-20261028.index',
 'data-plan-no-borrow-commit-message-20261028.txt':'six-greedy-plans-commit-message-20261028.txt',
 '暂禁AI借科技并将数据收入奖励固定在计划内执行':'将六类准备与奖励选择收束为贪心执行计划',
}.items():
 assert a in s,a
 s=s.replace(a,b)
pathlib.Path('adhoc/deliver-six-greedy-plans-20261028-v1.py').write_text(s)
files=[
 'randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/resource-demand.js','randomizer/game/ai/local-decision-plans.js',
 'randomizer/game/ai/six-greedy-plans.test.js','randomizer/game/ai/shared-resource-prefix.test.js','randomizer/game/effects/residual-domain-session.js','randomizer/index.html',
 'tools/node-test-inventory.js','tools/browser-smoke-inventory.js','tools/audit_v_state_inputs.js',
 'docs/ai-six-greedy-plans-20261028.md','docs/ai-development-workflow.md','docs/ai-fixed-data-no-borrow-20261028.md','docs/ai-search-agent-contract-20261023.md','docs/effect-session-runtime.md',
 'adhoc/six-greedy-plans-design-20261028-v1.md','adhoc/capture-six-greedy-plan-fixtures-20261028-v1.js','adhoc/six-greedy-plan-fixtures-20261028-v1.json',
 'adhoc/audit-six-greedy-plans-case062-20261028-v1.js','adhoc/audit-six-greedy-plans-corpus-20261028-v1.js',
 'adhoc/finalize-six-greedy-plans-20261028-v1.py','adhoc/prepare-six-greedy-plans-delivery-20261028-v1.py','adhoc/deliver-six-greedy-plans-20261028-v1.py',
]
p='reports/ai-foundation-20261023/six-greedy-plans-final-20261028-v1.json';final=json.loads(pathlib.Path(p).read_text());files.append(p);reports=[r['path'] for r in final['checkpoints']];files.extend(reports);files.extend(r['path'] for r in final['validation']['logs'].values());files.extend(r['rawPath'] for r in final['rows']);files=list(dict.fromkeys(files));manifest=pathlib.Path('adhoc/six-greedy-plans-snapshot-20261028.json');m=json.loads(manifest.read_text());m['files']={p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in files};m['sourceBoundReports']=reports+[p];manifest.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'files':len(files)}))
