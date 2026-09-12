"use strict";
// 一次性交付修复：恢复本次force构建影响的历史正文，再只刷新元数据。
// 生成文件属于机械更新；先完整备份当前HTML，不删除任何报告或历史实验。
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const { REPO_ROOT, refreshActionLogReportMetadata } = require("../tools/robot-iteration-lib");
const baseline = "f072cb50065af5489261d801ed8424934a421d87";
const registry = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "reports/iteration/registry.json"), "utf8"));
const checkpoint = path.join(REPO_ROOT, "reports/iteration/report-metadata-restoration-20260912.json");
const apply = process.argv.includes("--apply");
if (apply && fs.existsSync(checkpoint)) throw new Error("RESTORATION_ALREADY_RECORDED");
const panels = (html) => [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)]
  .map((match) => match[0]).filter((panel) => !panel.includes("<h2>搜索触限记录</h2>"));
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
const changes = [];
const excluded = [];
const committedPaths = new Set(execFileSync("git", ["ls-tree", "-r", "--name-only", baseline],
  { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim().split("\n"));
for (const version of registry.versions) {
  for (const result of version.results) {
    if (result.missingRecord || !result.savePath || !result.reportPath || !result.reportExists) continue;
    assert(result.reportPath.startsWith(`reports/iteration/${version.id}/`));
    if (!committedPaths.has(result.reportPath)) {
      // 没有归档正文不能虚构恢复结果；保留现文件并在checkpoint显式登记未核验边界。
      excluded.push({ path: result.reportPath, reason: "no-committed-original" });
      continue;
    }
    const original = execFileSync("git", ["show", `${baseline}:${result.reportPath}`],
      { cwd: REPO_ROOT, maxBuffer: 16 * 1024 * 1024 }).toString();
    const current = fs.readFileSync(path.join(REPO_ROOT, result.reportPath), "utf8");
    const updated = refreshActionLogReportMetadata(original, {
      savePath: result.savePath, versionId: version.id, versionName: version.name,
      runKey: result.recordFile.replace(/\.json$/, ""), recordFile: result.recordFile,
    });
    assert.deepEqual(panels(updated), panels(original), result.reportPath);
    changes.push({ path: result.reportPath, original, current, updated,
      restoredBody: JSON.stringify(panels(current)) !== JSON.stringify(panels(original)) });
  }
}
const summary = { baseline, reports: changes.length,
  restoredBodies: changes.filter((entry) => entry.restoredBody).length, excluded, apply };
if (apply) {
  const backup = fs.mkdtempSync(path.join(os.tmpdir(), "seti-report-regeneration-backup-20260912-"));
  for (const change of changes) {
    const target = path.join(REPO_ROOT, change.path);
    assert.equal(fs.readFileSync(target, "utf8"), change.current, "报告在核验后发生并发修改");
    const backupPath = path.join(backup, change.path);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.writeFileSync(backupPath, change.current);
    fs.writeFileSync(target, change.updated);
  }
  summary.backup = backup;
  fs.writeFileSync(checkpoint, JSON.stringify({ ...summary, entries: changes.map((change) => ({
    path: change.path, restoredBody: change.restoredBody,
    originalHash: hash(change.original), beforeHash: hash(change.current), afterHash: hash(change.updated),
  })) }, null, 2) + "\n");
}
console.log(JSON.stringify(summary, null, 2));
