"""Fix the budget unit in the Native travel-tail regression, not the solver."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

repo = Path(__file__).resolve().parents[1]
directory = repo / 'reports/ai-foundation-20261119'
before = json.loads((directory / 'transition-budget-before-20261119-v1.json').read_text())
assert before['exitCode'] != 0 and 'actual complete closure' in before['stderr']
snapshot = Path(before['snapshot'])
name = 'randomizer/game/ai/probe-travel-tail.test.js'
original = subprocess.check_output(['git', 'show', before['parent'] + ':' + name], cwd=repo)
assert (snapshot / name).read_bytes() == original
source = original.decode()
def change(old, new):
    global source
    assert source.count(old) == 1, (old, source.count(old))
    source = source.replace(old, new)
change("// The actual complete production closure fits; one fewer input fails closed.",
       "// Transition budgets charge proved steps too. The exact charged closure\n // fits; one fewer charged transition fails closed. Native submissions keep\n // their separate 256-input gate.")
change(' const actualInputs=fast.diagnostics.nativeExecutions;\n for(const transitions of [actualInputs,actualInputs-1]){',
       " const actualInputs=fast.diagnostics.nativeExecutions,actualTransitions=fast.diagnostics.transitions,budgetBoundaries=[];\n assert(actualTransitions>actualInputs,'this proof-bearing fixture must distinguish charged transitions from Native executions');\n for(const transitions of [actualTransitions,actualTransitions-1]){")
change('if(transitions===actualInputs){', 'if(transitions===actualTransitions){')
change('   assert(result.diagnostics.nativeExecutions<=transitions);',
       "   budgetBoundaries.push({limit:transitions,complete:result.complete,stopReason:result.stopReason,nativeExecutions:result.diagnostics.nativeExecutions,chargedTransitions:result.diagnostics.transitions});\n   assert(result.diagnostics.nativeExecutions<=256);assert(result.diagnostics.nativeExecutions<=transitions);")
change('optimizedInputs:fast.diagnostics.nativeExecutions,fullNativeInputs:',
       "optimizedInputs:fast.diagnostics.nativeExecutions,optimizedTransitions:actualTransitions,budgetUnit:'charged-transitions',budgetBoundaries,fullNativeInputs:")
def repair_policy_dependency(text):
    old = " p.setMovementPlanning(false);\n for(const [spec,base]of proofs){"
    new = " const liveProbe=base=>probe.ownedProbes(base.observation.publicState.board.rockets,{id:f.seatId}).length>0;\n const movementProofs=[...proofs].filter(([,base])=>liveProbe(base)),stationaryProofs=[...proofs].filter(([,base])=>!liveProbe(base));\n assert(movementProofs.length>0&&stationaryProofs.length>0,'fixture must cover both movement-dependent and stationary income proofs');\n p.setMovementPlanning(false);\n for(const [spec,base]of movementProofs){"
    assert text.count(old) == 1
    text = text.replace(old, new)
    old = " p.setMovementPlanning(true);\n for(const [spec,base]of proofs)"
    new = " for(const [spec,base]of stationaryProofs){\n  assert.equal(p.turnTailSummary(base,spec.kind),spec,'stationary income proof remains valid without the movement policy');\n  assert.doesNotThrow(()=>p.turnTailBoundary(base,spec));\n }\n p.setMovementPlanning(true);\n for(const [spec,base]of proofs)"
    assert text.count(old) == 1
    text = text.replace(old, new)
    old = "values=require('./state-value'),agent="
    assert text.count(old) == 1
    text = text.replace(old, "values=require('./state-value'),probe=require('./probe-capital'),agent=")
    text = text.replace('movementModeGuard:true,optimizedInputs:',
                        'movementModeGuard:true,movementProofs:movementProofs.length,stationaryProofs:stationaryProofs.length,optimizedInputs:')
    return text.replace('their separate256-input gate.', 'their separate 256-input gate.')
source = repair_policy_dependency(source)
(snapshot / name).write_text(source)
doc = 'docs/node-testing.md'
text = subprocess.check_output(['git', 'show', before['parent'] + ':' + doc], cwd=repo, text=True)
assert text.count('## 运行') == 1
paragraph = ('搜索预算测试使用与预算字段一致的计数：`budget.transitions` 的边界取自 `diagnostics.transitions`，'
             '其中包括已证明而不再原生执行的步骤。`diagnostics.nativeExecutions` 单独核对完整规则提交额度，'
             '不能代替计费转移步数。精确预算应完整闭合，少一个计费步时必须拒绝返回动作和可复用计划；'
             '这些检查不能替代节点、前沿和耗时门槛。\n\n')
(snapshot / doc).write_text(text.replace('## 运行', paragraph + '## 运行'))
subprocess.run(['node', '--check', str(snapshot / name)], check=True)
head = subprocess.run(['node', 'tools/run_node_tests.js', '--match', name], cwd=snapshot,
                      capture_output=True, text=True, timeout=40)
record = {'parent': before['parent'], 'snapshot': str(snapshot), 'ownedPaths': [name, doc],
          'checks': {'head': {'exitCode': head.returncode, 'stdout': head.stdout, 'stderr': head.stderr}},
          'productionStrategyChanged': False, 'newAutonomousGames': 0}
output = directory / 'transition-budget-after-20261119-v1.json'
assert not output.exists()
save = lambda: output.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
save()
previous = json.loads((directory / 'frozen-continuation-validation-v72-backport-20261119-v2.json').read_text())
v72 = Path(tempfile.mkdtemp(prefix='seti-v72-budget-validation-20261119-', dir='/private/tmp'))
shutil.copytree(previous['runtime'], v72, symlinks=True, dirs_exist_ok=True)
assert (v72 / name).read_bytes() == original
(v72 / name).write_text(source)
result = subprocess.run(['node', name], cwd=v72, capture_output=True, text=True, timeout=40)
record['checks']['v72'] = {'runtime': str(v72), 'exitCode': result.returncode,
                          'stdout': result.stdout, 'stderr': result.stderr}
candidate = json.loads((directory / 'blue-income-forecast-prototype-preflight-20261119-v2.json').read_text())
for relative, digest in candidate['candidateChangedFiles'].items():
    assert hashlib.sha256((v72 / relative).read_bytes()).hexdigest() == digest, relative
record['candidateStrategyHashesUnchanged'] = candidate['candidateChangedFiles']
record['ownedHashes'] = {relative: hashlib.sha256((snapshot / relative).read_bytes()).hexdigest()
                        for relative in record['ownedPaths']}
record['passed'] = all(check['exitCode'] == 0 for check in record['checks'].values())
save()
print(json.dumps({'passed': record['passed'], 'checks': record['checks']}, ensure_ascii=False))
