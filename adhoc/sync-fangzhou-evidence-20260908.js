"use strict";
// 同步已生成的验收产物；绝不运行AI，也不覆盖已有不同内容。
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const quickMove = process.argv.includes("--quick-move");
const rulesBaseline = process.argv.includes("--rules-baseline");
assert.ok(!(quickMove && rulesBaseline), "一次只同步一个版本");
const source = rulesBaseline ? "/private/tmp/seti-rules-baseline-20260908.ohUO6T"
  : quickMove ? "/private/tmp/seti-quick-move-events-20260908.RYFIBr"
  : "/private/tmp/seti-fangzhou-major-20260908.z4LG96";
const target = "/Users/bilibili/code/seti-simu";
let files = quickMove ? [
  "reports/research/ab2586b3.c50e4f01.full.json",
  "seti-saves/seti-save-research-quick-move-events-20260908-c50e4f01-full-v317.json",
  "reports/iteration/quick-move-events-20260908/ab2586b3.c50e4f01.full.action-log.html",
  "reports/iteration/quick-move-full-review-20260908.json",
] : [
  "reports/research/b58e392b.4d3711c5.full.json",
  "seti-saves/seti-save-research-fangzhou-major-reward-20260908-4d3711c5-full-v317.json",
  "reports/iteration/fangzhou-major-reward-20260908/b58e392b.4d3711c5.full.action-log.html",
  "reports/iteration/fangzhou-major-full-review-20260908.json",
];
if (rulesBaseline) {
  const records = fs.readdirSync(path.join(source, "reports/research")).filter(f => f.endsWith(".ee3ea52f.full.json"));
  assert.equal(records.length, 1, "等待唯一完整记录，不重跑AI");
  const record = JSON.parse(fs.readFileSync(path.join(source, "reports/research", records[0]), "utf8"));
  assert.equal(record.name, "rules-baseline-20260908");
  assert.equal(record.terminal, true);
  files = [
    `reports/research/${records[0]}`,
    record.savePath,
    `reports/iteration/rules-baseline-20260908/${records[0].replace(/\.json$/, ".action-log.html")}`,
    "reports/iteration/rules-baseline-full-review-20260908.json",
  ];
}
for (const file of files) {
  const from = path.join(source, file), to = path.join(target, file);
  const content = fs.readFileSync(from);
  if (fs.existsSync(to)) assert.deepEqual(fs.readFileSync(to), content, `拒绝覆盖不同证据：${file}`);
  else { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL); }
  assert.deepEqual(fs.readFileSync(to), content);
  console.log(`已同步并逐字节核对：${file}`);
}
