'use strict';
const fs=require('node:fs'),path=require('node:path');
const load=n=>require(path.resolve(n)),raw=JSON.parse(fs.readFileSync(process.argv[2]));
const e=raw.compositionEnvelope,s=e.session?.session?.workingState||JSON.parse(e.committedState),id=raw.seatId;
const demand=load('randomizer/game/ai/resource-demand'),pc=load('randomizer/game/ai/probe-capital');
const w=load('randomizer/game/ai/state-value').DEFAULT_WEIGHTS,cards=load('randomizer/game/cards/deck');
const p=s.players.players.find(p=>p.id===id);
const menu=p.hand.map(c=>({family:'choose_card',actionId:c.id,target:{choiceId:'income:'+c.id,cardInstanceId:c.id}}));
const results=p.hand.map(c=>({name:c.cardId,move:cards.getDiscardActionMoveRewardForCard(c),income:cards.getIncomeGainForCard(c),value:demand.incomeCardValue(s,id,c),computer:demand.computerIncomeValue(s,id,c)}));
const routes=pc.requirements(pc.factsFromState(s,p)).filter(g=>g.endpointFamily==='land').map(g=>{
 const cost={...g.endpointFacts.cost,energy:(g.endpointFacts.cost.energy||0)+g.route.cost},floor=g.endpointFacts.rewards.reduce((n,x)=>n+(x.type==='gain_resources'?(x.options?.gain?.score||0):0),0);
 const wallet={credits:p.income.credits,energy:p.income.energy},bill=k=>pc.funding({...wallet,[k]:wallet[k]+2},cost,w);
 return {planet:g.planetId,cost,floor,credits:bill('credits'),energy:bill('energy')};
});
console.log(JSON.stringify({results,routes,chosen:demand.incomeChoice({state:s,seatId:id,goal:{required:{}},actions:menu})},null,2));
