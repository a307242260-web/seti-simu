"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const rockets = require("../randomizer/game/rockets"), solar = require("../randomizer/solar-system/core");
const ability = require("../randomizer/game/abilities/rocket"), cards = require("../randomizer/game/cards/effects");
const residual = require("../randomizer/game/effects/residual-domain-session");
const input = "reports/iteration/current-movement-hotspots-20260907.json";
const output = "reports/iteration/turn-visit-routes-shared-progress-v2-20260907.json";
const key = n => `${n.at.x},${n.at.y}/${n.card}/${n.free}/${JSON.stringify(n.progress)}/${n.complete}`;
const compare = (a, b) => a.paid - b.paid || a.moves - b.moves;

// 有限几何费用原型：先打当前手牌，卡牌移动结束后才能使用公司或付费移动。
// 不运行规则搜索、不估计沿途其他收益，最短费用不能用于删除更贵的独立收益路线。
function route(root, actor, rocket, bonus, points, free) {
  const first = { at: rockets.getRocketSectorCoordinate(rocket), card: points, free,
    visits: [], paid: 0, moves: 0, path: [], progress: { usedKeys: [], claimedKeys: [] }, complete: false };
  const best = new Map([[key(first), first]]), queue = [first];
  let expanded = 0;
  while (queue.length) {
    queue.sort(compare);
    const n = queue.shift();
    if (best.get(key(n)) !== n) continue;
    expanded++;
    assert.ok(expanded <= 4096, "原型达到上限必须显式失败，不能当完成");
    if (n.complete) return { ...n, expanded };
    const edges = [];
    if (n.card > 0) edges.push({ ...n, card: 0, path: [...n.path, { mode: "finish-card" }] });
    const cost = ability.getRequiredMovePointsFromCoordinate({ ...root, state: root }, actor, n.at);
    assert.ok(Number.isInteger(cost) && cost > 0);
    for (const d of ability.MOVE_DIRECTIONS) {
      const move = rockets.canMoveFromCoordinate(root.pieces, n.at, d.deltaX, d.deltaY, rocket.id);
      if (!move.ok) continue;
      const content = solar.resolveVisibleContent(move.to.x, move.to.y, root.solarSystem).content;
      const visits = new Set(n.visits);
      const event = { type: "move", playerId: actor.id, sameRing: move.to.y === n.at.y };
      if (content.kind === solar.layout.CONTENT_KIND.COMET) event.type = "visitComet";
      if (content.kind === solar.layout.CONTENT_KIND.ASTEROID) event.type = "visitAsteroid";
      // 正式applyArrivalRewards对地球也生成visitPlanet；不发宣传不等于没有访问。
      if (content.kind === solar.layout.CONTENT_KIND.PLANET) {
        event.type = "visitPlanet"; event.planetId = content.planetId;
      }
      const progress = structuredClone(n.progress);
      const transition = residual.describeEventBonusProgress({ bonus: { ...bonus, ...progress, ownerId: actor.id }, event, ownerId: actor.id });
      if (transition.usedKey) progress.usedKeys.push(transition.usedKey);
      const complete = transition.status === "reward";
      if (complete && transition.claimKey) progress.claimedKeys.push(transition.claimKey);
      if (["progress", "reward"].includes(transition.status)) visits.add(event.planetId || "comet");
      const variants = n.card > 0 ? (cost <= n.card ? [{ mode: "card", card: n.card - cost, free: n.free, paid: n.paid }] : [])
        : [{ mode: "paid", card: 0, free: n.free, paid: n.paid + cost },
          ...(n.free && cost === 1 ? [{ mode: "company", card: 0, free: 0, paid: n.paid }] : [])];
      for (const v of variants) edges.push({ at: move.to, card: v.card, free: v.free, paid: v.paid,
        progress, complete, moves: n.moves + 1, visits: [...visits].sort(), path: [...n.path, { mode: v.mode, direction: d.id,
          from: n.at, to: move.to, points: cost, visits: [...visits].sort() }] });
    }
    for (const next of edges) {
      const prior = best.get(key(next));
      if (prior && compare(prior, next) <= 0) continue;
      best.set(key(next), next); queue.push(next);
    }
  }
  throw new Error("有限路线图耗尽但未找到访问目的");
}

if (fs.existsSync(output)) console.log(`已有路线证据：${output}`);
else {
  const buffer = fs.readFileSync(input), fixture = JSON.parse(buffer);
  const report = { scope: "真实148/497打当前收益牌后的单探测器同回合几何费用；公司额度分别有/无，不证明额度当前可用或其他收益支配，不含资源交换/科技/旋转/其他卡/多探测器", input,
    inputSha256: crypto.createHash("sha256").update(buffer).digest("hex"), rows: [] };
  const start = performance.now();
  for (const entry of fixture.entries) {
    const root = JSON.parse(entry.checkpoint.coreState.committedState), before = JSON.stringify(root);
    const actor = root.players.players.find(p => p.id === entry.actorId);
    const card = actor.hand.find(c => c.cardId === (entry.step === 148 ? "b_24.webp" : "dlc_12.png"));
    assert.ok(card);
    const effects = cards.getCardModel(card.cardId).playEffects;
    assert.equal(effects[0].type, cards.EFFECT_TYPES.REGISTER_EVENT_BONUS);
    assert.equal(effects[1].type, cards.EFFECT_TYPES.CARD_MOVE);
    const bonus = effects[0].options.bonus;
    assert.equal(bonus.duration, "turn");
    for (const rocket of rockets.getRocketsForPlayer(root.pieces, actor.id).filter(r => r.surface === "solar-board")) {
      for (const free of [0, 1]) {
        const result = route(root, actor, rocket, bonus, effects[1].options.movementPoints, free);
        assert.ok(result.path.filter(p => p.mode === "company").length <= free);
        const paidOrCompany = result.path.findIndex(p => ["paid", "company"].includes(p.mode));
        assert.ok(paidOrCompany < 0 || result.path.slice(paidOrCompany).every(p => p.mode !== "card"));
        report.rows.push({ step: entry.step, cardId: card.cardId, rocketId: rocket.id, companyAllowance: free,
          initialEnergy: actor.resources.energy, bonus, ...result });
      }
    }
    assert.equal(JSON.stringify(root), before, "不修改正式状态或序号");
  }
  report.wallMs = performance.now() - start; report.verified = true;
  const before = JSON.parse(fs.readFileSync("reports/iteration/turn-visit-routes-20260907.json"));
  const comparable = rows => rows.map(({ step, cardId, rocketId, companyAllowance, paid, moves, visits, path }) =>
    ({ step, cardId, rocketId, companyAllowance, paid, moves, visits, path }));
  assert.deepEqual(comparable(report.rows), comparable(before.rows), "共享正式进度后实际目的路线与成本不变");
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, wallMs: report.wallMs, rows: report.rows.map(r => ({ step: r.step,
    company: r.companyAllowance, paid: r.paid, moves: r.moves, expanded: r.expanded, visits: r.visits,
    path: r.path.map(p => `${p.mode}:${p.direction || "结束"}`) })) }, null, 2));
}
