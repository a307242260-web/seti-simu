"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/step506-trace-order-suffix-20260912.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("reports/iteration/budget-before-step506-20260912.json"));
const save = JSON.parse(fs.readFileSync(input.source));
const envs = [createSimulationEnv(), createSimulationEnv()];
function state(env) {
  const envelope = env.createCheckpoint().coreState.compositionEnvelope;
  return { committedState: JSON.parse(envelope.committedState), session: envelope.session };
}
function compare(a, b, path = "") {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === "object" && typeof b === "object") {
    assert.equal(Array.isArray(a), Array.isArray(b), path);
    assert.deepEqual(Object.keys(a), Object.keys(b), path);
    return Object.keys(a).flatMap(key => compare(a[key], b[key], `${path}/${key}`));
  }
  // 比较所有Session历史快照，逐处报告已确认的序号交换；不删除Session或忽略其他差异。
  assert(/\/aliens\/chong\/traceSlotsByAlienSlotId\/2\/(pink|yellow)\/2\/sequence$/.test(path), `非预期差异 ${path}`);
  assert.deepEqual([a, b].sort((x, y) => x - y), [30, 31], path);
  return [path];
}
function execute(env, actionId) {
  const action = env.legalActions().find(a => a.actionId === actionId);
  assert(action, `缺少原动作 ${actionId}`);
  assert.equal(env.step(action).ok, true);
}
try {
  for (const env of envs) {
    env.loadCheckpoint(input.checkpoint);
    for (let index = 505; index < 513; index += 1) execute(env, save.replaySteps[index].action.actionId);
  }
  const orders = [["trace:2:pink:chong:2", "trace:2:yellow:chong:2"],
    ["trace:2:yellow:chong:2", "trace:2:pink:chong:2"]];
  for (let lane = 0; lane < 2; lane += 1) for (const choiceId of orders[lane]) {
    const action = envs[lane].legalActions().find(a => a.target?.choiceId === choiceId);
    assert(action);
    execute(envs[lane], action.actionId);
  }
  const differencesByStep = [{ step: 515, paths: compare(state(envs[0]), state(envs[1])) }];
  let verifiedSteps = 0;
  for (let index = 515; index < save.replaySteps.length; index += 1) {
    assert.deepEqual(envs[0].legalActions(), envs[1].legalActions(), `第${index + 1}步合法集`);
    for (const env of envs) {
      execute(env, save.replaySteps[index].action.actionId);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, save.replaySteps[index].after,
        `第${index + 1}步原记录结果`);
    }
    differencesByStep.push({ step: index + 1, paths: compare(state(envs[0]), state(envs[1])) });
    verifiedSteps += 1;
    if (verifiedSteps % 10 === 0) console.log(`[双路线规则重放，无AI] ${verifiedSteps}/${save.replaySteps.length - 515}`);
  }
  const final = state(envs[0]).committedState.match;
  assert(final.finalScores);
  const result = { source: input.source, codeCommit: require("node:child_process").execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    orders, verifiedSteps, legalActionsEqual: true, allRecordedAfterEqual: true,
    fullStateEqualExceptTwoTraceSequencesAndTheirSessionCopies: true, differencesByStep, finalScores: final.finalScores,
    initialDiagnosticFailure: "第一版仅归一化committed顶层，在517步发现Session历史也保留两处痕迹序号；改为逐处比较并报告所有差异，没有改生产代码。",
    scope: "固定原轨迹双路线执行到终局；没有AI搜索，不证明所有可选未来均等价。" };
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ verifiedSteps, legalActionsEqual: true,
    scores: final.finalScores.map(row => ({ playerId: row.playerId, totalScore: row.totalScore })),
    stateDifferenceLocations: [...new Set(differencesByStep.flatMap(row => row.paths))], output }, null, 2));
} finally { for (const env of envs) env.dispose(); }
