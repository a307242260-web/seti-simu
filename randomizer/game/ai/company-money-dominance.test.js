"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const industry = require("../industry");
const tech = require("../tech");
const { createAnalysisPort } = require("./analysis-port");
const { searchDecision } = require("./decision-search");
const { createStateValueEvaluator } = require("./state-value");
const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../adhoc/ai-decision-corpus-20261023-v1/case-011-20261023-v1.json")));
const seed = fixture.source.seed, seatId = fixture.seatId;
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition, evaluate = createStateValueEvaluator(seatId);
const source = JSON.parse(fixture.compositionEnvelope.committedState);
const ownerOf = state => state.players.players.find(player => player.id === seatId);
function envelopeFor(label) {
  const state = structuredClone(source), owner = ownerOf(state);
  owner.initialSelection.industry = { id: `industry:${label}.png` };
  industry.ensurePlayerIndustryState(owner);
  industry.initializeHeliosPassiveMarkers(owner);
  industry.clearStrategyPassiveSlots(owner);
  owner.hand = [];
  owner.resources = { ...owner.resources, credits: 2, energy: 1, publicity: 0, availableData: 0, handSize: 0 };
  owner.dataState = { poolTokens: [], placedTokens: [], discardedCount: 0 };
  owner.industryRoundMarkRound = 0;
  owner.industryRoundMarkTurn = 0;
  for (const player of state.players.players) player.reservedCards = [];
  return { ...fixture.compositionEnvelope, committedState: JSON.stringify(state) };
}
function restore(envelope) {
  const result = comp.lifecycle.restore(envelope);
  assert.equal(result.ok, true, JSON.stringify(result));
}
const results = [];
for (const label of Object.keys(industry.INDUSTRY_DEFINITIONS)) {
  const envelope = envelopeFor(label);
  restore(envelope);
  const before = comp.lifecycle.save().envelope;
  function run(enabled, cache = 0) {
    const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: cache });
    try {
      const root = port.openRoot(), order = port.postMainResourceOrder(root);
      assert(order, `${label}的已审计公司流程应接受钱电模拟`);
      const first = port.expand(root, root.legalActions.find(a => a.target?.tradeId === "credits-for-energy").actionId);
      const returned = port.expand(first, first.legalActions.find(a => a.target?.tradeId === "energy-for-credit").actionId);
      assert.equal(port.postMainResourceOrder(returned).group, order.group, "实际亏损兑换不改变其他前向规则事实");
      assert.equal(order.credits - port.postMainResourceOrder(returned).credits, 1);
      assert.equal(order.energy - port.postMainResourceOrder(returned).energy, 1);
      const result = searchDecision({ port, root, evaluate, resourceDominance: enabled,
        budget: { transitions: 2048, nodes: 2049, frontier: 2048, milliseconds: 10000 } });
      assert.equal(result.complete, true, `${label}: ${result.stopReason}`);
      assert.deepEqual(comp.lifecycle.save().envelope, before);
      return result;
    } finally { port.close(); }
  }
  const raw = run(false), pruned = run(true), cached = run(true, 256);
  for (const result of [pruned, cached]) {
    assert.equal(result.actionId, raw.actionId, label);
    assert.equal(result.value, raw.value, label);
    assert.equal(result.lines[0].distance, raw.lines[0].distance, label);
    assert(result.diagnostics.dominancePrunes > 0, label);
    assert(result.diagnostics.transitions < raw.diagnostics.transitions, label);
  }
  results.push({ label, rawInputs: raw.diagnostics.transitions, prunedInputs: pruned.diagnostics.transitions, value: raw.value });
}
// 通过正式发射取得可移动的本席棋子，再对每种公司的实际能力穷举完整条件链。
const launchFixture = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../adhoc/ai-decision-corpus-20261023-v1/case-008-20261023-v1.json")));
restore(launchFixture.compositionEnvelope);
assert(comp.inputPort.submitAction(comp.inputPort.enumerateActions({}).find(a => a.family === "launch")).ok);
for (let guard = 0; guard < 16 && comp.inspect().phase === "awaiting_input"; guard += 1) {
  const d = comp.inspect().session.decision;
  assert(comp.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion,
    ownerId: d.ownerId, choice: d.choices[0] }).ok);
}
assert.notEqual(comp.inspect().phase, "awaiting_input");
const launched = JSON.parse(comp.lifecycle.save().envelope.committedState);
assert(launched.pieces.rockets.some(rocket => rocket.playerId === seatId || rocket.color === ownerOf(source).color));
const abilityResults = [];
for (const label of Object.keys(industry.INDUSTRY_DEFINITIONS)) {
  const envelope = envelopeFor(label), state = JSON.parse(envelope.committedState), owner = ownerOf(state);
  state.pieces = structuredClone(launched.pieces);
  for (const [key, value] of Object.entries(launched.meta.sequences)) {
    state.meta.sequences[key] = Math.max(state.meta.sequences[key] || 1, value);
  }
  owner.hand = [structuredClone(ownerOf(source).hand[0])];
  owner.resources = { ...owner.resources, credits: 4, energy: 3, publicity: 3, handSize: 1 };
  owner.industryLastPlayedCardThisRound = industry.snapshotPlayedCard(ownerOf(source).hand[1]);
  if (label === "赫利昂联合体") {
    assert(tech.playerTech.recordPlayerTake(owner.techState, "orange1", null).ok);
    state.tech.stacks.orange1.remaining -= 1;
  }
  if (label === "未来跨度研究所") assert(industry.parkFutureSpanCard(owner,
    structuredClone(ownerOf(source).hand[1]), owner.resources.score + 15).ok);
  envelope.committedState = JSON.stringify(state); restore(envelope);
  const before = comp.lifecycle.save().envelope;
  const counterfactualPort = { ...comp.counterfactualPort, createFork(...args) {
    const fork = comp.counterfactualPort.createFork(...args), original = fork.composition || fork;
    const inputPort = { ...original.inputPort };
    for (const method of ["submitAction", "submitQuickAction", "submitDecision"]) {
      inputPort[method] = (...inputs) => {
        const result = original.inputPort[method](...inputs);
        assert(result.ok, `${label}: ${JSON.stringify(result.failure || result)}`);
        return result;
      };
    }
    return { ...fork, composition: { ...original, inputPort } };
  } };
  const port = createAnalysisPort({ composition: { ...comp, counterfactualPort }, seatId, maxCacheEntries: 0 });
  try {
    const rich = port.openRoot();
    const first = port.expand(rich, rich.legalActions.find(a => a.target?.tradeId === "credits-for-energy").actionId);
    const poor = port.expand(first, first.legalActions.find(a => a.target?.tradeId === "energy-for-credit").actionId);
    assert.equal(port.postMainResourceOrder(rich).group, port.postMainResourceOrder(poor).group);
    const ability = poor.legalActions.find(a => a.family === "industry");
    if (!industry.INDUSTRY_DEFINITIONS[label].activeAbilityId) { assert.equal(ability, undefined); continue; }
    assert(ability, `${label}实际能力必须可执行，不能以无能力窗口代替`);
    const queue = [[port.expand(rich, ability.actionId), port.expand(poor, ability.actionId)]], visited = new Set();
    let edges = 1, leaves = 0;
    for (let head = 0; head < queue.length; head += 1) {
      assert(queue.length < 256, "公司条件链验证必须有全局上限，不能无限延长");
      const [a, b] = queue[head];
      assert.equal(a.status, b.status); assert.equal(a.boundary, b.boundary);
      const observationA = a.observation, observationB = b.observation;
      const playersA = structuredClone(observationA.publicState.players), playersB = structuredClone(observationB.publicState.players);
      const playerA = playersA.find(p => p.playerId === seatId), playerB = playersB.find(p => p.playerId === seatId);
      assert.equal(playerA.credits - playerB.credits, 1); assert.equal(playerA.energy - playerB.energy, 1);
      playerA.credits = playerB.credits = 0; playerA.energy = playerB.energy = 0;
      assert.deepEqual(playersA, playersB, "能力结算除钱电差外的玩家事实一致");
      assert.deepEqual(observationA.selfState, observationB.selfState);
      assert.deepEqual(observationA.publicState.board, observationB.publicState.board);
      if (a.status !== "decision") { leaves += 1; continue; }
      const identity = port.identity(b);
      if (visited.has(identity)) continue;
      visited.add(identity);
      for (const action of b.legalActions) {
        assert(a.legalActions.some(candidate => candidate.actionId === action.actionId), "较穷状态的每个条件选择均可模拟");
        queue.push([port.expand(a, action.actionId), port.expand(b, action.actionId)]); edges += 1;
      }
    }
    assert(leaves > 0);
    assert.deepEqual(comp.lifecycle.save().envelope, before);
    abilityResults.push({ label, inputsPerWallet: edges, leaves });
  } finally { port.close(); }
  if (label === "哨兵探测网络") {
    const submit = () => {
      const action = comp.inputPort.enumerateActions({}).find(a => a.family === "industry");
      const result = comp.inputPort.submitQuickAction(action);
      assert(result.ok, JSON.stringify(result.failure || result));
    };
    submit();
    const after = comp.lifecycle.save().envelope, actual = JSON.parse(after.committedState);
    assert.equal(ownerOf(actual).resources.availableData, 1, "实际补开的数据角标必须获得数据");
    assert.equal(actual.meta.sequences.dataToken, state.meta.sequences.dataToken + 1, "必须使用权威数据编号流");
    restore(after); assert.deepEqual(comp.lifecycle.save().envelope, after);
    restore(before); submit(); assert.deepEqual(comp.lifecycle.save().envelope, after, "同一公司输入恢复重放保持数据、RNG和journal");
  }
}
// 其他席位触发器、未知公共角标或下一自己回合不能借公司目录白名单放行。
function rejected(mutate) {
  const envelope = envelopeFor("异星实验室"), state = JSON.parse(envelope.committedState);
  mutate(state, ownerOf(state)); envelope.committedState = JSON.stringify(state); restore(envelope);
  const port = createAnalysisPort({ composition: comp, seatId });
  try { assert.equal(port.postMainResourceOrder(port.openRoot()), null); }
  finally { port.close(); }
}
rejected((_state, owner) => { owner.mainActionCompleted = false; });
rejected((state) => { state.turn.passedPlayerIds = state.turn.activePlayerIds.filter(id => id !== seatId); });
rejected((state) => { state.players.players.find(p => p.id !== seatId).reservedCards = [structuredClone(ownerOf(source).hand[0])]; });
rejected((state) => { state.cards.publicCards[0].set = "unreviewed-company-corner"; });
const unknown = envelopeFor("未审计公司");
assert.throws(() => restore(unknown), /未知公司/, "未知公司在正式观察入口显式失败，不能进入搜索");
comp.dispose();
console.log(JSON.stringify({ companyMoneyDominance: "passed", results, abilityResults }));
