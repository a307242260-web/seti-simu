"use strict";

const assert = require("node:assert/strict");
const cardSelection = require("./card-selection-decision");

function createOwner(overrides = {}) {
  let inspection = null;
  const owner = cardSelection.createCardSelectionDecisionOwner({
    inspectSession: () => inspection,
    resolvePlayer: (root, pending) => root.players.find((player) => player.id === pending.playerId),
    getCardLabel: (card) => card.label,
    getSelectedPublicSlots: () => overrides.selectedSlots || [],
    getPublicScanChoicesForCard: () => ({ ok: true }),
    getPublicScanMinSelectable: () => 1,
    getPublicCardMultiSelectMinSelectable: () => 1,
    canBlindDraw: () => true,
    isFutureSpanEligibleHandCard: (card) => card.eligible,
  });
  return {
    owner,
    setInspection(value) { inspection = value; },
  };
}

(function testOwnerCreatesSerializableCardDecisionBoundary() {
  const harness = createOwner();
  const root = {
    players: [{ id: "p1", color: "blue", hand: [] }],
    cardState: { publicCards: [{ id: "c1", label: "卡牌一" }] },
  };
  let effect;
  harness.owner.runRuleTransaction(root, () => {
    harness.owner.open(root, {
      type: "public_scan",
      player: root.players[0],
      allowBlindDraw: false,
    });
    effect = harness.owner.takeOpenedDecisionEffect();
  });
  assert.equal(effect.ownerId, "p1");
  assert.equal(effect.kind, "decision");
  assert.equal(effect.payload.choices.length, 1);
  assert.equal(effect.payload.choices[0].target.cardId, "c1");
  assert.deepEqual(effect.payload.choices[0].cardSelection, {
    type: "public_scan",
    playerId: "p1",
    playerColor: "blue",
    effectId: null,
    allowBlindDraw: false,
  });
  assert.equal(harness.owner.read(), null);
})();

(function testOpenCannotEscapeSynchronousRuleTransaction() {
  const harness = createOwner();
  const root = {
    players: [{ id: "p1", color: "blue", hand: [] }],
    cardState: { publicCards: [] },
  };
  assert.throws(
    () => harness.owner.open(root, { type: "public_scan", playerId: "p1" }),
    /只能在当前规则事务内 open/,
  );
  harness.owner.runRuleTransaction(root, () => {
    harness.owner.open(root, { type: "public_scan", playerId: "p1" });
  });
  assert.equal(harness.owner.takeOpenedDecisionEffect(), null);
  assert.equal(harness.owner.read(), null);
})();

(function testRestoredDecisionEffectIsTheOnlyPendingSource() {
  const harness = createOwner();
  harness.setInspection({
    session: {
      currentEffect: {
        kind: "decision",
        type: cardSelection.DECISION_EFFECT_TYPE,
        payload: {
          cardSelection: {
            type: "industry_future_hand",
            playerId: "p1",
            allowBlindDraw: false,
          },
        },
      },
    },
  });
  assert.deepEqual(harness.owner.read(), {
    type: "industry_future_hand",
    playerId: "p1",
    allowBlindDraw: false,
  });
})();

(function testSelectionChoicesCarryPendingPayloadAcrossDecisionVersions() {
  const harness = createOwner({ selectedSlots: [0] });
  const root = {
    players: [{ id: "p1", hand: [] }],
    cardState: { publicCards: [{ id: "c1", label: "一" }, { id: "c2", label: "二" }] },
  };
  let effect;
  harness.owner.runRuleTransaction(root, () => {
    harness.owner.open(root, {
      type: "card_public_corner_discard",
      playerId: "p1",
      minSelectable: 1,
      maxSelectable: 2,
      allowBlindDraw: false,
    });
    effect = harness.owner.takeOpenedDecisionEffect();
  });
  assert.deepEqual(effect.payload.choices.map((choice) => choice.target.kind), [
    "public-card",
    "confirm-public-corner-discard",
  ]);
  assert.equal(effect.payload.choices.every((choice) => (
    choice.cardSelection.type === "card_public_corner_discard"
  )), true);
})();
