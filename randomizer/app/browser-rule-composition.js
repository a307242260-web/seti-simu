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
    const createCommittedCandidate = (workingState, metadata, stateVersion) => (
      initialGameState.createCommittedCandidate(
        workingState,
        metadata,
        stateStoreApi.SCHEMA_VERSION,
        stateVersion,
      )
    );
    return ruleCompositionApi.createRuleComposition({
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
        createProjectionState(workingState, committedState) {
          return createCommittedCandidate(
            workingState,
            { ...getCommittedContext(workingState), stateVersion: committedState.meta.stateVersion },
            committedState.meta.stateVersion,
          );
        },
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
      executeHostCommand: context.executeHostCommand,
      createActionRegistry: context.createActionRegistry,
      effectDomains: [context.standardActionDomain],
      projectState(state) {
        return {
          meta: { stateVersion: state.meta.stateVersion },
          match: structuredClone(state.match),
          turn: structuredClone(state.turn),
        };
      },
    });
  }

  return { createBrowserRuleComposition };
});
