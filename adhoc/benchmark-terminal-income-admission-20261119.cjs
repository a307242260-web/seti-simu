'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119');
const load=p=>JSON.parse(fs.readFileSync(p)),m=load(path.join(dir,process.argv[2]||'terminal-choice-candidate-preflight-20261119-v1.json'));
const rt=m.runtime,out=path.join(dir,process.argv[3]||'terminal-choice-admission-board06-20261119-v1.json');assert(!fs.existsSync(out));
for(const [name,h]of Object.entries(m.sourceFiles))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(rt,name))).digest('hex'),m.changedFiles[name]||h,name);
const checkpoint=load(path.join(repo,'reports/research/c014616d.83839572.full.json.failed-checkpoint.json'));
const original=JSON.parse(fs.readFileSync(path.join(repo,'reports/research/c014616d.83839572.full.json.attempts.jsonl'),'utf8').trim().split('\n').at(-1)).search;
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port'));
const {searchDecision}=require(path.join(rt,'randomizer/game/ai/decision-search'));
const values=require(path.join(rt,'randomizer/game/ai/state-value')),agent=require(path.join(rt,'randomizer/game/ai/search-agent'));
const seed=checkpoint.config.seed,seat='player-white',random=createSeededRandom(seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
let port;const report={sourceCommit:m.sourceCommit,changedFiles:m.changedFiles,newAutonomousGames:0,newCommittedGameInputs:0};
try{
 c.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});assert(c.lifecycle.restore(checkpoint.coreState.compositionEnvelope).ok);
 const before=c.lifecycle.save().envelope,evaluate=values.createStateValueEvaluator(seat),started=performance.now();
 port=createAnalysisPort({composition:c,seatId:seat});const root=port.openRoot();
 const r=searchDecision({port,root,evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,budget:{transitions:null,nodes:null,frontier:null,milliseconds:null}});
 const elapsed=performance.now()-started;report.complete=r.complete;report.actionId=r.actionId;report.value=r.value;
 report.milliseconds=elapsed;report.nativeInputs=r.diagnostics.nativeExecutions;report.diagnostics=r.diagnostics;
 report.roots=r.roots;report.sameChosenAction=r.actionId===original.actionId;report.sameValue=r.value===original.value;
 report.sameAllRootValues=original.roots.length===r.roots.length&&original.roots.every(a=>r.roots.some(b=>a.actionId===b.actionId&&a.value===b.value&&a.completion===b.completion));
 report.fixedRunezuChoices=r.lines.flatMap(n=>n.edges||[]).flatMap(e=>e.fixedChoices||[]).filter(p=>p.reason==='fixed-free-runezu-card').length;
 assert.deepEqual(c.lifecycle.save().envelope,before);report.rootAndRngUnchanged=true;
 report.gatePassed=r.complete&&report.nativeInputs<=256&&elapsed<=600;

 assert(report.gatePassed,'single-point gate remains unmet');report.passed=true;
}catch(error){report.passed=false;report.failure={message:error.message,stack:error.stack};process.exitCode=1;}
finally{fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');port?.close();c.dispose();}
console.log(JSON.stringify(report));
