'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const [source,out]=process.argv.slice(2),raw=fs.readFileSync(source),j=JSON.parse(raw),seat='player-white',load=p=>require(path.resolve(p));
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {createSeededRandom}=load('randomizer/game/random'),{buildRuleObservation}=load('randomizer/app/rule-observation'),sv=load('randomizer/game/ai/state-value');
const seed=JSON.parse(j.rows[0].origin.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
k.newGame({seed});
const c=k.composition,restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(c.lifecycle.save().envelope,e);};
try{
 const rows=[];
 for(const row of j.rows){
  const sides=[];
  for(const side of row.sides){
   restore(side.end);
   const v=sv.evaluateStateValue(c.projection({role:'player',playerId:seat}).state,seat);
   assert.deepEqual(c.lifecycle.save().envelope,side.end);
   sides.push({label:side.label,total:v.total,components:v.components});
  }
  restore(row.origin);
  assert.deepEqual(sides.map(x=>x.total),[159,161.5]);
  if(rows.length)assert.deepEqual(sides,rows[0].sides);
  rows.push({world:row.index,sides});
 }
 fs.writeFileSync(out,JSON.stringify({scope:'Apply unchanged default evaluator at equal Native horizons in three hidden-order worlds. No search, no hidden identity used to choose any input.',
  sourceSha256:crypto.createHash('sha256').update(raw).digest('hex'),model:sv.MODEL_VERSION,nativeInputs:0,rows},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({model:sv.MODEL_VERSION,comparison:rows[0].sides.map(x=>[x.label,x.total]),maskedWorlds:rows.length}));
}finally{c.dispose();}
