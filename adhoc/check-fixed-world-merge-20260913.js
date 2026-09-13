"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const mainRoot = "/Users/bilibili/code/seti-simu";
const base = "329bd8a0";
const head = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const files = execFileSync("git", ["diff", "--no-renames", "--name-only", "-z", `${base}..HEAD`], { encoding: "utf8" })
  .split("\0").filter(Boolean);
const baseFiles = new Set(execFileSync("git", ["ls-tree", "-r", "--name-only", "-z", base], { encoding: "utf8" })
  .split("\0").filter(Boolean));
const equal = (left, right) => left === null ? right === null : right !== null && left.equals(right);
const rows = files.map(file => {
  const original = baseFiles.has(file) ? execFileSync("git", ["show", `${base}:${file}`], { maxBuffer: 64 * 1024 * 1024 }) : null;
  const candidatePath = path.resolve(__dirname, "..", file);
  const mainPath = path.join(mainRoot, file);
  const candidate = fs.existsSync(candidatePath) ? fs.readFileSync(candidatePath) : null;
  const main = fs.existsSync(mainPath) ? fs.readFileSync(mainPath) : null;
  return { file, status: equal(main, candidate) ? "already-equal"
    : equal(main, original) ? "base-unchanged" : "overlap-review-required" };
});
const report = { base, head, mainRoot, scope: "只比较物理工作树字节，不使用共享暂存区；不执行合并。",
  counts: rows.reduce((out, row) => { out[row.status] = (out[row.status] || 0) + 1; return out; }, {}), rows };
const output = path.join(__dirname, `fixed-world-merge-check-${head}-20260913.json`);
if (fs.existsSync(output)) throw new Error(`已有检查记录，拒绝覆盖：${output}`);
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, counts: report.counts, overlaps: rows.filter(row => row.status === "overlap-review-required") }));
