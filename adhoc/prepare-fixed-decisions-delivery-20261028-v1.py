# coding: utf-8
"""Prepare an explicit tested overlay, never the shared worktree index."""
import hashlib
import json
import pathlib

stage = pathlib.Path.cwd()
source = pathlib.Path('adhoc/deliver-shared-prefix-20261028-v1.py').read_text()
replacements = {
    '/private/tmp/seti-shared-prefix-20261028-959a13mx': str(stage),
    'adhoc/shared-prefix-snapshot-20261028.json': 'adhoc/fixed-decisions-snapshot-20261028.json',
    'shared-prefix-snapshot-check-20261028-v1.json': 'fixed-decisions-snapshot-check-20261028-v1.json',
    'SETI_DELIVER_SHARED_PREFIX': 'SETI_DELIVER_FIXED_DECISIONS',
    'seti-shared-prefix-private-20261028.index': 'seti-fixed-decisions-private-20261028.index',
    'shared-prefix-commit-message-20261028.txt': 'fixed-decisions-commit-message-20261028.txt',
    '共享资源准备前缀并按新增执行与状态计费': '固定终局标记与扫描目的并减少可信分支恢复复制',
}
for before, after in replacements.items():
    assert before in source, before
    source = source.replace(before, after)
pathlib.Path('adhoc/deliver-fixed-decisions-20261028-v1.py').write_text(source)
files = [
    'randomizer/game/ai/analysis-port.js', 'randomizer/game/ai/decision-search.js',
    'randomizer/game/ai/search-agent.js', 'randomizer/game/ai/local-decision-plans.js',
    'randomizer/game/ai/local-decision-plans.test.js',
    'randomizer/game/effects/science-session.js', 'randomizer/game/effects/session-runtime.js',
    'randomizer/game/rule-composition.js', 'randomizer/index.html',
    'tools/node-test-inventory.js', 'tools/browser-smoke-inventory.js', 'tools/audit_v_state_inputs.js',
    'docs/ai-local-decisions-20261028.md', 'docs/ai-design.md', 'docs/ai-development-workflow.md',
    'docs/ai-search-agent-contract-20261023.md', 'docs/effect-session-runtime.md',
    'adhoc/fixed-decisions-design-20261028-v1.md',
    'adhoc/fixed-decision-final-mark-20261028-v1.json',
    'adhoc/capture-fixed-decision-fixture-20261028-v1.js',
    'adhoc/audit-fixed-decisions-case062-20261028-v4.js',
    'adhoc/audit-fixed-decisions-corpus-20261028-v4.js',
    'adhoc/benchmark-fixed-policies-20261028-v3.js',
    'adhoc/benchmark-fixed-restore-20261028-v3.js',
    'adhoc/finalize-fixed-decisions-20261028-v1.py',
    'adhoc/prepare-fixed-decisions-delivery-20261028-v1.py',
    'adhoc/deliver-fixed-decisions-20261028-v1.py',
]
final_path = 'reports/ai-foundation-20261023/fixed-decisions-final-20261028-v1.json'
final = json.loads(pathlib.Path(final_path).read_text())
reports = [r['path'] for r in final['checkpoints'].values()]
files.extend(reports)
files.append(final_path)
files.extend(r['path'] for r in final['validation']['logs'].values())
for p in reports:
    files.extend(r['rawPath'] for r in json.loads(pathlib.Path(p).read_text())['rows'])
files = list(dict.fromkeys(files))  # Case-062 is a reused checkpoint in the full corpus.
manifest_path = pathlib.Path('adhoc/fixed-decisions-snapshot-20261028.json')
manifest = json.loads(manifest_path.read_text())
manifest['files'] = {p: hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in files}
manifest['sourceBoundReports'] = reports + [final_path]
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'explicitFiles': len(files), 'sourceBoundReports': len(manifest['sourceBoundReports'])}))
