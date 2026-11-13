'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { createSimulationRuleComposition } = require('../randomizer/training/simulation-rule-composition');
const { createSeededRandom } = require('../randomizer/game/random');

const file = process.argv[2] || path.join(__dirname,
  '../reports/ai-foundation-20261113/prepass-funded-landing/r3-public-cargo-frontier-replay-20261113-v1.json.gz');
const { groups } = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
const white = 'player-white';
for (const group of groups) {
  const seed = JSON.parse(group.root.committedState).meta.seed;
  const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4 });
  kernel.newGame({ seed });
  const c = kernel.composition;
  const save = () => c.lifecycle.save().envelope;
  try {
    for (const row of group.rows) {
      assert(c.lifecycle.restore(group.root).ok);
      assert.deepEqual(save(), group.root);
      for (const [i, expected] of row.inputs.entries()) {
        for (const [offset, envelope] of row.checkpoints) {
          if (offset === i) assert.deepEqual(save(), envelope);
        }
        const decision = c.inspect().session?.decision;
        const action = (decision?.choices || c.inputPort.enumerateActions({}))
          .find(choice => choice.actionId === expected.actionId);
        assert.deepEqual(action, expected);
        if (action.actorId !== white) assert(['pass', 'choose_card', 'choose_payment'].includes(action.family));
        const result = decision
          ? c.inputPort.submitDecision({
            decisionId: decision.decisionId, decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice: action,
          })
          : action.phase === 'quick' ? c.inputPort.submitQuickAction(action) : c.inputPort.submitAction(action);
        assert(result.ok, JSON.stringify(result.failure || result));
      }
      const end = save();
      assert.deepEqual(end, row.end);
      for (const [offset, envelope] of row.checkpoints) {
        if (offset === row.inputs.length) assert.deepEqual(end, envelope);
      }
      const state = JSON.parse(end.committedState);
      if (row.score != null) {
        assert(state.turn.gameEnded);
        assert.equal(state.match.finalScores.find(player => player.playerId === white).totalScore, row.score);
      } else {
        assert(!state.turn.gameEnded);
      }
    }
    console.log(group.name, group.rows.length, group.rows.reduce((n, row) => n + row.inputs.length, 0));
  } finally {
    c.dispose();
  }
}
