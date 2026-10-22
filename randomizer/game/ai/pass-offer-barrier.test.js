"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const { createAnalysisPort } = require("./analysis-port");
const read = p => JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../..", p)));
const f = read("adhoc/ai-decision-corpus-20261023-v1/case-008-20261023-v1.json");
const seed = f.source.seed, seatId = f.seatId;
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed }); const comp = kernel.composition;
function restore(envelope) { const result = comp.lifecycle.restore(envelope); assert(result.ok, JSON.stringify(result)); }
let reference = null;
const actualOffers = [];
for (const swapped of [false, true]) {
  const state = JSON.parse(f.compositionEnvelope.committedState);
  if (swapped) [state.cards.passReservePiles[1], state.cards.passReservePiles[2]] = [state.cards.passReservePiles[2], state.cards.passReservePiles[1]];
  restore({ ...f.compositionEnvelope, committedState: JSON.stringify(state) });
  const before = comp.lifecycle.save().envelope;
  const port = createAnalysisPort({ composition: comp, seatId }), root = port.openRoot();
  const child = port.expand(root, root.legalActions.find(action => action.family === "pass").actionId);
  assert.equal(child.status, "information-barrier", "规划必须停在PASS预留牌首次公开处，不能提前读取未来选项");
  assert.equal(child.boundary, "hidden_pass_reserve_offer"); assert.deepEqual(child.legalActions, []);
  assert.equal(child.observation.selfState.hand.length, root.observation.selfState.hand.length, "尚未选择预留牌不能冒充已取得手牌");
  if (!reference) reference = child.observation; else assert.deepEqual(child.observation, reference, "替换尚未公开的预留牌不改变可见边界");
  assert.deepEqual(comp.lifecycle.save().envelope, before); port.close();
  const submitPass = () => assert(comp.inputPort.submitAction(comp.inputPort.enumerateActions({}).find(action => action.family === "pass")).ok);
  submitPass(); const revealed = comp.lifecycle.save().envelope;
  assert.equal(comp.inspect().session.irreversibleBarrier.code, "hidden_pass_reserve_offer");
  const inspection = comp.inspect().session;
  assert.equal(comp.inputPort.undo({ sessionId: inspection.sessionId, revision: inspection.revision }).code, "EFFECT_UNDO_IRREVERSIBLE_BARRIER");
  restore(before); submitPass(); assert.deepEqual(comp.lifecycle.save().envelope, revealed, "正式公开的恢复重放一致");
  const known = createAnalysisPort({ composition: comp, seatId }), knownRoot = known.openRoot();
  assert.equal(knownRoot.status, "decision"); assert(known.passReserveChoiceSpec(knownRoot));
  actualOffers.push(knownRoot.legalActions.map(action => action.target.cardId));
  const selected = known.expand(knownRoot, knownRoot.legalActions[0].actionId);
  assert.equal(selected.status, "other-owner"); assert.equal(selected.observation.selfState.hand.length, knownRoot.observation.selfState.hand.length + 1);
  known.close();
}
assert.notDeepEqual(actualOffers[0], actualOffers[1], "差分实际替换了待公开选项");
for (const finalRound of [false, true]) {
  const state = JSON.parse(f.compositionEnvelope.committedState);
  if (finalRound) state.turn.roundNumber = 4;
  else { state.cards.discardPile.push(...state.cards.passReservePiles[1]); state.cards.passReservePiles[1] = []; }
  restore({ ...f.compositionEnvelope, committedState: JSON.stringify(state) });
  const port = createAnalysisPort({ composition: comp, seatId }), root = port.openRoot();
  const child = port.expand(root, root.legalActions.find(action => action.family === "pass").actionId);
  assert.equal(child.status, "other-owner", "空叠/末轮没有新选项，不虚构信息屏障"); port.close();
}
const five = read("reports/ai-foundation-20261022/analysis-root-input-v2.json").coreState.compositionEnvelope;
restore(five);
const port = createAnalysisPort({ composition: comp, seatId }), root = port.openRoot();
const discard = port.expand(root, root.legalActions.find(action => action.family === "pass").actionId);
assert.equal(discard.status, "decision", "强制弃牌先于公开预留牌，不能提前停止并跳过费用");
const offered = port.expand(discard, discard.legalActions[0].actionId);
assert.equal(offered.status, "information-barrier"); assert.equal(offered.boundary, "hidden_pass_reserve_offer");
port.close(); comp.dispose();
console.log(JSON.stringify({ passOfferBarrier: "passed", hiddenWorldVariants: 2, actualOfferStillSelectable: true,
  forcedDiscardPreserved: true, emptyAndFinalRoundNoBarrier: true, replayAndUndo: true }));
