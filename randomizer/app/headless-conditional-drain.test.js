"use strict";

const assert = require("node:assert/strict");
const {
  buildEnvironmentEvents,
  drainHeadlessDeterministicEffects,
} = require("./headless-env");
const { CONDITIONAL_FAMILIES } = require("./headless-contract");

function createHarness(family, choiceCount) {
  const actorPlayer = { id: `owner-${family}` };
  const candidates = Array.from({ length: choiceCount }, (_unused, index) => ({
    id: "conditionalChoice",
    family,
    target: { kind: "fixture", choiceId: String(index) },
  }));
  const executed = [];
  return {
    actorPlayer,
    candidates,
    executed,
    api: {
      listHeadlessConditionalActionCandidates() {
        return { actorPlayer, candidates: executed.length ? [] : candidates };
      },
      executeHeadlessConditionalAction(candidate) {
        executed.push(candidate);
        return { ok: true, selectedChoiceId: candidate.target.choiceId };
      },
      listHeadlessTurnActionCandidates() {
        return { candidates: [{ id: "pass" }] };
      },
      getTurnState() {
        return { gameEnded: false };
      },
    },
  };
}

for (const family of CONDITIONAL_FAMILIES) {
  const single = createHarness(family, 1);
  const singleResult = drainHeadlessDeterministicEffects(single.api);
  assert.equal(singleResult.ok, true, `${family} 单选应自动推进`);
  assert.equal(singleResult.boundary, "turn_action", `${family} 单选不得形成 policy boundary`);
  assert.deepEqual(single.executed, [single.candidates[0]], `${family} 应执行唯一合法项`);
  assert.equal(singleResult.steps.length, 1, `${family} 单选应记录一个自动事件`);
  assert.equal(singleResult.steps[0].automaticConditionalChoice, true);
  assert.equal(singleResult.steps[0].family, family);
  assert.equal(singleResult.steps[0].actorPlayerId, single.actorPlayer.id, `${family} 自动事件应归属 effect owner`);
  assert.deepEqual(
    buildEnvironmentEvents(singleResult, 0, "fixture_parent"),
    [{
      eventIndex: 0,
      type: "automatic_conditional_choice",
      family,
      target: single.candidates[0].target,
      ownerPlayerId: single.actorPlayer.id,
      sourceActionType: "fixture_parent",
      irreversible: null,
    }],
    `${family} 自动项应写入 replay environment event`,
  );

  const replayed = createHarness(family, 1);
  assert.deepEqual(
    drainHeadlessDeterministicEffects(replayed.api),
    singleResult,
    `${family} 单选自动事件必须可确定性重放`,
  );

  const multiple = createHarness(family, 2);
  const multipleResult = drainHeadlessDeterministicEffects(multiple.api);
  assert.equal(multipleResult.ok, true, `${family} 多选应形成合法边界`);
  assert.equal(multipleResult.boundary, "conditional_choice", `${family} 多选必须保留独立 policy step`);
  assert.equal(multipleResult.actorPlayer.id, multiple.actorPlayer.id, `${family} 多选应保留正确 owner`);
  assert.deepEqual(multipleResult.candidates, multiple.candidates, `${family} 多选应保留完整 legal mask`);
  assert.deepEqual(multiple.executed, [], `${family} 多选不得由环境代选`);
  assert.deepEqual(multipleResult.steps, [], `${family} 多选前不得伪造自动事件`);
}

const unknown = createHarness("unknown_family", 1);
const unknownResult = drainHeadlessDeterministicEffects(unknown.api);
assert.equal(unknownResult.ok, false, "未知 conditional family 必须 fail-closed");
assert.equal(unknownResult.final.code, "HEADLESS_UNSUPPORTED_CONDITIONAL_FAMILY");
assert.match(unknownResult.final.message, /family=unknown_family/);
assert.deepEqual(unknown.executed, [], "未知 conditional family 不得自动执行");

const bounded = createHarness("choose_branch", 1);
bounded.api.listHeadlessConditionalActionCandidates = () => ({
  actorPlayer: bounded.actorPlayer,
  candidates: bounded.candidates,
});
const boundedResult = drainHeadlessDeterministicEffects(bounded.api, 3);
assert.equal(boundedResult.ok, false, "不收敛的 deterministic drain 必须在上界失败");
assert.match(boundedResult.final.message, /超过 3 步/);
assert.equal(bounded.executed.length, 3, "drain 不得执行超过显式步数上界");

console.log(`headless conditional drain tests passed (${CONDITIONAL_FAMILIES.length} families)`);
