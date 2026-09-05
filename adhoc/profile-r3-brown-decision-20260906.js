"use strict";
const fs = require("node:fs");
const inspector = require("node:inspector");
const { promisify } = require("node:util");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/r3-brown-cpu-20260906.json";
const profilePath = "reports/iteration/r3-brown-decision-20260906.cpuprofile";

async function run() {
  if (fs.existsSync(output) || fs.existsSync(profilePath)) {
    console.log("CPU剖析已有记录，未重跑");
    return;
  }
  const env = createSimulationEnv();
  const session = new inspector.Session();
  session.connect();
  const post = promisify(session.post).bind(session);
  const report = { createdAt: new Date().toISOString(), profilePath,
    checkpointPath: "reports/iteration/r3-brown-before-41-20260906.json",
    scope: "对已知超时状态的一次CPU采样；用于归因，不替代无采样性能验收，不跑全盘" };
  try {
    env.loadCheckpoint(JSON.parse(fs.readFileSync(report.checkpointPath)));
    await post("Profiler.enable");
    await post("Profiler.start");
    const start = performance.now();
    const decision = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    const { profile } = await post("Profiler.stop");
    fs.writeFileSync(profilePath, JSON.stringify(profile));
    report.chosen = decision.policyDecision?.actionId;
    report.ok = decision.ok;
    report.diagnostics = Object.fromEntries(Object.entries(env.getCounterfactualDiagnostics())
      .filter(([key]) => key.endsWith("Milliseconds") || key === "executedNodeCount"));
    const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
    const parents = new Map(profile.nodes.flatMap((node) => (node.children || []).map((id) => [id, node.id])));
    const totals = new Map();
    for (let index = 0; index < profile.samples.length; index += 1) {
      const micros = profile.timeDeltas[index];
      let id = profile.samples[index];
      let self = true;
      const visited = new Set();
      while (id != null) {
        const frame = nodes.get(id).callFrame;
        const key = `${frame.url}:${frame.lineNumber + 1}:${frame.functionName}`;
        if (!visited.has(key)) {
          const row = totals.get(key) || { file: frame.url, line: frame.lineNumber + 1,
            name: frame.functionName, selfMs: 0, totalMs: 0 };
          row.totalMs += micros / 1000;
          if (self) row.selfMs += micros / 1000;
          totals.set(key, row);
          visited.add(key);
        }
        self = false;
        id = parents.get(id);
      }
    }
    report.selfHotspots = [...totals.values()].sort((a, b) => b.selfMs - a.selfMs).slice(0, 35);
    report.totalHotspots = [...totals.values()].filter((row) => row.file.includes("seti-simu"))
      .sort((a, b) => b.totalMs - a.totalMs).slice(0, 45);
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ output, ms: report.wallMs, chosen: report.chosen,
      selfHotspots: report.selfHotspots.slice(0, 12), totalHotspots: report.totalHotspots.slice(0, 15) }, null, 2));
  } finally {
    session.disconnect();
    env.dispose();
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
