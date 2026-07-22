"use strict";

const DEFINITIONS = Object.freeze({
  discardAction: "discard_action",
  cardSelectionAction: "card_selection_action",
  scanTargetAction: "scan_target_action",
  handScanAction: "hand_scan_action",
  alienTraceAction: "alien_trace_action",
  alienTracePickerState: "alien_trace_picker_state",
  actionEffectFlow: "action_effect_flow",
});

function attachDecisionState(pendingState, decisionSessions) {
  const facade = decisionSessions.createFacade(DEFINITIONS);
  for (const field of Object.keys(DEFINITIONS)) {
    if (Object.hasOwn(pendingState, field) && pendingState[field] != null) {
      facade[field] = pendingState[field];
    }
    delete pendingState[field];
  }
  Object.defineProperties(pendingState, Object.getOwnPropertyDescriptors(facade));
  return pendingState;
}

module.exports = { DEFINITIONS, attachDecisionState };
