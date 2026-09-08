// 对已捕获的同一77盘面调用两版纯目标目录，分离根准入与搜索裁剪；不执行搜索。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/suffix-blue77-root-admission-20260908.json';
if (fs.existsSync(output)) { console.log('已有首动作准入证据：' + output); process.exit(0); }
const capture = JSON.parse(fs.readFileSync('reports/iteration/suffix-blue77-ranking-20260908.json')).captures[0];
const action = capture.ranked.find(x => x.action.summary === 'dlc_23.png').action;
const roots = {};
for (const [name, source] of Object.entries({
  combined: '/private/tmp/seti-alien-pick-disabled-tech-20260908',
  suffix: '/private/tmp/seti-route-suffix-facts-20260908',
})) {
  const evaluator = require(source + '/randomizer/game/ai/expected-score-evaluator');
  const observation = capture.snapshot.rootObservation;
  const legalActions = capture.ranked.map(x => x.action).filter(a => evaluator.requiresRootCounterfactual(a, observation));
  assert.ok(legalActions.some(a => a.actionId === action.actionId));
  const input = { focalSeatId: 'player-blue', rootObservation: observation, legalActions, maxProxyDepth: 15 };
  const targets = evaluator.enumerateSecondaryAgentRootTargets(input);
  const selected = evaluator.selectSecondaryAgentRootActions(input);
  roots[name] = { targets, selected, bindings: targets.filter(t => t.compatibleActionIds.includes(action.actionId)) };
  assert.equal(roots[name].bindings.length, 0);
  assert.ok(!selected.some(a => a.actionId === action.actionId));
}
assert.deepEqual(roots.combined, roots.suffix);
const report = { board: '3c7e0003.af937808.full.json', step: 77, action, roots,
  conclusion: '合法且需反事实的中性浮力训练未获任何根目标绑定；两版在同一盘面完全一致，因此不是本次依赖改动新增的目录遗漏，也不是94个前沿来源裁剪造成的首动作未估值。是否应增加有目的的触发牌准备需单独设计，不能据此开放全部打牌。' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, targetCount: roots.suffix.targets.length,
  rootActions: roots.suffix.selected.map(a => a.summary), bindings: roots.suffix.bindings, bothVersionsEqual: true }));
