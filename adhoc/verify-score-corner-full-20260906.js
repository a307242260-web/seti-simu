"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const output = "reports/iteration/score-corner-r4-full-verification-20260906.json";
if(fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const read = p=>JSON.parse(fs.readFileSync(p));
  const quick = read("reports/research/7a4c63fd.0d21aebf.quick-200.json");
  const full = read("reports/research/7a4c63fd.0d21aebf.full.json");
  const old = read("reports/research/76d49ed1.8a6ef25e.full.json");
  const q = read(quick.savePath),s = read(full.savePath),previous = read(old.savePath);
  assert.deepEqual(s.replaySteps.slice(0,200),q.replaySteps);
  assert.equal(full.resumedFrom,quick.savePath);
  assert.equal(full.gitCommit,quick.gitCommit);
  const state = JSON.parse(s.committedState);
  assert.equal(state.match.finalScoringSettled,true);
  const scores = Object.fromEntries(state.match.finalScores.map(p=>[p.playerId,p.totalScore]));
  assert.deepEqual(scores,full.summary.scores);
  const first = s.replaySteps.findIndex((step,i)=>JSON.stringify(step)!==JSON.stringify(previous.replaySteps[i]));
  const corners = s.replaySteps.flatMap((step,i)=>step.action.family==="card_corner"?[{
    step:i+1,actor:step.actorPlayerId,action:step.action,
    scoreDelta:step.after.p[step.actorPlayerId][0]-s.replaySteps[i-1].after.p[step.actorPlayerId][0],
    following:s.replaySteps.slice(i+1,i+4).map(x=>({family:x.action.family,target:x.action.target,actor:x.actorPlayerId})),
  }]:[]);
  assert.ok(first >= 0);
  const correctedCorner = s.replaySteps.findIndex(step=>step.action.actionId==="card_corner:68d40e4b");
  assert.ok(correctedCorner >= 0);
  assert.equal(s.replaySteps[correctedCorner+1].action.target.skip,true);
  assert.equal(s.replaySteps[correctedCorner].after.p["player-green"][0]
    - s.replaySteps[correctedCorner-1].after.p["player-green"][0],1);
  const report = {scope:"只读正式存档、前缀、首分歧和角标行动；不将总分差归因于单步",
    gitCommit:full.gitCommit,steps:full.steps,scores,mean:full.summary.avgScore,
    previousMean:old.summary.avgScore,acceptedBaseline:106.75,
    quickMs:quick.wallMs,resumeMs:full.wallMs,totalSimulationMs:quick.wallMs+full.wallMs,
    resumedPrefixIdentical:true,firstDifference:{step:first+1,before:previous.replaySteps[first],after:s.replaySteps[first]},
    corners,saves:[quick.savePath,full.savePath,old.savePath].map(path=>({path,
      sha256:crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex")}))};
  fs.writeFileSync(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify({output,steps:report.steps,mean:report.mean,firstDifference:first+1,
    corners:corners.map(c=>({step:c.step,actor:c.actor,summary:c.action.summary,scoreDelta:c.scoreDelta})),ms:report.totalSimulationMs},null,2));
}
