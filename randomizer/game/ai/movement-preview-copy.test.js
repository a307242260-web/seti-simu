'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const native=require('../production-kernel'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const read=p=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../..',p))),before=read('reports/ai-foundation-20261023/movement-copy-control-before-20261029-v1.json'),projected=read('reports/ai-foundation-20261023/movement-copy-projections-before-20261029-v1.json'),captured=read('adhoc/six-greedy-plan-fixtures-20261028-v1.json'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
for(const row of before.rows){
 const f=row.name==='advance'?captured.cases.advance:read(`adhoc/ai-decision-corpus-20261023-v1/case-${row.name}-20261023-v1.json`);assert.equal(sha(JSON.stringify(f)),row.fixtureSha256);
 const state=freeze(f.compositionEnvelope.session?.session?.workingState||JSON.parse(f.compositionEnvelope.committedState)),original=JSON.stringify(state);
 for(const c of row.cases){assert.deepEqual(native.comparePlannedMovementTiming(state,f.seatId,c.requirementId,c.path,0),c.value);assert.equal(JSON.stringify(state),original);}
 const seed=f.source.seed,k=native.createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const comp=k.composition;assert(comp.lifecycle.restore(f.compositionEnvelope).ok);const saved=comp.lifecycle.save().envelope,observation=comp.projection({role:'player',playerId:f.seatId}).state;
 assert.equal(sha(JSON.stringify(observation)),projected.rows.find(r=>r.name===row.name).observationSha256);assert.deepEqual(comp.lifecycle.save().envelope,saved);comp.dispose();
}
// Reusing geometry across economic changes is independent of full game-state identity.
{
 const f=read('adhoc/ai-decision-corpus-20261023-v1/case-152-20261023-v1.json'),state=JSON.parse(f.compositionEnvelope.committedState),c=before.rows.find(r=>r.name==='152').cases[0],key=s=>native.plannedMovementTimingKey(s,f.seatId,c.requirementId,c.path,0),original=key(state),economic=structuredClone(state),p=economic.players.players.find(p=>p.id===f.seatId);
 p.resources.credits+=7;p.resources.energy+=2;p.resources.score+=3;p.resources.publicity+=1;p.income.energy+=1;p.hand.pop();p.reservedCards=[];p.dataState.poolTokens=[];
 assert.equal(key(economic),original);assert.deepEqual(native.comparePlannedMovementTiming(economic,f.seatId,c.requirementId,c.path,0),c.value);
 for(const mutate of [s=>s.solarSystem.rotation.wheel1Steps++,s=>s.pieces.rockets[0].sectorX++,s=>s.players.players.find(p=>p.id===f.seatId).techState.disabledTiles.orange2=true,s=>s.turn.cardTurnEventBonuses.push({playerId:f.seatId,movementModifiers:{ignoreAsteroidRestriction:true}}),s=>s.turn.turnNumber++]){const changed=structuredClone(state);mutate(changed);assert.notEqual(key(changed),original);}
 assert.notEqual(native.plannedMovementTimingKey(state,f.seatId,c.requirementId,c.path,1),original);
}
console.log(JSON.stringify({movementPreviewCopy:'passed',nativeTimingCases:12,fullProjectionHashes:4,frozenRootsUnchanged:true,geometryCacheInvalidation:true}));

// Geometric previews omit journal snapshots; actual rotation keeps them.
{
 const turnFlow=require('../turn-flow'),f=read('adhoc/ai-decision-corpus-20261023-v1/case-152-20261023-v1.json'),state=JSON.parse(f.compositionEnvelope.committedState),normal=structuredClone(state),preview=structuredClone(state),a=turnFlow.rotateSolarSystem(normal,1,f.seatId),b=turnFlow.rotateSolarSystem(preview,1,f.seatId,{captureSnapshots:false});
 assert(a.ok&&b.ok);assert(a.moved.length>0);assert.deepEqual(preview,normal);
 assert(a.moved.every(m=>m.beforeRocket&&m.beforePlayer));assert(b.moved.every(m=>m.beforeRocket===null&&m.beforePlayer===null));
 const stripped=a.moved.map(m=>({...m,beforeRocket:null,beforePlayer:null}));assert.deepEqual(b,{...a,moved:stripped});
}
