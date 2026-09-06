"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const output = "reports/iteration/probe-location-full-verification-20260907.json";
if (fs.existsSync(output)) console.log(`已有验证：${output}`);
else {
  const report = { scope: "只读位置任务修复完整记录/存档，对照b10ae543，分开核对终局、动作差异、失败和截断；不运行AI" };
  try {
    const files = fs.readdirSync("reports/research").filter(p => p.endsWith(".b8be61a5.full.json"));
    assert.equal(files.length, 1, "该生产版本必须只有一份完整记录");
    const sources = ["reports/research/39fc344f.b10ae543.full.json", `reports/research/${files[0]}`];
    const read = p => JSON.parse(fs.readFileSync(p));
    const records = sources.map(read), saves = records.map(r => read(r.savePath));
    records.forEach(r => assert.equal(r.terminal, true));
    const states = saves.map(s => JSON.parse(s.committedState));
    report.sources = sources;
    report.measurements = records.map((r, index) => {
      const searches = r.metrics.searches, family = {};
      for (const search of searches) for (const [key, count] of Object.entries(search.diagnostics.attemptedNodeCountByFamily)) {
        family[key] = (family[key] || 0) + count;
      }
      const scores = states[index].match.finalScores.map(s => ({ playerId: s.playerId, total: s.totalScore }));
      return { commit: r.gitCommit, steps: r.steps, wallMs: r.wallMs, searches: searches.length, scores,
        mean: scores.reduce((n, s) => n + s.total, 0) / scores.length,
        nodes: searches.reduce((n, s) => n + s.diagnostics.executedNodeCount, 0),
        submissions: searches.reduce((n, s) => n + s.diagnostics.successfulInputSubmissionCount, 0),
        attemptedNodesByFamily: family,
        fullBudgetSteps: searches.filter(s => s.kind === "strategic" && s.diagnostics.executedNodeCount >= s.diagnostics.maxExecutionNodes).map(s => s.step),
        cutOffs: searches.filter(s => s.diagnostics.executionLimitReached).map(s => ({ step: s.step, kind: s.kind,
          budget: s.diagnostics.maxExecutionNodes, frontier: s.diagnostics.frontierOriginCountByFamily })),
        failures: searches.filter(s => Object.keys(s.diagnostics.failedNodeCountByCode).length).map(s => ({ step: s.step, counts: s.diagnostics.failedNodeCountByCode })),
      };
    });
    report.sameReplay = JSON.stringify(saves[0].replaySteps) === JSON.stringify(saves[1].replaySteps);
    report.sameFinalState = JSON.stringify(states[0]) === JSON.stringify(states[1]);
    const count = Math.max(...saves.map(s => s.replaySteps.length));
    report.firstReplayDifference = null;
    for (let index = 0; index < count; index += 1) {
      if (JSON.stringify(saves[0].replaySteps[index]) !== JSON.stringify(saves[1].replaySteps[index])) {
        report.firstReplayDifference = { step: index + 1, before: saves[0].replaySteps[index], after: saves[1].replaySteps[index] };
        break;
      }
    }
    const current = report.measurements[1];
    report.scoreGatePassed = current.mean >= 108.5;
    report.noRuleFailures = current.failures.length === 0;
    report.noExecutionCutOffs = current.cutOffs.length === 0;
    report.goalPassed = report.scoreGatePassed && report.noRuleFailures && report.noExecutionCutOffs;
    report.sha256 = Object.fromEntries([...sources, ...records.map(r => r.savePath)].map(file => [file,
      crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")]));
    report.verified = true;
  } catch (error) { report.verified = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, verified: report.verified, measurements: report.measurements,
      sameReplay: report.sameReplay, sameFinalState: report.sameFinalState,
      firstDifference: report.firstReplayDifference?.step, goalPassed: report.goalPassed, error: report.error }, null, 2)); }
}
