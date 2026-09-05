"use strict";
const fs = require("node:fs");
const crypto = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const output = "reports/iteration/r3-scan-earth-comparison-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重算：${output}`);
else {
  const record = JSON.parse(fs.readFileSync("reports/research/c3eebca2.4fba7beb.full.json"));
  const paths = ["seti-saves/seti-save-research-sector-directory-s2-20260906-904acf13-full-v307.json", record.savePath];
  const raw = paths.map((path) => fs.readFileSync(path));
  const saves = raw.map((value) => JSON.parse(value));
  const finals = saves.map((save) => JSON.parse(save.committedState).match.finalScores);
  const differing = [];
  for (let i = 0; i < Math.max(...saves.map((s) => s.replaySteps.length)); i += 1) {
    const [a, b] = saves.map((s) => s.replaySteps[i]);
    if (!isDeepStrictEqual(a?.action, b?.action) || !isDeepStrictEqual(a?.after, b?.after)) differing.push(i);
  }
  const perfPaths = ["reports/iteration/sector-directory-performance-20260906.json", "reports/iteration/r3-scan-earth-performance-20260906.json"];
  const evaluations = perfPaths.map((path) => JSON.parse(fs.readFileSync(path)).sample.outcomes.map((o) => ({
    actionId: o.action.actionId, status: o.status, code: o.code, leafCount: o.leafCount, evaluation: o.evaluation,
  })));
  const stripNewField = (value) => JSON.parse(JSON.stringify(value, (key, v) => key === "standardScanEarthSource" ? undefined : v));
  const report = { createdAt: new Date().toISOString(), scope: "只读完整存档与既有单决策诊断，不运行搜索",
    sources: paths.map((path, i) => ({ path, sha256: crypto.createHash("sha256").update(raw[i]).digest("hex"), steps: saves[i].replaySteps.length })),
    differingCount: differing.length, firstDifference: differing.length ? { index: differing[0], rows: saves.map((s) => s.replaySteps[differing[0]]) } : null,
    finals, means: finals.map((rows) => rows.reduce((sum, r) => sum + r.totalScore, 0) / rows.length),
    performanceSources: perfPaths, evaluatedRoots: evaluations[0].length,
    sameColdEvaluationsExceptNewPublicField: isDeepStrictEqual(...evaluations.map(stripNewField)),
    caveat: "首次动作分歧定位不是缓存失效原因或终局分差的因果证明；新增字段仅从评分明细的基础设施回显中排除。" };
  fs.writeFileSync(output, JSON.stringify(report));
  console.log(JSON.stringify({ output, steps: report.sources.map((s) => s.steps), means: report.means,
    firstDifference: report.firstDifference?.index, sameColdEvaluationsExceptNewPublicField: report.sameColdEvaluationsExceptNewPublicField }));
}
