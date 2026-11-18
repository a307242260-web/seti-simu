process.chdir(require("node:path").resolve(process.argv[2]||process.cwd()));
'use strict';
const fs=require('node:fs'),z=require('node:zlib'),assert=require('node:assert/strict'),{open}=require('./native-root-harness-20261118-v1.cjs');
const D='reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1',out=D+'/pickup-task-all-hidden-identities-20261118-v1.json.gz';assert(!fs.existsSync(out));
const source=JSON.parse(z.gunzipSync(fs.readFileSync(D+'/teacher-r4-point289-end-task-control-20261118-v1.json.gz'))),rows=[];
const chong=require(require('node:path').resolve('randomizer/game/aliens/chong')),effects=require(require('node:path').resolve('randomizer/game/cards/effects')),taskId='b117-orbit-land-count-task';
const ordered=x=>Array.isArray(x)?x.map(ordered):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const base=source.root.session.session.workingState,taskCard=base.players.players.find(p=>p.id==='player-white').reservedCards.find(c=>effects.getCardModel(c)?.tasks?.some(t=>t.id===taskId));assert(taskCard);
const rename=(value,id)=>{if(typeof value==='string')return value==='fossil_06'?id:value===id?'fossil_06':value;if(Array.isArray(value))return value.map(v=>rename(v,id));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[rename(k,id),rename(v,id)]));return value;};
for(const id of chong.FOSSIL_IDS.filter(id=>id!=='fossil_07')){
 const root=structuredClone(source.root);const modify=s=>{s.aliens.chong=rename(s.aliens.chong,id)};const committed=JSON.parse(root.committedState);modify(committed);root.committedState=JSON.stringify(ordered(committed));root.session=rename(root.session,id);
 const m=open(root);try{
  const before=m.save(),prior=structuredClone(m.player()),markerBefore=structuredClone(m.state().planets),rngBefore=structuredClone(m.state().meta.rngState),v=require(require('node:path').resolve('randomizer/game/ai/state-value')).createStateValueEvaluator('player-white'),valueBefore=v(m.owner('player-white')),steps=[];
  assert.equal(valueBefore,222);assert(m.menu().some(a=>a.target.fossilId===id));
  const take=predicate=>{const action=m.act(predicate[0],predicate[1]);steps.push({action,after:m.save(),facts:m.facts(),value:v(m.owner('player-white'))});};
  take(['choose_target',a=>a.target.fossilId===id]);
  assert.deepEqual(m.player(),prior,'pickup writes no player ledger');assert.deepEqual(m.state().planets,markerBefore,'pickup cannot remove earned planet markers');assert.deepEqual(m.state().meta.rngState,rngBefore,'pickup draws no randomness');assert.equal(steps[0].value,valueBefore);
  take(['end_turn',()=>true]);assert(m.menu().some(a=>a.target.choiceId===`confirm:task:${taskCard.id}:${taskId}`));
  take(['accept_optional_effect',a=>a.target.choiceId===`confirm:task:${taskCard.id}:${taskId}`]);
  assert.equal(m.player().resources.score,prior.resources.score+3);assert.equal(m.player().resources.credits,prior.resources.credits+1);assert.equal(m.player().completedTaskCount,prior.completedTaskCount+1);assert.equal(steps[2].value,230);
  assert.deepEqual(m.state().meta.rngState,rngBefore);rows.push({hiddenFossil:id,root:before,steps,knownTaskDelta:8,pickupChangesNoPlayerOrPlanetLedger:true,pickupRngUnchanged:true});
 }finally{m.dispose()}
}
fs.writeFileSync(out,z.gzipSync(JSON.stringify({kind:'Native hidden-assignment controls, not a policy look-ahead or autonomous game',sourceCommit:'ecb735cf7ba5f285f9d0e87842772871c4eab29e',scope:'All6 unseen uncarried identities at this public ledger. fossil_07 is already transported and is never reassigned.',cases:rows.length,nativeInputs:rows.length*3,rows,rootControlsMutuallyIndependent:true,summary:'Native pickup changes only fossil transport state/token, not the earned planet-task condition or wallet. Every assignment preserves222 before claiming and reaches230 after the same free B117 claim.'})));
console.log(JSON.stringify({cases:rows.length,nativeInputs:rows.length*3,delta:8,values:rows.map(r=>[r.hiddenFossil,r.steps.map(s=>s.value)]),sourceAndRngGuardsPassed:true}));
