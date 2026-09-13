"use strict";
const fs = require("node:fs");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const source = process.argv[2];
const output = "adhoc/human-405-world-audit-20260913.json";
if (!source) throw new Error("需要明确的405分存档路径");
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const bytes = fs.readFileSync(source);
const save = JSON.parse(bytes);
const root = JSON.parse(save.committedState);
assert.equal(root.players.players.find(p => p.color === "white").finalScore, 405);
const instances = new Map();
function visit(value, path) {
  if (!value || typeof value !== "object") return;
  if (typeof value.id === "string" && typeof value.cardId === "string") {
    const existing = instances.get(value.id);
    if (existing) assert.equal(existing.cardId, value.cardId, `同实体牌身份冲突：${value.id}`);
    else instances.set(value.id, { id: value.id, cardId: value.cardId, path });
  }
  for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
}
visit(root, "committedState");
const ordinary = [...instances.values()].filter(c => /^card-\d+-/.test(c.id))
  .map(c => ({ ...c, sequence: Number(c.id.split("-")[1]) })).sort((a, b) => a.sequence - b.sequence);
const present = new Set(ordinary.map(c => c.sequence));
const max = Math.max(...present);
const report = {
  source, sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  savedAt: save.savedAt, seed: save.seed, steps: save.replaySteps.length,
  score: root.players.players.map(p => ({ color: p.color, base: p.resources.score, final: p.finalScore })),
  slots: Object.entries(root.aliens.aliens).map(([slotId, s]) => ({ slotId, alienId: s.alienId, revealed: s.revealed })),
  ordinaryInstances: ordinary,
  missingOrdinarySequences: Array.from({ length: max }, (_, i) => i + 1).filter(i => !present.has(i)),
  alienInstances: [...instances.values()].filter(c => c.id.startsWith("alien-")),
  limitations: [
    "迁移合成档，不直接等同三段原档；需核对迁移补齐项。",
    "普通牌实体序号是牌序约束线索，尚未证明完整发牌顺序；不能直接以此排序生成盘面。",
    "终态符号位置/化石位置可能已经移动，不能当作初始配置。",
    "replay after仅资源摘要，不包含每步完整盘面；需原档或可验证历史重放补证。",
  ],
};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, sha256: report.sha256, score: report.score,
  slots: report.slots, ordinaryCount: ordinary.length, missing: report.missingOrdinarySequences,
  alienCount: report.alienInstances.length }, null, 2));
