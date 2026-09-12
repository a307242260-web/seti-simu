"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const model = require("../randomizer/game/ai/outcome-model");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/step506-trace-pairs-20260912.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("reports/iteration/budget-before-step506-20260912.json"));
const source = JSON.parse(fs.readFileSync(input.source));
const env = createSimulationEnv();
const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const leanCheckpoint = () => {
  const checkpoint = env.createCheckpoint();
  delete checkpoint.replaySteps;
  delete checkpoint.browserReplaySteps;
  delete checkpoint.effectSessionJournals;
  return checkpoint;
};
const selected = previous => evaluator.selectSecondaryAgentSuccessors({
  branchObservation: model.createDecisionObservation(env.observe("player-white"), { seatId: "player-white" }),
  focalSeatId: "player-white", currentAction: previous,
  routeTargetId: "land:saturn:satellite:titan", routePlanId: "land:saturn:satellite:titan",
  legalSuccessors: env.legalActions(),
});
const execute = action => {
  const legal = env.legalActions().find(item => item.actionId === action.actionId);
  assert(legal, `非正式合法动作：${action.actionId}`);
  assert.equal(env.step(legal).ok, true);
};
const rows = [];
try {
  env.loadCheckpoint(input.checkpoint);
  assert.deepEqual(env.legalActions(), input.legalActions);
  for (let index = 505; index < 513; index += 1) {
    execute(source.replaySteps[index].action);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, source.replaySteps[index].after);
  }
  const root = leanCheckpoint();
  const firstChoices = selected(source.replaySteps[512].action);
  assert.equal(firstChoices.length, 5);
  for (const first of firstChoices) {
    env.loadCheckpoint(root);
    execute(first);
    const next = selected(first);
    const firstState = leanCheckpoint();
    const row = { first: first.target.choiceId, firstSummary: first.summary,
      nextChoices: next.map(a => ({ family: a.family, target: a.target, summary: a.summary })), pairs: [] };
    // 只枚举紧接的第二枚痕迹；遇到选牌/化石等独立Decision就明确停止，不代选。
    for (const second of next.filter(a => a.target?.kind === "planet-reward-alien-trace")) {
      env.loadCheckpoint(firstState);
      execute(second);
      const checkpoint = leanCheckpoint();
      const committed = JSON.parse(checkpoint.coreState.committedState);
      const publicObservation = model.createDecisionObservation(env.observe("player-white"), { seatId: "player-white" });
      row.pairs.push({ second: second.target.choiceId, secondSummary: second.summary,
        envelopeHash: hash(checkpoint.coreState.compositionEnvelope),
        stateSectionHashes: Object.fromEntries(Object.entries(committed).map(([key, value]) => [key, hash(value)])),
        publicState: publicObservation.publicState,
        nextChoices: env.legalActions().map(a => ({ family: a.family, target: a.target, summary: a.summary })) });
    }
    rows.push(row);
    console.log(`[规则分支检查，无AI] ${row.first}：后继${next.length}项，可直接继续第二枚痕迹${row.pairs.length}项`);
  }
  const comparisons = [];
  for (const row of rows) for (const pair of row.pairs) {
    if (row.first >= pair.second) continue;
    const reverse = rows.find(other => other.first === pair.second)?.pairs.find(other => other.second === row.first);
    if (!reverse) continue;
    comparisons.push({ first: row.first, second: pair.second,
      exactEnvelopeEqual: pair.envelopeHash === reverse.envelopeHash,
      differentStateSections: Object.keys(pair.stateSectionHashes).filter(key => pair.stateSectionHashes[key] !== reverse.stateSectionHashes[key]),
      publicStateEqual: hash(pair.publicState) === hash(reverse.publicState) });
  }
  fs.writeFileSync(output, JSON.stringify({ source: input.source, sourceSHA256: hash(source),
    scope: "真实第514步的5个现有搜索候选，枚举立即相邻的第二次痕迹；其他Decision不推进，不调用AI，不代表完整搜索收益。",
    rows, comparisons }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(comparisons, null, 2));
} finally { env.dispose(); }
