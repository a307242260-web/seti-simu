'use strict';
// Literal Native witness for an entirely known development sequence.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119');
const pre=JSON.parse(fs.readFileSync(path.join(dir,'v486-random20-runtime-preflight-20261119-v1.json'))),rt=pre.runtime;
const resume=process.argv[2]==='--resume-native-checkpoint';
const out=path.join(dir,`early-investment-research-order-control-20261119-v${resume?2:1}.json`);assert(!fs.existsSync(out));
const root=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,resume?'early-investment-order-checkpoint-20261119-v1.json.gz':'early-investment-3158182c-endpoint-20261119-v1.json.gz')))).envelope;
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const cards=require(path.join(rt,'randomizer/game/cards/deck'));
const seed=JSON.parse(root.committedState).meta.seed,random=createSeededRandom(seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const [f,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,f))),h,f);
const report=resume?JSON.parse(fs.readFileSync(path.join(dir,'early-investment-research-order-control-20261119-v1.json'))):{schemaVersion:'seti-native-development-order-control-v1',sourceCommit:pre.sourceCommit,seed,
 question:'From the already observed card-income endpoint, can Purple4-first preserve analysis while developing Blue4?',
 plan:['research purple4','play known dlc29 for two data','fill computer5 and6','swap known b3 for visible b9, use its publicity corner','analyze for free','research blue4 in slot1 and place remaining data'],
 maximumInputs:40,inputs:[],newAISearches:0,newFullGames:0,status:'running'};
if(resume){assert.equal(report.status,'failed');report.priorFailure=report.failure;delete report.failure;report.status='running';report.resumedWithoutRepeatedNativeInputs=report.inputs.length;}
const persist=()=>fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');persist();
function state(){const e=c.lifecycle.save().envelope;return e.session?.session?.workingState||JSON.parse(e.committedState);}
function player(){return state().players.players.find(p=>p.id==='player-white');}
function legal(){const x=c.inspect();return x.phase==='awaiting_input'?x.session.decision.choices:c.inputPort.enumerateActions({});}
function doAction(label,predicate){
 assert(report.inputs.length<40);const actions=legal(),matches=actions.filter(predicate);
 assert.equal(matches.length,1,label+' unavailable: '+JSON.stringify(actions.map(a=>({f:a.family,t:a.target,p:a.payload}))));
 const a=matches[0],x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null;
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));report.inputs.push({label,action:a,resources:player().resources,income:player().income});
 fs.writeFileSync(path.join(dir,'early-investment-order-checkpoint-20261119-v1.json.gz'),zlib.gzipSync(JSON.stringify({envelope:c.lifecycle.save().envelope,inputs:report.inputs.length})));
 persist();
}
function research(tile){doAction('research',a=>a.family==='research_tech');doAction('choose '+tile,a=>a.family==='choose_target'&&a.target?.tileId===tile&&(tile!=='blue4'||a.target.blueSlot===1));}
function end(){doAction('end turn',a=>a.family==='end_turn');}
function computer(){doAction('place data',a=>a.family==='place_data');doAction('computer',a=>a.family==='choose_target'&&a.target?.target==='computer');}
try{
 c.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});assert(c.lifecycle.restore(root).ok);assert.deepEqual(c.lifecycle.save().envelope,root);
 if(!resume){
 const p=player();assert.deepEqual(p.hand.map(c=>c.cardId),['dlc_29.png','b_3.webp']);assert.equal(p.resources.publicity,9);
 assert(state().cards.publicCards.some(c=>c?.cardId==='b_9.webp'));
 research('purple4');end();
 const supplier=player().hand.find(c=>c.cardId==='dlc_29.png');
 doAction('play known two-data supplier',a=>a.family==='play_card'&&a.target?.cardInstanceId===supplier.id);
 computer();computer();
 const outgoing=player().hand.find(c=>c.cardId==='b_3.webp');
 doAction('company swap',a=>a.family==='industry'&&a.target?.abilityId==='deepspace_swap_cards');
 doAction('outgoing observed b3',a=>a.family==='choose_card'&&a.target?.cardInstanceId===outgoing.id);
 const incoming=state().cards.publicCards.find(c=>c?.cardId==='b_9.webp');assert(incoming);
 doAction('incoming visible b9',a=>a.family==='choose_card'&&a.target?.cardInstanceId===incoming.id);
 }
 const publicityCard=player().hand.find(c=>c.cardId==='b_9.webp');assert.equal(cards.getDiscardActionRewardForCard(publicityCard)?.gain.publicity,1);
 doAction('known publicity corner',a=>a.family==='card_corner'&&a.target?.cardInstanceId===publicityCard.id);end();
 doAction('free analysis',a=>a.family==='analyze'&&a.payload?.skipCost===true);
 doAction('blue trace slot1',a=>a.family==='choose_target'&&a.target?.alienSlotId===1&&a.target?.traceType==='blue');end();
 research('blue4');
 doAction('place reserved data',a=>a.family==='place_data');doAction('blue slot1',a=>a.family==='choose_target'&&a.target?.target==='blueBonus'&&a.target?.blueSlot===1);end();
 if(legal().some(a=>a.target?.tileId==='a'&&a.target?.choiceId==='final:a'))doAction('same final mark A',a=>a.target?.tileId==='a'&&a.target?.choiceId==='final:a');
 const final=state(),me=player();assert.equal(final.turn.roundNumber,1);assert(legal().some(a=>a.family==='pass'));
 report.boundary={round:1,phase:'before-pass-card-and-income',resources:me.resources,income:me.income,techState:me.techState,hand:me.hand,dataState:me.dataState,
  alienSlots:final.aliens.aliens,rockets:final.pieces.rockets.filter(r=>r.playerId==='player-white'||r.playerColor==='white'),scanState:final.scan};
 report.status='complete';persist();console.log(JSON.stringify({status:report.status,inputs:report.inputs.length,boundary:report.boundary}));
}catch(e){report.status='failed';report.failure={message:e.message,stack:e.stack};persist();console.error(e.stack);process.exitCode=1;}
finally{c.dispose();}
