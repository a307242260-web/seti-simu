"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/white-free-movement-20260907.json";
if (fs.existsSync(output)) console.log("已有正式分支证据，不重放");
else {
  const source = JSON.parse(fs.readFileSync("reports/iteration/white-movement-205-20260907.json"));
  const save = JSON.parse(fs.readFileSync(source.source)), rows = [];
  for (const mode of ["recorded", "use-free-first"]) {
    const env = createSimulationEnv(), row = { mode, inputs: [] }; rows.push(row);
    try {
      env.loadCheckpoint(source.entries.find(e => e.step === 205).checkpoint);
      function execute(action) {
        assert.ok(action, "正式分支动作必须存在");
        const result = env.step(action); assert.equal(result.ok, true, JSON.stringify(result.error));
        row.inputs.push(action);
      }
      if (mode === "use-free-first") {
        execute(env.legalActions().find(a => a.target?.rocketId === 6 && a.target?.deltaY === 1));
        const choices = env.legalActions(); assert.equal(choices.length, 1);
        assert.equal(choices[0].target?.skip, true); execute(choices[0]);
      }
      for (let index = mode === "recorded" ? 204 : 207; index <= 209; index++) {
        execute(env.legalActions().find(a => a.actionId === save.replaySteps[index].action.actionId));
      }
      const cp = env.createCheckpoint(), state = JSON.parse(cp.coreState.committedState);
      row.state = state;
      row.player = state.players.players.find(p => p.id === "player-white");
      row.rockets = state.pieces.rockets;
      row.legal = env.legalActions();
    } finally { env.dispose(); }
  }
  assert.deepEqual(rows[0].rockets, rows[1].rockets, "相同探测器、同一终点");
  const expectedPlayer = structuredClone(rows[0].player); expectedPlayer.resources.energy += 1;
  assert.deepEqual(rows[1].player, expectedPlayer, "玩家全部字段相同，唯独免费先走多保留1能量");
  assert.deepEqual(rows[0].state.planets, rows[1].state.planets);
  assert.deepEqual(rows[0].state.aliens, rows[1].state.aliens);
  assert.deepEqual(rows[0].state.meta.rngState, rows[1].state.meta.rngState);
  fs.writeFileSync(output, JSON.stringify({ scope: "同一205前态正式分支；不运行AI，证明免费先走较记录方案节省1能量",
    rows, passed: true }, null, 2) + "\n");
  console.log(JSON.stringify({ output, passed: true, energies: rows.map(r => r.player.resources.energy),
    inputs: rows.map(r => r.inputs.length) }));
}
