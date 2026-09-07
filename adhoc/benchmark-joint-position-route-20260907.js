"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const inspector = require("node:inspector");
const { jointPositionRoute } = require("./joint-position-route-20260907");
const cards = require("../randomizer/game/cards/effects");
const label = process.argv[2]; assert.match(label || "", /^[a-z0-9-]+$/, "必须提供本次实验标签");
const output = `reports/iteration/joint-route-cost-${label}-20260907.json`;
const input = "reports/iteration/company-movement-input-42-20260906.json";
const implementation = "adhoc/joint-position-route-20260907.js";
const hash = p => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
async function main() {
  if (fs.existsSync(output)) { console.log(`已有查询成本记录：${output}`); return; }
  const root = JSON.parse(JSON.parse(fs.readFileSync(input)).checkpoint.coreState.committedState);
  const before = JSON.stringify(root), actor = root.players.players.find(p => p.id === "player-green");
  const args = { root, actor, condition: cards.getCardModel("dlc_7.png").tasks[0].condition,
    stage: "paid", cardPoints: 0, companyRemaining: 2, usedRocketIds: [] };
  const expected = jointPositionRoute(args);
  for (let i = 0; i < 3; i++) assert.deepEqual(jointPositionRoute(args), expected);
  const session = new inspector.Session(); session.connect();
  const post = (method, params = {}) => new Promise((resolve, reject) => session.post(method, params,
    (error, value) => error ? reject(error) : resolve(value)));
  const times = [];
  let profile;
  try {
    await post("Profiler.enable"); await post("Profiler.start");
    for (let i = 0; i < 20; i++) {
      const start = performance.now(); const result = jointPositionRoute(args);
      times.push(performance.now() - start); assert.deepEqual(result, expected);
    }
    profile = (await post("Profiler.stop")).profile;
  } finally { session.disconnect(); }
  assert.equal(JSON.stringify(root), before);
  const samples = new Map();
  const byId = new Map(profile.nodes.map(n => [n.id, n.callFrame]));
  for (const id of profile.samples) {
    const frame = byId.get(id); assert.ok(frame);
    const name = `${frame.functionName || "anonymous"}@${frame.url}:${frame.lineNumber + 1}`;
    samples.set(name, (samples.get(name) || 0) + 1);
  }
  const sorted = [...times].sort((a, b) => a - b);
  const report = { scope: "实际42位置上的联合位置查询CPU/耗时；20次仅用于同进程微基准，不运行AI或完整局，不等于生产单决策性能",
    input, inputSha256: hash(input), implementation, implementationSha256: hash(implementation),
    result: expected, iterations: times.length, times, medianMs: (sorted[9] + sorted[10]) / 2,
    cpuSelfSamples: [...samples].sort((a, b) => b[1] - a[1]), stateUnchanged: true, verified: true };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, medianMs: report.medianMs, expanded: expected.expanded,
    topSelfSamples: report.cpuSelfSamples.slice(0, 12), verified: true }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
