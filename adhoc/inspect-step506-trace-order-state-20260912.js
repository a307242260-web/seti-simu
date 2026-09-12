"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/step506-trace-order-state-20260912.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("reports/iteration/budget-before-step506-20260912.json"));
const save = JSON.parse(fs.readFileSync(input.source));
const env = createSimulationEnv();
const differences = (a, b, path = "") => {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return [{ path, forward: a, reverse: b }];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(key => differences(a[key], b[key], `${path}/${key}`));
};
try {
  env.loadCheckpoint(input.checkpoint);
  for (let index = 505; index < 513; index += 1) {
    const action = env.legalActions().find(a => a.actionId === save.replaySteps[index].action.actionId);
    assert(action);
    assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, save.replaySteps[index].after);
  }
  const root = env.createCheckpoint();
  delete root.replaySteps;
  delete root.browserReplaySteps;
  delete root.effectSessionJournals;
  const orders = [["trace:2:pink:chong:2", "trace:2:yellow:chong:2"],
    ["trace:2:yellow:chong:2", "trace:2:pink:chong:2"]];
  const states = orders.map(order => {
    env.loadCheckpoint(root);
    for (const choiceId of order) {
      const action = env.legalActions().find(a => a.target?.choiceId === choiceId);
      assert(action);
      assert.equal(env.step(action).ok, true);
    }
    const envelope = env.createCheckpoint().coreState.compositionEnvelope;
    return { committedState: JSON.parse(envelope.committedState), session: envelope.session };
  });
  const result = { source: input.source, orders, differences: differences(...states),
    scope: "仅验证虫族粉2/黄2相反顺序的完整状态差异；不宣称其他组合或未来行为等价。" };
  assert(result.differences.length > 0);
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(result, null, 2));
} finally { env.dispose(); }
