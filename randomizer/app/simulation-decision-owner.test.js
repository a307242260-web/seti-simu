"use strict";

const assert = require("node:assert/strict");
const { buildDecision, createSimulationEnv } = require("./simulation-env");
const standardFlowFixture = require("../full-flow/standard-flow-v1.fixture");

function createApi(ownerState, currentPlayerId = "player-blue") {
  return {
    getTurnState: () => ({ gameEnded: false, currentPlayerId }),
    getSimulationDecisionOwnerState: () => structuredClone(ownerState),
  };
}

function assertDecision(ownerState, expected, legalActorPlayerId = expected.actorPlayerId) {
  const decision = buildDecision(
    createApi(ownerState),
    [{
      actorPlayerId: legalActorPlayerId,
      decisionType: expected.decisionType || "conditional_choice",
    }],
  );
  assert.deepEqual(decision, {
    actorPlayerId: expected.actorPlayerId,
    pendingOwnerPlayerId: expected.pendingOwnerPlayerId || null,
    effectOwnerPlayerId: expected.effectOwnerPlayerId || null,
    currentPlayerId: expected.currentPlayerId,
    source: expected.source,
    decisionType: expected.decisionType || "conditional_choice",
    choiceCount: 1,
  });
}

assertDecision({
  actorPlayerId: "player-green",
  pendingOwnerPlayerId: "player-green",
  effectOwnerPlayerId: "player-brown",
  currentPlayerId: "player-blue",
  source: "pending_owner",
}, {
  actorPlayerId: "player-green",
  pendingOwnerPlayerId: "player-green",
  effectOwnerPlayerId: "player-brown",
  currentPlayerId: "player-blue",
  source: "pending_owner",
}, "player-blue");

assertDecision({
  actorPlayerId: "player-brown",
  pendingOwnerPlayerId: null,
  effectOwnerPlayerId: "player-brown",
  currentPlayerId: "player-blue",
  source: "effect_owner",
}, {
  actorPlayerId: "player-brown",
  effectOwnerPlayerId: "player-brown",
  currentPlayerId: "player-blue",
  source: "effect_owner",
});

assertDecision({
  actorPlayerId: "player-blue",
  pendingOwnerPlayerId: null,
  effectOwnerPlayerId: null,
  currentPlayerId: "player-blue",
  source: "current_player",
}, {
  actorPlayerId: "player-blue",
  currentPlayerId: "player-blue",
  source: "current_player",
  decisionType: "turn_action",
});

const ended = buildDecision({
  getTurnState: () => ({ gameEnded: true, currentPlayerId: "player-blue" }),
}, []);
assert.equal(ended, null);

const replaySource = createSimulationEnv();
const replayConfig = { seed: "decision-owner-replay-parity", activePlayerCount: 4 };
const preObservation = replaySource.reset(replayConfig);
const chosenAction = replaySource.legalActions()[0];
const stepResult = replaySource.step(chosenAction);
assert.equal(stepResult.ok, true);
const replay = replaySource.getReplay();
replaySource.dispose();

const replayTarget = createSimulationEnv();
const replayPreObservation = replayTarget.reset(replayConfig);
assert.deepEqual(
  replayPreObservation.decision,
  preObservation.decision,
  "replay 前 decision owner context 必须一致",
);
const replayPostObservation = replayTarget.loadReplay(replay);
assert.deepEqual(
  replayPostObservation.decision,
  stepResult.observation.decision,
  "replay 后 decision owner context 必须一致",
);
replayTarget.dispose();

const openingRegression = createSimulationEnv();
openingRegression.reset(standardFlowFixture.config);
const openingPlayerId = "player-white";
const openingHand = openingRegression.observe(openingPlayerId).selfState.hand;
const originalEntityIds = new Set(openingHand.map((card) => card.id));
const explicitDiscardChoices = [
  { cardId: "b_77.webp", handIndex: 2 },
];
let remainingOriginalEntities = originalEntityIds.size;
let discardCount = openingRegression.observe(openingPlayerId).publicState.board.discardCount;

for (const choice of explicitDiscardChoices) {
  const before = openingRegression.observe(openingPlayerId);
  const selectedEntity = before.selfState.hand.find((card) => card.cardId === choice.cardId);
  assert.ok(selectedEntity, `opening 明确选择必须仍在手牌：${choice.cardId}`);
  const matches = openingRegression.legalActions().filter((candidate) => (
    candidate.family === "choose_payment"
    && candidate.actorPlayerId === openingPlayerId
    && candidate.target?.cardId === choice.cardId
    && candidate.target?.handIndex === choice.handIndex
  ));
  assert.equal(matches.length, 1, `opening cardId/handIndex 必须唯一解析：${choice.cardId}`);

  const result = openingRegression.step(matches[0]);
  assert.equal(result.ok, true, `opening 明确弃牌失败：${choice.cardId}`);
  const after = openingRegression.observe(openingPlayerId);
  const remainingIds = new Set(after.selfState.hand.map((card) => card.id));
  assert.equal(remainingIds.has(selectedEntity.id), false,
    `已弃实体不得在同一 opening 链复活：${selectedEntity.id}`);
  assert.equal(openingRegression.legalActions().some((candidate) => (
    candidate.actorPlayerId === openingPlayerId && candidate.target?.cardId === choice.cardId
  )), false, `下一 Decision 不得再次枚举已弃卡：${choice.cardId}`);
  const nextRemainingOriginalEntities = [...originalEntityIds]
    .filter((entityId) => remainingIds.has(entityId)).length;
  assert.equal(nextRemainingOriginalEntities, remainingOriginalEntities - 1,
    "每次明确弃牌后，原始手牌实体集合必须真实减少 1");
  assert.equal(after.publicState.board.discardCount, discardCount + 1,
    "每次明确弃牌后，弃牌计数必须增加 1");
  remainingOriginalEntities = nextRemainingOriginalEntities;
  discardCount = after.publicState.board.discardCount;
}
openingRegression.dispose();

console.log("simulation decision owner tests passed");
