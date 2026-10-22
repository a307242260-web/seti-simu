(function (root, factory) {
  "use strict";
  const standardAction = typeof module === "object" && module.exports
    ? require("../actions/standard-action") : root.SetiStandardAction;
  const api = factory(standardAction);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SetiCompletionAgent = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (standardAction) {
  "use strict";

  const VERSION = "seti-completion-agent-v1";
  // 仅为合法完成对局的确定性基线；顺序不代表估值，也不宣称完成搜索。
  const MAIN_ORDER = ["analyze", "research_tech", "land", "orbit", "scan", "launch", "play_card", "pass"];
  const compareId = (left, right) => left.actionId < right.actionId ? -1 : left.actionId > right.actionId ? 1 : 0;

  function createCompletionAgent() {
    function decide(context) {
      const actions = [...context.legalActions].sort(compareId);
      if (!actions.length) throw new Error("COMPLETION_EMPTY_LEGAL_SET");
      for (const action of actions) {
        if (!standardAction.ALL_FAMILIES.includes(action.family)) {
          throw new Error(`COMPLETION_UNSUPPORTED_FAMILY: ${action.family}`);
        }
      }
      const setup = context.observation.publicState?.resident?.initialSetup;
      const offer = setup?.offer;
      const confirm = actions.find(action => action.target?.kind === "confirm_initial_setup"
        || action.target?.confirm === true);
      let selected = confirm || actions.find(action => action.target?.kind === "start_initial_setup");
      if (!selected && setup?.active && offer) {
        selected = !offer.selectedIndustryId
          ? actions.find(action => action.target?.selectionKind === "industry")
          : actions.find(action => action.target?.selectionKind === "initial"
            && !(offer.selectedInitialIds || []).includes(action.target.cardId));
      }
      if (!selected && actions.every(action => action.phase === "conditional")) {
        const alreadySelected = new Set(context.selectedActionIds);
        selected = actions.find(action => !alreadySelected.has(action.actionId));
      }
      if (!selected) selected = actions.find(action => action.family === "end_turn");
      if (!selected) {
        for (const family of MAIN_ORDER) {
          selected = actions.find(action => action.family === family);
          if (selected) break;
        }
      }
      if (!selected) throw new Error("COMPLETION_NO_PROGRESS_ACTION");
      return { actionId: selected.actionId, reasonCode: "completion:deterministic-progress" };
    }
    return Object.freeze({
      decide,
      getProvenance: () => Object.freeze({ type: "completion", version: VERSION, modelChecksum: null }),
    });
  }

  return Object.freeze({ VERSION, createCompletionAgent });
});
