"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildActionLogReport, REPO_ROOT } = require("./robot-iteration-lib");
const recordFile = "7bb2c6d4.60f8cca6.quick-24.json";
const options = {
  savePath: "seti-saves/seti-save-research-quick-timing-20260912-60f8cca6-quick-24-v2.json",
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
console.log("robot report record links passed");
