"use strict";
const assert = require("node:assert/strict");
const rockets = require("../randomizer/game/rockets");
const cards = require("../randomizer/game/cards/effects");
const ability = require("../randomizer/game/abilities/rocket");

// 联合位置目的的阶段图原型。整个正式位置谓词成立才结束，卡牌点是共享额度，
// 公司点只能由不同来源各用一次。此处仅计算移动点，不执行任务/奖励/支付Decision。
function jointPositionRoute({ root, actor, condition, stage, cardPoints, companyRemaining, usedRocketIds }) {
  assert.equal(condition.type, "probesOnDifferentPlanets");
  assert.ok(["paid", "card", "company"].includes(stage));
  assert.ok(Number.isInteger(cardPoints) && cardPoints >= 0);
  assert.ok(Number.isInteger(companyRemaining) && companyRemaining >= 0 && companyRemaining <= 2);
  assert.ok(Array.isArray(usedRocketIds));
  const sourceIds = rockets.getRocketsForPlayer(root.pieces, actor.id)
    .filter(r => r.surface === "solar-board" && (r.kind || "standard") === "standard").map(r => r.id);
  const fulfilled = pieces => {
    const facts = rockets.buildProbeLocationData({ ...root, pieces });
    return cards.taskConditionMet({ condition }, actor, { probeLocations: facts.index, probeLocationDetails: facts.details });
  };
  if (fulfilled(root.pieces)) return { status: "satisfied", expanded: 0, choices: [], sourceIds };
  const compare = (a, b) => a.paid - b.paid || a.moves - b.moves;
  const key = n => JSON.stringify([n.pieces, n.stage, n.card, n.company, n.used, n.first]);
  const initial = { pieces: structuredClone(root.pieces), stage, card: cardPoints,
    company: companyRemaining, used: [...usedRocketIds].sort((a, b) => a - b),
    paid: 0, moves: 0, first: "start", path: [] };
  const queue = [initial], best = new Map([[key(initial), initial]]), winners = [];
  let expanded = 0, optimum;
  while (queue.length) {
    queue.sort(compare);
    const n = queue.shift();
    if (best.get(key(n)) !== n) continue;
    if (optimum && compare(n, optimum) > 0) break;
    assert.ok(++expanded <= 4096, "JOINT_POSITION_BUDGET_EXCEEDED: 不能把未完成查询称作不可达");
    if (fulfilled(n.pieces)) { optimum = n; winners.push(n); continue; }
    const append = (next, step) => {
      const entry = { ...next, first: n.first === "start" ? JSON.stringify(step) : n.first,
        path: [...n.path, step] };
      const previous = best.get(key(entry));
      if (previous && compare(previous, entry) <= 0) return;
      best.set(key(entry), entry); queue.push(entry);
    };
    if (n.stage === "card") append({ ...n, stage: "paid", card: 0 }, { mode: "finish-card" });
    if (n.stage === "company") append({ ...n, stage: "paid", company: 0 }, { mode: "finish-company" });
    if (n.stage === "paid" && n.company > 0) append({ ...n, stage: "company" }, { mode: "start-company" });
    for (const rocketId of sourceIds) {
      if (n.stage === "company" && (n.company === 0 || n.used.includes(rocketId))) continue;
      const rocket = n.pieces.rockets.find(r => r.id === rocketId);
      const at = rockets.getRocketSectorCoordinate(rocket);
      assert.ok(at, "联合位置来源缺少实际坐标");
      const points = ability.getRequiredMovePointsFromCoordinate({ ...root, pieces: n.pieces, state: { ...root, pieces: n.pieces } }, actor, at);
      assert.ok(Number.isInteger(points) && points > 0);
      if (n.stage === "card" && points > n.card) continue;
      if (n.stage === "company" && points !== 1) continue;
      for (const direction of ability.MOVE_DIRECTIONS) {
        const legal = rockets.canMoveRocket(n.pieces, rocketId, direction.deltaX, direction.deltaY);
        if (!legal.ok) continue; // 几何合法性查询，不是失败的正式输入。
        const pieces = structuredClone(n.pieces);
        const moved = rockets.moveRocket(pieces, rocketId, direction.deltaX, direction.deltaY);
        assert.equal(moved.ok, true, moved.message);
        const company = n.company - Number(n.stage === "company");
        const card = n.card - (n.stage === "card" ? points : 0);
        append({ ...n, pieces, company, card,
          stage: (n.stage === "company" && company === 0) || (n.stage === "card" && card === 0) ? "paid" : n.stage,
          used: n.stage === "company" ? [...n.used, rocketId].sort((a, b) => a - b) : n.used,
          paid: n.paid + (n.stage === "paid" ? points : 0), moves: n.moves + 1 },
        { mode: n.stage, rocketId, deltaX: direction.deltaX, deltaY: direction.deltaY, direction: direction.id });
      }
    }
  }
  if (!winners.length) return { status: "unreachable", reason: "current-sources-cannot-satisfy", expanded, sourceIds, choices: [] };
  const choices = new Map();
  for (const n of winners) {
    if (!choices.has(n.first)) choices.set(n.first, { first: JSON.parse(n.first), paths: [] });
    choices.get(n.first).paths.push(n.path);
  }
  return { status: "reachable", expanded, paid: optimum.paid, moves: optimum.moves, sourceIds, choices: [...choices.values()] };
}
module.exports = { jointPositionRoute };
