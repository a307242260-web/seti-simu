"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const inspector = require("node:inspector"), { promisify } = require("node:util");
const zlib = require("node:zlib");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/round-income-green-profile-20260906.json";
async function main() {
  if (fs.existsSync(output)) return console.log(`已有诊断，未重跑：${output}`);
  const record = JSON.parse(fs.readFileSync("reports/research/cdcd5d61.6d67a974.quick-200.json"));
  const save = JSON.parse(fs.readFileSync(record.savePath));
  const state = JSON.parse(save.committedState);
  state.meta.rngState.algorithm = "seti-simulation-mulberry32-v1";
  const committed = JSON.stringify(state);
  const env = createSimulationEnv(), session = new inspector.Session();
  session.connect(); const post = promisify(session.post).bind(session);
  const report = { scope: "从同版200步存档恢复，仅定位首个绿方决策并CPU采样；不跑整局，采样不作无采样性能门禁",
    source: record.savePath, sourceCommit: record.gitCommit, prefix: [] };
  let profiling = false, before, started;
  try {
    env.loadCheckpoint({ schemaVersion: "seti-rl-checkpoint-v1", coreState: { version: 2, committedState: committed,
      compositionEnvelope: { schemaVersion: "seti-rule-composition-save-v1", committedState: committed, session: save.session ?? null } },
      config: { seed: record.seed, activePlayerCount: record.activePlayerCount, aiDifficulty: record.aiDifficulty,
        policyVersion: record.policyVersion, ...record.flags },
      replayCursor: { seed: record.seed, stepIndex: 0 }, replaySteps: null, browserReplaySteps: save.replaySteps });
    for (let step = 201; step <= 220; step += 1) {
      const seat = env.observe().decision.actorPlayerId;
      if (seat === "player-green") {
        report.step = step; before = env.createCheckpoint();
        report.checkpointPath = "reports/iteration/round-income-green-before-search-20260906.json";
        fs.writeFileSync(report.checkpointPath, JSON.stringify(before));
        await post("Profiler.enable"); await post("Profiler.start"); profiling = true;
        started = performance.now();
        const result = env.runHeuristicPolicyDecision();
        report.wallMs = performance.now() - started;
        report.chosen = result.policyDecision?.actionId; report.decisionOk = result.ok;
        break;
      }
      const result = env.runHeuristicPolicyDecision();
      const action = env.saveBrowserSave().replaySteps.at(-1).action;
      report.prefix.push({ step, seat, action });
      if (step === 201) assert.equal(action.actionId, "choose_target:9f6fd10f");
      if (step === 202) assert.equal(action.actionId, "place_data:8fd12fd3");
      assert.equal(result.ok, true);
    }
    assert.ok(report.step, "必须在限定前缀内找到绿方决策");
  } catch (error) {
    report.wallMs = started ? performance.now() - started : null;
    report.error = { message: error.message, stack: error.stack };
    if (before) report.rootUnchanged = env.createCheckpoint().coreState.committedState === before.coreState.committedState;
  } finally {
    try {
      if (profiling) {
        const { profile } = await post("Profiler.stop");
        report.profilePath = "reports/iteration/round-income-green-20260906.cpuprofile.gz";
        fs.writeFileSync(report.profilePath, zlib.gzipSync(JSON.stringify(profile)));
        const nodes = new Map(profile.nodes.map(node => [node.id, node]));
        const parents = new Map(profile.nodes.flatMap(node => (node.children || []).map(id => [id, node.id])));
        const totals = new Map();
        for (let i = 0; i < profile.samples.length; i += 1) {
          const sampleId = profile.samples[i], ms = profile.timeDeltas[i] / 1000, visited = new Set();
          for (let id = sampleId; id != null; id = parents.get(id)) {
            const frame = nodes.get(id).callFrame;
            const key = `${frame.url}:${frame.lineNumber + 1}:${frame.functionName}`;
            if (visited.has(key)) continue; visited.add(key);
            const row = totals.get(key) || { file: frame.url, line: frame.lineNumber + 1, name: frame.functionName, selfMs: 0, totalMs: 0 };
            row.totalMs += ms; if (id === sampleId) row.selfMs += ms; totals.set(key, row);
          }
        }
        report.selfHotspots = [...totals.values()].sort((a, b) => b.selfMs - a.selfMs).slice(0, 25);
        report.totalHotspots = [...totals.values()].filter(row => row.file.includes("seti-simu")).sort((a, b) => b.totalMs - a.totalMs).slice(0, 35);
      }
      report.diagnostics = env.getCounterfactualDiagnostics();
    } finally {
      session.disconnect(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ output, step: report.step, wallMs: report.wallMs, error: report.error,
        rootUnchanged: report.rootUnchanged, selfHotspots: report.selfHotspots?.slice(0, 8), totalHotspots: report.totalHotspots?.slice(0, 12) }, null, 2));
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
