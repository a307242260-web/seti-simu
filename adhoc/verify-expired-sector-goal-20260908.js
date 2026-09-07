"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const source = "reports/iteration/expired-sector-goal-proof-20260908.json";
const output = "reports/iteration/expired-sector-goal-verification-20260908.json";
if (fs.existsSync(output)) console.log(`已有验证：${output}`);
else {
  const proof = JSON.parse(fs.readFileSync(source)), input = proof.capture.input;
  const before = JSON.stringify(input);
  const returned = evaluator.selectSecondaryAgentSuccessors(input);
  assert.deepEqual(returned, []);
  // 完成判定使用自己的action/targetId契约，不能直接传后继函数的currentAction/routeTargetId。
  const completed = evaluator.completesSecondaryAgentRouteTarget({ ...input,
    action: input.currentAction, targetId: input.routeTargetId });
  assert.ok(input.currentAction); assert.equal(completed, false);
  assert.equal(JSON.stringify(input), before);
  const report = { source, passed:true, returned, completed,
    previousReturned: proof.returned, observationUnchanged:true,
    note:"旧反例的完成检查参数不完整，旧completed字段不作为证据；此处使用正式契约重新验证，不重跑搜索" };
  fs.writeFileSync(output, JSON.stringify(report,null,2)+"\n"); console.log(JSON.stringify(report));
}
