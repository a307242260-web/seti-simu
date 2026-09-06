"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const source = "reports/research/7f66d3e1.c555bc33.full.json";
const initial = "reports/iteration/company-movement-input-42-20260906.json";
const output = "reports/iteration/current-movement-hotspots-20260907.json";
if (fs.existsSync(output)) console.log(`已有检查点：${output}`);
else {
  const env = createSimulationEnv(), report = { source, initial,
    scope: "从既有42检查点正式重放当前完整局，保存148/497搜索前真实状态；不运行AI、不修改盘面", entries: [] };
  try {
    const read = p=>JSON.parse(fs.readFileSync(p)), record = read(source), save = read(record.savePath);
    const cp = read(initial).checkpoint; delete cp.replaySteps; env.loadCheckpoint(cp);
    for (let index = 41; index < 497; index++) {
      if ([147,496].includes(index)) {
        const checkpoint = env.createCheckpoint(), root = JSON.parse(checkpoint.coreState.committedState);
        const actor = root.players.players.find(p=>p.id===save.replaySteps[index].actorPlayerId);
        assert.ok(actor);
        report.entries.push({step:index+1,actorId:actor.id,resources:actor.resources,
          hand:actor.hand,reservedCards:actor.reservedCards,
          bonuses:root.turn.cardTurnEventBonuses || [],
          pieces:root.pieces.rockets.filter(p=>p.playerId===actor.id),
          transports:root.aliens.chong?.transportTasksByRocketId || {}, checkpoint});
      }
      if (index === 496) break;
      const expected = save.replaySteps[index];
      const action = env.legalActions().find(a=>a.actionId===expected.action.actionId);
      assert.ok(action,`第${index+1}步动作必须存在`);
      assert.deepEqual(JSON.parse(JSON.stringify(action)),expected.action);
      const result = env.step(action); assert.equal(result.ok,true,JSON.stringify(result.error));
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after);
    }
    assert.equal(report.entries.length,2);
    report.sha256 = Object.fromEntries([source,initial,record.savePath].map(p=>[p,crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")]));
    report.verified=true;
  } catch(error) {report.verified=false;report.error={message:error.message,stack:error.stack};process.exitCode=1;}
  finally {env.dispose();fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({output,verified:report.verified,
    entries:report.entries.map(({checkpoint,...entry})=>entry),error:report.error},null,2));}
}
