"use strict";

const assert = require("node:assert/strict");

const cases = [
  ["action-value", { aiNumber: (value) => Number(value) || 0 }, (domain) => {
    assert.equal(domain.getAiActionGraphBaseNet({ gain: 9, cost: 4 }), 5);
    assert.equal(domain.getAiActionGraphBaseNet({ breakdown: { existingScore: 7 } }), 7);
  }],
  ["alien-choice-value", { players: { RESOURCE_LIMITS: { energy: 5 } }, aiNumber: (value) => Number(value) || 0 }, (domain) => {
    assert.deepEqual(domain.getAiEffectiveBanrenmaRewardGain({ energy: 3, score: 2 }, { resources: { energy: 4 } }), { energy: 1, score: 2 });
  }],
  ["alien-valuation", {}, (domain) => {
    const source = { nested: { value: 2 } };
    const cloned = domain.cloneAiValue(source);
    assert.deepEqual(cloned, source);
    assert.notEqual(cloned.nested, source.nested);
  }],
  ["card-candidates", { banrenma: { isBanrenmaCard: (card) => card?.species === "banrenma" }, chong: { isChongCard: () => false } }, (domain) => {
    assert.equal(domain.doesAiCardReserveAfterPlay({ species: "banrenma" }, 0, null), true);
    assert.equal(domain.doesAiCardReserveAfterPlay({}, 2, null), true);
    assert.equal(domain.doesAiCardReserveAfterPlay({}, 0, {}), false);
  }],
  ["demand-card", {}, (domain) => {
    const demand = domain.createAiStrategyDemand();
    assert.deepEqual(demand.actions, {});
    assert.equal(demand.distanceFromEarth.minDistance, 0);
    assert.equal(domain.resetAiStrategyDemandCache(), undefined);
  }],
  ["final-pace", { ai: null }, (domain) => {
    assert.deepEqual(domain.getAiLaunchPaymentCost({}), { credits: 2 });
    assert.deepEqual(domain.getAiLaunchPaymentCost({ skipCost: true }), {});
    assert.deepEqual(domain.getAiLaunchPaymentCost({ cost: { energy: 1 } }), { energy: 1 });
  }],
  ["income-card", {}, (domain) => {
    assert.equal(domain.isAiPassReservePreviewIncomeCandidate({ cardId: "c1" }, { active: true, incomeCandidates: [{ cardId: "c1" }] }), true);
    assert.equal(domain.isAiPassReservePreviewIncomeCandidate({ cardId: "c2" }, { active: true, incomeCandidates: [{ cardId: "c1" }] }), false);
  }],
  ["movement-industry-data", {}, (domain) => {
    const industry = { id: "industry:test" };
    assert.equal(domain.getAiIndustryCard({ initialSelection: { industry } }), industry);
    assert.equal(domain.getAiIndustryCard({}), null);
  }],
  ["resource-valuation", {}, (domain) => {
    assert.equal(domain.aiNumber("3.5"), 3.5);
    assert.equal(domain.aiNumber("bad"), 0);
    assert.equal(domain.roundAiScore(1.23456), 1.235);
  }],
  ["route-planet", { solar: { mod8: (value) => ((value % 8) + 8) % 8 } }, (domain) => {
    assert.equal(domain.getAiCircularDistanceX(7, 1), 2);
    assert.equal(domain.getAiCircularDistanceX(2, 5), 3);
  }],
  ["scan-value", { getCurrentPlayer: () => ({ id: "p1", color: "blue" }) }, (domain) => {
    const player = { id: "p1", color: "blue" };
    assert.equal(domain.aiTokenBelongsToPlayer({ playerId: "p1" }, player), true);
    assert.equal(domain.aiTokenBelongsToPlayer({ playerColor: "red" }, player), false);
  }],
  ["selection-pressure", { aiNumber: (value) => Number(value) || 0 }, (domain) => {
    assert.equal(domain.isRawNegativeResourceCardCornerAction({ id: "cardCorner", actionKind: "resource", score: -1 }), true);
    assert.equal(domain.isRawNegativeResourceCardCornerAction({ id: "cardCorner", actionKind: "move", score: -1 }), false);
  }],
  ["state-summary", {}, (domain) => assert.equal(domain.countAiPlayerTech({ techState: { ownedTiles: { orange: [1, 2], blue: 3 } } }), 3)],
  ["tech-action", {}, (domain) => {
    assert.equal(domain.aiResearchTechEventMatches({ type: "researchTech" }, "blue"), true);
    assert.equal(domain.aiResearchTechEventMatches({ type: "researchTech", techType: "orange" }, "blue"), false);
    assert.equal(domain.aiResearchTechEventMatches({ type: "scan" }, "blue"), false);
  }],
  ["tech-candidates", { getCurrentPlayer: () => null }, (domain) => assert.deepEqual(
    domain.selectExecutableAiResearchTechCandidate([], null, null, []),
    { candidate: null, check: { ok: false, message: "没有可研究科技候选" } },
  )],
  ["trade-candidates", {
    getAiCardDisplayLabel: () => "测试牌", getCurrentPlayer: () => ({ id: "p1" }),
    getCardPrice: () => 2, getCardTypeCode: () => 1, roundAiScore: (value) => Number(value) || 0,
  }, (domain) => {
    const summary = domain.summarizeAiTradeDiscardCardEntry({ handIndex: 0, card: { id: "c1" }, opportunityCost: 3 });
    assert.equal(summary.cardLabel, "测试牌");
    assert.equal(summary.opportunityCost, 3);
  }],
];

for (const [moduleName, dependencies, verify] of cases) {
  const factoryName = `create${moduleName.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("")}`;
  verify(require(`./${moduleName}`)[factoryName](dependencies));
}

console.log(`game/ai domain unit tests passed (${cases.length})`);
