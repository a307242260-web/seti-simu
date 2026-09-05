"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const output = "reports/iteration/r3-current-rounds-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重算：${output}`);
else {
  const records = ["baea50cc.20feca27.full.json", "22cf8cea.cf4280fd.full.json"];
  const sources = records.map((name) => {
    const record = JSON.parse(fs.readFileSync(`reports/research/${name}`));
    const raw = fs.readFileSync(record.savePath);
    const save = JSON.parse(raw);
    const finalScores = JSON.parse(save.committedState).match.finalScores;
    assert.equal(record.terminal, true);
    assert.equal(finalScores.reduce((sum, row) => sum + row.totalScore, 0) / 4, record.summary.avgScore);
    const rounds = [];
    for (let round = 1; round <= 4; round += 1) {
      const steps = save.replaySteps.filter((step) => step.after.r === round);
      assert.ok(steps.length);
      const last = steps.at(-1);
      rounds.push({ round, lastStep: last.stepIndex, after: last.after,
        greenMainActions: steps.filter((step) => step.action.actorId === "player-green"
          && step.action.phase === "main").map((step) => ({ index: step.stepIndex,
          family: step.action.family, target: step.action.target, summary: step.action.summary })) });
    }
    return { record: name, savePath: record.savePath,
      sha256: crypto.createHash("sha256").update(raw).digest("hex"),
      finalScores, rounds, replaySteps: save.replaySteps };
  });
  let identicalPrefixSteps = 0;
  while (identicalPrefixSteps < Math.min(...sources.map((source) => source.replaySteps.length))) {
    const [a, b] = sources.map((source) => source.replaySteps[identicalPrefixSteps]);
    if (a.action.actionId !== b.action.actionId || JSON.stringify(a.after) !== JSON.stringify(b.after)) break;
    identicalPrefixSteps += 1;
  }
  const report = { createdAt: new Date().toISOString(),
    scope: "只读两个已完成版本；按after.r分组的是步骤后状态，不代表行动发起轮次。分差和行动差异只作定位，不作因果证明。",
    identicalPrefixSteps, firstDivergence: sources.map((source) => source.replaySteps[identicalPrefixSteps]),
    sources: sources.map(({ replaySteps, ...source }) => ({ ...source, steps: replaySteps.length })),
    seatDeltas: sources[1].finalScores.map((row) => {
      const baseline = sources[0].finalScores.find((item) => item.playerId === row.playerId);
      return { playerId: row.playerId, base: row.baseScore - baseline.baseScore,
        tile: row.tileScore - baseline.tileScore, card: row.cardScore - baseline.cardScore,
        total: row.totalScore - baseline.totalScore };
    }) };
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, identicalPrefixSteps, seatDeltas: report.seatDeltas,
    rounds: sources.map((source) => source.rounds.map((round) => ({ round: round.round,
      baseScores: Object.fromEntries(Object.entries(round.after.p).map(([id, values]) => [id, values[0]])),
      greenMainActions: round.greenMainActions }))) }, null, 2));
}
