"use strict";
const assert = require("node:assert/strict");
const rockets = require("../randomizer/game/rockets");
const solar = require("../randomizer/solar-system/core");
const ability = require("../randomizer/game/abilities/rocket");
const residual = require("../randomizer/game/effects/residual-domain-session");

// 设计原型，不接生产选择器。给定一个真实有效的bonus目的，返回当前阶段所有
// 最低付费点、再最少移动次数的首步。只证明该目的的费用，不证明沿途其他收益支配。
// 两个等费用首步必须保留；位置相同但访问进度不同不是同一状态。
function visitRoute({ root, actor, rocket, bonus, cardPoints, companyAvailable, companyPending = false }) {
  assert.ok(Number.isInteger(cardPoints) && cardPoints >= 0);
  assert.equal(typeof companyAvailable, "boolean");
  const possibleEvents = [{ type: "move", sameRing: true }, { type: "move", sameRing: false }];
  function arrivalEvents(at) {
    const content = solar.resolveVisibleContent(at.x, at.y, root.solarSystem).content;
    if (content.kind === solar.layout.CONTENT_KIND.PLANET) return [{ type: "visitPlanet", planetId: content.planetId }];
    if (content.kind === solar.layout.CONTENT_KIND.COMET) return [{ type: "visitComet" }];
    if (content.kind === solar.layout.CONTENT_KIND.ASTEROID) return [{ type: "visitAsteroid" }];
    return [];
  }
  for (let x = 0; x < 8; x++) for (let y = rockets.SECTOR_RING_MIN; y <= rockets.SECTOR_RING_MAX; y++) {
    possibleEvents.push(...arrivalEvents({ x, y }));
  }
  const availability = new Set(possibleEvents.map(event => residual.describeEventBonusProgress({
    bonus, event: { ...event, playerId: actor.id }, ownerId: actor.id,
  }).status));
  // 先证明存在进度；已领取的一次性bonus仍可能记录新usedKeys，但不再是领奖需求。
  // 此处枚举事件的超集只做不可达判定，不把尚未可达的事件当成已取得奖励。
  if (![...availability].some(status => status === "reward" || status === "progress")) {
    return { status: "unreachable", reason: "no-reward-progress", expanded: 0,
      statuses: [...availability].sort(), choices: [] };
  }
  const compare = (a, b) => a.paid - b.paid || a.moves - b.moves;
  const key = n => JSON.stringify([n.at.x, n.at.y, n.card, n.company, n.pending,
    n.usedKeys, n.claimedKeys, n.complete, n.first]);
  const start = { at: rockets.getRocketSectorCoordinate(rocket), card: cardPoints,
    company: companyAvailable, pending: companyPending, usedKeys: [...(bonus.usedKeys || [])],
    claimedKeys: [...(bonus.claimedKeys || [])], paid: 0, moves: 0, complete: false,
    first: "start", path: [] };
  const queue = [start], best = new Map([[key(start), start]]), winners = [];
  let expanded = 0, optimum;
  const statuses = new Set();
  while (queue.length) {
    queue.sort(compare);
    const n = queue.shift();
    if (best.get(key(n)) !== n) continue;
    if (optimum && compare(n, optimum) > 0) break;
    assert.ok(++expanded <= 4096, "VISIT_ROUTE_BUDGET_EXCEEDED: 原型未完成，不能冒充无可达目标");
    if (n.complete) { optimum = n; winners.push(n); continue; }
    const edges = [];
    const append = (next, step) => {
      const first = n.first === "start" ? JSON.stringify(step) : n.first;
      edges.push({ ...next, first, path: [...n.path, step] });
    };
    if (n.card > 0) append({ ...n, card: 0 }, { mode: "finish-card" });
    if (n.pending) append({ ...n, company: false, pending: false }, { mode: "finish-company" });
    const points = ability.getRequiredMovePointsFromCoordinate({ ...root, state: root }, actor, n.at);
    assert.ok(Number.isInteger(points) && points > 0);
    for (const d of ability.MOVE_DIRECTIONS) {
      const moved = rockets.canMoveFromCoordinate(root.pieces, n.at, d.deltaX, d.deltaY, rocket.id);
      if (!moved.ok) continue;
      const events = arrivalEvents(moved.to);
      // 正式移动同时产生到达事件和move事件；到达行星不抹掉b125的同环移动条件。
      events.push({ type: "move", sameRing: moved.to.y === n.at.y });
      const progress = { usedKeys: [...n.usedKeys], claimedKeys: [...n.claimedKeys] };
      let complete = false;
      for (const event of events) {
        const result = residual.describeEventBonusProgress({ bonus: { ...bonus, ...progress },
          event: { ...event, playerId: actor.id }, ownerId: actor.id });
        assert.ok(["inapplicable", "repeated", "claimed", "progress", "reward"].includes(result.status));
        statuses.add(result.status);
        if (result.usedKey) progress.usedKeys.push(result.usedKey);
        if (result.status === "reward") {
          complete = true;
          if (result.claimKey) progress.claimedKeys.push(result.claimKey);
        }
      }
      const variants = n.card > 0
        ? (points <= n.card ? [{ mode: "card", card: n.card - points, company: n.company, pending: false, paid: n.paid }] : [])
        : n.pending
          ? (n.company && points === 1 ? [{ mode: "company", card: 0, company: false, pending: false, paid: n.paid }] : [])
          : [{ mode: "paid", card: 0, company: n.company, pending: false, paid: n.paid + points },
            ...(n.company && points === 1 ? [{ mode: "company", card: 0, company: false, pending: false, paid: n.paid }] : [])];
      for (const v of variants) append({ ...n, ...v, ...progress, at: moved.to, complete, moves: n.moves + 1 },
        { mode: v.mode, direction: d.id, rocketId: rocket.id, deltaX: d.deltaX, deltaY: d.deltaY });
    }
    for (const next of edges) {
      const prior = best.get(key(next));
      if (prior && compare(prior, next) <= 0) continue;
      best.set(key(next), next); queue.push(next);
    }
  }
  if (!winners.length) return { status: "unreachable", expanded, statuses: [...statuses].sort(), choices: [] };
  const choices = new Map();
  for (const n of winners) {
    if (!choices.has(n.first)) choices.set(n.first, { first: JSON.parse(n.first), paths: [] });
    choices.get(n.first).paths.push(n.path);
  }
  return { status: "reachable", expanded, paid: optimum.paid, moves: optimum.moves,
    choices: [...choices.values()] };
}
module.exports = { visitRoute };
