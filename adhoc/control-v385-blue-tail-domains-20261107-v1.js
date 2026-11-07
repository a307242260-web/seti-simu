'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const cards=require('../randomizer/game/cards/deck'),data=require('../randomizer/game/data');
const [fixture,bench,output,key]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const root=read(fixture).decisionRoots[key].envelope,search=read(bench)[key].search,seatId='player-white',seed='seti-free-analyze-v1';
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function act(id){
 const d=c.inspect().session?.decision,menu=d?.choices||c.inputPort.enumerateActions({}),a=menu.find(a=>a.actionId===id);assert(a,id);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);return a;
}
function snapshot(){
 const e=save(),state=JSON.parse(e.committedState),p=state.players.players.find(p=>p.id===seatId);
 return{e,probes:state.pieces.rockets.filter(r=>r.playerId===seatId).map(r=>[r.id,r.surface]),wallet:p.resources,ready:(c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({})).filter(a=>a.family==='complete_task').map(a=>[a.target.cardInstanceId,a.target.ruleId]), temporary:state.turn.temporaryMovement,
  computer:data.listComputerPlacedTokens(p).map(t=>t.placementSlot),hand:p.hand.map(c=>[c.id,c.cardId,cards.getDiscardActionRewardForCard(c)?.dataCount||0]),
  public:state.cards.publicCards.map(c=>c?.id)};
}
try{
 const paths=new Map([[0,[]]]),queue=[0],rows=[];
 for(const i of queue)for(const e of search.lines[i].edges)if(e.steps?.length&&!paths.has(e.target)){
  paths.set(e.target,[...paths.get(i),...e.steps]);queue.push(e.target);
 }
 for(const n of search.lines)for(const e of n.edges)if(e.resourcePlan?.id==='data:blue:2'&&e.newInputs&&paths.has(n.node)){
  restore(root);for(const id of paths.get(n.node))act(id);
  const before=snapshot(),steps=e.steps.map(act),after=snapshot(),tail=search.lines[e.target];
  rows.push({node:n.node,before,steps,after,tail:tail.edges.map(a=>[a.actionId,a.turnTailPlanValue?.deferredPublicity,a.resourcePlan?.goal.id]),value:tail.value});
 }
 restore(root);
 fs.writeFileSync(output,JSON.stringify({rows,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
 for(const r of rows)console.log(r.node,
  [r.before.wallet.availableData,r.before.wallet.energy,r.before.wallet.publicity,r.before.probes.length,r.before.ready.length].join('/'),
  [r.after.wallet.availableData,r.after.wallet.energy,r.after.wallet.publicity,r.after.probes.length,r.after.ready.length].join('/'),
  r.steps.at(-1).summary,r.after.hand.map(h=>[h[1],h[2]]),r.tail.map(a=>[a[0].split(':')[0],a[1]?'defer':'',a[2]]));
}finally{c.dispose();}
