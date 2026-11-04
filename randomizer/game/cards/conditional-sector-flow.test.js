'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),data=require('../data'),deck=require('./deck');
const read=n=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../reports/ai-foundation-20261104/two-rounds-teacher-v1',`teacher-step-${n}-20261104-v1.json`)));
function open(f,envelope=f.compositionEnvelope){const seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});assert(k.composition.lifecycle.restore(envelope).ok);return k.composition;}
const legal=c=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const state=c=>{const e=c.lifecycle.save().envelope;return e.session?.session?.workingState||JSON.parse(e.committedState);};
function submit(c,a){assert(a);const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));}
const own=(s,id)=>s.players.players.find(p=>p.id===id),count=(s,id,nebulaId)=>(data.getSectorRanking(s.data,nebulaId).find(r=>r.playerId===id||r.playerColor===own(s,id).color)?.count||0);
function normalize(e){const names=new Map();return JSON.parse(JSON.stringify(e).replace(/effect-session-[0-9]+(?=[:"\\])/g,n=>{if(!names.has(n))names.set(n,'session-'+names.size);return names.get(n);}));}
// Real teacher card/board: two qualified sectors, one of them one scan from
// completion. Every sector must receive exactly one signal before one settle.
const f=read('084'),c=open(f);let cold;
try{const before=c.lifecycle.save().envelope,s=state(c),p=own(s,f.seatId),startData=p.resources.availableData,signals=count(s,f.seatId,'sector-4-b');const card=p.hand.find(c=>c.cardId==='dlc_37.png');submit(c,legal(c).find(a=>a.family==='play_card'&&a.target.cardInstanceId===card.id));
 const pending=c.lifecycle.save().envelope;cold=open(f,pending);const a=legal(c).find(a=>a.target?.nebulaId==='sector-2-a');submit(c,a);submit(cold,legal(cold).find(x=>x.actionId===a.actionId));
 assert.equal(count(state(c),f.seatId,'sector-4-b'),signals+1,'DLC37 must also scan its other initially qualified sector');assert.equal(own(state(c),f.seatId).resources.availableData,startData,'DLC37 never gains data');assert.deepEqual(normalize(c.lifecycle.save().envelope),normalize(cold.lifecycle.save().envelope));
 for(let n=0;c.inspect().phase==='awaiting_input';n++){assert(n<12);const options=legal(c);assert(!options.some(a=>a.target?.nebulaId),'each all-matching sector is consumed only once');const chosen=options[0];submit(c,chosen);submit(cold,legal(cold).find(a=>a.actionId===chosen.actionId));}
 assert.equal(data.listSectorWinRecords(state(c).data,'sector-2-a').length,1,'settlement occurs once after all obligations');assert.equal(count(state(c),f.seatId,'sector-4-b'),signals+1);assert.deepEqual(normalize(c.lifecycle.save().envelope),normalize(cold.lifecycle.save().envelope));assert(c.lifecycle.restore(before).ok);assert.deepEqual(c.lifecycle.save().envelope,before);
}finally{c.dispose();cold?.dispose();}
// Controlled card replacement plus one native signal placement on a real earlier board: DLC22 has two scans of
// one selected qualifying sector, without generic repeat expansion or data.
const g=read('072'),e=structuredClone(g.compositionEnvelope),s=JSON.parse(e.committedState),p=own(s,g.seatId),old=p.hand.find(c=>c.cardId==='dlc_37.png'),entry=deck.CARD_CATALOG.find(c=>c.card_id==='dlc_22.png');Object.assign(old,{cardId:entry.card_id,price:entry.price,incomeCode:entry.income_code});assert(data.replaceNextNebulaDataToken(s.data,'sector-2-a',p,{root:s}).ok);e.committedState=JSON.stringify(s);const repeat=open(g,e);
try{const start=state(repeat),n=count(start,g.seatId,'sector-2-a'),d=own(start,g.seatId).resources.availableData;assert(n>=3);submit(repeat,legal(repeat).find(a=>a.family==='play_card'&&a.target.cardInstanceId===old.id));submit(repeat,legal(repeat).find(a=>a.target?.nebulaId==='sector-2-a'));assert.equal(count(state(repeat),g.seatId,'sector-2-a'),n+2,'DLC22 must scan the selected sector twice');assert.equal(own(state(repeat),g.seatId).resources.availableData,d);
}finally{repeat.dispose();}
// Zero or one qualifying sector is fixed work, with no invented target and
// no extra owner decision. This also catches re-enumeration of new signals.
for(const one of [false,true]){const e=structuredClone(read('072').compositionEnvelope),s=JSON.parse(e.committedState),p=own(s,'player-white');for(const [id,bucket]of Object.entries(s.data.nebulae))for(const t of bucket.tokens)if(t.replacedByPlayerId===p.id&&(!one||id!=='sector-2-a')){delete t.replacedByPlayerId;delete t.replacedByPlayerColor;delete t.replacementOrder;}const c=open(read('072'),{...e,committedState:JSON.stringify(s)});
 try{const n=count(state(c),p.id,'sector-2-a'),card=p.hand.find(c=>c.cardId==='dlc_37.png');submit(c,legal(c).find(a=>a.family==='play_card'&&a.target.cardInstanceId===card.id));assert.equal(c.inspect().phase,'idle');assert.equal(count(state(c),p.id,'sector-2-a'),one?n+1:n);}finally{c.dispose();}}
console.log(JSON.stringify({allMatchingNativeTeacher:true,repeatWithinOneSector:true,noDataGain:true,settleOnce:true,coldRestoreAndRng:true}));
