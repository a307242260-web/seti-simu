'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const amiba=require('../randomizer/game/aliens/amiba'),end=require('../randomizer/game/end-game-scoring'),effects=require('../randomizer/game/cards/effects');
const demand=require('../randomizer/game/ai/resource-demand'),trades=require('../randomizer/game/actions/quick-trades');
const [orderFile,walletFile,output]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p)),pair=read(orderFile).rows['blue-then-red'];
const seatId='player-white',p=s=>s.players.players.find(x=>x.id===seatId);
function score(s){
 const player=p(s),rows=end.computePlayerFinalScore({...s,players:s.players.players,cardEffects:effects,
  getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},player);
 const trace=end.getPlayerTraceCounts(player,s.aliens),species=Object.fromEntries(['yellow','pink','blue'].map(k=>[k,amiba.countTraceMarkers(s.aliens,player,k)]));
 return{score:rows.totalScore,tileScores:rows.tileScoresById,trace,species};
}
const source=JSON.parse(pair.first.e.committedState),sourceBefore=JSON.stringify(source),aliased=structuredClone(source),slot=aliased.aliens.amiba.revealedSlotId;
const cloned=amiba.migrateLegacyTraces(aliased.aliens,slot,{takeSequence:()=>aliased.meta.sequences.alienEntity++});
assert(cloned>0);const before=score(source),migrated=score(aliased);
assert.deepEqual(migrated,before);assert.equal(JSON.stringify(source),sourceBefore);
const settled=score(JSON.parse(pair.second.e.committedState));assert.equal(settled.score-before.score,2);
const actual=structuredClone(source);
assert(amiba.placeAmibaTrace(actual.aliens,slot,'pink',1,p(actual),{sequence:actual.meta.sequences.alienEntity++}).ok);
amiba.migrateLegacyTraces(actual.aliens,slot,{takeSequence:()=>actual.meta.sequences.alienEntity++});
const real=score(actual);assert.equal(real.trace.pink,before.trace.pink+1);assert.equal(real.species.pink,before.species.pink+1);
const extra=structuredClone(aliased),state=require('../randomizer/game/aliens/state');
assert(state.addExtraTrace(extra.aliens,slot,'pink',p(extra).color).ok);
const separate=score(extra);assert.equal(separate.trace.pink,before.trace.pink+1);assert.equal(separate.species.pink,before.species.pink+1);
const wallet=read(walletFile);
const scan={kind:'scan',required:{credits:1,energy:2}},launch={...scan,launch:true,required:{credits:1,energy:3}};
const funds=[];
for(const [label,row] of [['base',wallet.base],...Object.entries(wallet.rows).map(([label,r])=>[label,r.later])]){
 const s=JSON.parse(row.e.committedState),x=p(s);
 const transitions=['credits-for-energy','energy-for-credit','cards-for-credit','cards-for-energy'].map(id=>trades.getTradeAction(id));
 const can=(goal)=>{
  const known=new Set(),stack=[[x.resources.credits,x.resources.energy,x.hand.length]];
  for(let a;a=stack.pop();){
   if(known.has(a.join(',')))continue;known.add(a.join(','));
   const [credits,energy,handSize]=a,w={credits,energy,handSize};
   if(credits>=goal.required.credits&&energy>=goal.required.energy)return true;
   for(const t of transitions)if(Object.entries(t.cost).every(([k,n])=>w[k]>=n))
    stack.push(a.map((v,i)=>v-(t.cost[['credits','energy','handSize'][i]]||0)+(t.gain[['credits','energy','handSize'][i]]||0)));
  }
  return false;
 };
 const actualBase=can(scan),actualLaunch=can(launch),plannedBase=demand.capacity(s,seatId,scan),plannedLaunch=demand.capacity(s,seatId,launch);
 assert(actualBase&&plannedBase&&!actualLaunch&&!plannedLaunch);
 funds.push({label,actualBase,actualLaunch,plannedBase,plannedLaunch});
}
fs.writeFileSync(output,JSON.stringify({before,migrated,settled,real,separate,cloned,funds,sourceUnchanged:true},null,2)+'\n',{flag:'wx'});
console.log('legacy copy unchanged; real face and extra count; common scan retained and impossible scan+launch rejected');
