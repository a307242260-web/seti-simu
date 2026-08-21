"use strict";

// 共享规则观察构建器（Browser/Simulation 同源信息层）。
//
// 背景（host-unify 改造）：机器协调器 / AI 评估需要"规则观察"形状的输入
// （顶层 publicState.players/board、selfState.hand、requirements），而 Browser
// host 的 projectBrowserState 此前只产出 UI 展示视图（resident.* 且被读模型
// 替换），导致浏览器机器席位 observation 失明（players/hand/assets 全空 →
// 启发式决策退化为 pass）。
//
// 本模块把 Simulation 侧 buildObservation 的完整实现提升为两个 host 共用的
// 观察构建：sanitize 逻辑（simulation-contract）是纯函数、不依赖 host，任何
// canonical state + viewer 都能产出同源规则观察。Browser 的 projectBrowserState
// 用它构建 publicState/selfState 信息层（UI 壳附加为 resident.ui，不覆盖），
// Simulation 继续用它做 projectCounterfactualState —— 两个 host 的机器席位
// 观察从此同源（docs/browser-simulation-unification.md §信息层统一）。
//
// 错误语义：纯构建，无静默吞错；非法输入直接抛 TypeError。

const {
  OBSERVATION_SCHEMA_VERSION,
  sanitizeCard,
  sanitizePublicPlayer,
  sanitizeSelfPlayer,
  sanitizeAlienPublicState,
  sanitizeTechSupply,
  sanitizeFinalScoringState,
} = require("./simulation-contract");
const endGameScoring = require("../game/end-game-scoring");
const cardEffects = require("../game/cards/effects");

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function getTurnState(state) {
  // 调用方只瞬时读取原始字段并复制进新对象，不持有引用，无需克隆
  return state.turn || {};
}

// 待放置终局标记的潜在价值：玩家 base 分已跨过 [25,50,70] 阈值但尚未认领的标记，
// 每个标记会放在该玩家可标记的最优板块（公式 baseValue × 下一槽位倍率）。
function pendingFinalMarkValue(state, player) {
  const fs = state.finalScoring;
  if (!fs || !fs.tiles || !Array.isArray(fs.thresholds)) return 0;
  const playerId = player?.id || player?.color || null;
  if (!playerId) return 0;
  const score = Number(player?.resources?.score) || 0;
  const minThreshold = Math.min(...fs.thresholds.map((t) => Number(t) || 0));
  if (score < minThreshold) return 0;
  const marks = Object.values(fs.tiles || {})
    .flatMap((tile) => (Array.isArray(tile?.marks) ? tile.marks : []));
  const claimed = new Set(marks
    .filter((mark) => mark?.playerId === playerId || mark?.playerColor === playerId)
    .map((mark) => Number(mark?.threshold)));
  const pendingThresholds = fs.thresholds.filter((threshold) => (
    score >= Number(threshold) && !claimed.has(Number(threshold))
  ));
  if (!pendingThresholds.length) return 0;
  const formulaContext = {
    aliens: state.aliens,
    planets: state.planets,
    data: state.data,
  };
  const getCardTypeCode = (card) => cardEffects.getRuntimeCardTypeCode(
    card,
    cardEffects.getCardModel(card)?.cardType,
  );
  let total = 0;
  for (const threshold of pendingThresholds) {
    let best = 0;
    for (const [tileId, tile] of Object.entries(fs.tiles || {})) {
      const tileMarks = Array.isArray(tile?.marks) ? tile.marks : [];
      if (tileMarks.some((mark) => (
        mark?.playerId === playerId || mark?.playerColor === playerId
      ))) {
        continue;
      }
      const nextSlot = !tileMarks.some((mark) => Number(mark?.slotIndex) === 1) ? 1
        : !tileMarks.some((mark) => Number(mark?.slotIndex) === 2) ? 2 : 3;
      const formulaId = endGameScoring.getFormulaId(tileId, fs.tileVariants?.[tileId]);
      const baseValue = Number(endGameScoring.getFormulaBaseValue(
        formulaId,
        player,
        formulaContext,
        { getCardTypeCode },
      ) || 0);
      const multiplier = Number(endGameScoring.getSlotMultiplier(formulaId, nextSlot) || 0);
      best = Math.max(best, baseValue * multiplier);
    }
    total += best;
  }
  return total;
}

function buildDecisionFromState(state, legalActions) {
  const turn = getTurnState(state);
  if (turn.gameEnded) return null;
  const actorPlayerId = legalActions[0]?.actorId || turn.currentPlayerId || null;
  if (!actorPlayerId) return null;
  const decisionType = legalActions[0]?.phase === "conditional"
    ? "conditional_choice"
    : "turn_action";
  const effectOwnerPlayerId = decisionType === "turn_action" ? null : actorPlayerId;
  return {
    actorPlayerId,
    pendingOwnerPlayerId: effectOwnerPlayerId,
    effectOwnerPlayerId,
    currentPlayerId: turn.currentPlayerId,
    source: effectOwnerPlayerId ? "effect_owner" : "current_player",
    decisionType,
    choiceCount: legalActions.length,
  };
}

// 规则观察（信息层）：viewer-safe 完整盘面快照，与 Simulation 的
// projectCounterfactualState 完全同源。Browser/Simulation 的机器席位、AI 评估、
// 训练都从它读；UI 渲染壳不在此层。
function buildRuleObservation(state, seed, viewerPlayerId, legalActions = [], options = {}) {
  const turn = getTurnState(state);
  const playersState = state.players || { players: [] };
  const perspectivePlayerId = viewerPlayerId || legalActions[0]?.actorId || turn.currentPlayerId || null;
  const decision = buildDecisionFromState(state, legalActions);
  const setup = state.match?.initialSetup || null;
  const setupCurrentPlayerId = setup?.currentPlayerId || null;
  // cheap：搜索中间节点只需 requirements/资源/rockets/aliens/公共牌/科技（遮蔽所需），
  // 跳过 planets/data/solarSystem/finalScoring 克隆；完整观测只在叶/根/宿主构建。
  const cheap = options.cheap === true;
  return {
    schemaVersion: OBSERVATION_SCHEMA_VERSION,
    seed: seed ?? null,
    perspectivePlayerId,
    publicState: {
      roundNumber: turn.roundNumber,
      turnNumber: turn.turnNumber,
      actionCycleNumber: turn.actionCycleNumber,
      currentPlayerId: turn.currentPlayerId,
      passedPlayerIds: [...(turn.passedPlayerIds || [])],
      completedTurnPlayerIds: [...(turn.completedTurnPlayerIds || [])],
      activePlayerIds: [...(turn.activePlayerIds || [])],
      players: (playersState.players || []).map((player) => {
        const breakdown = endGameScoring.computePlayerFinalScore({
          ...state,
          finalScoring: clone(state.finalScoring),
          players: playersState.players || [],
          currentPlayer: player,
          cardEffects,
          getCardTypeCode: (card) => cardEffects.getRuntimeCardTypeCode(
            card,
            cardEffects.getCardModel(card)?.cardType,
          ),
        }, player);
        // finalScore 传完整终局总分（breakdown.totalScore）：observation 与记录
        // 统一"所有分数以最终总分为准"口径（2026-08-20 用户规定）。此前传 null
        // 导致 finalScore 恒 null、记录/复盘只看到 base 分（如 v27-tech-v3 白 64
        // base，实际完整 106）。
        const publicPlayer = sanitizePublicPlayer(player, breakdown);
        return {
          ...publicPlayer,
          securedEndGameBonus: breakdown.totalScore - breakdown.baseScore
            + pendingFinalMarkValue(state, player),
        };
      }),
      board: {
        rockets: clone(state.pieces?.rockets || []),
        ...(cheap ? {} : {
          planets: clone(state.planets || {}),
          data: clone(state.data || {}),
          solarSystem: clone(state.solarSystem || {}),
          finalScoring: sanitizeFinalScoringState(state.finalScoring),
        }),
        publicCards: (state.cards?.publicCards || []).map(sanitizeCard),
        discardCount: (state.cards?.discardPile || []).length,
        techSupply: sanitizeTechSupply(state.tech),
        aliens: sanitizeAlienPublicState(state.aliens),
      },
      resident: {
        initialSetup: {
          active: setup?.phase === "selecting",
          interactive: setup?.phase === "selecting"
            && setupCurrentPlayerId === perspectivePlayerId,
          currentPlayerId: setupCurrentPlayerId,
          offer: setup?.phase === "selecting" && setupCurrentPlayerId === perspectivePlayerId
            ? clone(setup.offersByPlayerId?.[setupCurrentPlayerId] || null)
            : null,
          confirmedPlayerIds: clone(setup?.confirmedPlayerIds || []),
        },
      },
      pending: decision,
    },
    selfState: sanitizeSelfPlayer(
      (playersState.players || []).find((player) => player.id === perspectivePlayerId) || null,
    ),
    decision,
    probeRouteRequirements: state.probeRouteRequirements || null,
    dataAnalyzeRequirements: state.dataAnalyzeRequirements || null,
    sectorWinRequirements: state.sectorWinRequirements || null,
    incomeGainRequirements: state.incomeGainRequirements || null,
    techGainRequirements: state.techGainRequirements || null,
    terminal: Boolean(turn.gameEnded),
  };
}

module.exports = {
  OBSERVATION_SCHEMA_VERSION,
  buildRuleObservation,
  buildDecisionFromState,
  getTurnState,
  pendingFinalMarkValue,
};
