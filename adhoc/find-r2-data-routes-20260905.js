"use strict";
// 纯重放已有动作，不调用AI，不重复固定盘面实验。
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/resource-r2-data-route-candidates-20260905.json";
if (fs.existsSync(output)) {
  console.log(fs.readFileSync(output, "utf8"));
} else {
  const candidates = [];
  for (const file of ["16bce41e.d9283ce5.full.json", "241f6fc0.4f994f86.full.json"]) {
    const record = JSON.parse(fs.readFileSync(`reports/research/${file}`));
    const save = JSON.parse(fs.readFileSync(record.savePath));
    const env = createSimulationEnv();
    try {
      env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "weak_start" });
      for (let index = 0; index < save.replaySteps.length; index += 1) {
        const legal = env.legalActions();
        const observation = env.observe();
        const req = observation.dataAnalyzeRequirements;
        const scan = legal.find((a) => a.family === "scan");
        if (scan && req?.eligible && req.dataNeeded === 1) {
          candidates.push({ record: file, replayCount: index, seatId: req.playerId,
            requirement: req, scan, recordedAction: save.replaySteps[index].action,
            player: observation.publicState.players.find((p) => p.playerId === req.playerId) });
        }
        assert.equal(env.step(save.replaySteps[index].action).ok, true, `${file}重放${index + 1}`);
      }
      assert.equal(env.isTerminal(), true);
    } finally { env.dispose(); }
  }
  const report = { createdAt: new Date().toISOString(), gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    scope: "纯重放两个已有终局，筛查数据门槛；尚未验证扫描后费用和实际完整收益链", candidates };
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(candidates.map(c => ({ record: c.record, replayCount: c.replayCount,
    seat: c.seatId, computer: c.requirement.computerPlacedCount, data: c.requirement.availableData,
    chosen: c.recordedAction.family }))));
}
