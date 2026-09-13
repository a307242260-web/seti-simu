"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const {createSimulationRuleComposition}=require("../randomizer/game/production-kernel");
const {createSeededRandom}=require("../randomizer/game/random");
const output="adhoc/scan-free-cost-boundary-20260913.json";
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const old=JSON.parse(fs.readFileSync("adhoc/budget485-scan4-20260913.json"));
const input=JSON.parse(fs.readFileSync("adhoc/budget485-input-20260913.json"));
const seed=input.checkpoint.config.seed,seat="player-green";
const c=createSimulationRuleComposition({seed,random:createSeededRandom(seed),trustedForkLifecycle:true}).composition;
try {
  assert.equal(c.lifecycle.restore(old.envelope).ok,true);
  assert.deepEqual(c.inspect().session.decision.choices,old.choices,"正式方向/发射/跳过选择不变");
  const current=c.projection({role:"player",playerId:seat}).state.probeRouteRequirements;
  assert.equal(current.movementContext.phase,"scan");
  assert.equal(current.movementContext.scanRemaining,1);
  const rows=current.candidates.filter(g=>g.sourceId!=="launch").map(g=>{
    const previous=old.observation.probeRouteRequirements.candidates.find(x=>x.requirementId===g.requirementId);
    const formalMinimum=Math.min(...old.variants.map(v=>v.observation.probeRouteRequirements.candidates
      .find(x=>x.requirementId===g.requirementId)?.required.energy??Infinity));
    assert.equal(g.required.energy,formalMinimum,g.requirementId);
    return {requirement:g.requirementId,previous:previous?.required.energy,current:g.required.energy,formalMinimum};
  });
  assert(rows.some(r=>r.current<r.previous));
  const record={source:"adhoc/budget485-scan4-20260913.json",legalChoicesUnchanged:true,movement:current.movementContext,rows};
  fs.writeFileSync(output,JSON.stringify(record,null,2)+"\n",{flag:"wx"});console.log(JSON.stringify(record));
} finally {c.dispose();}
