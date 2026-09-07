"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const output="reports/iteration/white-gap-rounds-20260907.json";
if(fs.existsSync(output))console.log("已有白方逐轮分账，不重复生成");else{
  const rows=[];
  for(const recordId of ["7feb57c3.96e60c14","aed4e5db.1f55695a"]){
    const record=JSON.parse(fs.readFileSync(`reports/research/${recordId}.full.json`)),save=JSON.parse(fs.readFileSync(record.savePath)),state=JSON.parse(save.committedState);
    const last=new Map();for(const step of save.replaySteps)last.set(step.after.r,step.after);
    const rounds=[...last].map(([round,after])=>({round,score:after.p["player-white"][0],resources:after.p["player-white"]}));
    const final=state.match.finalScores.find(p=>p.playerId==="player-white");assert.equal(rounds.at(-1).score,final.baseScore);
    const actions=save.replaySteps.map((r,i)=>({...r,step:i+1})).filter(r=>r.actorPlayerId==="player-white"&&["land","orbit"].includes(r.action.family)).map(r=>({step:r.step,round:r.after.r,action:r.action}));
    rows.push({recordId,rounds,final,actions,scoreSources:state.players.players.find(p=>p.id==="player-white").scoreSources});
  }
  const roundDeltas=rows[0].rounds.map((r,i)=>({round:r.round,before:r.score,after:rows[1].rounds[i].score,delta:rows[1].rounds[i].score-r.score}));
  assert.deepEqual(roundDeltas.map(r=>r.delta),[0,7,5,-15]);
  const fourthRoundGains=rows.map(r=>r.rounds[3].score-r.rounds[2].score);assert.deepEqual(fourthRoundGains,[43,23]);
  fs.writeFileSync(output,JSON.stringify({scope:"只读两份完整存档的逐轮过程分及终局分账；过程领先不等于未来资源相同，不据此排除早期策略影响",rows,roundDeltas,fourthRoundGains,passed:true},null,2)+"\n");
  console.log(JSON.stringify({roundDeltas,fourthRoundGains,finalDelta:rows[1].final.totalScore-rows[0].final.totalScore},null,2));
}
