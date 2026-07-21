"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const policyPort = require("./policy-port");
const standardAction = require("../actions/standard-action");
const heuristicEvaluator = require("./heuristic-evaluator");

const modulePath = path.resolve(__dirname, "heuristic-policy.js");
delete require.cache[modulePath];
const heuristic = require(modulePath);

function descriptor(family, index = 0, overrides = {}) {
  return {
    schemaVersion: policyPort.STANDARD_ACTION_SCHEMA_VERSION,
    family,
    phase: standardAction.PHASE_BY_FAMILY[family] || "conditional",
    actionId: `${family}:fixture-${index}`,
    actorId: "player-blue",
    stateVersion: 4,
    decisionVersion: 9,
    target: { choiceId: String(index) },
    payload: {},
    summary: `${family} ${index}`,
    ...overrides,
  };
}

function context(actions, suffix = "fixture") {
  return policyPort.createDecisionContext({
    requestId: `request-${suffix}`,
    seatId: "player-blue",
    stateVersion: 4,
    decisionVersion: 9,
    observation: {
      publicState: { roundNumber: 2, players: [{ id: "player-blue", handCount: 2 }] },
      selfState: { id: "player-blue", resources: { credits: 3, energy: 2 } },
    },
    legalActions: actions,
    deterministicContext: { seed: "heuristic-policy-fixture", requestOrdinal: 3 },
  });
}

const policy = heuristic.createHeuristicPolicy({
  difficulty: "weak_start",
  strategyWeights: { pass: 0.8, land: 1.2 },
});

for (const family of ["choose_branch", "choose_card", "choose_target", "choose_payment", "choose_reward"]) {
  const result = heuristic.decideChoice({
    seatId: "player-blue",
    family,
    stateVersion: 4,
    decisionVersion: 9,
    decisionId: `migrated-${family}`,
    choices: [
      { choiceId: "left", value: 1, target: { side: "left" }, summary: "左" },
      { choiceId: "right", value: 5, target: { side: "right" }, summary: "右" },
    ],
  });
  assert.equal(result.ok, true, `${family} 必须经 DecisionContext -> PolicyDecision`);
  assert.equal(result.choice.choiceId, "right");
  assert.equal(result.context.legalActions.length, 2);
  assert.equal(result.decision.policy.version, heuristic.POLICY_VERSION);
}

assert.equal(heuristic.decideChoice({ seatId: "", family: "choose_card", choices: [{ choiceId: "x", value: 1 }] }).code, "HEURISTIC_POLICY_CHOICE_OWNER_INVALID");
assert.equal(heuristic.decideChoice({ seatId: "player-blue", family: "future_family", choices: [{ choiceId: "x", value: 1 }] }).code, "HEURISTIC_POLICY_UNSUPPORTED_FAMILY");
assert.equal(heuristic.decideChoice({ seatId: "player-blue", family: "choose_card", choices: [] }).code, "HEURISTIC_POLICY_EMPTY_LEGAL_SET");
{
  const stale = heuristic.decideChoice({
    seatId: "player-blue",
    family: "choose_card",
    stateVersion: 4,
    decisionVersion: 9,
    choices: [{ choiceId: "x", value: 1 }],
    policy: {
      decide(decisionContext) {
        return { ...policyPort.createPolicyDecision(decisionContext, {
          actionId: decisionContext.legalActions[0].actionId,
          policyType: "heuristic",
          policyVersion: heuristic.POLICY_VERSION,
        }), decisionVersion: 8 };
      },
      getProvenance: () => ({ type: "heuristic", version: heuristic.POLICY_VERSION }),
    },
  });
  assert.equal(stale.code, "POLICY_STALE");
}
assert.deepEqual(policy.getProvenance(), {
  type: "heuristic",
  version: heuristic.POLICY_VERSION,
  config: {
    difficulty: "weak_start",
    strategyWeights: { pass: 0.8, land: 1.2 },
    evaluationParameters: require("./expected-score-evaluator").DEFAULT_PARAMETERS,
  },
  configChecksum: policy.getProvenance().configChecksum,
});

{
  const evaluatedContext = context([
    descriptor("play_card", 0, { payload: { handIndex: 0 } }),
    descriptor("research_tech", 1, { target: { tileId: "orange2" } }),
  ], "visible-evaluator");
  const cardEvaluation = heuristicEvaluator.evaluateAction(evaluatedContext, evaluatedContext.legalActions[0]);
  assert.equal(cardEvaluation.resources.credits, 0);
  assert.equal(cardEvaluation.roundNumber, 2);

  const calls = [];
  const evaluatedPolicy = heuristic.createHeuristicPolicy({
    evaluateAction(decisionContext, action) {
      calls.push({ requestId: decisionContext.requestId, actionId: action.actionId });
      return { score: action.family === "research_tech" ? 20 : 0 };
    },
  });
  assert.equal(evaluatedPolicy.decide(evaluatedContext).actionId, "research_tech:fixture-1");
  assert.deepEqual(calls.map((entry) => entry.actionId), [
    "play_card:fixture-0",
    "research_tech:fixture-1",
  ]);
}

{
  const decisionContext = context([
    descriptor("pass"),
    descriptor("land", 1, { target: { rocketId: "r1", planetId: "mars" } }),
  ], "turn");
  const decision = policy.decide(decisionContext);
  assert.equal(decision.actionId, "land:fixture-1");
  assert.deepEqual(Object.keys(decision).sort(), [
    "actionId", "decisionVersion", "diagnostics", "policy", "requestId", "schemaVersion", "seatId", "stateVersion",
  ]);
  assert.equal(decision.policy.type, "heuristic");
  assert.equal(decision.policy.version, heuristic.POLICY_VERSION);
}

for (const family of standardAction.ALL_FAMILIES) {
  const actions = [
    descriptor(family, 0, { payload: { value: 1, ...(family === "choose_card" ? { score: 1 } : {}) } }),
    descriptor(family, 1, { payload: { value: 5, ...(family === "choose_card" ? { score: 5 } : {}) } }),
  ];
  const decision = heuristic.createHeuristicPolicy().decide(context(actions, `family-${family}`));
  assert.equal(decision.actionId, actions[1].actionId, `${family} 必须逐项估值且只从 legal set 选择`);
}

{
  const optionalContext = context([
    descriptor("accept_optional_effect", 0, { summary: "取消奖励", target: { choiceId: "cancel" } }),
    descriptor("accept_optional_effect", 1, { summary: "确认奖励", target: { choiceId: "confirm" } }),
  ], "optional");
  assert.equal(policy.decide(optionalContext).actionId, "accept_optional_effect:fixture-1");
}

{
  const mixedContext = context([
    descriptor("choose_reward", 0, { summary: "领取奖励", target: { choiceId: "reward" } }),
    descriptor("accept_optional_effect", 1, { summary: "跳过奖励", target: { choiceId: "skip" } }),
  ], "mixed-conditional");
  assert.equal(policy.decide(mixedContext).actionId, "choose_reward:fixture-0");
}

assert.throws(
  () => policy.decide(context([], "empty")),
  (error) => error.code === "HEURISTIC_POLICY_EMPTY_LEGAL_SET",
);
assert.throws(
  () => policy.decide(context([descriptor("future_family")], "unknown")),
  (error) => error.code === "HEURISTIC_POLICY_UNSUPPORTED_FAMILY" && error.families[0] === "future_family",
);
assert.throws(
  () => policy.decide(context([descriptor("launch", 0, { phase: "conditional" })], "bad-phase")),
  (error) => error.code === "HEURISTIC_POLICY_DESCRIPTOR_INVALID",
);

{
  const shared = heuristic.createHeuristicPolicy();
  const actions = [descriptor("scan"), descriptor("pass", 1)];
  const teacherDecision = shared.decide(context(actions, "teacher"));
  const opponentDecision = shared.decide(context(actions, "opponent"));
  assert.equal(teacherDecision.actionId, opponentDecision.actionId, "teacher 与冻结 opponent 必须复用同一实例和选择语义");
  assert.equal(teacherDecision.policy.version, opponentDecision.policy.version);
}

{
  const source = fs.readFileSync(modulePath, "utf8");
  for (const forbidden of [
    "document.", "localStorage", "querySelector", "getElementById", "dispatchRuntimeAction",
    "runAiAutomationStep", "toLegacyCandidate", "chooseTurnAction", "choosePlayCard", "buildCandidates",
  ]) {
    assert.equal(source.includes(forbidden), false, `Heuristic Policy 不得依赖 ${forbidden}`);
  }
  const productionFiles = [
    "../../app/ai/action-executor.js",
    "../../app/ai/initial-card-pending.js",
    "../../app/ai/interaction-pending.js",
  ].map((relativePath) => fs.readFileSync(path.resolve(__dirname, relativePath), "utf8"));
  for (const productionSource of productionFiles) {
    assert.equal(productionSource.includes(".chooseTurnAction"), false, "app AI 生产路径不得调用旧 turn selector");
    assert.equal(productionSource.includes(".choosePlayCard"), false, "app AI 生产路径不得调用旧 card selector");
  }
  assert.equal(fs.existsSync(path.resolve(__dirname, "candidate-pipeline.js")), false, "旧 candidate pipeline 必须物理删除");
  assert.equal(
    fs.readFileSync(path.resolve(__dirname, "../../index.html"), "utf8").includes("candidate-pipeline.js"),
    false,
    "浏览器装配不得继续加载旧 candidate pipeline",
  );
}

console.log(`heuristic-policy tests passed (${standardAction.ALL_FAMILIES.length} families)`);
