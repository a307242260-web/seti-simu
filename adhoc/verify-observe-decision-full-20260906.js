"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const output = "reports/iteration/observe-decision-full-verification-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const read = path => JSON.parse(fs.readFileSync(path));
  function record(mode) {
    const names = fs.readdirSync("reports/research").filter(name => name.endsWith(`.213f34db.${mode}.json`));
    assert.equal(names.length, 1);
    const path = `reports/research/${names[0]}`, value = read(path);
    assert.equal(value.name, "observe-decision-r4-20260906");
    return { path, value };
  }
  const q = record("quick-200"), f = record("full");
  const quick = read(q.value.savePath), full = read(f.value.savePath);
  const oldQuick = read(read("reports/research/cdcd5d61.6d67a974.quick-200.json").savePath);
  assert.deepEqual(quick.replaySteps, oldQuick.replaySteps);
  assert.deepEqual(full.replaySteps.slice(0, 200), quick.replaySteps);
  assert.equal(f.value.resumedFrom, q.value.savePath);
  assert.equal(f.value.gitCommit, q.value.gitCommit);
  const state = JSON.parse(full.committedState);
  assert.equal(state.match.finalScoringSettled, true);
  const scores = Object.fromEntries(state.match.finalScores.map(player => [player.playerId, player.totalScore]));
  assert.deepEqual(scores, f.value.summary.scores);
  const data = state.players.players.map(player => ({ playerId: player.id,
    count: player.resources.availableData, pool: player.dataState.poolTokens.length }));
  for (const player of data) assert.equal(player.count, player.pool);
  const report = { scope: "只读完整存档校验；不以终局数据一致外推全程一致或全部实现正确",
    quickRecord: q.path, fullRecord: f.path, gitCommit: f.value.gitCommit,
    steps: f.value.steps, scores, mean: f.value.summary.avgScore, acceptedBaseline: 106.75,
    quickMs: q.value.wallMs, resumeMs: f.value.wallMs, totalSimulationMs: q.value.wallMs + f.value.wallMs,
    quickTraceIdenticalToPreviousVersion: true, resumedPrefixIdentical: true, finalDataCounts: data,
    saves: [q.value.savePath, f.value.savePath].map(path => ({ path,
      sha256: crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex") })), passed: true };
  fs.writeFileSync(output, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
}
