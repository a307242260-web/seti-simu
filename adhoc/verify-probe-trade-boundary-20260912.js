"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const output = "reports/iteration/probe-trade-boundary-20260912.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const baseline = "/Users/bilibili/code/seti-simu";
assert.equal(execFileSync("git", ["rev-parse", "--short=8", "HEAD"], { cwd: baseline, encoding: "utf8" }).trim(), "033b244a");
const before = require(`${baseline}/randomizer/game/ai/expected-score-evaluator`);
const after = require("../randomizer/game/ai/expected-score-evaluator");
const input = require("../reports/iteration/budget-before-step465-20260912.json");
const ctx = { focalSeatId: "player-green", rootObservation: input.observation, legalActions: input.legalActions };
const roots = [before, after].map(e => e.enumerateSecondaryAgentRootTargets(ctx));
const external = roots.map(list => list.filter(t => !t.planId.startsWith("probe:")));
assert.deepEqual(external[1], external[0]);
const card = roots[0].find(t => t.targetId === "card:acquire:card-82-0");
assert.equal(card.compatibleActionIds.length, 3);
const selected = [before, after].map(e => e.selectSecondaryAgentSuccessors({
  focalSeatId: "player-green", branchObservation: input.observation, legalSuccessors: input.legalActions,
  routeTargetId: card.targetId, routePlanId: card.planId }));
assert.deepEqual(selected[1], selected[0]);
assert.equal(selected[1].length, 3);
fs.writeFileSync(output, JSON.stringify({ baseline: "033b244a", scope: "读取相同465公开输入比较非探测根与指定公牌后继，不运行规则或AI", external, selected, pass: true }, null, 2) + "\n", { flag: "wx" });
console.log("非探测根完全一致，指定公牌三种交易在根及后继均保持");
