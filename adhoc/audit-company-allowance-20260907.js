"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const output = "reports/iteration/company-allowance-contract-20260907.json";
if (fs.existsSync(output)) console.log(`已有核验：${output}`);
else {
  const source = "reports/iteration/company-stage-42-20260907.json";
  const report = { scope: "复用既有六个正式首步及第二阶段ownerPayload，核对每艘一次和阶段额度，不执行公司动作或运行AI", source, cases: [] };
  try {
    const prior = JSON.parse(fs.readFileSync(source));
    assert.equal(prior.passed, true);
    assert.equal(prior.cases.length, 6);
    for (const entry of prior.cases) {
      const used = entry.first.target.rocketId, payload = entry.ownerPayload;
      assert.equal(payload.abilityId, "huanyu_free_moves");
      assert.equal(payload.step, "free_move");
      assert.equal(payload.remaining, 1);
      assert.deepEqual(payload.usedRocketIds, [used]);
      const moves = entry.second.filter(a => a.target.rocketId != null);
      const eligible = [...new Set(moves.map(a => a.target.rocketId))];
      assert.equal(eligible.length, 1);
      assert.ok(!eligible.includes(used));
      assert.equal(moves.length, 3);
      assert.equal(entry.second.filter(a => a.target.skip === true).length, 1);
      report.cases.push({ firstActionId: entry.first.actionId, firstRocketId: used,
        remaining: payload.remaining, usedRocketIds: payload.usedRocketIds, eligibleRocketIds: eligible,
        creditForAlreadyMovedRocket: 0, creditForOtherEligibleRocket: 1,
        secondDirectionIds: moves.map(a => a.payload.direction), canEndMovement: true });
    }
    report.sourceSha256 = crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex");
    report.passed = true;
  } catch (error) { report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, cases: report.cases.length,
      ...(report.error ? { error: report.error } : {}) })); }
}
