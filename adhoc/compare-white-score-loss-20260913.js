"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const output="adhoc/white-score-loss-20260913.json";
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const paths=["seti-saves/seti-save-research-secondary-probe-greedy-20260913-c47eaa17-full-v264.json",
  "seti-saves/seti-save-research-scan-free-cost-20260913-de73734c-full-v278.json"];
const saves=paths.map(p=>JSON.parse(fs.readFileSync(p))),states=saves.map(s=>JSON.parse(s.committedState));
const players=states.map(s=>s.players.players.find(p=>p.id==="player-white"));
const scores=states.map(s=>s.match.finalScores.find(p=>p.playerId==="player-white"));
const delta=(a,b)=>Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b)])].map(k=>[k,(b[k]||0)-(a[k]||0)]).filter(([,v])=>v!==0));
const sourceDelta=delta(players[0].scoreSources,players[1].scoreSources);
assert.equal(Object.values(sourceDelta).reduce((a,b)=>a+b,0),scores[1].baseScore-scores[0].baseScore);
const components={base:scores[1].baseScore-scores[0].baseScore,cards:scores[1].cardScore-scores[0].cardScore,
  tiles:scores[1].tileScore-scores[0].tileScore};
assert.equal(Object.values(components).reduce((a,b)=>a+b,0),-40);
const white=saves.map(s=>s.replaySteps.map((x,i)=>({step:i+1,...x})).filter(s=>s.action.actorId==="player-white"));
const key=s=>JSON.stringify([s.action.family,s.action.target,s.action.payload]);
let first=0;while(first<Math.min(...white.map(s=>s.length))&&key(white[0][first])===key(white[1][first]))first++;
const record={paths,scores,components,sourceDelta,tileDelta:delta(scores[0].tileScoresById,scores[1].tileScoresById),
  assets:players.map(p=>({income:p.income,tech:p.techState.ownedTiles,completedTaskCount:p.completedTaskCount,resources:p.resources})),
  firstWhiteSemanticDifference:white.map(s=>s.slice(first-3,first+8).map(x=>({step:x.step,round:x.after.r,action:x.action}))),
  scope:"收益差额逐项守恒；这是结果拆分，不单凭终局相关性证明各项损失的决策因果。"};
fs.writeFileSync(output,JSON.stringify(record,null,2)+"\n",{flag:"wx"});console.log(JSON.stringify({output,components,sourceDelta,tileDelta:record.tileDelta}));
