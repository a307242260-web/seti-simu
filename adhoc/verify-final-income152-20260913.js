"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const output = "adhoc/final-income152-20260913.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
let source = fs.readFileSync("/tmp/seti-income432-audit-20260913.TPxMg7/adhoc/audit-real-finalmark142-20260913.js", "utf8");
for (const [from, to] of [["adhoc/real-finalmark142-20260913.json", output], ["step: 142", "step: 152"], ["i < 141", "i < 151"]]) {
  assert.equal(source.split(from).length, 2); source = source.replace(from, to);
}
const insertion = `
  const oldObservation = structuredClone(observation);
  for (const player of oldObservation.publicState.players) delete player.companyBaseIncome;
  const oldProjected = { ...projected }; delete oldProjected.companyBaseIncome;
  const port = require("../randomizer/game/ai/policy-port");
  const model = require("../randomizer/game/ai/outcome-model");
  const decide = (policy, obs) => policy.createHeuristicPolicy().decide(port.createDecisionContext({
    requestId: "final-income152", seatId, stateVersion: legal[0].stateVersion,
    decisionVersion: legal[0].decisionVersion, legalActions: legal, actionOutcomes: [],
    observation: model.createDecisionObservation(obs, { seatId })
  })).actionId;
  report.oldSelection = decide(require("/Users/bilibili/code/seti-simu/randomizer/game/ai/heuristic-policy"), oldObservation);
  report.newSelection = decide(require("../randomizer/game/ai/heuristic-policy"), observation);
  report.formulas = report.formulas.map(f => {
    const marks = board.finalScoring.tiles[f.tileId].marks;
    const slot = !marks.some(m => Number(m.slotIndex) === 1) ? 1 : !marks.some(m => Number(m.slotIndex) === 2) ? 2 : 3;
    const multiplier = scoring.getSlotMultiplier(f.formulaId, slot);
    const oldBase = scoring.getFormulaBaseValue(f.formulaId, oldProjected,
      { aliens: board.aliens, planets: board.planets, data: board.data },
      { getCardTypeCode: c => Number(c.cardTypeCode) });
    assert.equal(f.policyBase, f.formalBase);
    return { ...f, oldBase, slot, multiplier, oldScore: oldBase * multiplier, score: f.policyBase * multiplier };
  });
  assert.equal(report.oldSelection, save.replaySteps[151].action.actionId);
  const candidate = JSON.parse(fs.readFileSync("seti-saves/seti-save-research-final-income-input-fix-20260913-5b3f3e20-full-v307.json"));
  for (let i = 0; i < 151; i++) {
    assert.deepEqual(candidate.replaySteps[i].action, save.replaySteps[i].action);
    assert.deepEqual(candidate.replaySteps[i].after, save.replaySteps[i].after);
  }
  assert.equal(report.newSelection, candidate.replaySteps[151].action.actionId);
  report.companyBaseIncome = projected.companyBaseIncome;
`;
assert.equal(source.split("  report.rawCompany = raw.initialSelection.industry;").length, 2);
source = source.replace("  report.rawCompany = raw.initialSelection.industry;", insertion + "  report.rawCompany = raw.initialSelection.industry;");
// 正式重放共同前151步，两版Policy仅选终局标记，不启动反事实搜索。
new Function("require", "console", "process", source)(require, console, process);
const result = JSON.parse(fs.readFileSync(output)); assert(!result.error);
console.log(JSON.stringify({ oldSelection: result.oldSelection, newSelection: result.newSelection,
  companyBaseIncome: result.companyBaseIncome, income: result.rawIncome, formulas: result.formulas }, null, 2));
