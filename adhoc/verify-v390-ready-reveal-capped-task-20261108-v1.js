'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {ALIEN_TYPE_IDS}=require('../randomizer/game/aliens/catalog'),alien=require('../randomizer/game/aliens/state'),jiuzhe=require('../randomizer/game/aliens/jiuzhe');
const [fixture,graph,out]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p)),seed='seti-free-analyze-v1',seat='player-white';
const label='early-A0-analyzed',source=read(fixture).decisionRoots[label].envelope;
const edges=read(graph)[label].search.sharedPrefixGraph.edges,byTarget=new Map(edges.map(e=>[e.to,e]));
// V389 Native input 114 was the blue placement with one ready, hidden species.
const firstBlue=edges[113];
assert(firstBlue.actionId.startsWith('place_data:'));
const ancestors=n=>byTarget.has(n)?[...ancestors(byTarget.get(n).from),byTarget.get(n).actionId]:[];
function kernel(){
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
   projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
 k.newGame({seed});return k.composition;
}
const c=kernel(),independent=kernel(),save=(k=c)=>k.lifecycle.save().envelope;
const get=e=>e.session?.session?.workingState||JSON.parse(e.committedState),owner=s=>s.players.players.find(p=>p.id===seat);
const restore=(e,k=c)=>{assert(k.lifecycle.restore(e).ok);assert.deepEqual(save(k),e);};
const menu=(k=c)=>k.inspect().session?.decision?.choices||k.inputPort.enumerateActions({});
function submit(a,k=c){
 assert.deepEqual(menu(k).find(q=>q.actionId===a.actionId),a);
 const d=k.inspect().session?.decision,r=d?k.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):
   a.phase==='quick'?k.inputPort.submitQuickAction(a):k.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));
}
const task=a=>a.family==='complete_task'&&a.target.cardInstanceId==='card-15-0';
const species=require('../randomizer/game/aliens'),speciesKeys=['jiuzhe','banrenma','aomomo','yichangdian','fangzhou','runezu','chong'];
const sorted=o=>Array.isArray(o)?o.map(sorted):o&&typeof o==='object'?Object.fromEntries(Object.keys(o).sort().map(k=>[k,sorted(o[k])])):o;
const selectedPrefix=[];
function planner(origin){
 restore(origin);const p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 try{
  p.setResourcePlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});p.setCardPickPlanning(true);
  const root=p.openRoot(),q=p.resourceSpec(root);
  assert(root.legalActions.some(task));assert.deepEqual(save(),origin);
  return {plan:q?.deferredCappedTask||null,publicAlien:root.observation.publicState.board.aliens.slots.find(x=>Number(x.slotId)===2)};
 }finally{p.close();}
}
function scoreBoundary(e){
 const s=get(e),p=owner(s);
 return {wallet:p.resources,sector:s.data,tech:s.tech,rng:s.meta.rngState,
  hands:s.players.players.map(x=>x.hand),aliens:s.aliens,turn:s.turn,
  menu:menu().filter(a=>!task(a)&&!a.target.choiceId?.includes('task:card-15-0')).map(a=>[a.family,a.target,a.payload])};
}
try{
 restore(source);
 for(const id of ancestors(firstBlue.from)){const a=menu().find(q=>q.actionId===id);assert(a,id);selectedPrefix.push(a);submit(a);}
 const base=save(),baseState=get(base),original=baseState.aliens.aliens['2'].assignedAlienId;
 assert(alien.isAlienReadyToReveal(baseState.aliens.aliens['2'])&&owner(baseState).completedTaskCount===0);
 assert.equal(owner(baseState).resources.publicity,10);
 const controls={};
 for(const id of ALIEN_TYPE_IDS.filter(x=>x!=='阿米巴')){
  const origin=structuredClone(base),s=get(origin);
  if(id!==original){
   // Only the test authority changes the hidden assignment. The planner
   // never receives this identifier from the viewer projection.
   s.aliens.aliens['2'].assignedAlienId=id;
   s.aliens.revealPoolAlienIds=ALIEN_TYPE_IDS;
   const k=speciesKeys.find(k=>species[k].ALIEN_ID===id);
   s.aliens[k].initialConfiguration=species[k].createInitialConfiguration(createSeededRandom('v390-ready-reveal-test:'+k),s.players.players);
   origin.committedState=JSON.stringify(sorted(s));
  }
  const tested=planner(origin);assert(tested.plan);assert(!tested.publicAlien.revealed&&!tested.publicAlien.alienId);
  const witnesses={};
  for(const claim of [false,true]){
   restore(origin);const steps=[];
   const choose=test=>{const a=menu().find(test);assert(a);steps.push(a);submit(a);return a;};
   if(claim)choose(task);
   choose(a=>a.family==='end_turn');
   if(menu().some(a=>a.target?.choiceId?.startsWith('skip:task:card-15-0')))choose(a=>a.target.choiceId.startsWith('skip:task:card-15-0'));
   const endpoint=save(),view=scoreBoundary(endpoint);
   restore(origin,independent);for(const a of steps)submit(a,independent);assert.deepEqual(save(independent),endpoint);
   witnesses[claim?'claim':'keep']={steps,endpoint,view};
  }
  const {claim,keep}=witnesses;
  assert.equal(claim.view.aliens.aliens['2'].alienId,id);assert.equal(keep.view.aliens.aliens['2'].alienId,id);
  assert.deepEqual(claim.view,keep.view);
  if(id==='九折'){
   const threshold=Math.min(...jiuzhe.CARD_DEFINITIONS.filter(c=>c.condition.type==='completedTasks').map(c=>c.condition.count));
   const near=structuredClone(origin),x=get(near);owner(x).completedTaskCount=threshold-1;near.committedState=JSON.stringify(sorted(x));
   assert.equal(planner(near).plan,null);
  }
  controls[id]={plan:tested.plan,origin,claim:{steps:claim.steps,endpoint:claim.endpoint},keep:{steps:keep.steps,endpoint:keep.endpoint}};
 }
 restore(source);fs.writeFileSync(out,JSON.stringify({source,selectedPrefix,base,original,controls,rootRestored:true,independentStateSessionRng:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
 console.log('second-species native reveal parity',Object.keys(controls));
}finally{c.dispose();independent.dispose();}
