"use strict";
// 复用已保存的逐步观察与合法集，仅调用纯目标目录，不执行规则或AI搜索。
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/turing-entry.js");
const evaluator = req("../randomizer/game/ai/expected-score-evaluator");
const base = "/Users/bilibili/code/seti-simu/reports/iteration/";
const output = base + "turing-entry-bindings-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const source = JSON.parse(fs.readFileSync(base + "blue50-no-borrow-masked-20260908.json"));
assert.equal(source.passed, true);
const rows = [];
for (const check of source.checks) {
  const company = check.legal.filter(a => a.family === "industry" && a.target?.abilityId === "turing_borrow_tech");
  if (!company.length) continue;
  assert.equal(company.length, 1);
  const input = { rootObservation: check.observation, legalActions: check.legal,
    focalSeatId: "player-blue", maxProxyDepth: 15 };
  const before = JSON.stringify(input);
  const targets = evaluator.enumerateSecondaryAgentRootTargets(input);
  const selected = evaluator.selectSecondaryAgentRootActions(input);
  assert.equal(JSON.stringify(input), before, "目录读取不能改变原始检查点");
  const bindings = targets.filter(t => t.compatibleActionIds.includes(company[0].actionId));
  assert.equal(selected.some(a => a.actionId === company[0].actionId), bindings.length > 0);
  rows.push({ afterPhysicalStep: check.chainLength, expectedNext: check.nextAction,
    company: company[0], targetCount: targets.length,
    companyRootAdmitted: bindings.length > 0, bindings,
    mainActionCompleted: check.observation.publicState.players.find(p => p.playerId === "player-blue")?.mainActionCompleted ?? null,
    targetIds: targets.map(t => ({ targetId: t.targetId, planId: t.planId })) });
}
assert.ok(rows.length > 0);
const report = { codeHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  source: "blue50-no-borrow-masked-20260908.json", rows,
  scope: "第50步保留85分链沿途已有观察的目标目录检查；不是全部4096节点分布，不统计无用节点，不执行新搜索。",
  summary: { companyLegalStates: rows.length, companyBoundStates: rows.filter(r => r.bindings.length).length } };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report.summary, steps: rows.map(r => r.afterPhysicalStep), output }, null, 2));
