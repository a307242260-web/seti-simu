"use strict";

const DEFINITIONS = Object.freeze({});

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
