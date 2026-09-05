"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const output = "reports/iteration/card-income-identity-full-comparison-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重算：${output}`);
else {
  const recordPath = "reports/research/22cf8cea.cf4280fd.full.json";
  const record = JSON.parse(fs.readFileSync(recordPath));
  const raw = fs.readFileSync(record.savePath);
  const save = JSON.parse(raw);
  const previous = JSON.parse(fs.readFileSync("seti-saves/seti-save-research-income-reserve-r3i1-20260906-082d3e12-quick-200-v104.json"));
  const failurePath = "reports/iteration/income-reserve-full-failure-20260906-v2.json";
  const failure = JSON.parse(fs.readFileSync(failurePath));
  const first200Equal = JSON.stringify(save.replaySteps.slice(0, 200)) === JSON.stringify(previous.replaySteps);
  const failedPrefixEqual = failure.steps.every((step) => save.replaySteps[step.index].action.actionId === step.actionId);
  const finalScores = JSON.parse(save.committedState).match.finalScores;
  const report = { createdAt: new Date().toISOString(), recordPath, savePath: record.savePath,
    sha256: crypto.createHash("sha256").update(raw).digest("hex"), failurePath,
    scope: "只读正式存档及已存失败前动作，不重跑AI。", first200Equal, failedPrefixEqual,
    recoveredStep: save.replaySteps[235], steps: save.replaySteps.length, finalScores,
    mean: finalScores.reduce((sum, row) => sum + row.totalScore, 0) / finalScores.length };
  fs.writeFileSync(output, JSON.stringify(report));
  assert.equal(first200Equal, true);
  assert.equal(failedPrefixEqual, true);
  assert.equal(report.recoveredStep.action.actorId, "player-brown");
  assert.equal(report.recoveredStep.action.target.cardInstanceId, "card-54-0");
  console.log(JSON.stringify({ output, steps: report.steps, mean: report.mean, first200Equal, failedPrefixEqual,
    scores: finalScores.map((row) => row.totalScore) }));
}
