"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSeededRandom } = require("../randomizer/game/random");
const cards = require("../randomizer/game/cards/deck");
const input = "adhoc/human-405-config-evidence-20260913.json";
const output = "adhoc/human-405-fixed-config-20260913.json";
if (fs.existsSync(output)) { console.log(`已有配置：${output}`); process.exit(0); }
const bytes = fs.readFileSync(input), evidence = JSON.parse(bytes);
assert.deepEqual(evidence.missingOrdinarySequences, []);
const known = evidence.ordinaryGenerationOrder.map((entry, index) => {
  assert.equal(entry.sequence, index + 1);
  return entry.cardId;
});
assert.equal(new Set(known).size, known.length);
const normalState = cards.createCardState();
cards.initializeDrawPile(normalState, createSeededRandom("human-405-unseen-v1"));
const unknown = normalState.drawPileCardIds.filter(id => !known.includes(id));
const ordinaryDeck = [...known, ...unknown];
assert.equal(ordinaryDeck.length, cards.CARD_CATALOG.length);
const alienConfigurations = {};
for (const key of ["amiba", "chong"]) {
  const reveal = evidence.firstReveal[key], events = evidence.alienEvents.filter(event =>
    event.species === key || event.id?.startsWith(`alien-${key}-`));
  const deck = [reveal.state.displayedCardIndex];
  for (const event of events) {
    const index = event.kind === "display" ? event.cardIndex : Number(event.cardId.match(/_(\d+)\./)[1]);
    if (index != null && !deck.includes(index)) deck.push(index);
  }
  const knownCount = deck.length;
  // 剩余牌尚未观测：保留原档首次揭示后牌堆中的相对顺序，亦为确定性补齐。
  for (const index of reveal.state.cardDeck) if (!deck.includes(index)) deck.push(index);
  assert.deepEqual([...deck].sort((a, b) => a - b), Array.from({ length: 10 }, (_, i) => i));
  // 在新顶牌规则下重放原档的取牌/展示事件，不运行AI或旧规则。
  const pending = [...deck];
  let displayed = pending.shift();
  for (const event of events) {
    if (event.kind === "display") {
      assert.equal(displayed, event.cardIndex, `${key}第${event.step}步展示分叉`);
    } else {
      const index = Number(event.cardId.match(/_(\d+)\./)[1]);
      if (index === displayed) displayed = pending.shift() ?? null;
      else assert.equal(pending.shift(), index, `${key}第${event.step}步盲抽分叉`);
    }
  }
  alienConfigurations[key] = { cardDeck: deck, knownCardCount: knownCount };
  if (key === "amiba") alienConfigurations[key].symbolOrder =
    ["orange_1", "orange_2", "blue_3", "red_1", "red_2"].map(slot => reveal.state.symbolSlots[slot]);
  else alienConfigurations[key].fossilOrder = [...reveal.state.planetFossilIds.jupiter,
    ...reveal.state.planetFossilIds.saturn, reveal.state.panelFossilSlots[7]];
}
const result = { version: "human-405-world-v1", seed: "seti-free-analyze-v1",
  evidenceSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  sourceSaveSha256: "bdff1283bc052ec3e833d958f369f0c0ef286ebca1c7a48034efe5a612f029b7",
  knownOrdinaryCount: known.length, ordinaryDeck,
  assignments: { 1: "阿米巴", 2: "虫" }, alienConfigurations,
  verification: "94张普通牌前缀完整保留；21条外星牌展示/入手事件在按顶牌取牌规则下逐条匹配。未验证新内核完整人类重放。" };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, knownOrdinary: known.length, unknownOrdinary: unknown.length,
  alienConfigurations }, null, 2));
