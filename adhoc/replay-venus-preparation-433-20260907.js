"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/venus-preparation-433-20260907-v2.json";
const source = "reports/iteration/trace-analysis-hotspot-433-20260906.json";
const checkpoint = "reports/iteration/amiba-overflow-before-step-433-20260906.json";
const stable = value => JSON.stringify(value, (_key, v) => v && typeof v === "object" && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
if (fs.existsSync(output)) console.log(`已有证据，跳过：${output}`);
else {
  const env = createSimulationEnv(), report = { source, checkpoint,
    scope: "正式重建既有11条环绕金星准备路径；相同根随机状态，不冒充历史branchKey重放；下一主行动前通过正式end_turn/advanceFocalPlanningTurn推进，其他缺失宏输入只接受唯一合法项，否则显式记录歧义",
    sha256: Object.fromEntries([source,checkpoint].map(p => [p,crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")])), paths: [] };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync(checkpoint)); delete cp.replaySteps; env.loadCheckpoint(cp);
    fork = env.createCounterfactualFork().composition;
    const initial = fork.lifecycle.save().envelope;
    const cluster = JSON.parse(fs.readFileSync(source)).diagnostics.goalClusters
      .find(c => c.path.length === 1 && c.targetId === "orbit:venus:planet:");
    assert.equal(cluster.routeVariants.length, 11);
    const legal = () => { const i = fork.inspect(); return i.phase === "awaiting_input"
      ? i.session.decision.choices : fork.inputPort.enumerateActions(); };
    function submit(action) {
      const i = fork.inspect(), d = i.session?.decision;
      const r = i.phase === "awaiting_input" ? fork.inputPort.submitDecision({ decisionId: d.decisionId,
        decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: action }, { skipProjection: true })
        : fork.inputPort.submitAction(action, { skipProjection: true });
      assert.equal(r.ok, true, JSON.stringify(r));
    }
    for (const [index, variant] of cluster.routeVariants.entries()) {
      assert.equal(fork.lifecycle.restore(initial).ok, true);
      const path = { index, actions: variant.actions, insertedUniqueInputs: [], insertedTurnEnds: [] }; report.paths.push(path);
      for (const wanted of variant.actions) {
        let action;
        for (let drain = 0; drain < 20; drain++) {
          const choices = legal();
          const matches = choices.filter(a => a.family === wanted.family && stable(a.target) === stable(wanted.target));
          if (matches.length === 1) { action = matches[0]; break; }
          // 目标簇省略回合控制步骤；这里只补该有限目录内两种下一主行动的正式边界。
          const turnEnd = choices.find(a => a.family === "end_turn");
          if (!matches.length && ["orbit", "play_card"].includes(wanted.family) && turnEnd
            && !path.insertedTurnEnds.some(e => e.beforeAction === wanted)) {
            submit(turnEnd);
            const advanced = fork.counterfactualPort.advanceFocalPlanningTurn("player-white");
            assert.equal(advanced.ok, true, JSON.stringify(advanced));
            path.insertedTurnEnds.push({ beforeAction: wanted, action: turnEnd, advanced });
            continue;
          }
          if (matches.length > 1 || choices.length !== 1) {
            path.unresolved = { wanted, choices }; break;
          }
          path.insertedUniqueInputs.push(choices[0]); submit(choices[0]);
        }
        if (!action) { if (!path.unresolved) path.unresolved = { reason: "唯一输入排空超过20步" }; break; }
        submit(action);
      }
      path.completed = !path.unresolved;
      if (path.completed) {
        path.envelope = fork.lifecycle.save().envelope;
        path.state = JSON.parse(path.envelope.committedState);
        path.legal = legal();
      }
    }
    report.completedCount = report.paths.filter(p => p.completed).length;
    report.unresolvedCount = report.paths.length - report.completedCount;
    report.completedStateGroups = [...Map.groupBy(report.paths.filter(p=>p.completed), p=>stable(p.state)).values()]
      .map(group => group.map(p => p.index));
    report.passed = report.unresolvedCount === 0;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify({ output, passed: report.passed, completedCount: report.completedCount,
      unresolved: report.paths.filter(p=>p.unresolved).map(p=>({index:p.index,wanted:p.unresolved.wanted,
        choices:p.unresolved.choices?.map(a=>({family:a.family,target:a.target}))})),
      groups: report.completedStateGroups, error: report.error },null,2));
    if (!report.passed) process.exitCode = 1;
  }
}
