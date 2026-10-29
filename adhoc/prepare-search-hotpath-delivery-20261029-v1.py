# coding: utf-8
import pathlib,json,hashlib
stage=pathlib.Path.cwd();s=pathlib.Path('adhoc/deliver-six-greedy-plans-20261028-v1.py').read_text()
for a,b in {
 '/private/tmp/seti-six-greedy-plans-20261028-b4rnme1v':str(stage),
 'adhoc/six-greedy-plans-snapshot-20261028.json':'adhoc/search-hotpath-snapshot-20261029.json',
 'six-greedy-plans-snapshot-check-20261028-v1.json':'search-hotpath-snapshot-check-20261029-v1.json',
 'SETI_DELIVER_SIX_GREEDY_PLANS':'SETI_DELIVER_SEARCH_HOTPATH',
 'seti-six-greedy-plans-private-20261028.index':'seti-search-hotpath-private-20261029.index',
 'six-greedy-plans-commit-message-20261028.txt':'search-hotpath-commit-message-20261029.txt',
 '将六类准备与奖励选择收束为贪心执行计划':'复用移动时机计算并减少只读预览与观察复制',
}.items():
 assert a in s,a
 s=s.replace(a,b)
pathlib.Path('adhoc/deliver-search-hotpath-20261029-v1.py').write_text(s)
files=[
 'randomizer/game/production-kernel.js','randomizer/game/ai/analysis-port.js','randomizer/game/ai/movement-preview-copy.test.js','randomizer/index.html',
 'tools/node-test-inventory.js','tools/browser-smoke-inventory.js','tools/audit_v_state_inputs.js',
 'docs/ai-search-hotpath-20261029.md','docs/ai-search-agent-contract-20261023.md','docs/ai-development-workflow.md','docs/ai-six-greedy-plans-20261028.md','docs/effect-session-runtime.md',
 'adhoc/search-hotpath-design-20261029-v1.md','adhoc/profile-search-hotpath-20261029-v1.js','adhoc/benchmark-movement-copy-20261029-v1.js','adhoc/capture-movement-projections-20261029-v1.js','adhoc/benchmark-movement-copy-after-20261029-v1.js',
 'adhoc/finalize-search-hotpath-20261029-v1.py','adhoc/prepare-search-hotpath-delivery-20261029-v1.py','adhoc/deliver-search-hotpath-20261029-v1.py',
]
final_path='reports/ai-foundation-20261023/search-hotpath-final-20261029-v1.json';final=json.loads(pathlib.Path(final_path).read_text());files.append(final_path)
reports=[r['path'] for r in final['checkpoints']];files.extend(reports);files.extend(r['path'] for r in final['baselineEvidence']);files.extend(r['path'] for r in final['validation']['logs'].values());variant_path=final['intermediateSources']['path'];files.append(variant_path);variants=json.loads(pathlib.Path(variant_path).read_text());files.extend(variants['variants'])
for n in [1,2,3]:
 files.extend([f'adhoc/audit-search-hotpath-{part}-20261029-v{n}.js' for part in ['case062','corpus']]);files.extend([f'reports/ai-foundation-20261023/search-hotpath-{part}-20261029-v{n}.json' for part in ['case062','corpus']])
for p in list(files):
 if p.endswith('.json') and p.startswith('reports/'):
  report=json.loads(pathlib.Path(p).read_text())
  files.extend(r['rawPath'] for r in report.get('rows',[]) if r.get('rawPath'))
files=list(dict.fromkeys(files));mp=pathlib.Path('adhoc/search-hotpath-snapshot-20261029.json');m=json.loads(mp.read_text());m['scope']='Exact read-only movement-preview copying, geometry-dependency cache and immutable observation reuse; strategy, node identity and global budgets unchanged.';m['files']={p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in files};m['sourceBoundReports']=reports+[final_path];mp.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'files':len(files),'bytes':sum(pathlib.Path(p).stat().st_size for p in files)}))
