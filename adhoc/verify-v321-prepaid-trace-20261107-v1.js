'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const R='reports/ai-foundation-20261107/',D=R+'income-before-amiba-prepaid-trace-v321-v1/',F='reports/ai-foundation-20261105/third-round-teacher-v1/';
const base='/private/tmp/seti-v320-income-before-amiba-scalar-work-20261107-v1/',next='/private/tmp/seti-v321-income-before-amiba-prepaid-trace-20261107-v1/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest=D+'source-manifest-20261107-v1.json',m=read(manifest);
for(const [p,h] of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))assert.equal(sha(next+p),h,p);
const old=require(base+'randomizer/game/ai/ready-analysis-capital'),candidate=require(next+'randomizer/game/ai/ready-analysis-capital'),weights=require(next+'randomizer/game/ai/state-value').DEFAULT_WEIGHTS;
const cold=read(F+'v320-cold-income-before-amiba-20261107-v1.json'),f=read(cold.fixture);assert.equal(cold.fixtureSha256,sha(cold.fixture));
const s=JSON.parse(f.compositionEnvelope.committedState),player=s.players.players.find(p=>p.id===f.seatId),probe=require(next+'randomizer/game/ai/probe-capital'),facts=probe.factsFromState(s,player);
const source=structuredClone(facts.board.aliens.slots),fixtureBefore=JSON.stringify(facts);
assert.equal(source.length,2);const test=[[],[1],[1,2,3,4,5],[3,1,2],[1,1],[2],[1,3],[1,2,3,4,5,6]];let comparisons=0,nonzero=0;
for(const computerSlots of test)for(const publicity of [0,5,9,10])for(const weight of [weights,{...weights,publicity:.7}])for(const layout of ['first','extra','no-blue','revealed','mixed']){
 const slots=structuredClone(source);
 for(const slot of slots){
  slot.revealed=layout==='revealed'||layout==='mixed'&&slot.slotId===2;
  for(const color of ['yellow','pink','blue'])slot.traces[color]={firstPlaced:layout==='extra'||layout==='no-blue'&&color!=='blue'};
 }
 const q={...facts,terminal:false,passing:false,round:3,analyzeEnergyCost:0,reservedCards:[],computerSlots,
  board:{...facts.board,aliens:{...facts.board.aliens,slots}},player:{...facts.player,publicity}};
 const before=JSON.stringify(q),a=old.prepaidCapital(q,weight),b=candidate.prepaidCapital(q,weight);
 assert.equal(a,b);assert.equal(JSON.stringify(q),before);comparisons++;if(b)nonzero++;
}
assert.equal(JSON.stringify(facts),fixtureBefore);assert(nonzero>0);
const result={scope:'Same Native trace rewards, prefix/computer occupancy, publicity cap, custom arithmetic, unrevealed vs revealed/mixed, no mutations. No search.',manifest,manifestSha256:sha(manifest),comparisons,nonzero,originalFactsUnchanged:true,newAiQueries:0,newAutonomousRuns:0};
fs.writeFileSync(D+'prepaid-trace-controls-20261107-v1.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
