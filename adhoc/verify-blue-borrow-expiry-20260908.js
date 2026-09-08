// 从第49步真实根重放获胜计划前缀，对照借用科技后立刻结束回合的净变化。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/blue-borrow-expiry-20260908.json';
if (fs.existsSync(output)) { console.log('已有对照：' + output); process.exit(0); }
const source = JSON.parse(fs.readFileSync('reports/iteration/identity-blue-cross-baseline-identity-20260908.json'));
const capture = source.captures[0];
const plan = capture.ranked.find(x => x.action.actionId === capture.chosen.actionId).leaf.planSteps;
const full = JSON.parse(fs.readFileSync('seti-saves/seti-save-research-quick-turn-order-20260908-438305b4-full-v300.json'));
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const env = require('../randomizer/app/simulation-env').createSimulationEnv(), forks = [];
const report = { scope: '只执行正式输入，不进行搜索；不从局部无收益外推整局48分损失', orders: [] };
function legal(c) { const s = c.inspect(); return s.phase === 'awaiting_input' ? s.session.decision.choices : c.inputPort.enumerateActions(); }
function submit(c, a) {
  assert.ok(a);
  const d = c.inspect().session?.decision;
  const result = a.phase === 'conditional' ? c.inputPort.submitDecision({ decisionId: d.decisionId,
    decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: a }) : c.inputPort.submitAction(a);
  assert.equal(result.ok, true, JSON.stringify(result));
  if (a.family === 'end_turn') assert.equal(c.counterfactualPort.advanceFocalPlanningTurn('player-blue').ok, true);
}
function differences(a, b, path = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .flatMap(k => differences(a[k], b[k], path + '/' + k));
  return [{ path, withoutBorrow: a, withBorrow: b }];
}
try {
  env.reset(config);
  for (const step of full.replaySteps.slice(0, 48)) {
    const a = env.legalActions().find(a => a.actionId === step.action.actionId);
    assert.deepEqual(a, step.action); assert.equal(env.step(a).ok, true);
  }
  const c = env.createCounterfactualFork().composition; forks.push(c);
  assert.equal(plan[4].action.family, 'industry');
  for (const step of plan.slice(0, 4)) submit(c, legal(c).find(a => a.actionId === step.action.actionId));
  const envelope = c.lifecycle.save().envelope;
  for (const borrow of [false, true]) {
    const fork = env.createCounterfactualFork(envelope, { branchKey: 'blue-borrow-expiry' }).composition; forks.push(fork);
    const actions = [];
    const run = predicate => { const a = legal(fork).find(predicate); submit(fork, a); actions.push(a); };
    if (borrow) {
      run(a => a.family === 'industry');
      run(a => a.target?.choiceId === 'tech:purple2');
    }
    run(a => a.family === 'end_turn');
    const state = JSON.parse(fork.lifecycle.save().envelope.committedState);
    const player = state.players.players.find(p => p.id === 'player-blue');
    const active = require('../randomizer/game/players').playerOwnsTech(player, 'purple2', {
      roundNumber: state.turn.roundNumber, turnNumber: state.turn.turnNumber,
    });
    report.orders.push({ borrow, actions, state, borrowedPurple2Active: active });
  }
  report.differences = differences(report.orders[0].state, report.orders[1].state);
  assert.equal(report.orders[1].borrowedPurple2Active, false);
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  forks.forEach(f => f.dispose()); env.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error, differences: report.differences }));
}
