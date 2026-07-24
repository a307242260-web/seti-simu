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

    function createEffectPresentation(flow) {
      if (!flow || typeof flow !== "object") return null;
      const safeOptionKeys = [
        "cost", "playerId", "playerColor", "targetPlayerId", "targetPlayerColor", "skippable",
      ];
      return {
        actionType: flow.actionType || null,
        label: flow.label || null,
        historySource: flow.historySource || null,
        currentIndex: Number.isInteger(flow.currentIndex) ? flow.currentIndex : 0,
        completed: Boolean(flow.completed),
        effects: (flow.effects || []).map((effect) => ({
          id: effect?.id || null,
          type: effect?.type || null,
          label: effect?.label || null,
          status: effect?.status || null,
          icon: effect?.icon || null,
          badge: effect?.badge ?? null,
          required: Boolean(effect?.required),
          undoable: effect?.undoable !== false,
          options: Object.fromEntries(safeOptionKeys
            .filter((key) => Object.hasOwn(effect?.options || {}, key))
            .map((key) => [key, clone(effect.options[key])])),
        })),
      };
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
      const visibilityCandidate = clone(canonicalState);
      visibilityCandidate.match.actionEffectPresentation = createEffectPresentation(
        canonicalState.match?.actionEffectFlow,
      );
      const visible = browserProjection.visibilityPolicy(
        visibilityCandidate,
        resolvedViewer,
        inspection,
      );
      if (visible.match && Object.hasOwn(visible.match, "actionEffectPresentation")) {
        delete visible.match.actionEffectPresentation;
      }
      const visibleResident = visible.resident || {};
      const initialSetup = clone(visibleResident.initialSetup || {
        active: false,
        interactive: false,
        currentPlayerId: null,
        offer: null,
        confirmedPlayerIds: [],
      });
      const presentationPlayers = clone(
        visibleResident.players?.players || Object.values(visible.players || {}),
      );
      const presentationState = {
        match: clone(visible.match || {}),
        turn: clone(visibleResident.turn || {}),
        players: {
          currentPlayerId: visibleResident.players?.currentPlayerId
            ?? visible.match?.currentPlayerId
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
        effectPresentation: clone(visibleResident.effectPresentation || null),
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
      };
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
