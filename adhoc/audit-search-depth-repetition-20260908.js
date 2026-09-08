"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "reports/iteration/search-depth-repetition-20260908.json");
if (fs.existsSync(output)) {
  console.log(`已有checkpoint：${output}`);
  process.exit(0);
}
const files = [
  "blue50-no-borrow-queue-trace-20260908.json",
  "blue536-queue-trace-20260908.json",
];
const reports = files.map(file => {
  const source = JSON.parse(fs.readFileSync(path.join(root, "reports/iteration", file)));
  assert.equal(source.passed, true);
  assert.equal(source.matchRecordedSearch, true);
  const trace = source.diagnostics.searchPathTrace;
  const executionRows = trace.filter(row => row.event === "execute");
  // tracePathNode逐来源输出；同一执行序号的多条记录不是多次正式执行。
  const executions = new Map();
  for (const row of executionRows) {
    const previous = executions.get(row.executedNodeCount);
    if (previous) assert.equal(previous.key, row.key);
    else executions.set(row.executedNodeCount, row);
  }
  const groups = new Map();
  for (const row of executions.values()) {
    const parts = row.key.split(":");
    assert.match(parts.at(-2), /^\d+$/);
    const remainingDepth = Number(parts.splice(-2, 1)[0]);
    const keyWithoutDepth = parts.join(":");
    if (!groups.has(keyWithoutDepth)) groups.set(keyWithoutDepth, []);
    groups.get(keyWithoutDepth).push({
      executionOrdinal: row.executedNodeCount, key: row.key, remainingDepth,
    });
  }
  return {
    source: `reports/iteration/${file}`, codeHead: source.codeHead,
    fullSearchExecutedNodes: source.diagnostics.executedNodeCount,
    traceRows: trace.length, executionOriginRows: executionRows.length,
    observedPhysicalExecutions: executions.size,
    repeatedKeysWithoutDepth: [...groups].filter(([, rows]) => rows.length > 1)
      .map(([keyWithoutDepth, rows]) => ({ keyWithoutDepth, executions: rows })),
  };
});
const report = {
  scope: "已有指定路径轨迹；不是全搜索执行日志，不推算全盘重复率",
  method: "execute事件按执行序号去重，再仅删除exactNodeKey的剩余深度分量分组",
  reports,
};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
