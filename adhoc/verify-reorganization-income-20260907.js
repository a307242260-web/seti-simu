"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const cards = require("../randomizer/game/cards/deck");
const output = "reports/iteration/reorganization-income-repro-20260907.json";
if (fs.existsSync(output)) {
  console.log("已有重组收入缺陷复现，不重复重放");
} else {
  const source = JSON.parse(fs.readFileSync("reports/iteration/white-gap-roots-20260907.json")).rows[0];
  const record = JSON.parse(fs.readFileSync(`reports/research/${source.recordId}.full.json`));
  const save = JSON.parse(fs.readFileSync(record.savePath));
  const env = createSimulationEnv();
  const rows = [];
  const readPlayer = () => {
    const state = JSON.parse(env.createCheckpoint().coreState.committedState);
    const player = state.players.players.find(entry => entry.id === "player-white");
    return { resources: player.resources, income: player.income, hand: player.hand.map(card => ({ id: card.id, cardId: card.cardId, gain: cards.getIncomeGainForCard(card) })) };
  };
  try {
    env.loadCheckpoint(source.checkpoint);
    for (let index = source.step - 1; index < 289; index++) {
      const expected = save.replaySteps[index];
      const action = env.legalActions().find(entry => entry.actionId === expected.action.actionId);
      assert.deepEqual(action, expected.action);
      const before = index >= 284 ? readPlayer() : null;
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
      if (before) rows.push({ step: index + 1, action, before, after: readPlayer() });
    }
    assert.equal(rows[0].before.income.energy, 2);
    assert.equal(rows.at(-1).after.income.energy, 5);
    assert.equal(rows.at(-1).after.income.handSize - rows[0].before.income.handSize, 1);
    const result = {
      scope: "历史基线正式重放；不运行AI，不更改规则，不将收入差直接换算为终局因果分",
      sourceRecord: source.recordId,
      cardImage: "assets/cards/space-agency/split/dlc_28.png",
      printedEffect: "从手牌中弃掉任意数量的卡牌。然后根据它们的收入角获得资源。",
      defect: "DISCARD_ANY_FOR_INCOME调用players.gainIncome，同时增加永久收入与即时资源；牌面仅要求即时资源",
      rows,
      reproduced: true,
    };
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify({ reproduced: true, before: rows[0].before.income, after: rows.at(-1).after.income, steps: rows.map(row => row.step) }));
  } finally {
    env.dispose();
  }
}
