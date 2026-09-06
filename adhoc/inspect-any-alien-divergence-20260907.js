"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/any-alien-divergence-v3-20260907.json";
const read = path => JSON.parse(fs.readFileSync(path));
if (fs.existsSync(output)) console.log(`已有证据：${output}`);
else {
  const env = createSimulationEnv();
  const sources = ["reports/research/ddc98722.1f0d82ec.full.json", "reports/research/0b8c855d.0caa713a.full.json"];
  const report = { scope: "复用42检查点重放共同前缀至408/410，读取手牌及已有搜索计数；不运行AI，不推断分数因果", sources };
  try {
    const records = sources.map(read), saves = records.map(r => read(r.savePath));
    assert.deepEqual(saves[0].replaySteps.slice(0, 409), saves[1].replaySteps.slice(0, 409));
    const cp = read("reports/iteration/company-movement-input-42-20260906.json").checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp);
    for (let index = 41; index < 409; index++) {
      if (index === 407) {
        report.checkpointPath = "reports/iteration/before-any-alien-408-20260907.json";
        if (!fs.existsSync(report.checkpointPath)) fs.writeFileSync(report.checkpointPath, JSON.stringify(env.createCheckpoint()));
        else {
          const live = env.createCheckpoint();
          report.undefinedPaths = [];
          function inspect(value, path) {
            if (value === undefined) report.undefinedPaths.push(path);
            else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) inspect(child, `${path}.${key}`);
          }
          inspect(live, "checkpoint");
          // 文件采用JSON契约；另保留所有原始undefined路径，不将序列化删除等同于修复。
          assert.deepEqual(read(report.checkpointPath), JSON.parse(JSON.stringify(live)));
        }
      }
      const expected = saves[1].replaySteps[index];
      const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
      assert.ok(action, `第${index + 1}步动作不存在`);
      assert.deepEqual(JSON.parse(JSON.stringify(action)), expected.action);
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    const state = JSON.parse(env.createCheckpoint().coreState.committedState);
    report.green = state.players.players.find(p => p.id === "player-green");
    report.paymentChoices = env.legalActions();
    report.nearbyReplay = saves.map(s => s.replaySteps.slice(407, 420));
    report.searches408 = records.map(r => r.metrics.searches.filter(s => s.step === 408));
    report.sha256 = Object.fromEntries([...sources, ...records.map(r => r.savePath)].map(p => [p, crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")]));
    report.verified = true;
  } catch (error) { report.verified = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, verified: report.verified, green: report.green, error: report.error }, null, 2));
  }
}
