'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation');
const F='reports/ai-foundation-20261105/third-round-teacher-v1/',source=F+'v253-standard-r3-native-verification-prefix-20261106-v1.checkpoint.json',read=p=>JSON.parse(fs.readFileSync(p)),seed='seti-free-analyze-v1',original=read(source).prefixes[125],out=F+'v253-first-tech-pair-native-control-20261106-v1.json';
// Two fixed, predeclared lines. No policy factory, search, guessed future card,
// state merging, or hidden-card-based funding; at most24 Native inputs each.
const result=fs.existsSync(out)?read(out):{scope:'Same complete Native input125 root and RNG; fixed purple1/purple2 research, shared amiba0 and B101/orange2 intentions. This is a bounded counterfactual, not autonomous play or a full-round result.',source,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),branches:{}};
const card=(family,id)=>a=>a.family===family&&a.target?.cardInstanceId===id,family=f=>a=>a.family===f,choice=id=>a=>a.target?.choiceId===id;
for(const tile of ['purple1','purple2']){
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,b=result.branches[tile]||{steps:[],envelope:original};result.branches[tile]=b;assert(c.lifecycle.restore(b.envelope).ok);
 const plan=[card('card_corner','alien-amiba-3-3'),family('research_tech'),a=>a.target?.tileId===tile,choice('confirm:trigger:alien-amiba-1-2:amiba1-purple-tech'),choice('symbol:red_2'),family('end_turn'),choice('final:b'),card('play_card','alien-amiba-0-1'),choice('symbol:blue_1'),family('end_turn'),card('play_card','card-29-pass-2-5'),a=>a.target?.tileId==='orange2',choice('confirm:trigger:alien-amiba-1-2:amiba1-orange-tech'),choice('symbol:orange_1'),family('end_turn'),a=>a.family==='quick_trade'&&a.target?.tradeId==='credits-for-energy',family('scan'),a=>a.target?.nebulaId==='sector-1-a',choice('public:card-50-0:sector-1-a'),a=>a.target?.choiceId==='public:done',a=>a.target?.mode==='launch',...(tile==='purple2'?[a=>a.target?.nebulaId==='sector-2-a']:[]),family('end_turn')];
 try{
  for(let i=b.steps.length;i<plan.length;i++){
   const d=c.inspect().session?.decision,actions=d?.choices||c.inputPort.enumerateActions({}),a=actions.find(plan[i]);
   if(!a){b.pendingIndex=i;b.pendingChoices=actions.map(a=>({actionId:a.actionId,family:a.family,target:a.target,summary:a.summary}));break;}
   const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));b.steps.push(a);b.envelope=c.lifecycle.save().envelope;fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
  }
  const d=c.inspect().session?.decision;b.pendingChoices=(d?.choices||c.inputPort.enumerateActions({})).map(a=>({actionId:a.actionId,family:a.family,target:a.target,summary:a.summary}));b.observation=c.projection({role:'player',playerId:'player-white'}).state;b.allPredeclaredInputsAccepted=b.steps.length===plan.length;
  assert(c.lifecycle.restore(original).ok);assert.deepEqual(c.lifecycle.save().envelope,original);b.rootAndRngRestored=true;
 }finally{c.dispose();}
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({tile,steps:b.steps.length,pending:b.pendingChoices,player:b.observation.publicState.players.find(p=>p.playerId==='player-white')}));
}
