"use strict";
// 第三轮开工诊断：窄协调器边界反例与既有真实搜索叶形状审计，不运行AI全盘。
const fs = require("node:fs");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createMachinePlayerCoordinator } = require("../randomizer/game/ai/machine-player-coordinator");
const continuation = require("../randomizer/game/ai/plan-continuation");
const output = "reports/iteration/plan-boundaries-r3-audit-20260905.json";
if (fs.existsSync(output)) {
  console.log(`已有checkpoint，未重跑：${output}`);
} else {
  const descriptor = (id) => ({ schemaVersion: "seti-standard-action-v1", actionId: id,
    family: "move", phase: "quick", actorId: "p1", stateVersion: 1, decisionVersion: 0,
    target: {}, payload: {} });
  let revealed = false;
  let calls = 0;
  const legal = [descriptor("start"), descriptor("planned"), descriptor("reconsidered")];
  const state = () => ({ publicState: { roundNumber: 1, turnNumber: 1,
    board: { aliens: { slots: [{ id: "alien-slot", revealed }] } } }, selfState: { id: "p1", hand: [] } });
  const diagnostics = [];
  const coordinator = createMachinePlayerCoordinator({ composition: {
    inspect: () => ({ phase: "idle" }), inputPort: { enumerateActions: () => legal },
    projection: () => ({ state: state() }),
  }, execute: () => ({ ok: true }), onDiagnostic: (type, detail) => diagnostics.push({ type, ...detail }) });
  coordinator.registerSeat("p1", () => {
    calls += 1;
    return calls === 1 ? { actionId: "start", plan: { nextActionId: "planned",
      continuation: ["planned"], dependency: { kind: "generic" }, revealedCount: 0 } }
      : { actionId: "reconsidered", plan: null };
  });
  coordinator.runDecision("p1");
  revealed = true;
  const actual = coordinator.runDecision("p1");
  assert.equal(actual.source, "plan-reuse", "诊断针对当前仍跳过同回合揭示检查的实现");
  assert.equal(calls, 1);
  const firstDependency = { kind: "tech", tileId: "blue1", present: true, remaining: 4, bonusId: "bonus_1c" };
  const advanced = continuation.advancePlan({ nextActionId: "research", continuation: ["research", "scan"],
    dependency: firstDependency, revealedCount: 0 });
  assert.equal(advanced.nextActionId, "scan");
  assert.deepEqual(advanced.dependency, firstDependency);
  const source = "reports/iteration/search-result-retention-s1-profile-20260905.json";
  const raw = fs.readFileSync(source);
  const outcome = JSON.parse(raw).cases.find((item) => item.name === "brown-pass").selectedOutcome;
  const leaves = outcome.leaves.map((leaf) => ({ leafId: leaf.leafId,
    actionCount: leaf.actionChain.length, executionStepCount: leaf.executionStepCount,
    routeActions: leaf.secondaryAgentTrace.length,
    rootAssumedObservation: Boolean(leaf.rootActionObservation),
    rootSettledObservation: Boolean(leaf.rootActionSettledObservation),
    hasPerStepObservations: Object.hasOwn(leaf, "stepObservations"),
  }));
  const report = { createdAt: new Date().toISOString(),
    gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    scope: "协调器窄边界反例不代表真实完整游戏；真实叶只审计已有记录，不重搜",
    sameTurnReveal: { expected: "scheme/reconsidered", actual: `${actual.source}/${actual.actionId}`, calls, diagnostics },
    advance: { expected: "下一步scan使用其执行前的扇区依赖", actual: advanced },
    realLeafSource: { path: source, sha256: crypto.createHash("sha256").update(raw).digest("hex"),
      leafCount: leaves.length, foldedLeaves: leaves.filter((leaf) => leaf.executionStepCount > leaf.actionCount).length,
      leaves },
  };
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, sameTurnReveal: report.sameTurnReveal, advance: report.advance,
    realLeaves: leaves.length, foldedLeaves: report.realLeafSource.foldedLeaves }, null, 2));
}
