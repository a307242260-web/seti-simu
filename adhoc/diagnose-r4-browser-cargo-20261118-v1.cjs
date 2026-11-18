'use strict';
// One fixed publicly known shipment, not an AI search or a game.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const R=path.resolve(__dirname,'..'),M=path.join(R,'reports/ai-foundation-20261118'),out=path.join(M,'r4-browser-cargo-diagnosis-20261118-v1.json.gz');
const manifest=JSON.parse(fs.readFileSync(path.join(M,'r4-main-owned-v513-source-20261118-v1.json'))),runtime=manifest.sealedRoot,sha=x=>crypto.createHash('sha256').update(x).digest('hex');
if(fs.existsSync(out)){console.log('REUSE',out);process.exit(0);}
const source={};for(const [name,hash] of Object.entries(manifest.paths)){assert.equal(sha(fs.readFileSync(path.join(runtime,name))),hash);source[name]=hash;}
process.chdir(runtime);
const {open}=require(path.join(R,'reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1/native-root-harness-20261118-v1.cjs'));
const {createAnalysisPort}=require(path.join(runtime,'randomizer/game/ai/analysis-port'));
const fixture=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(runtime,'randomizer/game/ai/fixtures/earned-pickup-task-20261118-v1.json.gz')))),m=open(fixture.root),trace=[],result={kind:'One fixed-plan Native cargo diagnostic; no AI search or game',sourceFiles:source,fixtureSha256:source['randomizer/game/ai/fixtures/earned-pickup-task-20261118-v1.json.gz'],trace};
const jobs=()=>structuredClone(m.state().aliens.chong.transportTasksByRocketId),state=()=>structuredClone(m.save());
function apply(action,stage){const before=state(),prior=jobs(),actual=m.apply(action);trace.push({stage,action:actual,before,after:state(),beforeJobs:prior,afterJobs:jobs()});fs.writeFileSync(out,z.gzipSync(JSON.stringify(result)));}
try{
 for(const a of fixture.actions)apply(m.menu().find(x=>x.actionId===a.actionId),'known-fixture-prefix');
 apply(m.menu().find(a=>a.target.fossilId==='fossil_06'),'known-F06-pickup');
 const before=state(),initialJobs=jobs(),p=createAnalysisPort({composition:m.c,seatId:'player-white',maxCacheEntries:0});result.root=before;result.initialJobs=initialJobs;
 let expansion;
 try{
  p.setResourcePlanning(true);p.setCardPickPlanning(true);p.setMovementPlanning(true);p.setDecisionPlanning({scanPlanning:true,finalMarkPlanning:true});
  const root=p.openRoot(),spec=p.resourceSpec(root),plan=spec.plans.find(p=>p.goal.fossilId==='fossil_07');assert(plan,'Existing declared F07 shipment must exist');result.plan=plan;
  expansion=p.expandResourcePlan(root,plan,()=>null);result.expansion={complete:expansion.complete,goalStatus:expansion.goalStatus,submissions:expansion.submissions,actions:expansion.prefixes.map(x=>x.action),diagnostics:p.getDiagnostics()};assert.deepEqual(state(),before,'Private plan cannot mutate live Native root');
 }finally{p.close();}
 // Persist before any schema assertion so diagnostic work is never lost.
 fs.writeFileSync(out,z.gzipSync(JSON.stringify(result)));console.log(JSON.stringify({output:out,goal:result.plan.goal.id,fossil:result.plan.goal.fossilId,claimCard:result.plan.goal.cardId,plannedInputs:result.expansion.actions.length,traceInputs:trace.length}));
}catch(e){result.failure={message:e.message,stack:e.stack};fs.writeFileSync(out,z.gzipSync(JSON.stringify(result)));throw e;}
finally{m.dispose();}
