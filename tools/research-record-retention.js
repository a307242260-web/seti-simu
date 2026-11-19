"use strict";

const fs = require("node:fs");

const TRACE_SCHEMA = "seti-research-decision-v1";
const numeric = value => Number.isFinite(value) ? value : null;

function compactSearch(search) {
  const { step, searchIndex, seat, action, kind, complete, committed, stopReason, value, rootAndSearchMilliseconds, diagnostics } = search;
  return { step, searchIndex, seat, action, kind, complete, committed, stopReason, value, rootAndSearchMilliseconds,
    diagnostics: {
      nativeExecutions: diagnostics?.nativeExecutions,
      executedNodeCount: diagnostics?.executedNodeCount,
      maxExecutionNodes: diagnostics?.maxExecutionNodes,
      executionLimitReached: diagnostics?.executionLimitReached,
      frontierOriginCountByFamily: diagnostics?.frontierOriginCountByFamily,
      budgetLimits: diagnostics?.budgetLimits,
    } };
}

function compactDecision(trace, { step, elapsedMs } = {}) {
  if (trace?.schemaVersion === TRACE_SCHEMA) return trace;
  if (!trace?.context?.seatId) throw new Error("RESEARCH_DECISION_CONTEXT_MISSING");
  const { context, search, actionId, reasonCode, coverage } = trace;
  const action = context.legalActions?.find(a => a.actionId === actionId);
  const { publicState } = context.observation || {};
  return { schemaVersion: TRACE_SCHEMA, step, round: publicState?.roundNumber, turn: publicState?.turnNumber,
    seat: context.seatId, stateVersion: context.stateVersion, decisionVersion: context.decisionVersion,
    actionId, summary: action?.summary, reasonCode, coverage, elapsedMs: numeric(elapsedMs),
    ...(search ? { searchMs: numeric(search.rootAndSearchMilliseconds), nativeInputs: numeric(search.diagnostics?.nativeExecutions),
      value: numeric(search.value), stopReason: search.stopReason } : {}) };
}

function writeTracePrefix(destination, source, { full = false, firstStep = 1 } = {}) {
  const bytes = fs.readFileSync(source, "utf8");
  const rows = bytes.split("\n").filter(line => line.trim()).map((line, index) => {
    const row = JSON.parse(line);
    if (full && row.schemaVersion === TRACE_SCHEMA) {
      // Earlier full context cannot be regenerated without rerunning the old AI.
      return line;
    }
    return full ? line : JSON.stringify(compactDecision(row, { step: firstStep + index }));
  });
  fs.writeFileSync(destination, rows.length ? rows.join("\n") + "\n" : "");
}

module.exports = { TRACE_SCHEMA, compactDecision, compactSearch, writeTracePrefix };
