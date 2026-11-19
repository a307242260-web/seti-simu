'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const R=path.resolve(__dirname,'..'),D=path.join(R,'reports/ai-foundation-20261119'),read=p=>JSON.parse(fs.readFileSync(p)),unzip=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(R,p)))),pre=read(path.join(D,'v486-random20-runtime-preflight-20261119-v1.json')),rt=pre.runtime;
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random')),{createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const seed='seti-free-analyze-v1',random=createSeededRandom(seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()},{composition:c}=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState});
let count=0;const points=[];
function run(before,actions,expected,name){assert(c.lifecycle.restore(before).ok);for(const action of actions){const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null,menu=d?d.choices:c.inputPort.enumerateActions({}),a=menu.find(a=>a.actionId===action.actionId&&a.actorId===action.actorId);assert(a);assert.deepEqual(a.target,action.target);const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);count++;}assert.deepEqual(c.lifecycle.save().envelope,expected);points.push({name,nativeSessionRngExact:true,inputs:actions.length});}
try{
 c.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});const root=unzip('reports/ai-foundation-20261119/teacher-r4-before-input246-20261119-v1.json.gz').envelope;
 const old=unzip('reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1/teacher-r4-first-plan-control-20261118-v1.json.gz');
 for(const test of old.cases)run(root,test.rows.map(r=>r.action),test.end,test.kind);
 const r=read(path.join(D,'teacher-r4-held-pickup-native-routes-20261119-v1.json'));assert.equal(r.status,'complete');for(const[name,test]of Object.entries(r.cases)){const cp=unzip(test.checkpoint);run(cp.before,cp.actions,cp.envelope,name);}
 assert.equal(count,36);const output=path.join(D,'teacher-r4-held-purpose-native-verification-20261119-v1.json');assert(!fs.existsSync(output));fs.writeFileSync(output,JSON.stringify({schemaVersion:'seti-r4-held-purpose-native-verification-v1',verified:true,nativeInputs:count,points,newAISearches:0,newGames:0},null,2)+'\n');console.log(JSON.stringify({verified:true,nativeInputs:count,endpoints:points.length}));
}finally{c.dispose()}
