"use strict";
// 仅使用已有事实逐叶核对；不运行搜索、游戏或固定盘面。
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { execFileSync } = require("node:child_process");
const output = "reports/iteration/r2e-expectation-audit-20260905.json";
const evaluatorPath = "randomizer/game/ai/expected-score-evaluator.js";
const hash = (input) => crypto.createHash("sha256").update(input).digest("hex");
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const oldBase = { blue1: 10, blue2: 10, blue3: 5, blue4: 5 };
const nonBlueBase = { orange1: 0, orange2: 7, orange3: 5, orange4: 0,
  purple1: 0, purple2: 10, purple3: 0, purple4: 10 };
// 独立按冻结口径计算，不调用被测模块的资源单价或科技函数。
function expectedFuture(tile, facts, legacy) {
  const remaining = Math.max(0, facts.finalRoundNumber - facts.roundNumber);
  let value = (nonBlueBase[tile] || (legacy ? oldBase[tile] : 0) || 0) * remaining;
  for (let r = facts.roundNumber + 1; r <= facts.finalRoundNumber; r += 1) {
    const discount = 1 - 0.5 * (r - 1) / Math.max(1, facts.finalRoundNumber - 1);
    const reward = { blue1: 10 * discount, blue2: 8 * discount, blue3: 6, blue4: 8 }[tile] || 0;
    value += reward * (4 / 3) * 0.5;
  }
  return value;
}
function expectedP(facts, legacy) {
  if (facts.terminal) return 0;
  const choices = facts.researchOptions.filter((p) => p.publicityCost > 0 && !facts.ownedTechIds.includes(p.tileId));
  return 0.5 * Math.max(0, ...choices.map((p) => expectedFuture(p.tileId, facts, legacy)
    * Math.min(1, Math.max(0, facts.resourceFacts.publicity) / p.publicityCost)));
}
function legacyHeld(facts) {
  return facts.ownedTechIds.reduce((n, id) => n + (oldBase[id] || 0), 0)
    * Math.max(0, facts.finalRoundNumber - facts.roundNumber);
}
function load(commit) {
  const source = execFileSync("git", ["show", `${commit}:${evaluatorPath}`], { encoding: "utf8" });
  const module = { exports: {} };
  new vm.Script(source).runInNewContext({ module, require: createRequire(path.resolve(evaluatorPath)), structuredClone });
  return { api: module.exports, sha256: hash(source) };
}
if (fs.existsSync(output)) {
  console.log(`已有checkpoint，未重算：${output}`);
} else {
  const before = load("5d43a4b5");
  const after = load("20feca27");
  const report = { scope: "固定156个已有叶，仅检验R2e前后公式变化的边界；不是完整历史Policy或终局因果证明",
    beforeCommit: "5d43a4b5", afterCommit: "20feca27", beforeSha256: before.sha256,
    afterSha256: after.sha256, cases: [], leaves: 0, excludedWithoutLeaves: 0 };
  try {
    for (const name of ["divergence", "step44", "step67", "step68", "baseline-step73", "step88"]) {
      const file = `reports/iteration/resource-r2-${name}-20260905.json`;
      const input = fs.readFileSync(file, "utf8");
      const saved = JSON.parse(input);
      const sample = { source: file, sha256: hash(input), changes: [] };
      report.cases.push(sample);
      for (const item of saved.outcomes) {
        if (!item.leaves.length) { report.excludedWithoutLeaves += 1; continue; }
        for (const [index, leaf] of item.leaves.entries()) {
          const root = item.rootFacts;
          const end = leaf.facts;
          for (const facts of [root, end]) {
            for (const key of ["terminal", "ownedTechIds", "roundNumber", "finalRoundNumber", "researchOptions", "resourceFacts"]) {
              assert.ok(Object.hasOwn(facts, key), `缺少${key}`);
            }
          }
          const oldValue = before.api.evaluateStrategicFactsBreakdown(root, end);
          const newValue = after.api.evaluateStrategicFactsBreakdown(root, end);
          const expectedTechChange = end.terminal ? 0 : legacyHeld(root) - legacyHeld(end);
          const expectedPChange = end.terminal ? 0 : expectedP(end, false) - expectedP(root, false)
            - expectedP(end, true) + expectedP(root, true);
          close(newValue.infrastructure.techValue - oldValue.infrastructure.techValue, expectedTechChange);
          close(newValue.publicityResearchValue - oldValue.publicityResearchValue, expectedPChange);
          close(newValue.primaryValue - oldValue.primaryValue, expectedTechChange + expectedPChange);
          close(newValue.total - oldValue.total, expectedTechChange + expectedPChange);
          close(newValue.infrastructure.total - oldValue.infrastructure.total, expectedTechChange);
          const unchanged = (value) => JSON.stringify({ ...value, total: null, primaryValue: null,
            publicityResearchValue: null, infrastructure: { ...value.infrastructure, total: null, techValue: null } });
          assert.equal(unchanged(newValue), unchanged(oldValue), "禁止出现F/P之外的估值变化");
          sample.changes.push({ actionId: item.actionId, leafIndex: index, before: oldValue.primaryValue,
            after: newValue.primaryValue, expectedTechChange, expectedPChange });
          report.leaves += 1;
        }
      }
      assert.equal(JSON.stringify(saved), JSON.stringify(JSON.parse(input)), "估值不得修改输入");
    }
    assert.equal(report.leaves, 156);
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    throw error;
  } finally {
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ passed: report.passed, leaves: report.leaves,
      excludedWithoutLeaves: report.excludedWithoutLeaves, output }));
  }
}
