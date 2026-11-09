"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), crypto = require("node:crypto"), path = require("node:path");
const root = process.cwd(), load = p => require(path.resolve(root,p));
const scenario = load("tools/research-human405-full"), runner = load("tools/run_research_validation");
const [recordPath, output] = process.argv.slice(2);
const read = f => JSON.parse(fs.readFileSync(f)), digest=f=>crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const record=read(recordPath), save=read(record.savePath), source=scenario.continuation(scenario.R4_ID);
assert(record.terminal&&record.steps===save.replaySteps.length&&record.resumeStep===259);
assert.deepEqual(record.scenario.continuation,source.provenance);
assert.deepEqual(save.replaySteps.slice(0,259),source.save.replaySteps);
const rawSearches=record.metrics.searches.filter(x=>x.step>259);
assert(rawSearches.length && rawSearches.every(r=>r.complete&&r.diagnostics.nativeExecutions<=256&&r.rootAndSearchMilliseconds<=600));
const maxNative=Math.max(...rawSearches.map(x=>x.diagnostics.nativeExecutions));
const maxMs=Math.max(...rawSearches.map(x=>x.rootAndSearchMilliseconds));
assert(record.wallMsIncludingSourcePrefix<180000);
const env=scenario.createEnvironment({},record.scenario);
const equality=(a,b)=>{assert.equal(a.committedState,b.committedState);assert.deepEqual(a.session,b.session);};
try {
 scenario.initialize(env,{seed:record.seed,activePlayerCount:4,compactReplay:true},record.scenario,{checkpointFromSave:runner.checkpointFromSave});
 const round=record.roundEnds.at(-1),cp=read(round.checkpointPath);
 for(const [i,step] of save.replaySteps.entries()){
  if(i<259)continue;
  if(i+1===round.beforeInput)equality(env.createCheckpoint().coreState.compositionEnvelope,cp.coreState.compositionEnvelope);
  const legal=env.legalActions().find(x=>x.actionId===step.action.actionId&&(x.actorId??x.actorPlayerId)===step.actorPlayerId);
  assert(legal,"missing legal native input "+(i+1));
  for(const k of ["schemaVersion","family","phase","target","payload"])assert.deepEqual(legal[k],step.action[k],`${i+1}:${k}`);
  const result=env.step(legal);assert(result.ok,"failed native input "+(i+1));
 }
 assert(env.isTerminal());
 equality(env.createCheckpoint().coreState.compositionEnvelope,save);
 assert.deepEqual(runner.summaryOf(env.observe()),record.summary);
 const end=JSON.parse(save.committedState),final=end.match.finalScores.find(p=>p.playerId==="player-white");
 const proof={scenario:record.scenario.id,sourcePrefix:259,suffix:record.steps-259,rootAndRoundEndExact:true,terminalStateSessionRngExact:true,
  totalInputs:record.steps,whiteSearches:rawSearches.length,maxNative,maxMs,resumedWallMs:record.wallMs,totalWallMs:record.wallMsIncludingSourcePrefix,
  roundEndScores:record.roundEnds.map(r=>r.score),whiteFinal:{total:final.totalScore,board:final.baseScore,tile:final.tileScore,card:final.cardScore},
  recordPath,recordSha256:digest(recordPath),savePath:record.savePath,saveSha256:digest(record.savePath),
  tracePath:record.agentTracePath,traceSha256:digest(record.agentTracePath)};
 fs.writeFileSync(output,JSON.stringify(proof,null,2)+"\n",{flag:"wx"});
 console.log(JSON.stringify(proof));
} finally {env.dispose();}
