"use strict";
const fs=require('node:fs'),assert=require('node:assert/strict'),kernel=require('../randomizer/game/production-kernel'),rockets=require('../randomizer/game/rockets');
const output='adhoc/goal-movement-timing-cases-20261023-v1.json';assert(!fs.existsSync(output),'Reuse existing geometry checkpoint');const fixture='adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json',f=JSON.parse(fs.readFileSync(fixture)),initial=JSON.parse(f.compositionEnvelope.committedState),cases={};
for(let y=1;y<=4&&Object.keys(cases).length<2;y++)for(let x=0;x<8&&Object.keys(cases).length<2;x++){
 const state=structuredClone(initial),ship=state.pieces.rockets.find(r=>r.playerId===f.seatId),slot=rockets.findAvailableSlotIndex(state.pieces,x,y,ship.id);if(slot==null)continue;rockets.assignRocketToSlot(ship,x,y,slot);
 const c=kernel.getProbeRouteRequirements(state,f.seatId).candidates.find(c=>c.requirementId==='rocket:5:land:neptune:satellite:triton'&&c.path.length);
 if(!c)continue;const path=c.path.map(s=>({...s,rocketId:ship.id})),timing=kernel.comparePlannedMovementTiming(state,f.seatId,c.requirementId,path,0);
 if(!timing.comparable)continue;
 const name=timing.bestPrefixLength?'advance':timing.alternatives.some(a=>a.prefixLength>0&&a.totalPaidPoints>timing.waitPaidPoints)?'wait-cheaper':null;
 if(name&&!cases[name])cases[name]={coordinate:{x,y,slot},requirementId:c.requirementId,path,timing};
}
assert(cases.advance&&cases['wait-cheaper']);fs.writeFileSync(output,JSON.stringify({scope:'Deterministic native geometry on controlled probe coordinates; no AI search or game run.',fixture,seatId:f.seatId,cases},null,2)+'\n');console.log(JSON.stringify(cases));
