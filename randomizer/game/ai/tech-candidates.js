(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAITechCandidates = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createTechCandidates(context = {}) {
    const {
      actions,
      scanEffects,
      tech,
      techGameState,
      FINAL_ROUND_NUMBER,
    } = context;
    const aiNumber = (...args) => context.aiNumber(...args);
    const createActionContext = (...args) => context.createActionContext(...args);
    const getAiMapDemand = (...args) => context.getAiMapDemand(...args);
    const getAiNextMissingFinalScoreThreshold = (...args) => context.getAiNextMissingFinalScoreThreshold(...args);
    const getAiOrange4SatellitePotentialProfile = (...args) => context.getAiOrange4SatellitePotentialProfile(...args);
    const getAiResearchTechCandidateSafety = (...args) => context.getAiResearchTechCandidateSafety(...args);
    const getAiResearchTechDirectScoreGain = (...args) => context.getAiResearchTechDirectScoreGain(...args);
    const getAiResearchTechFinalFormulaDeltas = (...args) => context.getAiResearchTechFinalFormulaDeltas(...args);
    const getAiResearchTechSelectionOptionsForEffect = (...args) => context.getAiResearchTechSelectionOptionsForEffect(...args);
    const getAiRoundNumber = (...args) => context.getAiRoundNumber(...args);
    const getAiStrategyDemand = (...args) => context.getAiStrategyDemand(...args);
    const getCurrentPlayer = (...args) => context.getCurrentPlayer(...args);
    const getResearchTechSelectionOptionsForEffect = (...args) => context.getResearchTechSelectionOptionsForEffect(...args);
    const isTechTileOwnedByOtherPlayer = (...args) => context.isTechTileOwnedByOtherPlayer(...args);
    const listAiMoveCandidates = (...args) => context.listAiMoveCandidates(...args);
    const roundAiScore = (...args) => context.roundAiScore(...args);
    const scoreAiHuanyuOrange2FutureMoveValue = (...args) => context.scoreAiHuanyuOrange2FutureMoveValue(...args);
    const scoreAiLateTechEngineCatchupValue = (...args) => context.scoreAiLateTechEngineCatchupValue(...args);
    const scoreAiLowTechBoardCatchupValue = (...args) => context.scoreAiLowTechBoardCatchupValue(...args);
    const scoreAiResearchTechRoutePlan = (...args) => context.scoreAiResearchTechRoutePlan(...args);
    const scoreAiResearchTechValue = (...args) => context.scoreAiResearchTechValue(...args);
    const sumAiDemandMap = (...args) => context.sumAiDemandMap(...args);

    function buildAiResearchTechCandidate(tileId) {
      const stack = tech.getStack?.(techGameState.board, tileId) || null;
      const candidate = {
        tileId,
        techType: stack?.techType || tech.getTechType?.(tileId) || null,
        stackIndex: tech.getStackIndex?.(tileId) || null,
        bonusId: stack?.bonusId || null,
        firstTake: stack?.firstTakeClaimedBy == null,
        remaining: stack?.remaining ?? null,
      };
      const safety = getAiResearchTechCandidateSafety(candidate, getCurrentPlayer());
      candidate.available = safety.ok;
      candidate.reason = safety.message || null;
      candidate.plan = scoreAiResearchTechRoutePlan(candidate, getCurrentPlayer());
      candidate.score = scoreAiResearchTechValue(candidate);
      candidate.finalFormulaDeltas = getAiResearchTechFinalFormulaDeltas(candidate, getCurrentPlayer());
      candidate.directScoreGain = getAiResearchTechDirectScoreGain(candidate);
      candidate.valueBreakdown = {
        lateTechCatchupValue: scoreAiLateTechEngineCatchupValue(candidate, getCurrentPlayer()),
        lowTechCatchupValue: scoreAiLowTechBoardCatchupValue(candidate, getCurrentPlayer()),
        huanyuOrange2FutureMoveValue: scoreAiHuanyuOrange2FutureMoveValue(candidate, getCurrentPlayer()),
      };
      if (candidate.tileId === "orange4") {
        candidate.valueBreakdown.orange4SatelliteProfile = getAiOrange4SatellitePotentialProfile(getCurrentPlayer());
      }
      if (!safety.ok) candidate.score -= 1000;
      return candidate;
    }

    function scoreAiBorrowedTechImmediateValue(candidate, player = getCurrentPlayer()) {
      if (!candidate || !player) return -Infinity;
      const techType = candidate.techType || "";
      const tileId = candidate.tileId || "";
      const demand = getAiStrategyDemand(player);
      const planScore = Math.max(0, aiNumber(candidate.plan?.score));
      let value = 1.5 + planScore * 1.15;
      const context = createActionContext();

      if (tileId === "orange1") {
        const launchCheck = actions.canExecute("launch", context);
        if (launchCheck.ok) value += 2.5 + getAiMapDemand(demand.actions, "launch") * 0.12;
      }
      if (tileId === "orange2") {
        const bestMoveScore = listAiMoveCandidates()
          .reduce((best, move) => Math.max(best, aiNumber(move.score)), 0);
        value += Math.min(7, Math.max(0, bestMoveScore) * 0.18)
          + getAiMapDemand(demand.actions, "move") * 0.1;
      }
      if (tileId === "orange3" || tileId === "orange4") {
        const landCheck = actions.canExecute("land", context);
        if (landCheck.ok) {
          value += 3.5
            + getAiMapDemand(demand.actions, "land") * 0.12
            + getAiMapDemand(demand.planetIds, landCheck.planet?.planetId) * 0.08;
        }
      }
      if (techType === "purple") {
        const scanCheck = scanEffects.canExecuteScan(player, { standardAction: true });
        if (scanCheck?.ok) {
          value += 3.25
            + getAiMapDemand(demand.actions, "scan") * 0.12
            + sumAiDemandMap(demand.scanColors) * 0.08
            + Math.max(0, 1 - aiNumber(player.resources?.additionalPublicScan)) * 0.75;
        }
      }

      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player);
      if (getAiRoundNumber() >= FINAL_ROUND_NUMBER && nextThreshold && currentScore < nextThreshold) {
        value -= Math.min(6, Math.max(1, nextThreshold - currentScore) * 0.45);
      }
      return roundAiScore(value);
    }

    function buildAiBorrowTechCandidate(tileId, player = getCurrentPlayer()) {
      const stack = tech.getStack?.(techGameState.board, tileId) || null;
      const candidate = {
        tileId,
        techType: stack?.techType || tech.getTechType?.(tileId) || null,
        stackIndex: tech.getStackIndex?.(tileId) || null,
        bonusId: stack?.bonusId || null,
        firstTake: false,
        remaining: stack?.remaining ?? null,
        finalFormulaDeltas: {},
        directScoreGain: 0,
      };
      const check = tech.resolver.canTakeTile(
        techGameState.board,
        player?.techState,
        tileId,
        { techTypes: ["orange", "purple"] },
      );
      candidate.available = check.ok;
      candidate.reason = check.message || null;
      candidate.plan = scoreAiResearchTechRoutePlan(candidate, player);
      candidate.score = scoreAiBorrowedTechImmediateValue(candidate, player);
      if (!check.ok) candidate.score -= 1000;
      return candidate;
    }

    function listAiBorrowTechCandidates(player = getCurrentPlayer()) {
      if (!player) return [];
      createActionContext().ensurePlayerTechState(player);
      return tech.listTakeableTiles(
        techGameState.board,
        player.techState,
        { techTypes: ["orange", "purple"] },
      )
        .map((tileId) => buildAiBorrowTechCandidate(tileId, player))
        .filter((candidate) => candidate.available !== false)
        .sort((left, right) => aiNumber(right.score) - aiNumber(left.score));
    }

    function listAiResearchTechCandidates(options = null) {
      const currentPlayer = getCurrentPlayer();
      if (!currentPlayer) return [];
      createActionContext().ensurePlayerTechState(currentPlayer);
      if (!currentPlayer.techState) return [];

      const selectionOptions = options || getResearchTechSelectionOptionsForEffect();
      const allowedTechTypes = (options ? tech.resolver.normalizeTechTypeFilter(options) : null)
        || tech.resolver.normalizeTechTypeFilter(selectionOptions)
        || tech.resolver.normalizeTechTypeFilter({ techTypes: techGameState.ui.allowedTechTypes })
        || null;
      const candidates = tech.listTakeableTiles(
        techGameState.board,
        currentPlayer.techState,
        allowedTechTypes ? { techTypes: allowedTechTypes } : {},
      );
      return candidates
        .filter((tileId) => (
          !selectionOptions.researchedByOthersOnly
          || isTechTileOwnedByOtherPlayer(tileId)
        ))
        .map((tileId) => buildAiResearchTechCandidate(tileId))
        .filter((candidate) => candidate.available !== false);
    }

    function getAiResearchTechCandidateExecutionCheck(candidate, player = getCurrentPlayer(), selectionOptionsOverride = null) {
      const tileId = candidate?.tileId || null;
      if (!tileId) return { ok: false, message: "科技候选缺少 tileId" };
      if (!player) return { ok: false, message: "没有当前玩家" };
      createActionContext().ensurePlayerTechState(player);
      if (!player.techState) return { ok: false, message: "玩家科技状态未初始化" };

      if (techGameState.ui.industryBorrowMode) {
        return tech.resolver.canTakeTile(
          techGameState.board,
          player.techState,
          tileId,
          { techTypes: ["orange", "purple"] },
        );
      }

      const selectionOptions = selectionOptionsOverride || getAiResearchTechSelectionOptionsForEffect();
      if (selectionOptions.researchedByOthersOnly && !isTechTileOwnedByOtherPlayer(tileId)) {
        return { ok: false, message: "这张牌只能选择其他玩家已研究过的科技" };
      }
      const allowedTechTypes = tech.resolver.normalizeTechTypeFilter(selectionOptions)
        || tech.resolver.normalizeTechTypeFilter({ techTypes: techGameState.ui.allowedTechTypes })
        || null;
      return tech.resolver.canTakeTile(
        techGameState.board,
        player.techState,
        tileId,
        allowedTechTypes ? { techTypes: allowedTechTypes } : {},
      );
    }

    function selectExecutableAiResearchTechCandidate(
      candidates = [],
      selected = null,
      player = getCurrentPlayer(),
      selectionOptions = null,
    ) {
      const ordered = [];
      if (selected) ordered.push(selected);
      for (const candidate of candidates) {
        if (!candidate?.tileId) continue;
        if (ordered.some((item) => item?.tileId === candidate.tileId)) continue;
        ordered.push(candidate);
      }

      let firstFailure = null;
      for (const candidate of ordered) {
        const check = getAiResearchTechCandidateExecutionCheck(candidate, player, selectionOptions);
        if (check.ok) return { candidate, check };
        if (!firstFailure) firstFailure = { candidate, check };
      }
      return {
        candidate: null,
        check: firstFailure?.check || { ok: false, message: "没有可研究科技候选" },
      };
    }
    return Object.freeze({
      buildAiResearchTechCandidate,
      scoreAiBorrowedTechImmediateValue,
      buildAiBorrowTechCandidate,
      listAiBorrowTechCandidates,
      listAiResearchTechCandidates,
      getAiResearchTechCandidateExecutionCheck,
      selectExecutableAiResearchTechCandidate,
    });
  }

  return Object.freeze({ createTechCandidates });
});
