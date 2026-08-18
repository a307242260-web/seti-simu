"use strict";
// 诊断：机器玩家协调器 readBoundary 的 observation 在 Browser/Simulation 两条
// 装配路径下到底"看到"了什么。不修改任何源码，只做只读探测。
//
// 用法：node tools/diagnose_machine_observation.js

const productionKernel = require("../randomizer/game/production-kernel");
const outcomeModel = require("../randomizer/game/ai/outcome-model");
const projectionAdapter = require("../randomizer/app/browser-host/projection-adapter");
const { createSeededRandom, hashSeed } = require("../randomizer/game/random");

const SEED = "diagnose-seed-1";

function summarizeObservation(label, observation) {
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
  const aliens = board?.aliens || {};
  const slots = Array.isArray(aliens?.slots) ? aliens.slots : Object.values(aliens?.slots || {});
  return {
    label,
    viewerSeatId: observation?.viewer?.seatId,
    schemaVersion: observation?.schemaVersion,
    publicPlayers: players.length,
    selfHand: Array.isArray(selfState.hand) ? selfState.hand.length : "missing",
    selfReserved: Array.isArray(selfState.reservedCards) ? selfState.reservedCards.length : "missing",
    boardRockets: Array.isArray(board?.rockets) ? board.rockets.length : "missing",
    alienSlots: slots.length,
    assets: { ...(projection.assets || {}) },
    ownedTechIds: [...(projection.progress?.ownedTechIds || [])],
    income: { ...(projection.progress?.income || {}) },
    realizedScore: projection.scoring?.realizedScore,
    roundNumber: projection.progress?.roundNumber,
    probeGoalRequirements: Boolean(projection.progress?.probeGoalRequirements),
    dataAnalyzeRequirements: Boolean(projection.progress?.dataAnalyzeRequirements),
    // 关键字段：resourceFacts 直接从 publicPlayer 读，若 publicPlayer 丢失则全 0
    probeRoute: projection.progress?.probeRoute || null,
  };
}

(async () => {
  // 用真实 production kernel 建一局（Simulation host，projectState 原样返回 canonical
  // state——与 Simulation 机器席位同一条观察输入；Browser 则额外套 defaultVisibilityPolicy
  // + projectBrowserState 的 resident 替换，等价于 browser-rule-composition.projectBrowserState
  // 的返回形状）。
  const seededRandom = createSeededRandom(SEED);
  const kernel = productionKernel.createSimulationRuleComposition({
    seed: SEED,
    activePlayerCount: 4,
    random: seededRandom,
    rngState: { algorithm: "seti-production-rng-v1", state: seededRandom.getState() },
    trustedProjectionReader: true,
    projectCounterfactualState: (state) => state,
  });
  const composition = kernel.composition;
  const newGame = kernel.newGame({ seed: SEED, activePlayerCount: 4 });
  if (newGame?.ok === false) throw new Error(newGame.message || newGame.code || "newGame 失败");
  const drain = composition.inputPort.beginDrain({ metadata: { source: "diagnose" } });
  if (drain?.ok === false) throw new Error(drain.message || drain.code || "drain 失败");

  // 找当前决策 owner（机器席位）
  const inspection = composition.inspect();
  const ownerId = inspection.session?.decision?.ownerId
    || composition.projection().state?.match?.currentPlayerId;
  if (!ownerId) throw new Error("无法解析决策 owner");

  // ---- Simulation 路径（协调器 createObservation 输入）----
  const simProjection = composition.projection({
    viewerId: `machine:${ownerId}`,
    playerId: ownerId,
    role: "player",
  });
  const simState = simProjection?.state || simProjection;
  const simObservation = outcomeModel.createDecisionObservation(simState, {
    seatId: ownerId,
    stateVersion: null,
    decisionVersion: null,
  });

  // ---- Browser 路径：defaultVisibilityPolicy + resident 替换（= projectBrowserState 输出）----
  // 取 canonical state：simulation host 的 projection 在 role!=simulation 时走
  // projectCounterfactualState；这里 identity 返回即 canonical。
  const canonical = simState;
  const visible = projectionAdapter.defaultVisibilityPolicy(
    structuredClone(canonical),
    { viewerId: `machine:${ownerId}`, playerId: ownerId, role: "player" },
    { inspection: composition.inspect() },
  );
  // 复刻 projectBrowserState 的 resident 替换（读模型不参与 observation，只占位）
  visible.resident = {
    finalReadModel: null,
    browserReadModel: null,
    initialSetup: visible.resident?.initialSetup || { active: false },
    initialIncome: { active: false },
  };
  visible.probeRouteRequirements = canonical.probeRouteRequirements || null;
  visible.dataAnalyzeRequirements = canonical.dataAnalyzeRequirements || null;
  visible.sectorWinRequirements = canonical.sectorWinRequirements || null;
  visible.incomeGainRequirements = canonical.incomeGainRequirements || null;
  visible.techGainRequirements = canonical.techGainRequirements || null;
  const browserObservation = outcomeModel.createDecisionObservation(visible, {
    seatId: ownerId,
    stateVersion: null,
    decisionVersion: null,
  });

  const summary = [
    summarizeObservation("simulation", simObservation),
    summarizeObservation("browser(visible)", browserObservation),
  ];

  // 对比核心字段
  const playerList = (obs) => {
    const raw = obs?.publicState?.players;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.players)) return raw.players;
    return Object.values(raw || {});
  };
  const simPlayer = playerList(simObservation).find(
    (p) => String(p.playerId ?? p.id) === String(ownerId),
  );
  const browserPlayer = playerList(browserObservation).find(
    (p) => String(p.playerId ?? p.id) === String(ownerId),
  );
  console.log(JSON.stringify({ ownerId, summary, simPlayerFound: Boolean(simPlayer), browserPlayerFound: Boolean(browserPlayer) }, null, 2));

  // 结论判断
  const blind = browserObservation.publicState.players.length === 0
    && browserObservation.selfState.hand.length === 0
    && browserObservation.outcomeProjection.assets.credits === 0;
  console.log(`\n>>> Browser 机器席位观察是否失明（players/hand/assets 全空）: ${blind ? "是 —— 信息传递失败" : "否"}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
