"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const fromQuick = process.argv.includes("--from-quick");
const canonical = process.argv.includes("--canonical");
const output = canonical ? "reports/iteration/resource-r2c-brown-pass-canonical-20260905.json"
  : fromQuick ? "reports/iteration/resource-r2c-brown-pass-resumed-20260905.json"
  : "reports/iteration/resource-r2c-brown-pass-20260905.json";
if (fs.existsSync(output)) {
  console.log(`已有checkpoint，未重跑：${output}`);
} else {
  const record = JSON.parse(fs.readFileSync("reports/research/39530f19.fda901b9.full.json"));
  const save = JSON.parse(fs.readFileSync(record.savePath));
  const index = save.replaySteps.findIndex((step, i) => i > 0
    && step.action.actorId === "player-brown" && step.action.family === "pass"
    && save.replaySteps[i - 1].after.r === 4);
  assert.ok(index > 0);
  const env = createSimulationEnv();
  const report = { gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    source: record.savePath, replayedSteps: index,
    scope: "纯重放已有完整存档至棕色第四轮PASS前，执行一次真实决策并保存完整估值输入；不重跑全盘" };
  try {
    env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: record.aiDifficulty });
    if (fromQuick) {
      const quickRecord = JSON.parse(fs.readFileSync("reports/research/39530f19.fda901b9.quick-200.json"));
      const quick = JSON.parse(fs.readFileSync(quickRecord.savePath));
      const state = JSON.parse(quick.committedState);
      if (state.meta?.rngState) state.meta.rngState.algorithm = "seti-simulation-mulberry32-v1";
      const committed = JSON.stringify(state);
      env.loadCheckpoint({ schemaVersion: "seti-rl-checkpoint-v1",
        coreState: { version: 2, committedState: committed, compositionEnvelope: {
          schemaVersion: "seti-rule-composition-save-v1", committedState: committed, session: quick.session ?? null } },
        config: { seed: save.seed, activePlayerCount: 4, aiDifficulty: record.aiDifficulty },
        replayCursor: { seed: save.seed, stepIndex: 0 }, replaySteps: null, browserReplaySteps: quick.replaySteps });
      report.resumeSource = quickRecord.savePath;
    }
    for (let i = fromQuick ? 200 : 0; i < index; i += 1) {
      const stored = save.replaySteps[i].action;
      let action = stored;
      if (canonical) {
        // JSON存档不保存undefined属性；先核对全部JSON字段（含owner/version），
        // 再提交唯一对应的正式descriptor。仅诊断重放，不修改生产validator。
        action = env.legalActions().find((item) => item.actionId === stored.actionId);
        assert.ok(action, `legal replay ${i + 1}`);
        assert.deepEqual(JSON.parse(JSON.stringify(action)), stored, `descriptor replay ${i + 1}`);
        const missing = [];
        const visit = (value, path) => {
          if (!value || typeof value !== "object") return;
          for (const [key, child] of Object.entries(value)) {
            if (child === undefined) missing.push(`${path}.${key}`);
            else visit(child, `${path}.${key}`);
          }
        };
        visit(action, "action");
        if (missing.length) (report.undefinedFields ||= []).push({ step: i + 1, paths: missing });
      }
      const result = env.step(action);
      if (!result.ok) report.failedReplay = { step: i + 1, result, legal: env.legalActions() };
      assert.equal(result.ok, true, `replay ${i + 1}`);
    }
    report.before = env.saveBrowserSave();
    const legal = env.legalActions();
    const started = performance.now();
    const result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - started;
    assert.equal(result.ok, true);
    report.chosen = result.policyDecision.actionId;
    report.plan = result.plan;
    report.diagnostics = env.getCounterfactualDiagnostics();
    report.outcomes = result.actionOutcomes;
    report.candidates = legal.map((action) => ({ action,
      evaluation: evaluator.evaluateOutcome({ seatId: action.actorId, legalActions: legal,
        actionOutcomes: result.actionOutcomes }, action) }));
    assert.equal(report.chosen, save.replaySteps[index].action.actionId);
    report.reproduced = true;
  } catch (error) {
    report.error = { message: error.message, stack: error.stack };
    throw error;
  } finally {
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    env.dispose();
  }
  console.log(JSON.stringify({ output, replayedSteps: index, chosen: report.chosen, wallMs: report.wallMs,
    candidates: report.candidates.map(({ action, evaluation }) => ({ summary: action.summary,
      actionId: action.actionId, selectable: evaluation.selectable, score: evaluation.score,
      reason: evaluation.reason, chain: evaluation.actionChain })) }, null, 2));
}
