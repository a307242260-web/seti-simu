"use strict";
const fs = require("node:fs");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { sanitizeAlienPublicState } = require("../randomizer/app/simulation-contract");
const plan = require("../randomizer/game/ai/plan-continuation");
const output = "reports/iteration/r3-alien-dependency-input-20260905.json";
if (fs.existsSync(output)) {
  console.log(`已有checkpoint，未重算：${output}`);
} else {
  const source = "reports/iteration/resource-r2c-brown-pass-canonical-20260905.json";
  const raw = fs.readFileSync(source);
  const state = JSON.parse(JSON.parse(raw).before.committedState);
  const canonicalSlots = state.aliens.aliens;
  const publicAliens = sanitizeAlienPublicState(state.aliens);
  const observation = { publicState: { board: { aliens: publicAliens } } };
  const cases = [];
  for (const slotId of [1, 2]) {
    assert.ok(canonicalSlots[slotId]);
    for (const traceType of ["pink", "yellow", "blue"]) {
      const descriptor = { actionId: `trace:${slotId}:${traceType}`, family: "choose_target",
        phase: "conditional", target: { kind: "planet-reward-alien-trace", alienSlotId: slotId, traceType } };
      const dependency = plan.planDependencyFromPlan({ planAssumedObservation: observation,
        nextStepDescriptor: descriptor }, { observation });
      assert.equal(dependency.present, false, "当前真实投影无法按正式槽编号定位");
      assert.equal(dependency.firstPlaced, null);
      cases.push({ slotId, traceType, canonicalTrace: canonicalSlots[slotId].traces[traceType], dependency });
    }
  }
  const report = { createdAt: new Date().toISOString(),
    gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    source, sourceSha256: crypto.createHash("sha256").update(raw).digest("hex"),
    scope: "已有真实canonical经正式sanitize生成观察，按真实target字段读取纯依赖；不是动作合法性或完整游戏验证",
    publicAliens, cases,
    finding: "sanitize丢失槽编号；依赖读取还将traces[traceType]字段错误读取为槽顶层字段" };
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, cases: cases.length, finding: report.finding }));
}
