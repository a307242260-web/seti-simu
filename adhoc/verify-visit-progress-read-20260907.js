"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const cards = require("../randomizer/game/cards/effects"), residual = require("../randomizer/game/effects/residual-domain-session");
const mode = process.argv[2];
assert.ok(["before", "after"].includes(mode));
const output = `reports/iteration/visit-progress-read-${mode}-20260907.json`;
const digest = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
if (fs.existsSync(output)) console.log(`已有进度契约证据：${output}`);
else {
  const input = "reports/iteration/company-hot-prefix-20260907.json", raw = fs.readFileSync(input);
  const initial = JSON.parse(JSON.parse(raw).envelope.committedState), entries = [];
  function collect(node, cardId, path) {
    if (!node || typeof node !== "object") return;
    if (node.type === cards.EFFECT_TYPES.REGISTER_EVENT_BONUS) entries.push({ cardId, path, effect: node });
    for (const [key, child] of Object.entries(node)) collect(child, cardId, `${path}.${key}`);
  }
  for (const cardId of Object.keys(cards.MODELS)) collect(cards.getCardModel(cardId), cardId, "model");
  assert.equal(entries.length, 18);
  const report = { input, inputSha256: crypto.createHash("sha256").update(raw).digest("hex"), mode, rows: [], queries: [] };
  try {
    for (const entry of entries) for (const variant of ["initialized", "legacy", "already-claimed", "wrong-owner"]) {
      const root = structuredClone(initial), ownerId = "player-green";
      root.players.players.find(p => p.id === ownerId).reservedCards = [];
      const bonus = { ...structuredClone(entry.effect.options.bonus), id: entry.effect.id,
        ownerId: variant === "wrong-owner" ? "player-blue" : ownerId, usedKeys: [], claimedKeys: [] };
      if (variant === "legacy") { delete bonus.usedKeys; delete bonus.claimedKeys; }
      if (variant === "already-claimed" && bonus.onceKey) bonus.claimedKeys = [bonus.onceKey];
      root.turn.cardTurnEventBonuses = [bonus];
      const base = { type: bonus.eventType, playerId: ownerId, rocketId: 3, source: "visit-progress-contract",
        planetId: (bonus.includePlanetIds || ["mars"])[0], sameRing: true, publicityReward: 1,
        nebulaId: bonus.color ? cards.NEBULA_IDS_BY_COLOR[bonus.color][0] : (bonus.nebulaIds || ["sector-1-a"])[0], sectorX: 0 };
      const sequence = [{ ...base, type: "unrelated-event" }, base, base,
        { ...base, planetId: "venus", sectorX: 1 }, { ...base, planetId: "venus", sectorX: 1 }, base];
      const row = { cardId: entry.cardId, path: entry.path, variant, steps: [] };
      for (const event of sequence) {
        let progress;
        const prior = structuredClone(bonus);
        if (mode === "after") {
          const query = freeze({ bonus: structuredClone(bonus), event: structuredClone(event), ownerId });
          const before = JSON.stringify(query);
          progress = residual.describeEventBonusProgress(query);
          assert.equal(JSON.stringify(query), before);
          assert.ok(Object.values(progress).every(v => v !== undefined));
          report.queries.push({ cardId: entry.cardId, variant, event, progress });
        }
        const result = residual.augmentEffectResult(root, { ok: true, events: [event], spawnedEffects: [] }, { ownerId });
        assert.equal(result.ok, true);
        if (mode === "after") {
          const expected = structuredClone(prior);
          if (!["inapplicable", "repeated"].includes(progress.status)) {
            if (progress.usedKey) { expected.usedKeys = expected.usedKeys || []; expected.usedKeys.push(progress.usedKey); }
            expected.claimedKeys = expected.claimedKeys || [];
            if (progress.status === "reward" && progress.claimKey) expected.claimedKeys.push(progress.claimKey);
          }
          assert.deepEqual(bonus, expected, "只读进度与正式领取写入一致");
        }
        row.steps.push({ event, bonus: structuredClone(bonus), result, rootSha256: digest(root) });
      }
      report.rows.push(row);
    }
    if (mode === "after") {
      const before = JSON.parse(fs.readFileSync("reports/iteration/visit-progress-read-before-20260907.json"));
      assert.deepEqual(report.rows, before.rows, "18模型完整状态与结果和提取前逐项相等");
    }
    report.verified = true;
  } catch (error) {
    report.verified = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  }
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, verified: report.verified, rows: report.rows.length,
    events: report.rows.reduce((n, r) => n + r.steps.length, 0), error: report.error }));
}
