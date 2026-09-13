"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const {createSimulationEnv}=require("../randomizer/app/simulation-env");
const cards=require("../randomizer/game/cards/deck"),effects=require("../randomizer/game/cards/effects");
const output="adhoc/data-corner-formal467-20260913.json";
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const input=JSON.parse(fs.readFileSync("adhoc/budget467-input-20260913.json"));
const ids=["alien-amiba-5-22","alien-amiba-2-18","alien-amiba-7-16"],rows=[];
const env=createSimulationEnv();
try {
  for(const id of ids){
    env.loadCheckpoint(input.checkpoint);
    const before=env.observe("player-white"),player=before.publicState.players.find(p=>p.playerId==="player-white");
    const card=before.selfState.hand.find(c=>c.id===id),action=env.legalActions().find(a=>a.family==="card_corner"&&a.target.cardInstanceId===id);
    assert(card&&action);assert.equal(env.step(action).ok,true);
    const after=env.observe("player-white"),next=after.publicState.players.find(p=>p.playerId==="player-white");
    assert.equal(next.score-player.score,1);assert.equal(next.availableData-player.availableData,1);
    assert(!after.selfState.hand.some(c=>c.id===id));assert.equal(after.selfState.hand.length,before.selfState.hand.length-1);
    rows.push({id,action,reward:cards.getDiscardActionRewardForCard(card),playEffects:effects.buildPlayEffects(card),
      publicPlayerAfter:next,remainingHandIds:after.selfState.hand.map(c=>c.id)});
  }
  assert.deepEqual(rows[0].publicPlayerAfter,rows[1].publicPlayerAfter);
  assert.deepEqual(rows[0].publicPlayerAfter,rows[2].publicPlayerAfter);
  assert.notDeepEqual(rows[0].playEffects,rows[1].playEffects);
  assert.notDeepEqual(rows[0].remainingHandIds,rows[1].remainingHandIds);
  fs.writeFileSync(output,JSON.stringify({source:"adhoc/budget467-input-20260913.json",rows,
    scope:"三个本席正式合法角标分别执行后公开玩家事实相同，均+1分+1数据、少1手牌；剩余牌身份与打牌效果不同，仅支持有损代表，不证明后续状态等价。"},null,2)+"\n",{flag:"wx"});
  console.log(`[正式分支核验] 3/3通过；${output}`);
}finally{env.dispose();}
