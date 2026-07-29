(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppBrowserRuleComposition = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function createBrowserRuleComposition(context = {}) {
    const productionKernelApi = context.productionKernelApi
      || (typeof require === "function" ? require("../game/production-kernel") : null);
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
      visible.resident = {
        finalReadModel,
        browserReadModel: browserReadModelOwner.project(canonicalState, {
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
        }),
        initialSetup,
        initialIncome: clone(visibleResident.initialIncome || {
          active: false,
          interactive: false,
          currentPlayerId: null,
          companyLabel: null,
          remainingCount: 0,
          currentPlayerRemainingCount: 0,
        }),
      };
      visible.probeRouteRequirements = clone(canonicalState.probeRouteRequirements || null);
      visible.dataAnalyzeRequirements = clone(canonicalState.dataAnalyzeRequirements || null);
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
