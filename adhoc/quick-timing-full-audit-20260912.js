"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const source = "reports/research/7bb2c6d4.60f8cca6.full.json";
const baseline = "reports/research/885906e7.31a2e43b.full.json";
const output = "reports/iteration/quick-timing-full-audit-20260912-60f8cca6.json";
if (fs.existsSync(output)) { console.log(`已有 checkpoint：${output}`); process.exit(0); }
function summarize(path) {
  const r = JSON.parse(fs.readFileSync(path, "utf8"));
  const kinds = {};
  for (const search of r.metrics.searches) {
    const d = search.diagnostics;
    const k = kinds[search.kind] ||= { searches: 0, nodes: 0, failures: 0, limits: {} };
    k.searches++;
    k.nodes += d.executedNodeCount;
    k.failures += Object.values(d.failedNodeCountByCode).reduce((a, b) => a + b, 0);
    for (const [name, limit] of Object.entries(d.budgetLimits)) {
      const count = k.limits[name] ||= { enabled: 0, reached: 0, truncated: 0 };
      for (const key of Object.keys(count)) count[key] += Number(limit[key] === true);
    }
  }
  return { source: path, gitCommit: r.gitCommit, steps: r.steps, summary: r.summary,
    wallMs: r.wallMs, resumeStep: r.resumeStep, resumedFrom: r.resumedFrom, kinds };
}
const record = JSON.parse(fs.readFileSync(source, "utf8"));
const save = JSON.parse(fs.readFileSync(record.savePath, "utf8"));
const counts = {}, late = [];
const env = createSimulationEnv();
try {
  env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "laughable" });
  for (const step of save.replaySteps) {
    const legal = env.legalActions();
    const action = legal.find(a => a.actionId === step.action.actionId);
    assert(action, `回放缺少正式动作：${step.stepIndex + 1}`);
    if (action.phase === "quick") {
      const checkpoint = env.createCheckpoint().coreState.committedState;
      const root = typeof checkpoint === "string" ? JSON.parse(checkpoint) : checkpoint;
      const player = root.players.players.find(p => p.id === action.actorId);
      const phase = player.mainActionCompleted ? "after-main" : "before-main";
      const key = `${phase}:${action.family}`;
      counts[key] = (counts[key] || 0) + 1;
      if (player.mainActionCompleted) {
        const comp = env.createCounterfactualFork().composition;
        try {
          const observation = comp.projection({ role: "player", playerId: action.actorId }).state;
          const targets = evaluator.enumerateSecondaryAgentRootTargets({ rootObservation: observation,
            focalSeatId: action.actorId, legalActions: legal });
          const compatible = targets.filter(t => t.compatibleActionIds.includes(action.actionId));
          late.push({ step: step.stepIndex + 1, actor: action.actorId, family: action.family,
            target: action.target, payload: action.payload,
            compatibleTargets: compatible.map(t => ({ targetId: t.targetId, planId: t.planId })) });
        } finally { comp.dispose(); }
      }
    }
    assert.equal(env.step(action).ok, true, `正式输入失败：${step.stepIndex + 1}`);
  }
  assert(env.isTerminal(), "必须自然终局");
  const result = { source, save: record.savePath, baseline: summarize(baseline), current: summarize(source),
    replayTerminal: true, counts, late,
    scope: "只重放正式输入，不调用AI；主行动标记读取每步正式状态。compatibleTargets证明当时存在准入目标，不证明原获胜计划绑定了其中某个目标。" };
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(result, null, 2));
} finally { env.dispose(); }
