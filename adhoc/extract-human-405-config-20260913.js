"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const input = process.argv[2];
if (!input) throw new Error("需要已验证的历史检查点JSONL路径");
const output = "adhoc/human-405-config-evidence-20260913.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const bytes = fs.readFileSync(input);
const checkpoints = bytes.toString().trim().split("\n").map(line => JSON.parse(line));
assert.equal(checkpoints.length, 517);
const ordinary = new Map(), alienSeen = new Set(), events = [], firstReveal = {};
const previousDisplay = {};
function cardsIn(value, result = new Map()) {
  if (!value || typeof value !== "object") return result;
  if (value.id && value.cardId) {
    if (result.has(value.id)) assert.equal(result.get(value.id).cardId, value.cardId);
    result.set(value.id, value);
  }
  for (const child of Object.values(value)) cardsIn(child, result);
  return result;
}
for (const { step, state } of checkpoints) {
  for (const card of cardsIn(state).values()) {
    const match = /^card-(\d+)-/.exec(card.id);
    if (match) {
      const sequence = Number(match[1]);
      if (ordinary.has(sequence)) assert.equal(ordinary.get(sequence).cardId, card.cardId);
      else ordinary.set(sequence, { sequence, cardId: card.cardId, instanceId: card.id, firstStep: step });
    }
    if (card.id.startsWith("alien-") && !alienSeen.has(card.id)) {
      alienSeen.add(card.id);
      events.push({ step, kind: "card-instance", id: card.id, cardId: card.cardId });
    }
  }
  for (const key of ["amiba", "chong"]) {
    const species = state.aliens[key];
    if (!species.revealInitialized) continue;
    if (!firstReveal[key]) firstReveal[key] = { step, state: species };
    if (previousDisplay[key] !== species.displayedCardIndex) {
      events.push({ step, kind: "display", species: key, cardIndex: species.displayedCardIndex });
      previousDisplay[key] = species.displayedCardIndex;
    }
  }
}
const order = [...ordinary.values()].sort((a, b) => a.sequence - b.sequence);
const missing = Array.from({ length: order.at(-1).sequence }, (_, i) => i + 1).filter(i => !ordinary.has(i));
const initial = checkpoints[0].state;
const result = {
  inputSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  historicalCommit: "4fe33887", checkpointCount: checkpoints.length,
  ordinaryGenerationOrder: order, missingOrdinarySequences: missing,
  initial: { solarSystem: initial.solarSystem, tech: initial.tech, finalScoring: initial.finalScoring,
    passReservePiles: initial.cards.passReservePiles, publicCards: initial.cards.publicCards },
  firstReveal, alienEvents: events,
  scope: "从核验过的历史重放提取事实；外星牌首次展示与入手是不同事件，尚未合成为新牌堆。",
};
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, ordinaryCount: order.length, missing,
  firstRevealSteps: Object.fromEntries(Object.entries(firstReveal).map(([k, v]) => [k, v.step])),
  alienEventCount: events.length }, null, 2));
