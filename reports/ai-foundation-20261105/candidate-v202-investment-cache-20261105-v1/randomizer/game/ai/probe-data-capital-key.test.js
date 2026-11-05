'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),probe=require('./probe-capital'),values=require('./state-value');
const read=p=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../..',p)));
const fixtures=['reports/ai-foundation-20261104/two-rounds-teacher-v1/teacher-step-025-20261104-v1.json','adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-035-20261030-v1.json','adhoc/ai-decision-corpus-20261023-v1/case-105-20261023-v1.json'];let quotes=0,controls=0;
for(const fixture of fixtures){const f=read(fixture),state=JSON.parse(f.compositionEnvelope.committedState),p=state.players.players.find(p=>p.id===f.seatId),base=probe.factsFromState(state,p);
 for(const credits of [4,8,12])for(const energy of [4,8,12])for(const publicity of [0,5])for(let data=0;data<=6;data++){
  const facts={...base,player:{...base.player,credits,energy,publicity,availableData:data},investment:(_hand,_publicity,funding)=>funding.resources.availableData};
  const before=JSON.stringify(facts.board),q=probe.quote(facts,values.DEFAULT_WEIGHTS);quotes++;
  for(const c of q.candidates.filter(c=>c.funded&&c.supported)){
   let finalData=data;
   for(const row of c.ledger){if(row.type==='gain_data')finalData+=row.count;
    else if(['scan_planet_sector','choose_nebula_scan','choose_colored_nebula_scan'].includes(row.type))finalData+=row.selected?.data||0;
    else if(row.gain?.availableData)finalData=Math.min(6,finalData+row.gain.availableData);
   }
   assert.equal(c.capitalDelta,finalData-data,JSON.stringify({fixture,credits,energy,publicity,data,id:c.id,ledger:c.ledger,actual:c.capitalDelta,expected:finalData-data}));controls++;
  }
  assert.equal(JSON.stringify(facts.board),before,'wallet-dependent cache queries must not mutate the native geometry');
 }
}
assert(controls>100);console.log(JSON.stringify({walletQuotes:quotes,nativeGeometryMissionControls:controls,dataCapacityIncludedInSharedCapitalKey:true,sourceUnchanged:true}));
