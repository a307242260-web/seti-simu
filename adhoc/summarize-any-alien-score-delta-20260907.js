"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const output = "reports/iteration/any-alien-score-delta-20260907.json";
if (fs.existsSync(output)) console.log(`已有证据：${output}`);
else {
  const records = ["reports/research/ddc98722.1f0d82ec.full.json", "reports/research/0b8c855d.0caa713a.full.json"];
  const read = p => JSON.parse(fs.readFileSync(p));
  const sources = records.map(read).map(r => r.savePath);
  const saves = sources.map(read), states = saves.map(s => JSON.parse(s.committedState));
  const actors = states.map(s => s.players.players.find(p => p.id === "player-green"));
  const finals = states.map(s => s.match.finalScores.find(p => p.playerId === "player-green"));
  const keys = [...new Set(actors.flatMap(a => Object.keys(a.scoreSources)))];
  const scoreDeltas = Object.fromEntries(keys.map(k => [k, (actors[1].scoreSources[k] || 0) - (actors[0].scoreSources[k] || 0)]).filter(([,v]) => v));
  assert.equal(Object.values(scoreDeltas).reduce((a,b) => a+b,0), -4);
  assert.equal(finals[1].totalScore - finals[0].totalScore, -4);
  assert.deepEqual(finals[0].tileScoresById, finals[1].tileScoresById);
  const planPath = "reports/iteration/data-event-decision-408-20260907.json";
  const plan = read(planPath);
  assert.equal(plan.passed, true);
  const actions = plan.steps.map(s => s.action);
  assert.equal(actions[2].target.choiceId, "energy");
  const laterCardPayment = actions.findIndex((a, i) => i > 2 && a.family === "choose_payment" && a.target.cardIds.includes("card-79-0"));
  assert.ok(laterCardPayment > 2);
  const report = {
    scope: "只读旧两版终局及当前独立408冷计划；得分账面与计划用途证据，不证明旧版排序改变原因",
    sources: [...records, ...sources, planPath], scoreDeltas, finals,
    greenReplayAfter408: saves.map(s => s.replaySteps.filter(p => p.stepIndex >= 407 && p.actorPlayerId === "player-green").map(p => ({step:p.stepIndex+1, action:p.action}))),
    currentPlan: { source: planPath, actionIds: actions.map(a => a.actionId), immediatePayment: actions[2], laterCardPayment: actions[laterCardPayment], precedingMove: actions[laterCardPayment-1] },
    conclusion: "当前计划保留b137供之后R12向内移动支付，故不是无用途保牌；实际旧两版482都直接登陆，与当前冷计划不能混同。未证明降分由规则错误或本轮引入缺陷造成。",
    sha256: Object.fromEntries([...records,...sources,planPath].map(p=>[p,crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")])), verified:true,
  };
  fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({output,scoreDeltas,verified:true}));
}
