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
      players,
      scanEffects,
      tech,
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
    const getResearchTechSelectionOptionsForEffect = (...args) => context.getResearchTechSelectionOptionsForEffect(...args);
    const listAiMoveCandidates = (...args) => context.listAiMoveCandidates(...args);
    const roundAiScore = (...args) => context.roundAiScore(...args);
    const scoreAiHuanyuOrange2FutureMoveValue = (...args) => context.scoreAiHuanyuOrange2FutureMoveValue(...args);
    const scoreAiLateTechEngineCatchupValue = (...args) => context.scoreAiLateTechEngineCatchupValue(...args);
    const scoreAiLowTechBoardCatchupValue = (...args) => context.scoreAiLowTechBoardCatchupValue(...args);
    const scoreAiResearchTechRoutePlan = (...args) => context.scoreAiResearchTechRoutePlan(...args);
    const scoreAiResearchTechValue = (...args) => context.scoreAiResearchTechValue(...args);
    const sumAiDemandMap = (...args) => context.sumAiDemandMap(...args);

    function requireWorkingRoot(workingRoot) {
      if (!workingRoot?.techGameState || !workingRoot?.playerState) {
        throw new TypeError("AI tech candidate requires explicit workingRoot");
      }
      return workingRoot;
    }

    function getWorkingCurrentPlayer(workingRoot) {
      return players.getCurrentPlayer(requireWorkingRoot(workingRoot).playerState);
    }

    function isTileOwnedByOtherPlayer(workingRoot, tileId, currentPlayer) {
      return (workingRoot.playerState.players || []).some((player) => (
        player?.id !== currentPlayer?.id
        && player?.techState?.ownedTiles?.[tileId]
        && !player?.techState?.disabledTiles?.[tileId]
      ));
    }

    function buildAiResearchTechCandidate(workingRoot, tileId) {
      requireWorkingRoot(workingRoot);
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      const stack = tech.getStack?.(workingRoot.techGameState.board, tileId) || null;
      const candidate = {
        tileId,
        techType: stack?.techType || tech.getTechType?.(tileId) || null,
        stackIndex: tech.getStackIndex?.(tileId) || null,
        bonusId: stack?.bonusId || null,
        firstTake: stack?.firstTakeClaimedBy == null,
        remaining: stack?.remaining ?? null,
      };
      const safety = getAiResearchTechCandidateSafety(candidate, currentPlayer);
      candidate.available = safety.ok;
      candidate.reason = safety.message || null;
      candidate.plan = scoreAiResearchTechRoutePlan(candidate, currentPlayer);
      candidate.score = scoreAiResearchTechValue(candidate);
      candidate.finalFormulaDeltas = getAiResearchTechFinalFormulaDeltas(candidate, currentPlayer);
      candidate.directScoreGain = getAiResearchTechDirectScoreGain(candidate);
      candidate.valueBreakdown = {
        lateTechCatchupValue: scoreAiLateTechEngineCatchupValue(candidate, currentPlayer),
        lowTechCatchupValue: scoreAiLowTechBoardCatchupValue(candidate, currentPlayer),
        huanyuOrange2FutureMoveValue: scoreAiHuanyuOrange2FutureMoveValue(candidate, currentPlayer),
      };
      if (candidate.tileId === "orange4") {
        candidate.valueBreakdown.orange4SatelliteProfile = getAiOrange4SatellitePotentialProfile(currentPlayer);
      }
      if (!safety.ok) candidate.score -= 1000;
      return candidate;
    }

    function scoreAiBorrowedTechImmediateValue(workingRoot, candidate, player = players.getCurrentPlayer(workingRoot.playerState)) {
      if (!candidate || !player) return -Infinity;
      const techType = candidate.techType || "";
      const tileId = candidate.tileId || "";
      const demand = getAiStrategyDemand(player);
      const planScore = Math.max(0, aiNumber(candidate.plan?.score));
      let value = 1.5 + planScore * 1.15;
      const actionContext = createActionContext(workingRoot);

      if (tileId === "orange1") {
        const launchCheck = actions.canExecute("launch", actionContext);
        if (launchCheck.ok) value += 2.5 + getAiMapDemand(demand.actions, "launch") * 0.12;
      }
      if (tileId === "orange2") {
        const bestMoveScore = listAiMoveCandidates(workingRoot)
          .reduce((best, move) => Math.max(best, aiNumber(move.score)), 0);
        value += Math.min(7, Math.max(0, bestMoveScore) * 0.18)
          + getAiMapDemand(demand.actions, "move") * 0.1;
      }
      if (tileId === "orange3" || tileId === "orange4") {
        const landCheck = actions.canExecute("land", actionContext);
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

    function buildAiBorrowTechCandidate(workingRoot, tileId, player = players.getCurrentPlayer(workingRoot.playerState)) {
      const stack = tech.getStack?.(workingRoot.techGameState.board, tileId) || null;
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
        workingRoot.techGameState.board,
        player?.techState,
        tileId,
        { techTypes: ["orange", "purple"] },
      );
      candidate.available = check.ok;
      candidate.reason = check.message || null;
      candidate.plan = scoreAiResearchTechRoutePlan(candidate, player);
      candidate.score = scoreAiBorrowedTechImmediateValue(workingRoot, candidate, player);
      if (!check.ok) candidate.score -= 1000;
      return candidate;
    }

    function listAiBorrowTechCandidates(workingRoot, player = players.getCurrentPlayer(workingRoot.playerState)) {
      if (!player) return [];
      createActionContext(workingRoot).ensurePlayerTechState(player);
      return tech.listTakeableTiles(
        workingRoot.techGameState.board,
        player.techState,
        { techTypes: ["orange", "purple"] },
      )
        .map((tileId) => buildAiBorrowTechCandidate(workingRoot, tileId, player))
        .filter((candidate) => candidate.available !== false)
        .sort((left, right) => aiNumber(right.score) - aiNumber(left.score));
    }

    function listAiResearchTechCandidates(workingRoot, options = null) {
      requireWorkingRoot(workingRoot);
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      if (!currentPlayer) return [];
      createActionContext(workingRoot).ensurePlayerTechState(currentPlayer);
      if (!currentPlayer.techState) return [];

      const selectionOptions = options || getResearchTechSelectionOptionsForEffect();
      const allowedTechTypes = (options ? tech.resolver.normalizeTechTypeFilter(options) : null)
        || tech.resolver.normalizeTechTypeFilter(selectionOptions)
        || tech.resolver.normalizeTechTypeFilter({ techTypes: workingRoot.techGameState.ui.allowedTechTypes })
        || null;
      const candidates = tech.listTakeableTiles(
        workingRoot.techGameState.board,
        currentPlayer.techState,
        allowedTechTypes ? { techTypes: allowedTechTypes } : {},
      );
      return candidates
        .filter((tileId) => (
          !selectionOptions.researchedByOthersOnly
          || isTileOwnedByOtherPlayer(workingRoot, tileId, currentPlayer)
        ))
        .map((tileId) => buildAiResearchTechCandidate(workingRoot, tileId))
        .filter((candidate) => candidate.available !== false);
    }

    function getAiResearchTechCandidateExecutionCheck(workingRoot, candidate, player = getWorkingCurrentPlayer(workingRoot), selectionOptionsOverride = null) {
      requireWorkingRoot(workingRoot);
      const tileId = candidate?.tileId || null;
      if (!tileId) return { ok: false, message: "科技候选缺少 tileId" };
      if (!player) return { ok: false, message: "没有当前玩家" };
      createActionContext(workingRoot).ensurePlayerTechState(player);
      if (!player.techState) return { ok: false, message: "玩家科技状态未初始化" };

      if (workingRoot.techGameState.ui.industryBorrowMode) {
        return tech.resolver.canTakeTile(
          workingRoot.techGameState.board,
          player.techState,
          tileId,
          { techTypes: ["orange", "purple"] },
        );
      }

      const selectionOptions = selectionOptionsOverride || getAiResearchTechSelectionOptionsForEffect();
      if (selectionOptions.researchedByOthersOnly && !isTileOwnedByOtherPlayer(workingRoot, tileId, player)) {
        return { ok: false, message: "这张牌只能选择其他玩家已研究过的科技" };
      }
      const allowedTechTypes = tech.resolver.normalizeTechTypeFilter(selectionOptions)
        || tech.resolver.normalizeTechTypeFilter({ techTypes: workingRoot.techGameState.ui.allowedTechTypes })
        || null;
      return tech.resolver.canTakeTile(
        workingRoot.techGameState.board,
        player.techState,
        tileId,
        allowedTechTypes ? { techTypes: allowedTechTypes } : {},
      );
    }

    function selectExecutableAiResearchTechCandidate(
      workingRoot,
      candidates = [],
      selected = null,
      player = getWorkingCurrentPlayer(workingRoot),
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
        const check = getAiResearchTechCandidateExecutionCheck(workingRoot, candidate, player, selectionOptions);
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
