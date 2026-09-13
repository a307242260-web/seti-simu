"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { gzipSync, gunzipSync } = require("node:zlib");

const output = path.join(__dirname, "human-405-history-evidence-20260913.json.gz");
const expectedHash = "6c905f29b4707eff3fc7858268183416e36791bd341c932721c1e4959a6443e3";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function verify(bytes) {
  const archive = JSON.parse(gunzipSync(bytes));
  assert.equal(archive.schemaVersion, "seti-human-405-history-evidence-v1");
  assert.equal(hash(archive.checkpointsJsonl), expectedHash);
  assert.equal(archive.checkpointsJsonl.trim().split("\n").length, 517);
  assert.equal(hash(archive.replayToolSource), archive.replayToolSha256);
  assert.equal(archive.historicalCommit, "4fe33887");
  return archive;
}
if (!fs.existsSync(output)) {
  const sourceDirectory = process.argv[2];
  if (!sourceDirectory) throw new Error("首次归档需要已核验的历史重放目录");
  const checkpointsJsonl = fs.readFileSync(path.join(sourceDirectory, "human-405-history-checkpoints-20260913.jsonl"), "utf8");
  assert.equal(hash(checkpointsJsonl), expectedHash, "不接受与已提取证据不同的历史检查点");
  const replayToolSource = fs.readFileSync(path.join(sourceDirectory, "tools/fast_forward_save.js"), "utf8");
  const bytes = gzipSync(JSON.stringify({
    schemaVersion: "seti-human-405-history-evidence-v1", historicalCommit: "4fe33887",
    sourceSave: "seti-saves/seti-save-537-merged.json",
    sourceSaveSha256: "bdff1283bc052ec3e833d958f369f0c0ef286ebca1c7a48034efe5a612f029b7",
    scope: "历史内核516步人类动作重放，不是当前规则或AI成绩验证；附当时修改过的严格重放工具源码。",
    replayToolSha256: hash(replayToolSource), replayToolSource, checkpointsJsonl,
  }), { level: 9 });
  verify(bytes);
  fs.writeFileSync(output, bytes, { flag: "wx" });
}
const bytes = fs.readFileSync(output);
verify(bytes);
console.log(JSON.stringify({ output, bytes: bytes.length, archiveSha256: hash(bytes), checkpointSha256: expectedHash,
  checkpointCount: 517, replayed: false }));
