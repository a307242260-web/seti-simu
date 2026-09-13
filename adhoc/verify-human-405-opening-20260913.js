"use strict";
const fs = require("node:fs"), readline = require("node:readline");
const assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "adhoc/human-405-opening-proof-20260913.json";
const inputPath = process.argv[2];
if (!inputPath) throw new Error("需要已核验的405分历史检查点JSONL");
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function main() {
  const stream = fs.createReadStream(inputPath);
  let initial, opening;
  try {
    for await (const line of readline.createInterface({ input: stream })) {
      const record = JSON.parse(line);
      if (!initial) initial = record.state;
      if (record.state.match.initialSetup) { opening = record.state.match.initialSetup; break; }
    }
  } finally { stream.destroy(); }
  assert.ok(initial && opening, "历史证据必须包括初态及初始选择");
  const env = createSimulationEnv();
  try {
    env.reset({ seed: "seti-free-analyze-v1", activePlayerCount: 4 });
    const current = JSON.parse(env.createCheckpoint().coreState.committedState);
    for (const key of ["solarSystem", "tech", "finalScoring"]) assert.deepEqual(current[key], initial[key], key);
    for (const key of ["publicCards", "passReservePiles"]) assert.deepEqual(current.cards[key], initial.cards[key], key);
    assert.deepEqual(current.players.players.map(p => [p.id, p.hand]), initial.players.players.map(p => [p.id, p.hand]));
    assert.equal(env.step(env.legalActions()[0]).ok, true);
    const fork = env.createCounterfactualFork().composition;
    try {
      const actual = fork.projection({ role: "simulation" }).state.match.initialSetup;
      assert.deepEqual(actual, opening, "全部四席选项、顺序、初始选择状态一致");
      const result = { source: inputPath, initialRecordHash: hash(initial), openingHash: hash(opening),
        worldVersion: current.meta.worldVersion, opening: actual,
        verified: ["solarSystem", "tech", "finalScoring", "publicCards", "passReservePiles", "fourPlayerHands", "initialSetup"],
        scope: "仅核验原局已知开局信息；不证明所有未来随机事件、隐藏信息隔离或终局分数" };
      fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
      console.log(JSON.stringify({ output, verified: result.verified, openingHash: result.openingHash }));
    } finally { fork.dispose(); }
  } finally { env.dispose(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
