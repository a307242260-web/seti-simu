(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppBootstrap = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  function summarizeCodexAiBatchResult(result, options = {}) {
    const samples = Array.isArray(result?.samples) ? result.samples : [];
    const includeDiagnostics = Boolean(options.includeDiagnostics);
    const includeActionLogs = Boolean(options.includeActionLogs);
    const playerResults = samples.flatMap((sample) => sample.playerResults || []);
    const scores = playerResults
      .map((entry) => Number(entry.finalScore))
      .filter((value) => Number.isFinite(value));
    const markCounts = playerResults
      .map((entry) => Number(entry.finalMarkCount))
      .filter((value) => Number.isFinite(value));
    const gamesWithAllPlayersMarked = samples.filter((sample) => {
      const playersInGame = sample.playerResults || [];
      return playersInGame.length > 0 && playersInGame.every((entry) => Number(entry.finalMarkCount) >= 3);
    }).length;
    const average = (values) => {
      if (!values.length) return 0;
      return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 100) / 100;
    };
    return {
      ok: Boolean(result?.ok),
      gamesRequested: result?.gamesRequested || 0,
      gamesRun: result?.gamesRun || samples.length,
      stoppedEarly: Boolean(result?.stoppedEarly),
      averageFinalScore: average(scores),
      bestFinalScore: scores.length ? Math.max(...scores) : 0,
      averageFinalMarkCount: average(markCounts),
      fullMarkPlayerRate: markCounts.length
        ? Math.round((markCounts.filter((count) => count >= 3).length / markCounts.length) * 1000) / 1000
        : 0,
      fullMarkGameRate: samples.length
        ? Math.round((gamesWithAllPlayersMarked / samples.length) * 1000) / 1000
        : 0,
      samples: samples.map((sample) => ({
        gameIndex: sample.gameIndex,
        seed: sample.seed,
        ok: sample.summary?.ok,
        blocked: Boolean(sample.summary?.blocked),
        gameEnded: Boolean(sample.summary?.gameEnded),
        bugCount: sample.bugCount || 0,
        ...(includeDiagnostics ? {
          summary: sample.summary,
          lowMarkPlayerDiagnostics: sample.lowMarkPlayerDiagnostics,
          lowMarkPlayerDiagnosticsList: (sample.lowMarkPlayerDiagnosticsList || []).map((entry) => ({
            playerId: entry.playerId,
            playerLabel: entry.playerLabel,
            finalScore: entry.finalScore,
            baseScore: entry.baseScore,
            completedTaskCount: entry.completedTaskCount,
            techCount: entry.techCount,
            finalFormulas: entry.finalFormulas,
            lowTailReasons: entry.lowTailReasons,
            resources: entry.resources,
            income: entry.income,
            handCards: entry.handCards,
            reservedCards: entry.reservedCards,
            actionCounts: entry.actionCounts,
            selectedActionTail: entry.selectedActionTail,
            playCardTail: entry.playCardTail,
          })),
          tailLogs: (sample.tailLogs || []).map((entry) => ({
            type: entry.type,
            roundNumber: entry.roundNumber,
            turnNumber: entry.turnNumber,
            playerLabel: entry.playerLabel,
            message: entry.message,
          })),
          finalScoreMarkDecisions: sample.finalScoreMarkDecisions || [],
          grandStrategyPickDecisions: sample.grandStrategyPickDecisions || [],
          grandStrategyPassiveDecisions: sample.grandStrategyPassiveDecisions || [],
          initialIncomeDiscardDecisions: sample.initialIncomeDiscardDecisions || [],
          ...(includeActionLogs ? {
            actionDecisionLogs: (sample.logs || [])
              .filter((entry) => entry?.type === "turn-action" || entry?.type === "tech-placement")
              .map((entry) => ({
                type: entry.type,
                roundNumber: entry.roundNumber,
                turnNumber: entry.turnNumber,
                playerId: entry.playerId,
                playerLabel: entry.playerLabel,
                message: entry.message,
                resources: entry.playerResources,
                action: entry.details?.action || null,
                candidates: entry.details?.candidates || [],
                details: entry.type === "tech-placement" ? entry.details : null,
              })),
          } : {}),
          analysis: sample.analysis
            ? {
              actionCounts: sample.analysis.actionCounts,
              playerProfiles: sample.analysis.playerProfiles,
              finalScoreMarks: sample.analysis.finalScoreMarks,
              finalScoreFormulas: sample.analysis.finalScoreFormulas,
              passResourceLockSamples: sample.analysis.passResourceLockSamples,
              earlyPassNoMainSamples: sample.analysis.earlyPassNoMainSamples,
              quickBeforePassNoMainSamples: sample.analysis.quickBeforePassNoMainSamples,
              preNoMainPassResourceDrainSamples: sample.analysis.preNoMainPassResourceDrainSamples,
              lowEngineThroughputSamples: sample.analysis.lowEngineThroughputSamples,
              resourceLockMainUnlockSamples: sample.analysis.resourceLockMainUnlockSamples,
              mainUnlockLowConcretePlaySamples: sample.analysis.mainUnlockLowConcretePlaySamples,
              lowRoundActionTailSamples: sample.analysis.lowRoundActionTailSamples,
              lowPlayerCandidateStats: sample.analysis.lowPlayerCandidateStats,
              topMissedCandidates: sample.analysis.topMissedCandidates,
            }
            : null,
        } : {}),
        players: (sample.playerResults || []).map((entry) => ({
          playerLabel: entry.playerLabel,
          companyLabel: entry.companyLabel,
          finalScore: entry.finalScore,
          baseScore: entry.baseScore,
          tileScore: entry.tileScore,
          completedTaskCount: entry.completedTaskCount,
          techCount: entry.techCount,
          finalMarkCount: entry.finalMarkCount,
          finalFormulas: entry.finalFormulas,
          credits: entry.resources?.credits,
          energy: entry.resources?.energy,
          income: entry.income,
        })),
      })),
    };
  }

  function installBeforeUnloadSave(context = {}) {
    const targetRoot = context.root || root;
    const startScreenState = context.startScreenState;
    const savePersistentGameStateNow = context.savePersistentGameStateNow;
    if (!targetRoot?.addEventListener || !startScreenState || typeof savePersistentGameStateNow !== "function") {
      return null;
    }
    const handler = () => {
      if (!startScreenState.entered) return;
      savePersistentGameStateNow({ label: "刷新前状态" });
    };
    targetRoot.addEventListener("beforeunload", handler);
    return handler;
  }

  function maybeRunCodexAiBatchSmoke(context = {}) {
    const targetRoot = context.root || root;
    const document = context.document || targetRoot?.document;
    if (!document || typeof targetRoot?.URLSearchParams !== "function") return false;
    const params = new targetRoot.URLSearchParams(targetRoot.location?.search || "");
    const rawGames = params.get("codexAiBatch") ?? params.get("codex_ai_batch");
    if (rawGames == null) return false;
    const output = document.createElement("pre");
    output.id = "codex-ai-batch-result";
    output.dataset.status = "running";
    output.textContent = "running";
    document.body.appendChild(output);
    const normalizeAiDifficulty = context.normalizeAiDifficulty || ((value) => value || "laughable");
    const uiRuntimeState = context.uiRuntimeState || {};
    const runAiAutoBattleBatch = context.runAiAutoBattleBatch;
    const summarize = context.summarizeCodexAiBatchResult || summarizeCodexAiBatchResult;
    if (typeof runAiAutoBattleBatch !== "function") {
      output.dataset.status = "error";
      output.textContent = JSON.stringify({ ok: false, message: "Missing Codex AI batch runner" }, null, 2);
      return true;
    }
    const games = Math.min(20, Math.max(1, Math.round(Number(rawGames) || 3)));
    const maxSteps = Math.min(5000, Math.max(20, Math.round(Number(params.get("maxSteps")) || 1800)));
    const yieldEverySteps = Math.max(0, Math.round(Number(params.get("yieldEverySteps")) || 80));
    const stopBeforeRound = Math.max(0, Math.round(Number(params.get("stopBeforeRound")) || 0));
    const activePlayerCount = Math.max(0, Math.round(Number(params.get("activePlayerCount")) || 0));
    const aiDifficulty = normalizeAiDifficulty(params.get("aiDifficulty") || params.get("ai_difficulty"));
    const seed = params.get("seed") || "codex-ai-batch";
    const explicitSeeds = (params.get("seeds") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, games);
    const includeDiagnostics = params.get("diagnostics") === "1";
    const includeActionLogs = params.get("includeLogs") === "1";
    const suppressReadoutRender = params.get("renderReadout") !== "1";
    const schedule = typeof targetRoot.setTimeout === "function"
      ? targetRoot.setTimeout.bind(targetRoot)
      : setTimeout;
    const runBatch = async () => {
      const previousSuppressReadoutRender = uiRuntimeState.codexAiBatchSuppressReadoutRender;
      uiRuntimeState.codexAiBatchSuppressReadoutRender = suppressReadoutRender;
      try {
        let lastProgressStep = 0;
        let lastProgressRound = 0;
        const result = await runAiAutoBattleBatch({
          games,
          seed,
          ...(explicitSeeds.length ? { seeds: explicitSeeds } : {}),
          maxSteps,
          yieldEverySteps,
          ...(stopBeforeRound > 0 ? { stopBeforeRound } : {}),
          ...(activePlayerCount > 0 ? { activePlayerCount } : {}),
          aiDifficulty,
          stepDelayMs: 0,
          stopOnBlocked: params.get("stopOnBlocked") !== "false",
          recordStrategyTuning: false,
          includeLogs: includeActionLogs,
          retainAnalysis: includeDiagnostics || includeActionLogs,
          includeSampleDiagnostics: includeDiagnostics || includeActionLogs,
          sequenceWindowTurns: 8,
          onStep: (progress) => {
            const step = Math.max(0, Math.round(Number(progress?.steps) || 0));
            const round = Math.max(0, Math.round(Number(progress?.roundNumber) || 0));
            if (step - lastProgressStep < 25 && round === lastProgressRound) return;
            lastProgressStep = step;
            lastProgressRound = round;
            output.textContent = JSON.stringify({
              running: true,
              steps: step,
              roundNumber: round,
              turnNumber: progress?.turnNumber || null,
              currentPlayerId: progress?.currentPlayerId || null,
            }, null, 2);
          },
        });
        output.dataset.status = result?.ok ? "ok" : "failed";
        output.textContent = JSON.stringify(summarize(result, {
          includeDiagnostics,
          includeActionLogs,
        }), null, 2);
      } catch (error) {
        output.dataset.status = "error";
        output.textContent = JSON.stringify({
          ok: false,
          message: String(error?.message || error),
        }, null, 2);
      } finally {
        uiRuntimeState.codexAiBatchSuppressReadoutRender = previousSuppressReadoutRender;
      }
    };
    const scheduleBatch = () => schedule(runBatch, 100);
    if (document.readyState === "complete") scheduleBatch();
    else targetRoot.addEventListener?.("load", scheduleBatch, { once: true });
    return true;
  }

  function initializeAppBootstrap(context = {}) {
    const targetRoot = context.root || root;
    context.initializeShell?.();
    installBeforeUnloadSave({
      root: targetRoot,
      startScreenState: context.startScreenState,
      savePersistentGameStateNow: context.savePersistentGameStateNow,
    });
    maybeRunCodexAiBatchSmoke({
      root: targetRoot,
      document: context.document,
      normalizeAiDifficulty: context.normalizeAiDifficulty,
      uiRuntimeState: context.uiRuntimeState,
      runAiAutoBattleBatch: context.runAiAutoBattleBatch,
      summarizeCodexAiBatchResult: context.summarizeCodexAiBatchResult,
    });
    const publicApiFactory = context.publicApiFactory || targetRoot.SetiAppPublicApi;
    if (!publicApiFactory?.createPublicApi) {
      throw new Error("Missing SETI app dependency: SetiAppPublicApi");
    }
    const publicApi = publicApiFactory.createPublicApi(context.publicApiContext || {});
    targetRoot.SetiRandomizer = publicApi;
    return publicApi;
  }

  return {
    summarizeCodexAiBatchResult,
    installBeforeUnloadSave,
    maybeRunCodexAiBatchSmoke,
    initializeAppBootstrap,
  };
});
