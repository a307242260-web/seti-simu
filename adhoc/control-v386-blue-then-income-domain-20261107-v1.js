'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {plan:movement}=require('../randomizer/game/ai/goal-movement'),{getProbeRouteRequirements}=require('../randomizer/game/production-kernel'),demand=require('../randomizer/game/ai/resource-demand');
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
  const p=search.lines[e.target],income=p.edges[0];
  if(p.edges.length!==1||income.resourcePlan?.id!=='data:income:4'||!income.steps)continue;
  restore(root);for(const id of paths.get(n.node))act(id);
  const before=snapshot(),blue=e.steps.map(act),afterBlue=snapshot(),paid=income.steps.map(act),afterIncome=snapshot();
  const next=search.lines[income.target],end=next.edges.find(a=>a.actionId.startsWith('end_turn:'));
  assert(end);
  const endAction=act(end.actionId),endPending=c.inspect().session?.decision?.choices;
  const move=snapshot=>{
    const state=JSON.parse(snapshot.e.committedState),owner=state.players.players.find(p=>p.id===seatId);
    const m=movement({state,seatId,actions:[],status:'stable',objectiveOnly:true,endpoints:()=>getProbeRouteRequirements(state,seatId).candidates});
    const tool=demand.movementToolPlan(state,owner);
    return {reason:m?.reason,objective:m?.chosenGoal?.id,path:m?.intent?.path,tool:tool.selected,capital:demand.planningCapital(state,owner)};
  };
  rows.push({node:n.node,before,afterBlue,afterIncome,blue,paid,endAction,endPending,reference:next.edges.map(a=>[a.actionId,a.turnTailPlanValue?.proof]),movement:[before,afterBlue,afterIncome].map(move)});
 }
 restore(root);
 fs.writeFileSync(output,JSON.stringify({rows,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
 for(const r of rows)console.log(r.node,[r.before,r.afterBlue,r.afterIncome].map(x=>[x.probes.length,x.wallet.credits,x.wallet.energy,x.wallet.availableData,x.wallet.publicity,x.ready.length]),r.movement.map(x=>[x.reason,x.objective,x.tool?.preparationDebt,x.capital]),r.reference);
}finally{c.dispose();}
