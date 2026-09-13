"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { buildActionLogReport, computeBestOf, REPO_ROOT } = require("./robot-iteration-lib");
const { createReportSave } = require("./robot-report-fixture");
const recordFile = "7bb2c6d4.60f8cca6.quick-24.json";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "seti-report-link-test-"));
try {
const savePath = path.join(temp, "current-world.json");
fs.writeFileSync(savePath, JSON.stringify(createReportSave()));
const options = {
  savePath: path.relative(REPO_ROOT, savePath),
  versionId: "quick-timing-20260912", recordFile,
};
const html = buildActionLogReport(options);
const link = html.match(/记录: <a href="([^"]+)"/);
assert(link, "存在研究记录时须提供链接");
const resolved = path.resolve(REPO_ROOT, "reports/iteration", options.versionId, link[1]);
assert.equal(resolved, path.join(REPO_ROOT, "reports/research", recordFile));
assert(fs.existsSync(resolved), "生成链接须指向实际研究文件");
const standalone = buildActionLogReport({ ...options, recordFile: null });
assert(!standalone.includes("记录: <a"), "无研究记录时不得虚构链接");
assert(standalone.includes("未记录，不能仅凭同 seed 确认同盘面"));
const identity = require("./fixed-world-identity").buildWorldIdentity({ seed: "report-replay-fixture" });
const worldRecord = path.join(temp, "world-record.json");
fs.writeFileSync(worldRecord, JSON.stringify({ world: identity }));
const withWorld = buildActionLogReport({ ...options, recordRelPath: path.relative(REPO_ROOT, worldRecord) });
assert(withWorld.includes(identity.fingerprint));
assert(withWorld.includes(identity.worldVersion));
} finally { fs.rmSync(temp, { recursive: true }); }
console.log("robot report record links passed");
const versions = [{ id: "current" }, { id: "older", roadmap: { avgScore: 999 } }];
const run = (avgScore, fingerprint, extra = {}) => ({
  recordFile: `${avgScore}.json`, mode: "full", terminal: true, avgScore,
  world: fingerprint ? { fingerprint, worldVersion: "test-world" } : null,
  scores: { "player-white": avgScore }, ...extra,
});
const results = { current: [run(96, "a")], older: [run(500), run(200, "b"), run(90, "a"), run(900, "a", { terminal: false })] };
assert.equal(computeBestOf(versions, results).bestAvg.value, 96);
assert.equal(computeBestOf(versions, results).comparisonScope, "current-world");
results.current = [run(96, "c", { mode: "quick-40", terminal: false })];
assert.equal(computeBestOf(versions, results).bestAvg, null, "当前世界无终局，不回退到旧世界成绩");
results.current = [run(80)];
assert.equal(computeBestOf(versions, results).comparisonScope, "historical-unverified");
console.log("robot report world comparison passed");
