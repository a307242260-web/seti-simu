"use strict";
// 仅归档唯一完整局及已生成UI证据，不运行AI，不覆盖不同内容。
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const source = "/private/tmp/seti-browser-smoke-read-path-20260909";
const target = "/Users/bilibili/code/seti-simu";
const records = fs.readdirSync(path.join(source, "reports/research")).filter(f => f.endsWith(".a402ca99.full.json"));
assert.equal(records.length, 1, "等待唯一完整局，不重跑");
const record = JSON.parse(fs.readFileSync(path.join(source, "reports/research", records[0]), "utf8"));
assert.equal(record.name, "counted-card-reveal-20260909");
assert.equal(record.terminal, true);
assert.ok(record.gitCommit.startsWith("a402ca99"));
const files = [
  `reports/research/${records[0]}`,
  record.savePath,
  `reports/iteration/counted-card-reveal-20260909/${records[0].replace(/\.json$/, ".action-log.html")}`,
  "reports/iteration/counted-reveal-ui-d2e05f6a-20260909.json",
];
for (const file of files) {
  assert.ok(typeof file === "string" && !path.isAbsolute(file) && !file.split("/").includes(".."));
  assert.ok(fs.existsSync(path.join(source, file)), `产物尚未完成：${file}`);
}
for (const file of files) {
  const from = path.join(source, file), to = path.join(target, file);
  const content = fs.readFileSync(from);
  if (fs.existsSync(to)) assert.deepEqual(fs.readFileSync(to), content, `拒绝覆盖不同证据：${file}`);
  else { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL); }
  assert.deepEqual(fs.readFileSync(to), content);
  console.log(`已同步并逐字节核对：${file}`);
}
