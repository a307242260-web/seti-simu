"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const endGameScoring = require("../randomizer/game/end-game-scoring");
const finalScoring = require("../randomizer/game/final-scoring");
const cardEffects = require("../randomizer/game/cards/effects");
const initialCards = require("../randomizer/game/initial-cards");
const { createFinalReadModelOwner } = require("../randomizer/game/final-read-model");
const { buildRuleObservation } = require("../randomizer/app/rule-observation");
const output = "reports/iteration/company-income-consumers-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const report = { passed:false, records:[] };
try {
  const proof = JSON.parse(fs.readFileSync("reports/iteration/company-base-income-finals-20260908.json"));
  assert.equal(proof.passed,true);
  for (const expected of proof.records) {
    const record = JSON.parse(fs.readFileSync(expected.file));
    const save = JSON.parse(fs.readFileSync(record.savePath));
    const state = JSON.parse(save.committedState);
    const model = createFinalReadModelOwner({
      endGameScoring, finalScoring, cardEffects,
      getCardTypeCode: card => cardEffects.getRuntimeCardTypeCode(card, cardEffects.getCardModel(card)?.cardType),
    }).project(state);
    const rows = [];
    for (const viewer of state.players.players) {
      const observation = buildRuleObservation(state, record.seed, viewer.id);
      for (const player of state.players.players) {
        const score = expected.scores.find(p => p.playerId === player.id);
        const publicPlayer = observation.publicState.players.find(p => p.playerId === player.id);
        assert.equal(publicPlayer.finalScore, score.totalScore);
        assert.equal(publicPlayer.securedEndGameBonus, score.totalScore - score.baseScore);
        assert.deepEqual(model.players.find(p => p.id === player.id).breakdown, score);
        const base = initialCards.getIndustryEffect(player.initialSelection.industry).baseIncome;
        const increases = ["credits","energy","handSize"].map(k => Math.max(0,(player.income[k] || 0) - (base[k] || 0)));
        const candidate = model.candidatesByPlayerId[player.id].a;
        const expectedBase = candidate.formulaId === "a1" ? Math.max(...increases.slice(0,2)) : Math.min(...increases);
        assert.equal(candidate.baseValue, expectedBase);
        assert.equal(candidate.immediateScore, expectedBase * candidate.multiplier);
        rows.push({ viewer:viewer.id, player:player.id, score:score.totalScore, candidate });
      }
    }
    report.records.push({ file:expected.file, checks:rows });
  }
  report.passed = true;
} catch(error) { report.error = error.stack; process.exitCode = 1; }
finally {
  fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({output,passed:report.passed,error:report.error,checks:report.records.reduce((n,r)=>n+r.checks.length,0)}));
}
