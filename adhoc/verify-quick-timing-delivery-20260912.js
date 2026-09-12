"use strict";

// 只读取已归档的记录、存档和HTML，不执行AI或修改实验产物。
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const registry = JSON.parse(read("reports/iteration/registry.json"));
const id = "quick-timing-corner-20260912";
assert.equal(registry.currentBaseline, id);
const version = registry.versions.find((entry) => entry.id === id);
const result = version.results.find((entry) => entry.mode === "full");
const record = JSON.parse(read(result.recordPath));
const save = JSON.parse(read(result.savePath));
const finalScores = JSON.parse(save.committedState).match.finalScores;
assert.equal(result.gitCommit, "a83f69ec");
assert.equal(result.steps, 597);
assert.equal(result.terminal, true);
assert.equal(result.scoreSource, "save-final");
assert.equal(result.avgScore, 97.75);
for (const score of finalScores) assert.equal(result.scores[score.playerId], score.totalScore);
assert.deepEqual(finalScores.map((score) => score.totalScore), [75, 125, 102, 89]);
const searches = record.metrics.searches;
assert.equal(searches.length, 203);
assert.equal(searches.reduce((sum, search) => sum + search.diagnostics.executedNodeCount, 0), 233757);
assert.equal(searches.filter((search) => search.diagnostics.budgetLimits.execution.truncated).length, 54);
assert.equal(searches.filter((search) => search.diagnostics.budgetLimits.frontier.truncated).length, 60);
assert(searches.filter((search) => search.kind === "strategic").every((search) => !search.diagnostics.budgetLimits.leaves.enabled));
const pages = ["reports/seti-current-base-robot-strategy-20260911.html", result.reportPath];
let checkedLinks = 0;
for (const file of pages) {
  const html = read(file);
  assert(html.includes("a83f69ec"), file);
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1].split("#")[0].split("?")[0];
    if (!href || /^[a-z]+:/i.test(href)) continue;
    assert(fs.existsSync(path.resolve(root, path.dirname(file), decodeURIComponent(href))), `${file}: ${href}`);
    checkedLinks += 1;
  }
}
const center = read("reports/robot-iteration.html");
assert(center.includes(id));
assert(center.includes(result.reportPath.replace(/^reports\//, "")));
const restoration = JSON.parse(read("reports/iteration/report-metadata-restoration-20260912.json"));
const panels = (html) => [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)]
  .map((match) => match[0]).filter((panel) => !panel.includes("<h2>搜索触限记录</h2>"));
for (const entry of restoration.entries) {
  const original = execFileSync("git", ["show", `${restoration.baseline}:${entry.path}`],
    { cwd: root, maxBuffer: 16 * 1024 * 1024 }).toString();
  assert.deepEqual(panels(read(entry.path)), panels(original), entry.path);
}
console.log(JSON.stringify({ version: id, commit: result.gitCommit, steps: result.steps,
  scores: result.scores, average: result.avgScore, searches: searches.length,
  executionTruncations: 54, frontierTruncations: 60, checkedLinks,
  preservedHistoricalReports: restoration.entries.length,
  historicalUnverified: restoration.excluded,
  historicalWarnings: registry.warnings.filter((warning) => warning.level === "warn"), outcome: "pass" }, null, 2));
