"use strict";
// A bounded research scenario. White uses the shared production search factory;
// the other seats only PASS and settle mandatory PASS choices.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const search = require("../randomizer/game/ai/search-agent");
const cards = require("../randomizer/game/cards/deck");
const effects = require("../randomizer/game/cards/effects");

const ID = "human405-white-round1-v1";
const LEARNER = "player-white";
const OPPONENT_VERSION = "seti-human405-pass-only-v1";
const ROOT = path.resolve(__dirname, "..");
const OPENING_REPORT = "reports/ai-foundation-20261023/human405-white-only-opening-20261030-v1.json";
const PREFERRED_RESERVE = Object.freeze({ "player-green": "b_24.webp", "player-blue": "b_49.webp", "player-brown": "b_80.webp" });

function opening() {
  const proof = JSON.parse(fs.readFileSync(path.join(ROOT, OPENING_REPORT), "utf8"));
  const bytes = fs.readFileSync(path.join(ROOT, proof.checkpointPath));
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  assert.equal(sha256, proof.checkpointSha256, "WHITE_ONLY_OPENING_DRIFT");
  const checkpoint = JSON.parse(bytes);
  assert.equal(checkpoint.replayCursor.stepIndex, 23);
  return { checkpoint, sha256 };
}

function describe(identity, options = {}) {
  if (identity.flags?.scenario !== ID) throw new Error("RESEARCH_SCENARIO_UNKNOWN");
  if (options.full) throw new Error("WHITE_ONLY_ROUND1_REQUIRES_QUICK_MODE");
  if (identity.agentType !== "search" || identity.activePlayerCount !== 4
    || identity.seed !== "seti-free-analyze-v1") throw new Error("WHITE_ONLY_ROUND1_CONFIGURATION_INVALID");
  const source = opening();
  return {
    id: ID, learnerSeat: LEARNER, learnerAgentType: "search", hostAgentFactory: "custom-seat-roles",
    opponentPolicyVersion: OPPONENT_VERSION, opponentReserveRule: "historical-preference-if-offered-otherwise-stable-action-id",
    roles: { "player-white": "shared-search", "player-green": "pass-only", "player-blue": "pass-only", "player-brown": "pass-only" },
    openingInputs: 23, openingCheckpointSha256: source.sha256, stopAfterRound: 1,
    comparisonScope: "white-only-first-round", scoreSemantics: "provisional-after-round1-settlement",
    decisionGate: { nativeInputs: 256, milliseconds: 600 },
  };
}

function passiveAgent(seatId) {
  return Object.freeze({
    getProvenance: () => ({ type: "passive-opponent", version: OPPONENT_VERSION }),
    decide(context) {
      const actions = context.legalActions;
      const pass = actions.find(a => a.family === "pass");
      if (pass) return { actionId: pass.actionId, reasonCode: "research:opponent-pass" };
      if (actions.length && actions.every(a => a.family === "choose_card" && a.target?.kind === "pass-hand-limit")) {
        const hand = context.observation.selfState.hand;
        const remaining = Math.max(0, 4 - context.observation.publicState.roundNumber);
        const utility = card => (effects.getCardPrice(card) || 0)
          + Object.entries(cards.getIncomeGainForCard(card) || {}).reduce((sum, [key, n]) => sum + n * ({ credits: 1, energy: 1, handSize: 1, publicity: .5, availableData: .5 }[key] || 0), 0) * remaining
          + (cards.getDiscardActionRewardForCard(card)?.dataCount || 0) * .5
          + (cards.getDiscardActionMoveRewardForCard(card)?.movementPoints || 0) * .5;
        const ranked = actions.map(action => ({ action, loss: action.target.cardIds.reduce((sum, id) => {
          const card = hand.find(c => c.id === id);
          if (!card) throw new Error("PASSIVE_DISCARD_CARD_MISSING");
          return sum + utility(card);
        }, 0) })).sort((a, b) => a.loss - b.loss || a.action.actionId.localeCompare(b.action.actionId));
        return { actionId: ranked[0].action.actionId, reasonCode: "research:required-pass-discard" };
      }
      if (actions.length && actions.every(a => a.family === "choose_card" && a.target?.kind === "pass-reserve-card")) {
        const preferred = actions.find(a => a.target.cardId === PREFERRED_RESERVE[seatId]);
        const selected = preferred || [...actions].sort((a, b) => a.actionId.localeCompare(b.actionId))[0];
        return { actionId: selected.actionId, reasonCode: preferred ? "research:required-pass-reserve-preference" : "research:required-pass-reserve-stable" };
      }
      throw new Error("PASSIVE_OPPONENT_UNSUPPORTED_DECISION");
    },
  });
}

function assertDecisionGate(evidence) {
  if (evidence.diagnostics.nativeExecutions > 256 || evidence.rootAndSearchMilliseconds > 600) {
    const error = new Error("WHITE_ONLY_DECISION_GATE_EXCEEDED");
    error.code = "WHITE_ONLY_DECISION_GATE_EXCEEDED";
    error.search = evidence;
    throw error;
  }
}

function agentFactory(context) {
  if (context.seatId !== LEARNER) return passiveAgent(context.seatId);
  const agent = search.createSearchAgent({ seatId: context.seatId, analysisPort: context.analysisPort });
  return Object.freeze({ ...agent, decide(input) {
    const result = agent.decide(input);
    try { assertDecisionGate(result.search); } catch (error) {
      agent.loadCheckpoint(null);
      throw error;
    }
    return result;
  } });
}

function createEnvironment(options = {}) {
  return createSimulationEnv({ ...options, agentFactory });
}

function initialize(env, config, metadata) {
  const { checkpoint, sha256 } = opening();
  assert.equal(sha256, metadata.openingCheckpointSha256);
  const canonicalBefore = checkpoint.coreState.committedState;
  // Only host policy configuration changes. The native root, RNG, replay and
  // required session are restored byte-for-byte from the verified opening.
  checkpoint.config = { ...checkpoint.config, ...config, agentType: "custom", seat: LEARNER, opponentIdentity: OPPONENT_VERSION };
  assert.deepEqual(checkpoint.machineAI, {});
  env.loadCheckpoint(checkpoint);
  assert.equal(env.createCheckpoint().coreState.committedState, canonicalBefore);
  return checkpoint.replaySteps;
}

function settled(observation) { return observation.publicState.roundNumber > 1; }

module.exports = { ID, describe, opening, createEnvironment, initialize, settled, passiveAgent, assertDecisionGate };
