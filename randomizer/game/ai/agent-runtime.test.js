"use strict";

const assert = require("node:assert/strict");
const { createAgentDecisionFunction } = require("./agent-runtime");
const { createCompletionAgent } = require("./completion-agent");
const { createSimulationEnv } = require("../../app/simulation-env");
const { buildIdentity, fingerprintOf } = require("../../../tools/run_research_validation");

function boundary(actions) {
  return {
    seatId: "p1", observation: { publicState: {}, selfState: {} },
    legalActions: actions.map((action, index) => ({
      schemaVersion: "seti-standard-action-v1", actorId: "p1", stateVersion: 1,
      decisionVersion: 2, actionId: `choice:${index}`, family: "choose_card",
      phase: "conditional", target: {}, payload: {}, ...action,
    })),
    sessionDecision: { executor: () => { throw new Error("private session"); } },
  };
}

const events = [];
let received;
const source = boundary([{ presentation: { selected: true } }, {}]);
const runtime = createAgentDecisionFunction({
  seatId: "p1",
  createAgent: () => ({
    getProvenance: () => ({ type: "fixture", version: "fixture-v1" }),
    decide(context) {
      received = context;
      assert.equal(Object.isFrozen(context), true);
      assert.equal(Object.isFrozen(context.observation.publicState), true);
      assert.equal(context.sessionDecision, undefined);
      assert.deepEqual(context.selectedActionIds, ["choice:0"]);
      return { actionId: context.legalActions[1].actionId, reasonCode: "fixture" };
    },
  }),
  onDecision: event => events.push(event),
});
const chosen = runtime.run(source);
assert.equal(chosen.actionId, "choice:1");
assert.equal(chosen.decision.actionId, chosen.actionId);
assert.equal(events.length, 1);
assert.equal(events[0].context, received);
source.observation.publicState.changed = true;
assert.equal(received.observation.publicState.changed, undefined);
assert.throws(() => runtime.run({ ...source, seatId: "p2" }), /AGENT_SEAT_MISMATCH/);

for (const result of [{ actionId: "unknown" }, Promise.resolve({ actionId: "choice:0" })]) {
  const invalid = createAgentDecisionFunction({ seatId: "p1", createAgent: () => ({
    getProvenance: () => ({ type: "fixture", version: "fixture-v1" }),
    decide: () => result,
  }) });
  assert.throws(() => invalid.run(source), /AGENT_(ACTION_NOT_LEGAL|ASYNC_UNSUPPORTED)/);
}

const completion = createAgentDecisionFunction({ seatId: "p1", createAgent: createCompletionAgent });
assert.equal(completion.run(boundary([
  { target: { kind: "discard-hand-card" }, presentation: { selected: true } },
  { target: { kind: "discard-hand-card" }, presentation: { selected: false } },
])).actionId, "choice:1", "已选牌不能反复切换");
assert.equal(completion.run(boundary([
  { target: { kind: "discard-hand-card" }, presentation: { selected: true } },
  { target: { kind: "confirm", confirm: true } },
])).actionId, "choice:1", "数量满足时确认");

const env = createSimulationEnv();
env.reset({ seed: "agent-runtime-opening-v1", agentType: "completion", compactReplay: true });
for (let step = 0; step < 8; step += 1) {
  const result = env.runAgentDecision();
  assert.equal(result.ok, true);
  assert.equal(result.policyProvenance.type, "completion");
  assert.equal(result.agentTrace.context.seatId, result.actorPlayerId);
}
const checkpoint = env.createCheckpoint();
const restored = createSimulationEnv();
restored.loadCheckpoint(checkpoint);
for (let step = 0; step < 8; step += 1) {
  const first = env.runAgentDecision();
  const second = restored.runAgentDecision();
  assert.equal(first.actionId, second.actionId);
  assert.deepEqual(first.observation, second.observation);
}
assert.equal(env.getReplay().steps.length, 16, "每次正式提交只记录一步");
env.dispose();
restored.dispose();

const custom = createSimulationEnv({ agentFactory: () => ({
  getProvenance: () => ({ type: "fixture", version: "factory-v1" }),
  decide: context => ({ actionId: context.legalActions[0].actionId }),
}) });
custom.reset({ seed: "custom-factory-v1" });
assert.equal(custom.runAgentDecision().policyProvenance.type, "fixture");
assert.throws(() => createSimulationEnv().loadCheckpoint(custom.createCheckpoint()), /AI factory/);
custom.reset({ seed: "explicit-completion-v1", agentType: "completion" });
assert.equal(custom.runAgentDecision().policyProvenance.type, "completion", "显式内置类型不能被注入factory覆盖");
custom.dispose();

const baselineIdentity = buildIdentity({ seed: "agent-identity-v1", config: { agentType: "completion" } });
const oldIdentity = buildIdentity({ seed: "agent-identity-v1", config: {} });
assert.equal(baselineIdentity.policyVersion, require("./completion-agent").VERSION);
assert.notEqual(fingerprintOf(baselineIdentity), fingerprintOf(oldIdentity), "新AI实验身份不能沿用旧启发式");
assert.throws(() => buildIdentity({ config: { agentType: "unknown" } }), /未知 AI 类型/);
console.log("agent runtime isolation, completion and recovery tests passed");
