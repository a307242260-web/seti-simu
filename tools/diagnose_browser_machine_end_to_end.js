"use strict";
// 端到端：真实 Browser 装配路径（createBrowserRuleComposition + 真实
// defaultVisibilityPolicy + 真实 machine coordinator + 真实 Heuristic 决策函数）
// 下，机器席位 readBoundary 的 observation 内容与决策行为。
// 读模型 owner 用 stub（projectBrowserState 只把读模型放进 resident 供 UI 消费，
// observation 从不读它们），等价于真实装配的 observation 形状。
//
// 用法：node tools/diagnose_browser_machine_end_to_end.js

const productionKernelApi = require("../randomizer/game/production-kernel");
const projectionAdapter = require("../randomizer/app/browser-host/projection-adapter");
const browserRuleCompositionModule = require("../randomizer/app/browser-rule-composition");
const machinePlayerCoordinatorModule = require("../randomizer/game/ai/machine-player-coordinator");
const heuristicDecisionFunctionModule = require("../randomizer/game/ai/heuristic-decision-function");
const outcomeModel = require("../randomizer/game/ai/outcome-model");
const { createSeededRandom } = require("../randomizer/game/random");

const SEED = "browser-e2e-1";

function summarizeObservation(observation) {
  const projection = observation?.outcomeProjection || {};
  const publicState = observation?.publicState || {};
  const rawPlayers = publicState?.players;
  const players = Array.isArray(rawPlayers)
    ? rawPlayers
    : Array.isArray(rawPlayers?.players)
      ? rawPlayers.players
      : Object.values(rawPlayers || {});
  const selfState = observation?.selfState || {};
  const board = publicState?.board || {};
  return {
    players: players.length,
    selfHand: Array.isArray(selfState.hand) ? selfState.hand.length : "missing",
    assets: { ...(projection.assets || {}) },
    realizedScore: projection.scoring?.realizedScore,
    ownedTechIds: [...(projection.progress?.ownedTechIds || [])],
    boardRockets: Array.isArray(board?.rockets) ? board.rockets.length : "missing",
    initialSetupOffer: Boolean(
      observation?.publicState?.resident?.initialSetup?.offer
      || observation?.publicState?.resident?.initialSetup?.active,
    ),
  };
}

(async () => {
  const seededRandom = createSeededRandom(SEED);
  const ruleComposition = browserRuleCompositionModule.createBrowserRuleComposition({
    productionKernelApi,
    random: seededRandom,
    seed: SEED,
    activePlayerCount: 4,
    hostServices: {},
    browserProjection: {
      visibilityPolicy: projectionAdapter.defaultVisibilityPolicy,
      getFinalReadModelOwner: () => ({ project: () => ({ players: [] }) }),
      getBrowserReadModelOwner: () => ({ project: () => ({ render: {} }) }),
      createRenderPresentation: () => ({}),
    },
  });
  const newGame = ruleComposition.newGame({ seed: SEED, activePlayerCount: 4 });
  if (newGame?.ok === false) throw new Error(newGame.message || newGame.code || "newGame 失败");
  const drain = ruleComposition.inputPort.beginDrain({ metadata: { source: "diag" } });
  if (drain?.ok === false) throw new Error(drain.message || drain.code || "drain 失败");

  function submit(action) {
    const inspection = ruleComposition.inspect();
    if (inspection.phase === "awaiting_input") {
      const result = ruleComposition.inputPort.submitDecision({
        decisionId: inspection.session.decision.decisionId,
        decisionVersion: inspection.session.decision.decisionVersion,
        ownerId: inspection.session.decision.ownerId,
        choice: action,
      });
      return result?.ok === false
        ? { ok: false, error: result.message || result.code || "submitDecision 失败" }
        : { ok: true };
    }
    const result = ruleComposition.inputPort.dispatchAction(action);
    return result?.ok === false
      ? { ok: false, error: result.message || result.code || "dispatchAction 失败" }
      : { ok: true };
  }

  const coordinator = machinePlayerCoordinatorModule.createMachinePlayerCoordinator({
    composition: ruleComposition,
    execute: submit,
    recordStep: () => {},
  });
  const decisionFunction = heuristicDecisionFunctionModule.createHeuristicDecisionFunction({
    composition: ruleComposition,
    difficulty: "laughable",
  });

  function currentOwner() {
    const inspection = ruleComposition.inspect();
    if (inspection.phase === "awaiting_input" && inspection.session?.decision?.ownerId) {
      return inspection.session.decision.ownerId;
    }
    const source = ruleComposition.projectionSource.read();
    return source?.state?.match?.currentPlayerId || null;
  }

  // 推进到第一个主行动边界（初始选择由机器席位自己决策）
  let steps = 0;
  let mainBoundary = null;
  let lastError = null;
  while (steps < 80) {
    steps += 1;
    const owner = currentOwner();
    if (!owner) { lastError = "无当前 owner"; break; }
    const boundary = coordinator.readBoundary(owner);
    const isSetup = heuristicDecisionFunctionModule.isInitialSetupBoundary(boundary.legalActions);
    if (!isSetup) {
      mainBoundary = boundary;
      break;
    }
    if (!coordinator.hasSeat(owner)) coordinator.registerSeat(owner, decisionFunction.run);
    try {
      const result = coordinator.runDecision(owner, { reuseEnabled: false });
      if (result.executed?.ok !== true) { lastError = `执行失败: ${result.executed?.error || "unknown"}`; break; }
    } catch (error) {
      lastError = `决策失败: ${error?.message || String(error)}`;
      break;
    }
  }

  console.log(`推进步数: ${steps}, 主行动边界: ${mainBoundary ? "是" : "否"}, lastError: ${lastError || "无"}`);
  if (!mainBoundary) {
    console.log("未到达主行动边界，退出。");
    return;
  }

  // 1) readBoundary 的 observation 内容
  const observation = mainBoundary.observation;
  const summary = summarizeObservation(observation);
  const playerList = (obs) => {
    const raw = obs?.publicState?.players;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.players)) return raw.players;
    return Object.values(raw || {});
  };
  const selfPlayer = playerList(observation).find((p) => (
    String(p.playerId ?? p.id) === String(mainBoundary.seatId)
  ));
  console.log("主行动边界 observation:", JSON.stringify(summary, null, 2));
  console.log(`selfPlayer 是否可见: ${Boolean(selfPlayer)}`);

  // 2) Heuristic 决策函数实际行为
  try {
    const decision = decisionFunction.run(mainBoundary);
    console.log("决策结果:", JSON.stringify({
      actionId: decision.actionId,
      actionFamily: mainBoundary.legalActions.find((a) => a.actionId === decision.actionId)?.family,
      outcomeStatuses: decision.actionOutcomes.map((o) => ({
        actionId: o.actionId,
        status: o.status,
        code: o.code || null,
        leaves: o.leaves?.length || 0,
        score: o.score ?? null,
      })),
    }, null, 2));
  } catch (error) {
    console.log("决策函数抛错:", error?.message || String(error));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
