"use strict";

const assert = require("node:assert/strict");
const {
  ACTION_FAMILIES,
  DECISION_SCHEMA_VERSION,
  createConditionalActionExecutor,
} = require("./conditional-action-executor");

function createRoot() {
  return {
    meta: { stateVersion: 7 },
    match: { decisionVersion: 11 },
    playerState: { currentPlayerId: "p1", players: [{ id: "p1", resources: { score: 0 } }] },
    pending: {
      ownerId: "p1",
      choices: ACTION_FAMILIES.map((family, index) => ({
        family,
        label: family,
        target: { kind: `${family}-handler`, choiceId: String(index) },
        reward: { score: index + 1 },
      })),
    },
  };
}

function createExecutor(options = {}) {
  return createConditionalActionExecutor({
    domain: {
      describeDecision(root) {
        return {
          actorPlayer: { id: root.pending.ownerId },
          candidates: root.pending.choices,
        };
      },
      executeChoice(root, choice, decision) {
        assert.equal(root, options.expectedRoot || root, "executor 必须取得 caller working root");
        assert.equal(decision.ownerId, "p1");
        root.playerState.players[0].resources.score += choice.payload.reward.score;
        root.pending = null;
        if (options.fail) return { ok: false, code: "RULE_FAILED", message: "failed" };
        if (options.throwError) throw new Error("boom");
        return { ok: true, events: [{ type: "choice_resolved", family: choice.family }] };
      },
    },
  });
}

function descriptor(root, executor, family) {
  const decision = executor.inspect(root);
  const option = executor.getOptions(root, family).choices[0];
  return {
    schemaVersion: "seti-standard-action-v1",
    actionId: `${family}:fixture`,
    family,
    phase: "conditional",
    actorId: decision.ownerId,
    stateVersion: decision.stateVersion,
    decisionVersion: decision.decisionVersion,
    target: option.target,
    payload: option.payload,
    decision: option.decision,
  };
}

{
  const root = createRoot();
  const executor = createExecutor({ expectedRoot: root });
  const decision = executor.inspect(root);
  assert.equal(decision.schemaVersion, DECISION_SCHEMA_VERSION);
  assert.equal(decision.ownerId, "p1");
  assert.equal(decision.stateVersion, 7);
  assert.equal(decision.decisionVersion, 11);
  assert.equal(decision.choices.length, ACTION_FAMILIES.length);
  assert.deepEqual(decision.followup.handlerIds, ACTION_FAMILIES.map((family) => `${family}-handler`));
  for (const family of ACTION_FAMILIES) {
    const options = executor.getOptions(root, family);
    assert.equal(options.ok, true, family);
    assert.equal(options.choices[0].decision.decisionOwnerId, "p1");
    assert.equal(options.choices[0].decision.followup.handlerId, `${family}-handler`);
  }
  const result = executor.execute(root, descriptor(root, executor, "choose_reward"));
  assert.equal(result.ok, true);
  assert.equal(result.followup.handlerId, "choose_reward-handler");
  assert.equal(root.pending, null);
}

{
  const root = createRoot();
  const executor = createExecutor();
  const stale = descriptor(root, executor, "choose_branch");
  root.match.decisionVersion += 1;
  const before = structuredClone(root);
  const result = executor.execute(root, stale);
  assert.equal(result.code, "CONDITIONAL_DECISION_STALE");
  assert.deepEqual(root, before, "stale 不得污染 working root");
}

for (const failure of [{ fail: true, code: "RULE_FAILED" }, { throwError: true, code: "CONDITIONAL_CHOICE_EXECUTOR_THROWN" }]) {
  const root = createRoot();
  const executor = createExecutor(failure);
  const action = descriptor(root, executor, "choose_card");
  const before = structuredClone(root);
  const result = executor.execute(root, action);
  assert.equal(result.code, failure.code);
  assert.deepEqual(root, before, "失败/异常必须原子恢复完整 working root");
}

{
  const browserRoot = createRoot();
  const replayRoot = structuredClone(browserRoot);
  const browserExecutor = createExecutor();
  const replayExecutor = createExecutor();
  const action = descriptor(browserRoot, browserExecutor, "choose_target");
  const browserResult = browserExecutor.execute(browserRoot, action);
  const replayResult = replayExecutor.execute(replayRoot, structuredClone(action));
  assert.equal(browserResult.ok, true);
  assert.equal(replayResult.ok, true);
  assert.deepEqual(replayRoot, browserRoot, "Browser/replay 必须复用同一 descriptor/domain 行为");
  assert.deepEqual(replayResult.events, browserResult.events);
}

{
  const root = createRoot();
  const executor = createExecutor();
  const action = descriptor(root, executor, "choose_reward");
  const effectChoice = {
    ...structuredClone(action.payload),
    family: action.family,
    label: "Effect Session 奖励选择",
    target: structuredClone(action.target),
    standardAction: structuredClone(action),
  };
  root.pending = null;
  const result = executor.executeEffectChoice(root, effectChoice);
  assert.equal(result.ok, true, "active DecisionEffect 已验证的 choice 不得回读旧 pending owner");
  assert.equal(root.playerState.players[0].resources.score, 4);
}

console.log(`conditional action executor tests passed (${ACTION_FAMILIES.length} families)`);
