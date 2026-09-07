"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const scoring = require("../randomizer/game/end-game-scoring");
const cardEffects = require("../randomizer/game/cards/effects");
const output = "reports/iteration/movement-card-value-20260907.json";
function breakdown(state) {
  const player = state.players.players.find(p => p.id === "player-green");
  return scoring.computePlayerFinalScore({ ...state, players: state.players.players,
    currentPlayer: player, cardEffects, getCardTypeCode: card =>
      cardEffects.getRuntimeCardTypeCode(card, cardEffects.getCardModel(card)?.cardType) }, player);
}
if (fs.existsSync(output)) console.log(`已有证据：${output}`);
else {
  const replay = JSON.parse(fs.readFileSync("reports/iteration/movement-divergence-42-formal-20260907.json"));
  const endpoints = replay.rows.map(row => ({ source: row.source,
    scoring: breakdown(JSON.parse(row.finalEnvelope.committedState)) }));
  const records = ["7feb57c3.96e60c14", "14114d45.77d36854", "1066a36f.0b586daa"];
  const finals = records.map(id => {
    const recordPath = `reports/research/${id}.full.json`;
    const record = JSON.parse(fs.readFileSync(recordPath));
    const save = JSON.parse(fs.readFileSync(record.savePath));
    const result = breakdown(JSON.parse(save.committedState));
    assert.equal(result.totalScore, record.summary.scores["player-green"]);
    return { recordPath, savePath: record.savePath, scoring: result,
      searchAtStep72: record.metrics.searches.filter(s => s.step === 72) };
  });
  assert.deepEqual(endpoints[2].scoring.cards, [{ cardId: "b_115.webp",
    rule: { kind: "unmarkedFinalRightmost" }, score: 5 }]);
  assert.equal(finals[2].scoring.cards.find(c => c.cardId === "b_115.webp").score, 0);
  const report = { scope: "只复算已有正式状态，不运行AI；当前状态终局价值不是保证兑现值，不能单独归因整局下降",
    endpoints, finals, passed: true };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, passed: true, b115Endpoint: 5, b115Final: 0 }));
}
