"use strict";
const assert = require("node:assert/strict");
const cards = require("../cards/effects");
const { describeEventBonusProgress } = require("./residual-domain-session");

function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function read(cardId, event, progress = {}, ownerId = "green") {
  const effect = cards.getCardModel(cardId).playEffects.find(e => e.type === cards.EFFECT_TYPES.REGISTER_EVENT_BONUS);
  const input = freeze({ bonus: { ...structuredClone(effect.options.bonus), id: effect.id,
    ownerId: "green", usedKeys: [], claimedKeys: [], ...progress }, event, ownerId });
  const before = JSON.stringify(input), result = describeEventBonusProgress(input);
  assert.equal(JSON.stringify(input), before, "读取不能写入进度、领取状态或事件");
  assert.ok(Object.values(result).every(value => value !== undefined));
  return result;
}

const mars = { type: "visitPlanet", planetId: "mars" }, venus = { type: "visitPlanet", planetId: "venus" };
assert.deepEqual(read("dlc_12.png", mars), { status: "progress", usedKey: "mars", claimKey: "dlc12-two-planets" });
assert.deepEqual(read("dlc_12.png", mars, { usedKeys: ["mars"] }), { status: "repeated" });
assert.deepEqual(read("dlc_12.png", venus, { usedKeys: ["mars"] }), { status: "reward", usedKey: "venus", claimKey: "dlc12-two-planets" });
assert.deepEqual(read("dlc_12.png", venus, { usedKeys: ["mars"], claimedKeys: ["dlc12-two-planets"] }),
  { status: "claimed", usedKey: "venus", claimKey: "dlc12-two-planets" });
assert.deepEqual(read("dlc_12.png", mars, {}, "blue"), { status: "inapplicable" });
assert.deepEqual(read("b_24.webp", mars), { status: "inapplicable" });
assert.deepEqual(read("b_24.webp", { type: "visitComet" }), { status: "reward", claimKey: "b24-comet-score" });
assert.deepEqual(read("b_24.webp", { type: "visitComet" }, { claimedKeys: ["b24-comet-score"] }),
  { status: "claimed", claimKey: "b24-comet-score" });
assert.deepEqual(read("b_66.webp", mars), { status: "reward", usedKey: "mars" });
assert.deepEqual(read("b_66.webp", mars, { usedKeys: ["mars"] }), { status: "repeated" });
assert.deepEqual(read("aomomo_5.webp", { type: "visitPlanet", planetId: "aomomo" }), { status: "reward" });
assert.deepEqual(read("aomomo_5.webp", mars), { status: "inapplicable" });
assert.deepEqual(read("b_125.webp", { type: "move", sameRing: false }), { status: "inapplicable" });
assert.deepEqual(read("b_125.webp", { type: "move", sameRing: true }), { status: "reward", claimKey: "b125-same-ring-reward" });
console.log("event-bonus-progress.test.js: 访问进度、阈值、领取、所有权和只读契约通过");
