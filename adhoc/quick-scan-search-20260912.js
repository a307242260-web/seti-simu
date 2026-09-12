"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const model = require("../randomizer/game/ai/outcome-model");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const data = require("../randomizer/game/data");
const pool = Number(process.argv[2] || 5);
assert([4, 5, 6].includes(pool));
const nearWin = process.argv.includes("--near-win");
const gitCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const scriptHash = crypto.createHash("sha256").update(fs.readFileSync(__filename)).digest("hex");
const output = `reports/iteration/quick-scan-search-20260912-${gitCommit.slice(0, 8)}-${scriptHash.slice(0, 8)}-pool${pool}${nearWin ? "-near-win" : ""}.json`;
if (fs.existsSync(output)) {
  process.stdout.write(`已有checkpoint，跳过搜索：${output}\n`);
  process.exit(0);
}
const source = "seti-saves/seti-save-research-turn-boundary-20260911-31a2e43b-full-v276.json";
const save = JSON.parse(fs.readFileSync(source, "utf8"));
const env = createSimulationEnv();
let composition;
try {
  env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "laughable" });
  for (const step of save.replaySteps.slice(0, 32)) {
    const action = env.legalActions().find(a => a.actionId === step.action.actionId);
    assert(action);
    assert.equal(env.step(action).ok, true);
  }
  const seatId = save.replaySteps[32].action.actorId;
  composition = env.createCounterfactualFork().composition;
  const envelope = composition.lifecycle.save().envelope;
  const state = JSON.parse(envelope.committedState);
  const player = state.players.players.find(p => p.id === seatId);
  assert.equal(data.listPoolTokens(player).length, 0);
  assert.equal(data.listComputerPlacedTokens(player).length, 4);
  const fixtureChanges = [];
  if (nearWin) {
    const sectorId = "sector-3-a";
    const openCount = () => data.listNebulaTokens(state.data, sectorId)
      .filter(token => !token.replacedByPlayerId && !token.replacedByPlayerColor).length;
    while (openCount() > 1) {
      const placed = data.replaceNextNebulaDataToken(state.data, sectorId, player, { root: state });
      assert.equal(placed.ok, true);
      fixtureChanges.push({ sectorId, slotIndex: placed.slotIndex, score: placed.secondSlotScore });
    }
    assert.equal(openCount(), 1);
  }
  for (let i = 0; i < pool; i += 1) assert.equal(data.gainData(player, { root: state }).ok, true);
  assert.equal(composition.lifecycle.restore({ ...envelope, committedState: JSON.stringify(state) }).ok, true);
  const checkpoint = env.createCheckpoint();
  delete checkpoint.replaySteps;
  checkpoint.coreState.compositionEnvelope = composition.lifecycle.save().envelope;
  checkpoint.coreState.committedState = checkpoint.coreState.compositionEnvelope.committedState;
  env.loadCheckpoint(checkpoint);
  const observation = model.createDecisionObservation(composition.projection({ role: "player", playerId: seatId }).state,
    { seatId });
  const legalActions = env.legalActions();
  if (nearWin) assert.equal(observation.outcomeProjection.progress.sectorWinRequirements.candidates
    .find(candidate => candidate.sectorId === "sector-3-a").minimumOwnMarks, 1);
  process.stdout.write(`[单决策] pool=${pool} commit=${gitCommit.slice(0, 8)} 开始，使用完整合法集与生产搜索预算\n`);
  const started = performance.now();
  const result = env.runHeuristicPolicyDecision();
  const elapsedMilliseconds = performance.now() - started;
  assert.equal(result.ok, true, "正式决策及一次提交必须成功");
  assert(result.searches.some(search => search.kind === "strategic" && search.diagnostics?.executedNodeCount > 0),
    "必须产生真实战略搜索诊断，禁把未启用嵌套搜索的空结果当作性能证据");
  const context = { seatId, observation, legalActions, actionOutcomes: result.actionOutcomes };
  const capacityLeaves = [];
  const evaluations = legalActions.map(action => {
    const evaluation = evaluator.evaluateOutcome(context, action);
    const outcome = result.actionOutcomes.find(o => o.actionId === action.actionId);
    const selectedLeaf = outcome?.leaves?.find(leaf => leaf.leafId === evaluation.selectedLeafId);
    if (["scan", "place_data"].includes(action.family)) {
      for (const leaf of outcome?.leaves || []) {
        if (!String(leaf.rootRoutePlanId || "").startsWith("sector:standard-scan:")) continue;
        const assessed = evaluator.evaluateOutcome({ ...context,
          actionOutcomes: [{ ...outcome, leaves: [leaf] }] }, action);
        const steps = leaf.planSteps || [];
        const scanIndex = steps.findIndex(step => step.action.family === "scan");
        capacityLeaves.push({ rootFamily: action.family, leafId: leaf.leafId,
          targetId: leaf.rootRouteTargetId, terminalReason: leaf.terminalReason,
          scanReached: scanIndex >= 0,
          preparedBeforeScan: scanIndex < 0 ? null : steps.slice(0, scanIndex)
            .filter(step => step.action.family === "place_data").length,
          selectable: assessed.selectable, reasonCodes: assessed.reasonCodes,
          primaryValue: assessed.primaryValue, dataDiscardDelta: assessed.dataDiscardDelta,
          executionStepCount: assessed.executionStepCount,
        });
      }
    }
    return { action, evaluation, searchCompleteness: outcome?.searchCompleteness,
      leafCount: outcome?.leaves?.length || 0,
      selectedSteps: (selectedLeaf?.planSteps || []).map(step => ({
        action: step.action, goalDepth: step.goalDepth, routeTargetId: step.routeTargetId,
        routePlanId: step.routePlanId, goalCompletionPending: step.goalCompletionPending,
        data: step.facts?.data,
      })) };
  });
  const record = { source, step: 33, gitCommit, scriptHash, pool, seatId, elapsedMilliseconds,
    nearWin, fixtureChanges, capacityLeaves,
    scope: "同一正式扫描前状态，用gainData构造池容量并经无replay的正式checkpoint恢复；Simulation完整生产决策及一次提交，不模拟对手。非整局实验。",
    selectedActionId: result.policyDecision.actionId, searches: result.searches, evaluations };
  fs.writeFileSync(output, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
  for (const search of result.searches) process.stdout.write(`[搜索结果] ${JSON.stringify(search)}\n`);
  process.stdout.write(`[单决策] ${elapsedMilliseconds.toFixed(1)}ms 选择=${result.policyDecision.actionId} checkpoint=${output}\n`);
} finally {
  composition?.dispose();
  env.dispose();
}
