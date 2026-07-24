(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppBrowserRuleComposition = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createBrowserRuleComposition(context = {}) {
    const {
      ruleCompositionApi,
      stateStoreApi,
      highCouplingState,
      initialGameState,
      workingStateAdapter,
      getCommittedContext,
    } = context;
    const productionCompositionApi = context.productionCompositionApi
      || (typeof require === "function" ? require("../game/production-composition") : null);
    const productionKernelApi = context.productionKernelApi
      || (typeof require === "function" ? require("../game/production-kernel") : null);
    if (!ruleCompositionApi?.createRuleComposition
      || !productionCompositionApi?.createProductionComposition
      || !productionKernelApi?.createProductionKernel
      || !workingStateAdapter
      || !getCommittedContext) {
      throw new Error("createBrowserRuleComposition requires Production Kernel and Browser adapters");
    }
    const browserProjection = context.browserProjection;
    if (typeof browserProjection?.visibilityPolicy !== "function"
      || typeof browserProjection?.getFinalReadModelOwner !== "function"
      || typeof browserProjection?.getBrowserReadModelOwner !== "function"
      || typeof browserProjection?.createRenderPresentation !== "function") {
      throw new Error("createBrowserRuleComposition requires explicit Browser projection owners");
    }
    const createCommittedCandidate = (workingState, metadata, stateVersion) => (
      initialGameState.createCommittedCandidate(
        workingState,
        metadata,
        stateStoreApi.SCHEMA_VERSION,
        stateVersion,
      )
    );
    const browserStateAdapter = Object.freeze({
      createWorkingState: workingStateAdapter.createWorkingState,
      createCommittedState(workingState, committedState, contextOverrides = {}) {
        return highCouplingState.purifyHighCouplingSlices(createCommittedCandidate(
          workingState,
          { ...getCommittedContext(workingState), ...contextOverrides },
          committedState.meta.stateVersion,
        ));
      },
      createSavedState(committedState, workingState, contextOverrides = {}) {
        const savedState = structuredClone(committedState);
        savedState.meta = {
          ...savedState.meta,
          ...getCommittedContext(workingState),
          ...structuredClone(contextOverrides),
          schemaVersion: savedState.meta.schemaVersion,
          stateVersion: savedState.meta.stateVersion,
        };
        return savedState;
      },
      restoreWorkingState: workingStateAdapter.restoreWorkingState,
      onCommitted(workingState, committedState) {
        workingState.meta = structuredClone(committedState.meta);
      },
    });
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
            .map((key) => [key, structuredClone(effect.options[key])])),
        })),
      };
    }
    const projectBrowserState = (workingRoot, viewer, inspection, projectionMeta = {}) => {
      const stateVersion = Number(projectionMeta.stateVersion) || 0;
      const canonicalCandidate = createCommittedCandidate(
        workingRoot,
        { ...getCommittedContext(workingRoot), stateVersion },
        stateVersion,
      );
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
      const visibilityCandidate = structuredClone(canonicalCandidate);
      visibilityCandidate.match.actionEffectPresentation = createEffectPresentation(
        canonicalCandidate.match?.actionEffectFlow,
      );
      const visible = browserProjection.visibilityPolicy(
        visibilityCandidate,
        resolvedViewer,
        inspection,
      );
      const visibleResident = visible.resident || {};
      if (visible.match && Object.hasOwn(visible.match, "actionEffectPresentation")) {
        delete visible.match.actionEffectPresentation;
      }
      const initialSetup = structuredClone(visibleResident.initialSetup || {
        active: false,
        interactive: false,
        currentPlayerId: null,
        offer: null,
        confirmedPlayerIds: [],
      });
      const presentationPlayers = structuredClone(
        visibleResident.players?.players || Object.values(visible.players || {}),
      );
      const presentationState = {
        match: structuredClone(visible.match || {}),
        turn: structuredClone(visibleResident.turn || {}),
        players: {
          currentPlayerId: visibleResident.players?.currentPlayerId
            ?? visible.match?.currentPlayerId
            ?? null,
          players: presentationPlayers,
        },
        solarSystem: structuredClone(visibleResident.solar || {}),
        pieces: structuredClone(visibleResident.pieces || {}),
        planets: structuredClone(visibleResident.planets || {}),
        data: structuredClone(visibleResident.data || {}),
        cards: structuredClone(visibleResident.cards || {}),
        tech: structuredClone(visibleResident.tech || {}),
        aliens: structuredClone(visibleResident.aliens || {}),
        finalScoring: structuredClone(visibleResident.finalScoring || {}),
        effectPresentation: structuredClone(visibleResident.effectPresentation || null),
      };
      const finalReadModel = finalReadModelOwner.project(canonicalCandidate);
      visible.resident = {
        finalReadModel,
        browserReadModel: browserReadModelOwner.project(canonicalCandidate, {
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
    };
    const browserProjectionAdapter = Object.freeze({
      adapterId: "seti-browser-viewer-projection-v1",
      projectWorkingState: true,
      projectState: projectBrowserState,
    });
    const browserHostServices = Object.freeze({ ...(context.hostServices || {}) });
    const installedKernel = productionKernelApi.createProductionKernel({
      hostKind: "browser",
      ruleCompositionApi,
      productionRules: context.productionRules,
      hostServices: browserHostServices,
      getAuthority: context.getAuthority,
      standardActionDomainOptions: context.standardActionDomainOptions,
      stateAdapter: browserStateAdapter,
      projectionAdapter: browserProjectionAdapter,
      ruleOptions: {
      invariantValidators: [workingStateAdapter.validateSessionBoundary],
      stateStoreApi: {
        createStateStore(initialState, options) {
          return highCouplingState.createHighCouplingStateStore(initialState, options);
        },
      },
      effectRuntimeApi: context.effectRuntimeApi,
      createActionContext: context.createActionContext,
      createInitialState(_initialOptions, workingState) {
        return highCouplingState.purifyHighCouplingSlices(createCommittedCandidate(
          workingState,
          getCommittedContext(workingState),
          0,
        ));
      },
      stateAdapter: browserStateAdapter,
      runWithWorkingState: context.runWithWorkingState,
      projectWorkingState: true,
      projectState: projectBrowserState,
      createCounterfactualFork: context.counterfactualEnabled === false
        ? null
        : (envelope, forkOptions = {}) => {
          const fork = createBrowserRuleComposition({
            ...context,
            counterfactualEnabled: false,
            initialOptions: { counterfactualSeed: forkOptions.branchKey },
          });
          const restored = fork.lifecycle.restore(envelope);
          if (!restored?.ok) {
            fork.dispose();
            throw new Error(restored?.message || restored?.code || "Browser counterfactual fork 恢复失败");
          }
          return fork;
        },
      initialOptions: context.initialOptions || {},
      },
    });
    const production = Object.freeze({
      composition: installedKernel.composition,
      domainPack: installedKernel.domainPack,
    });
    const composition = production.composition;
    const projectionSource = Object.freeze({
      read(viewer = null) {
        const projected = composition.projection(viewer);
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
      SAVE_SCHEMA_VERSION: composition.SAVE_SCHEMA_VERSION,
      inputPort: composition.inputPort,
      lifecycle: composition.lifecycle,
      counterfactualPort: composition.counterfactualPort,
      projection: composition.projection,
      inspect: composition.inspect,
      ...(composition.readModelPort ? { readModelPort: composition.readModelPort } : {}),
      subscribe: composition.subscribe,
      dispose: composition.dispose,
      capabilities: Object.freeze({
        productionDomainPackId: production.domainPack.packId,
      }),
      projectionSource,
    });
  }

  return { createBrowserRuleComposition };
});
