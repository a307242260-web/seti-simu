'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),z=require('node:zlib');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation');
const file='reports/ai-foundation-20261107/v335-research-layout-key-v1/v323-r3-blue1-purple2-equal-corner-20261107-v1.json.gz',archived=JSON.parse(z.gunzipSync(fs.readFileSync(file))),seat='player-white',arm=archived.branches.find(x=>x.earlyTech==='blue1'&&x.earlySlot===3),e=arm.beforeLastResearch.envelope,seed=JSON.parse(e.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});
k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope,restore=e=>assert(c.lifecycle.restore(e).ok),menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({}),brief=a=>({id:a.actionId,family:a.family,target:a.target,summary:a.summary});
const snap=()=>{const obs=c.projection({role:'player',playerId:seat}).state,p=obs.publicState.players.find(p=>p.playerId===seat);return {score:p.score,credits:p.credits,energy:p.energy,publicity:p.publicity,data:p.availableData,hand:obs.selfState.hand.map(x=>({id:x.id,cardId:x.cardId})),targets:menu().map(brief),scans:p.scans};};
let inputs=0;const apply=a=>{const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));inputs++;};
try{
 restore(e);const before=save(),start=snap();
 const scan=menu().find(x=>x.family==='scan');let scanMenu=null;if(scan){apply(scan);scanMenu=snap();restore(before);}
 const corner=menu().find(x=>x.family==='card_corner'&&x.target.cardInstanceId===start.hand[0].id);assert(corner);apply(corner);const afterCorner=snap();
 restore(before);assert.deepEqual(save(),before);
 const publicCards=()=>{const cards=require('../randomizer/game/cards/deck'),effects=require('../randomizer/game/cards/effects'),o=c.projection({role:'player',playerId:seat}).state;return o.publicState.board.publicCards.map(c=>({cardId:c.cardId,id:c.id,public:c,corner:cards.getDiscardActionRewardForCard(c),price:effects.getCardPrice(c)}));};
 const offer=publicCards(),trades=[],fixed=[];
 for(const state of [before]){
  restore(state);
  for(const a of menu().filter(a=>a.family==='industry'||a.target?.tradeId==='publicity-for-card')){
   restore(state);apply(a);const first=snap();trades.push({first:brief(a),menu:first.targets,public:publicCards()});
  }
 }
 // At most six fixed paths from the same source; no revealed replacement
 // may influence any pick or its publicity estimate.
 for(const mode of ['swap','paid'])for(const known of offer){
  restore(before);const path=[],act=a=>{assert(a);apply(a);path.push(brief(a));};
  const cardId=known.id;
  if(mode==='swap'){
   act(menu().find(a=>a.family==='industry'));
   act(menu().find(a=>a.target?.cardInstanceId===start.hand[0].id));
  }else act(menu().find(a=>a.target?.tradeId==='publicity-for-card'));
  act(menu().find(a=>a.target?.cardInstanceId===cardId));
  const acquired=snap(),beforePlay=save();
  if(mode==='paid'){
   const corner=menu().find(a=>a.family==='card_corner'&&a.target.cardInstanceId===start.hand[0].id);
   assert(corner);act(corner);
  }
  const play=menu().find(a=>a.family==='play_card'&&a.target.cardInstanceId===cardId);
  if(play)act(play);
  const afterPlay=snap();let signalTail=null;
  if(known.cardId==='dlc_19.png'&&play){
   const next=()=>menu().find(a=>a.target?.nebulaId==='sector-1-b'&&a.target?.choiceId==='nebula:sector-1-b');
   const snapshot=JSON.parse(save().session.session.workingState?JSON.stringify(save().session.session.workingState):save().committedState);
   const shortages=Object.fromEntries(Object.entries(snapshot.data.nebulae).map(([id,b])=>[id,b.tokens.filter(t=>!t.replacedByPlayerColor).length]));
   assert.equal(shortages['sector-1-b'],2);assert(Object.entries(shortages).filter(([id,n])=>id!=='sector-1-b').every(([,n])=>n>2));
   act(next());act(next());signalTail={shortages,afterSignals:snap(),envelope:save()};
  }
  fixed.push({mode,offer:known.cardId,path,acquired,afterPlay,signalTail,hadKnownPlay:!!play});
  if(mode==='swap'&&known.corner){
   restore(beforePlay);const use=menu().find(a=>a.family==='card_corner'&&a.target.cardInstanceId===cardId);assert(use);apply(use);
   fixed.at(-1).cornerEndpoint=snap();
  }
 }
 restore(before);assert.deepEqual(save(),before);assert(inputs<=40);
 const out={file,start,scanMenu,afterCorner,offer,trades,fixed,inputs,rootAndRngRestored:true,newAiQueries:0,newAutonomousRuns:0};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({inputs,branches:fixed.map(x=>({mode:x.mode,offer:x.offer,afterPublicity:x.afterPlay.publicity,afterScore:x.afterPlay.score,signals:x.signalTail?.afterSignals,play:x.hadKnownPlay,menu:x.afterPlay.targets.map(a=>a.family+':'+(a.target?.kind||a.target?.choiceId||'')),cornerPublicity:x.cornerEndpoint?.publicity})),rootAndRngRestored:true}));
}finally{c.dispose();}
