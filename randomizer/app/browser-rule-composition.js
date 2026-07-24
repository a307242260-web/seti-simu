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
      const visible = browserProjection.visibilityPolicy(
        canonicalCandidate,
        resolvedViewer,
        inspection,
      );
      const initialSetup = structuredClone(visible.resident?.initialSetup || {
        active: false,
        interactive: false,
        currentPlayerId: null,
        offer: null,
        confirmedPlayerIds: [],
      });
      visible.resident = {
        finalReadModel: finalReadModelOwner.project(canonicalCandidate),
        browserReadModel: browserReadModelOwner.project(canonicalCandidate, {
          viewer: resolvedViewer,
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
    const browserReadModels = Object.freeze({
      actionEffectFlow: (workingRoot) => structuredClone(workingRoot.match?.actionEffectFlow || null),
      cardUi: (workingRoot) => structuredClone(workingRoot.cardState?.ui || {}),
      playerTurn: (workingRoot) => ({
        players: structuredClone(workingRoot.playerState || { currentPlayerId: null, players: [] }),
        turn: {
          ...structuredClone(workingRoot.turnState || {}),
          currentPlayerId: workingRoot.playerState?.currentPlayerId ?? null,
        },
      }),
      solarBriefing: (workingRoot) => ({
        sectorBySlot: structuredClone(workingRoot.solarState?.sectorBySlot || {}),
      }),
      initialSetupStatus: (workingRoot) => ({
        active: workingRoot.match?.initialSetup?.phase === "selecting",
        currentPlayerId: workingRoot.match?.initialSetup?.currentPlayerId || null,
      }),
      alienBoard: (workingRoot) => ({
        alienGameState: structuredClone(workingRoot.alienGameState || {}),
        playerState: structuredClone(workingRoot.playerState || { currentPlayerId: null, players: [] }),
      }),
    });
    const browserProjectionAdapter = Object.freeze({
      adapterId: "seti-browser-viewer-projection-v1",
      projectWorkingState: true,
      projectState: projectBrowserState,
      readModels: browserReadModels,
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
      executeOwnerInput: context.executeOwnerInput,
      projectWorkingState: true,
      projectState: projectBrowserState,
      readModels: browserReadModels,
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
      ...composition,
      productionDomainPackId: production.domainPack.packId,
      productionActionRegistry: production.domainPack.actionRegistry,
      productionActionOwners: production.domainPack.actionOwners,
      productionActionExecutorOwners: production.domainPack.actionExecutorOwners,
      projectionSource,
    });
  }

  return { createBrowserRuleComposition };
});
