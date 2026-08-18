(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiAppBrowserRuleComposition = api;})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function createBrowserRuleComposition(context = {}) {
    const productionKernelApi = context.productionKernelApi
      || (typeof require === "function" ? require("../game/production-kernel") : null);
    // 规则观察（信息层）构建：与 Simulation 同一份实现（rule-observation.js）。
    // 机器协调器 / AI 评估 / 训练从 publicState/selfState 读盘面，UI 渲染壳只消费
    // resident.ui —— 信息层同源、壳层附加，见 docs/browser-simulation-unification.md
    // §信息层统一。
    const ruleObservation = context.ruleObservation
      || (typeof require === "function" ? require("./rule-observation") : null);
    const browserProjection = context.browserProjection;
    if (!productionKernelApi?.createBrowserProductionKernel) {
      throw new Error("createBrowserRuleComposition requires game Production Browser factory");
    }
    if (typeof browserProjection?.visibilityPolicy !== "function"
      || typeof browserProjection?.getFinalReadModelOwner !== "function"
      || typeof browserProjection?.getBrowserReadModelOwner !== "function"
      || typeof browserProjection?.createRenderPresentation !== "function") {
      throw new Error("createBrowserRuleComposition requires explicit Browser projection owners");
    }

    function projectBrowserState(canonicalState, viewer, inspection) {
      const finalReadModelOwner = browserProjection.getFinalReadModelOwner();
      const browserReadModelOwner = browserProjection.getBrowserReadModelOwner();
      if (!finalReadModelOwner?.project || !browserReadModelOwner?.project) {
        throw new TypeError("Browser projection read-model owners 尚未装配");
      }
      const resolvedViewer = viewer || {
        viewerId: "browser:system",
        playerId: null,
        role: "spectator",
      };
      const visible = browserProjection.visibilityPolicy(
        canonicalState,
        resolvedViewer,
        inspection,
      );
      const visibleResident = visible.resident || {};
      const initialSetup = clone(visibleResident.initialSetup || {
        active: false,
        interactive: false,
        currentPlayerId: null,
        offer: null,
        confirmedPlayerIds: [],
      });
      const presentationPlayers = clone(
        visibleResident.players?.players || [],
      );
      const presentationState = {
        match: clone(visible.match || {}),
        turn: clone(visibleResident.turn || {}),
        players: {
          currentPlayerId: visibleResident.players?.currentPlayerId
            ?? null,
          players: presentationPlayers,
        },
        solarSystem: clone(visibleResident.solar || {}),
        pieces: clone(visibleResident.pieces || {}),
        planets: clone(visibleResident.planets || {}),
        data: clone(visibleResident.data || {}),
        cards: clone(visibleResident.cards || {}),
        tech: clone(visibleResident.tech || {}),
        aliens: clone(visibleResident.aliens || {}),
        finalScoring: clone(visibleResident.finalScoring || {}),
      };
      const finalReadModel = finalReadModelOwner.project(canonicalState);
      const browserReadModel = browserReadModelOwner.project(canonicalState, {
        viewer: resolvedViewer,
        presentationState,
        presentationPlayers,
        finalReadModel,
        createHandPresentation: (player) => player?.hand || [],
        createReservedCardItems: (player) => player?.reservedCards || [],
        createRenderPresentation: (input) => browserProjection.createRenderPresentation({
          ...input,
          initialSetup,
        }),
      });
      // 信息层与壳分离（host-unify 改造）：resident 的信息字段（players/board/cards/
      // tech/aliens/solar/planets/data/finalScoring）保留为共享信息视图（visibilityPolicy
      // 已做 viewer-safe 遮蔽，别家手牌不在此层）；读模型壳附加在 resident.ui，**不再
      // 替换信息字段**——此前整体替换 resident 导致机器协调器/AI 观察失明（players/
      // hand/assets 全空 → 启发式决策退化为 pass）。
      visible.resident = {
        ...visible.resident,
        initialSetup,
        initialIncome: clone(visibleResident.initialIncome || {
          active: false,
          interactive: false,
          currentPlayerId: null,
          companyLabel: null,
          remainingCount: 0,
          currentPlayerRemainingCount: 0,
        }),
        ui: {
          finalReadModel,
          browserReadModel,
        },
      };
      // 规则观察信息层：与 Simulation buildRuleObservation 完全同源（同一份实现、
      // 同一 sanitize 纯函数）。机器协调器 createObservation(projection.state) 命中
      // 顶层 publicState/selfState，与 Simulation 机器席位观察同构。
      if (ruleObservation?.buildRuleObservation) {
        const ruleObserved = ruleObservation.buildRuleObservation(
          canonicalState,
          context.seed || null,
          resolvedViewer.role === "player" ? resolvedViewer.playerId : null,
          [],
          { cheap: false },
        );
        visible.publicState = ruleObserved.publicState;
        visible.selfState = ruleObserved.selfState;
        visible.perspectivePlayerId = ruleObserved.perspectivePlayerId;
        visible.terminal = Boolean(
          canonicalState.turn?.gameEnded
          ?? visible.match?.terminal
          ?? false,
        );
      }
      visible.probeRouteRequirements = clone(canonicalState.probeRouteRequirements || null);
      visible.dataAnalyzeRequirements = clone(canonicalState.dataAnalyzeRequirements || null);
      visible.sectorWinRequirements = clone(canonicalState.sectorWinRequirements || null);
      visible.incomeGainRequirements = clone(canonicalState.incomeGainRequirements || null);
      visible.techGainRequirements = clone(canonicalState.techGainRequirements || null);
      return visible;
    }

    const kernel = productionKernelApi.createBrowserProductionKernel({
      random: context.random || Math.random,
      seed: context.seed || "browser-host",
      activePlayerCount: context.activePlayerCount || 4,
      hostServices: context.hostServices || {},
      projectBrowserState,
      counterfactualEnabled: context.counterfactualEnabled,
    });
    const composition = kernel.composition;
    const projectionSource = Object.freeze({
      read(viewer = null) {
        const projected = composition.projection(viewer || {
          viewerId: "browser:system",
          playerId: null,
          role: "spectator",
        });
        return Object.freeze({
          source: Object.freeze({
            kind: projected.sessionId ? "working" : "committed",
            stateVersion: projected.stateVersion,
            sessionId: projected.sessionId || null,
            sessionRevision: projected.revision ?? null,
            phase: projected.phase || "idle",
          }),
          state: projected.state,
          decision: projected.decision || null,
        });
      },
    });
    return Object.freeze({
      ...composition,
      newGame: kernel.newGame,
      capabilities: Object.freeze({
        productionDomainPackId: kernel.productionDomainPackId,
      }),
      projectionSource,
    });
  }

  return Object.freeze({ createBrowserRuleComposition });
});
