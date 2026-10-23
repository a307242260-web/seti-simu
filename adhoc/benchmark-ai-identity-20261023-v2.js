"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const path = "randomizer/game/ai/analysis-port.js";
const source = fs.readFileSync(path, "utf8");
const start = source.indexOf("  function forwardIdentity("), end = source.indexOf("\n  function createAnalysisPort", start);
const original = source.slice(start, end);
const normalStart = original.indexOf("    const references = new Map();");
const normalEnd = original.indexOf("    const pending = session ? {");
const loop = original.slice(normalStart, normalEnd).replace(
  '    function normalize(value, key = "") {',
  '    const referencePattern = prefix && new RegExp(`(${prefix}:(?:effect|group):[0-9]+)`, "g");\n    function normalize(value, key = "") {'
).replaceAll('new RegExp(`(${prefix}:(?:effect|group):[0-9]+)`, "g")', 'referencePattern');
// The declaration itself must keep the actual constructor.
const imperative = loop.replace('const referencePattern = prefix && referencePattern;', 'const referencePattern = prefix && new RegExp(`(${prefix}:(?:effect|group):[0-9]+)`, "g");').replace(
  '      return Object.fromEntries(Object.keys(value).sort()\n        .filter(name => !descriptor || !["actionId", "stateVersion", "decisionVersion"].includes(name))\n        .map(name => [name, normalize(value[name], name)]));',
  '      const result = Object.create(null);\n      for (const name of Object.keys(value).sort()) {\n        if (descriptor && ["actionId", "stateVersion", "decisionVersion"].includes(name)) continue;\n        result[name] = normalize(value[name], name);\n      }\n      return result;'
);
const streaming = `    const references = new Map();
    const prefix = /^effect-session-[0-9]+$/.test(session?.sessionId) ? session.sessionId : null;
    const referencePattern = prefix && new RegExp(\`(\${prefix}:(?:effect|group):[0-9]+)\`, "g");
    const referenceKeys = new Set(["effectId", "parentEffectId", "groupId", "quickGroupId", "decisionId", "choiceId"]);
    function encode(value, key = "") {
      if (typeof value === "string" && prefix && referenceKeys.has(key)) {
        const parts = value.split(referencePattern);
        if (parts.length > 1) return encode(parts.map((part, index) => {
          if (index % 2 === 0) return part;
          if (!references.has(part)) references.set(part, references.size);
          return { reference: references.get(part) };
        }));
      }
      if (!value || typeof value !== "object") return JSON.stringify(value);
      if (Array.isArray(value)) {
        const entries = [];
        for (let index = 0; index < value.length; index += 1) entries.push(encode(value[index]) ?? "null");
        return "[" + entries.join(",") + "]";
      }
      const descriptor = value.schemaVersion === "seti-standard-action-v1";
      const entries = [];
      let integerEntries = null;
      for (const name of Object.keys(value).sort()) {
        if (descriptor && ["actionId", "stateVersion", "decisionVersion"].includes(name)) continue;
        const encoded = encode(value[name], name);
        if (encoded === undefined) continue;
        const entry = JSON.stringify(name) + ":" + encoded;
        // JSON.stringify enumerates array-index properties before other keys, even after lexical insertion.
        const number = Number(name);
        if (Number.isInteger(number) && number >= 0 && number < 4294967295 && String(number) === name) {
          (integerEntries ||= []).push([number, entry]);
        } else entries.push(entry);
      }
      if (integerEntries) entries.unshift(...integerEntries.sort((a, b) => a[0] - b[0]).map(entry => entry[1]));
      return "{" + entries.join(",") + "}";
    }
`;
const variants = { original, imperative: original.slice(0, normalStart) + imperative + original.slice(normalEnd),
  streaming: (original.slice(0, normalStart) + streaming + original.slice(normalEnd))
    .replace('return JSON.stringify(normalize({ state, pending, status, boundary }));', 'return encode({ state, pending, status, boundary });') };
const functions = Object.fromEntries(Object.entries(variants).map(([name, code]) => [name, new Function(`return (${code})`)()]));
const fixtures = ["001", "003", "008", "011", "009", "062", "105", "152"].map(id => {
  const fixturePath = `adhoc/ai-decision-corpus-20261023-v1/case-${id}-20261023-v1.json`;
  return { fixturePath, envelope: JSON.parse(fs.readFileSync(fixturePath)).compositionEnvelope };
});
const edgeState = { meta: {}, extra: { "10": { effectId: "effect-session-72:effect:19" }, "2": { effectId: "effect-session-72:effect:20" },
  "01": -0, "4294967295": Infinity, "0": { choiceId: "prefix:effect-session-72:effect:19:choice" }, undefined: undefined,
  action: { schemaVersion: "seti-standard-action-v1", actionId: "ignored", stateVersion: 2, decisionVersion: 3, target: "保留😀\n\"" },
  array: [undefined, , null, NaN, false], ordinary: "effect-session-72:effect:19", __proto__: null } };
const edge = { committedState: JSON.stringify(edgeState), session: { session: { workingState: edgeState, sessionId: "effect-session-72",
  queue: [{ effectId: "effect-session-72:effect:20", parentEffectId: "effect-session-72:effect:19", choiceId: "effect-session-72:group:7/a" }], journal: { actions: [] } } } };
for (const envelope of [...fixtures.map(f => f.envelope), edge]) {
  const expected = functions.original(envelope, "stable", null);
  for (const name of ["imperative", "streaming"]) assert.equal(functions[name](envelope, "stable", null), expected, name);
}
const rows = [];
for (let round = 0; round < 5; round += 1) {
  for (const name of (round % 2 ? ["streaming", "imperative", "original"] : Object.keys(functions))) {
    let bytes = 0; const at = performance.now();
    for (let repeat = 0; repeat < 20; repeat += 1) for (const fixture of fixtures) bytes += functions[name](fixture.envelope, "stable", null).length;
    rows.push({ round, name, milliseconds: performance.now() - at, calls: 160, bytes });
  }
}
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const report = { scope: "Eight actual checkpoint envelopes and a numeric-key/reference/JSON edge case; exact output byte parity. Microbenchmark only, no search/game speed inference.",
  originalFileSha256: sha(source), functionSources: variants, functionHashes: Object.fromEntries(Object.entries(variants).map(([k,v]) => [k,sha(v)])),
  fixtures: fixtures.map(f => ({ path: f.fixturePath, sha256: sha(fs.readFileSync(f.fixturePath)) })), byteParity: true, rows };
const output = "reports/ai-foundation-20261023/identity-micro-v2.json";
assert(!fs.existsSync(output), "Reuse existing checkpoint"); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(rows));
