"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const data = require("../randomizer/game/data");
const source = "seti-saves/seti-save-research-turn-boundary-20260911-31a2e43b-full-v276.json";
const save = JSON.parse(fs.readFileSync(source, "utf8"));
const env = createSimulationEnv();
const scanStep = 33;
const cases = [];
try {
  env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "laughable" });
  for (const step of save.replaySteps.slice(0, scanStep - 1)) {
    const action = env.legalActions().find(a => a.actionId === step.action.actionId);
    assert(action);
    assert.equal(env.step(action).ok, true);
  }
  const actorId = save.replaySteps[scanStep - 1].action.actorId;
  for (const pool of [4, 5, 6]) {
    for (const prepare of [0, ...pool > 4 ? [pool - 4] : []]) {
      const comp = env.createCounterfactualFork(null, { branchKey: `scan-capacity-${pool}-${prepare}` }).composition;
      try {
        const envelope = comp.lifecycle.save().envelope;
        const base = JSON.parse(envelope.committedState);
        const player = base.players.players.find(p => p.id === actorId);
        // 正式开局未设置该标记；规则以truthy判断主行动已完成。
        assert.equal(Boolean(player.mainActionCompleted), false);
        assert.equal(data.listPoolTokens(player).length, 0);
        const placedBefore = data.listComputerPlacedTokens(player).length;
        assert.equal(placedBefore, 4, "保留正式回放已有的四个计算机数据");
        for (let index = 0; index < pool; index += 1) assert.equal(data.gainData(player, { root: base }).ok, true);
        assert.equal(comp.lifecycle.restore({ ...envelope, committedState: JSON.stringify(base) }).ok, true);
        const actionsTaken = [];
        function decide(decision, choice) {
          assert(choice);
          assert.equal(comp.inputPort.submitDecision({ decisionId: decision.decisionId,
            decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice }).ok, true);
          actionsTaken.push({ family: choice.family, target: choice.target });
        }
        for (let index = 0; index < prepare; index += 1) {
          const place = comp.inputPort.enumerateActions({}).find(a => a.family === "place_data");
          assert(place);
          assert.equal(comp.inputPort.submitAction(place).ok, true);
          actionsTaken.push({ family: place.family, target: place.target });
          const decision = comp.inspect().session.decision;
          decide(decision, decision.choices.find(c => c.target.target === "computer"));
          assert.equal(comp.inspect().session, null, "第五/六个计算机位置不应留下待选奖励");
        }
        const scan = comp.inputPort.enumerateActions({}).find(a => a.family === "scan");
        assert(scan);
        assert.equal(comp.inputPort.submitAction(scan).ok, true);
        actionsTaken.push({ family: scan.family, target: scan.target });
        for (let index = scanStep; comp.inspect().session; index += 1) {
          const inspection = comp.inspect();
          assert.equal(inspection.phase, "awaiting_input");
          const recorded = save.replaySteps[index]?.action;
          assert.equal(recorded?.phase, "conditional");
          decide(inspection.session.decision, inspection.session.decision.choices
            .find(c => c.actionId === recorded.actionId));
        }
        const after = JSON.parse(comp.lifecycle.save().envelope.committedState);
        const result = after.players.players.find(p => p.id === actorId);
        const discarded = result.dataState.discardedCount - player.dataState.discardedCount;
        const poolAfter = data.listPoolTokens(result).length;
        const placedAfter = data.listComputerPlacedTokens(result).length;
        assert.equal(discarded, Math.max(0, pool - prepare + 2 - 6));
        assert.equal(poolAfter + placedAfter + discarded, pool + placedBefore + 2);
        assert.equal(placedAfter, placedBefore + prepare);
        assert.equal(result.mainActionCompleted, true);
        assert(comp.inputPort.enumerateActions({}).some(a => a.family === "end_turn"));
        cases.push({ poolBefore: pool, placedBefore, prepared: prepare, poolAfter, placedAfter, discarded,
          mainActionCompleted: true, actionsTaken });
      } finally { comp.dispose(); }
    }
  }
  console.log(JSON.stringify({ source, scanStep, actorId,
    fixture: "从既有正式扫描前状态起，用正式gainData构造池4/5/6；后续放置、扫描和条件选择全部经共享inputPort。",
    scope: "固定同一可见扫描选择链的容量必要性；不预测其他可选扫描、隐藏补牌或对手，不证明AI会主动先放数据。",
    cases }, null, 2));
} finally { env.dispose(); }
