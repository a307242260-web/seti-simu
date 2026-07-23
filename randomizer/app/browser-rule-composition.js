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
    if (!ruleCompositionApi?.createRuleComposition || !workingStateAdapter || !getCommittedContext) {
      throw new Error("createBrowserRuleComposition requires rule composition and state adapters");
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
    const composition = ruleCompositionApi.createRuleComposition({
      invariantValidators: [workingStateAdapter.validateSessionBoundary],
      stateStoreApi: {
        createStateStore(initialState, options) {
          return highCouplingState.createHighCouplingStateStore(initialState, options);
        },
      },
      effectRuntimeApi: context.effectRuntimeApi,
      createInitialState(_initialOptions, workingState) {
        return highCouplingState.purifyHighCouplingSlices(createCommittedCandidate(
          workingState,
          getCommittedContext(workingState),
          0,
        ));
      },
      stateAdapter: {
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
      },
      runWithWorkingState: context.runWithWorkingState,
      executeOwnerInput: context.executeOwnerInput,
      createActionRegistry: context.createActionRegistry,
      effectDomains: [context.standardActionDomain],
      projectWorkingState: true,
      projectState(workingRoot, viewer, inspection, projectionMeta = {}) {
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
        visible.resident = {
          finalReadModel: finalReadModelOwner.project(canonicalCandidate),
          browserReadModel: browserReadModelOwner.project(canonicalCandidate, {
            viewer: resolvedViewer,
            createHandPresentation: (player) => player?.hand || [],
            createReservedCardItems: (player) => player?.reservedCards || [],
            createRenderPresentation: browserProjection.createRenderPresentation,
          }),
        };
        return visible;
      },
      readModels: {
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
      },
    });
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
    return Object.freeze({ ...composition, projectionSource });
  }

  return { createBrowserRuleComposition };
});
