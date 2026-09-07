"use strict";
const assert = require("node:assert/strict");
const cards = require("../randomizer/game/cards/effects");
const rockets = require("../randomizer/game/rockets");
const solar = require("../randomizer/solar-system/core");
const residual = require("../randomizer/game/effects/residual-domain-session");
const { cardMovementPurposes } = require("./card-movement-purpose-directory-20260907");
const { routeToPurpose } = require("./visit-stage-route-20260907");
const { jointPositionRoute } = require("./joint-position-route-20260907");

// 单/多来源位置与已注册访问目的的接入原型；不是生产选择器。
// 未接入的目的显式列入deferred，禁止消费者据本结果删除全部移动合法集。
function cardMovementRouteGuidance({ root, actorId, inspection, legalActions }) {
  const actor = root.players.players.find(p => p.id === actorId);
  assert.ok(actor);
  const directory = cardMovementPurposes(root, actorId);
  const effect = inspection.session?.currentEffect;
  const cardStage = effect?.payload?.cardEffect?.type === "card_move";
  const companyStage = effect?.payload?.abilityId === "huanyu_free_moves"
    && effect.payload.step === "free_move";
  if (inspection.phase !== "idle" && !cardStage && !companyStage) {
    return { stage: "other-decision", routes: [], deferred: directory.entries.map(p => ({
      purposeId: p.id, reason: "settle-current-owner-first",
    })) };
  }
  const companyDefinition = residual.createActionDefinitions().find(d => d.family === "industry");
  assert.ok(companyDefinition, "必须读取正式公司可用性owner");
  const companyOptions = companyDefinition.enumerate({ state: root, standardActionAuthority: { actorId } });
  const futureCompanyAvailable = companyOptions.some(c =>
    c.target.abilityId === "huanyu_free_moves");
  const cardPoints = cardStage ? effect.payload.remaining ?? effect.payload.cardEffect.options.movementPoints : 0;
  if (companyStage) {
    assert.ok(Number.isInteger(effect.payload.remaining) && effect.payload.remaining > 0);
    assert.ok(Array.isArray(effect.payload.usedRocketIds));
  }
  const own = rockets.getRocketsForPlayer(root.pieces, actorId).filter(r => r.surface === "solar-board"
    && (r.kind || "standard") === "standard");
  const routes = [], deferred = [];
  const coordinates = solar.collectVisibleCoordinateContents(root.solarSystem)
    .filter(c => c.y >= rockets.SECTOR_RING_MIN && c.y <= rockets.SECTOR_RING_MAX);
  const matching = (first, action) => {
    if (first.mode === "start-company" || (first.mode === "company" && !companyStage)) return action.family === "industry"
      && action.target.abilityId === "huanyu_free_moves";
    if (first.mode === "finish-card" || first.mode === "finish-company") {
      return action.phase === "conditional" && action.target?.skip === true;
    }
    return action.family === (first.mode === "paid" ? "move" : "choose_target")
      && action.target.rocketId === first.rocketId && action.target.deltaX === first.deltaX
      && action.target.deltaY === first.deltaY;
  };
  for (const purpose of directory.entries) {
    if (purpose.kind === "position" && purpose.sourceArity === "joint") {
      const result = jointPositionRoute({ root, actor, condition: purpose.condition,
        stage: cardStage ? "card" : companyStage ? "company" : "paid", cardPoints,
        // 寰宇正式规则：至多两艘各一步；进行中额度来自实际payload，不能重开。
        companyRemaining: companyStage ? effect.payload.remaining : futureCompanyAvailable ? 2 : 0,
        usedRocketIds: companyStage ? effect.payload.usedRocketIds : [] });
      routes.push({ purposeId: purpose.id, source: purpose.source, phase: purpose.phase,
        sourceArity: "joint", rocketIds: result.sourceIds, result,
        nextActions: legalActions.filter(a => result.choices.some(c => matching(c.first, a))) });
      continue;
    }
    if (!(purpose.kind === "position" || (purpose.kind === "bonus" && purpose.phase === "registered"))) {
      deferred.push({ purposeId: purpose.id, reason: "registration-or-trigger-chain-not-integrated" }); continue;
    }
    for (const rocket of own) {
      let goal;
      if (purpose.kind === "bonus") goal = { kind: "bonus", bonus: purpose.bonus };
      else {
        const destinations = coordinates.filter(coordinate => {
          const moved = { ...rocket }, pieces = { ...root.pieces,
            rockets: root.pieces.rockets.map(r => r.id === rocket.id ? moved : r) };
          if (!rockets.placeRocketByPriority(pieces, moved, coordinate.x, coordinate.y)) return false;
          const facts = rockets.buildProbeLocationData({ ...root, pieces });
          return cards.taskConditionMet({ condition: purpose.condition }, actor, {
            probeLocations: facts.index, probeLocationDetails: facts.details,
          });
        }).map(({ x, y }) => ({ x, y }));
        goal = { kind: "position", destinations };
      }
      const result = routeToPurpose({ root, actor, rocket, purpose: goal, cardPoints,
        companyAvailable: companyStage ? !effect.payload.usedRocketIds.includes(rocket.id) : futureCompanyAvailable,
        companyPending: companyStage });
      routes.push({ purposeId: purpose.id, source: purpose.source, phase: purpose.phase,
        rocketId: rocket.id, result, nextActions: legalActions.filter(a => result.choices.some(c => matching(c.first, a))) });
    }
  }
  return { stage: cardStage ? "card" : companyStage ? "company" : "idle", routes, deferred };
}
module.exports = { cardMovementRouteGuidance };
