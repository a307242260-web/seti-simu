// 重编译历史真实优胜链并检查其已保存合法边界；不重放/重跑旧完整局。
const fs = require('node:fs'), assert = require('node:assert/strict');
const plan = require('/private/tmp/seti-route-suffix-facts-20260908/randomizer/game/ai/plan-continuation');
const output = 'reports/iteration/suffix-green370-verification-20260908.json';
if (fs.existsSync(output)) { console.log('已有370证据：' + output); process.exit(0); }
const source = 'reports/iteration/green-route-370-20260908.json';
const evidence = JSON.parse(fs.readFileSync(source));
assert.equal(evidence.passed, true); assert.equal(evidence.check370.hit, true);
const raw = evidence.rootChoices.find(r => r.action.family === 'launch').selectedPlanSteps;
const index = raw.findIndex(s => s.action.family === 'orbit'); assert.ok(index >= 0);
const steps = plan.compilePlanSteps(raw.slice(index));
assert.ok(steps.every(s => s.valid));
const stored = { schemaVersion: plan.PLAN_SCHEMA_VERSION, nextActionId: steps[0].actionId, steps };
const result = plan.planReuseCheck(stored, evidence.before370, [evidence.check370.action]);
assert.equal(result.hit, false); assert.equal(result.reason, 'future-step-affected');
assert.deepEqual(result.affected, { kind: 'card-slot', id: '2' });
const report = { source, boundary: '当前合法动作沿用已归档正式check370.action；不声称新版本重放了整局',
  oldHit: true, result, expected: stored.steps[0].futureDependencies,
  currentFacts: plan.capturePlanStep({ observation: evidence.before370, action: evidence.check370.action }).facts,
  passed: true };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, passed: true, result }));
