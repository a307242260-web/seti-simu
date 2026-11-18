"""Align Native money comparisons with official scoring after final PASS."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

repo = Path(__file__).resolve().parents[1]
directory = repo / 'reports/ai-foundation-20261119'
before = json.loads((directory / 'final-pass-validation-before-20261119-v1.json').read_text())
snapshot = Path(before['snapshot'])
assert all(check['exitCode'] != 0 for check in before['checks'].values())
names = ['randomizer/game/ai/known-card-money.test.js', 'randomizer/game/ai/pre-main-data-plan.test.js']
for name in names:
    assert (snapshot / name).read_bytes() == subprocess.check_output(['git', 'show', before['parent'] + ':' + name], cwd=repo)

p = snapshot / names[0]
source = p.read_text()
def replace(old, new):
    global source
    assert source.count(old) == 1, (old[:80], source.count(old))
    source = source.replace(old, new)
replace('let inputs=0,leaves=0,extraStops=0;', 'let inputs=0,leaves=0,extraStops=0,scoreOnlyStates=0,activeWalletStates=0;')
replace('  assert.equal(evaluate(av)-evaluate(bv),2+missionDelta);',
 "  const scoreOnly=o=>o.terminal===true||o.publicState.roundNumber===4&&o.publicState.passedPlayerIds?.includes(seatId)===true;\n  assert.equal(scoreOnly(av),scoreOnly(bv));\n  if(scoreOnly(av)){\n   assert.equal(evaluate(av),ax.finalScore);assert.equal(evaluate(bv),bx.finalScore);\n   assert.equal(evaluate(av)-evaluate(bv),ax.finalScore-bx.finalScore,'completed final PASS uses official score, not unused-wallet value');scoreOnlyStates++;\n  }else{assert.equal(evaluate(av)-evaluate(bv),2+missionDelta);activeWalletStates++;}")
replace('return {inputs,leaves,extraStops};', 'return {inputs,leaves,extraStops,scoreOnlyStates,activeWalletStates};')
replace('console.log(JSON.stringify({knownCardMoney:',
 "assert(paired.some(row=>row.scoreOnlyStates>0),'Native controls must include completed final PASS');\nassert(paired.some(row=>row.activeWalletStates>0),'Native controls must retain active or pending wallet valuation');\nconsole.log(JSON.stringify({knownCardMoney:")
p.write_text(source)

p = snapshot / names[1]
source = p.read_text()
replace('  if (round === 4) assert(delta < 0, "第4轮不能把插收入假定为优于用角标避免强制弃牌");',
 "  if (round === 4) {\n    const settled=o=>o.publicState.passedPlayerIds.includes(f.seatId);\n    assert(settled(oldPass.observation)&&settled(newPass.observation),'both Native alternatives must have completed final PASS');\n    const official=o=>o.publicState.players.find(p=>p.playerId===f.seatId).finalScore;\n    assert.equal(evaluate(oldPass.observation),official(oldPass.observation));assert.equal(evaluate(newPass.observation),official(newPass.observation));\n    assert.equal(delta,official(newPass.observation)-official(oldPass.observation));\n    assert.equal(delta,0,'this recorded final-PASS control ties in official score; unused currency is not a score penalty or bonus');\n  }")
p.write_text(source)
for name in names:
    subprocess.run(['node', '--check', str(snapshot / name)], check=True)
output = directory / 'final-pass-validation-after-20261119-v1.json'
assert not output.exists()
record = {'parent': before['parent'], 'snapshot': str(snapshot), 'ownedPaths': names,
          'checks': {}, 'strategyChanged': False, 'newAutonomousGames': 0}
save = lambda: output.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
save()
command = ['node', 'tools/run_node_tests.js']
for name in names + ['randomizer/game/ai/state-value.test.js']:
    command.extend(['--match', name])
head = subprocess.run(command, cwd=snapshot, capture_output=True, text=True, timeout=60)
record['checks']['head'] = {'exitCode': head.returncode, 'stdout': head.stdout, 'stderr': head.stderr}
save()
base = json.loads((directory / 'transition-budget-after-20261119-v1.json').read_text())
v72 = Path(tempfile.mkdtemp(prefix='seti-v72-final-pass-validation-20261119-', dir='/private/tmp'))
shutil.copytree(base['checks']['v72']['runtime'], v72, symlinks=True, dirs_exist_ok=True)
for fixture in before['fixtures']:
    target = v72 / fixture['path']
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(snapshot / fixture['path'], target)
for name in names:
    assert (v72 / name).read_bytes() == subprocess.check_output(['git', 'show', before['parent'] + ':' + name], cwd=repo)
    shutil.copyfile(snapshot / name, v72 / name)
result = subprocess.run(command, cwd=v72, capture_output=True, text=True, timeout=60)
record['checks']['v72'] = {'runtime': str(v72), 'exitCode': result.returncode,
                          'stdout': result.stdout, 'stderr': result.stderr}
candidate = json.loads((directory / 'blue-income-forecast-prototype-preflight-20261119-v2.json').read_text())
for name, digest in candidate['candidateChangedFiles'].items():
    assert hashlib.sha256((v72 / name).read_bytes()).hexdigest() == digest, name
record['candidateStrategyHashesUnchanged'] = candidate['candidateChangedFiles']
record['ownedHashes'] = {name: hashlib.sha256((snapshot / name).read_bytes()).hexdigest() for name in names}
record['passed'] = all(check['exitCode'] == 0 for check in record['checks'].values())
save()
print(json.dumps({'passed': record['passed'], 'checks': record['checks']}, ensure_ascii=False))
