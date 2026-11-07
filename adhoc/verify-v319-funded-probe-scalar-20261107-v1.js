'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),Module=require('node:module');
const R='reports/ai-foundation-20261107/',D=R+'income-before-amiba-probe-v319-v1/',F='reports/ai-foundation-20261105/third-round-teacher-v1/';
const old='/private/tmp/seti-v318-teacher125-research-quotes-20261107-v1/',next='/private/tmp/seti-v319-income-before-amiba-probe-20261107-v1/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest=D+'source-manifest-20261107-v1.json',m=read(manifest);
for(const[n,h]of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))assert.equal(sha(next+n),h,n);
const reference=require(old+'randomizer/game/ai/probe-capital'),candidate=require(next+'randomizer/game/ai/probe-capital'),weights=require(next+'randomizer/game/ai/state-value').DEFAULT_WEIGHTS;
const values0=require(old+'randomizer/game/ai/state-value'),values1=require(next+'randomizer/game/ai/state-value');
const demandFile=require.resolve(next+'randomizer/game/ai/resource-demand'),mod=new Module(demandFile,module);mod.filename=demandFile;mod.paths=module.paths;
const demand=fs.readFileSync(demandFile,'utf8'),i=demand.lastIndexOf('return Object.freeze({');assert(i>0);mod._compile(demand.slice(0,i)+demand.slice(i).replace('return Object.freeze({','return Object.freeze({diagnosticValueFacts:valueFacts,'),demandFile);
const saved=read(R+'teacher125-v317-hotspots-v1/v317-teacher125-swap-quotes-20261107-v1.json');assert.equal(sha(saved.checkpoint),saved.checkpointSha256);
const corpus=JSON.parse(z.gunzipSync(fs.readFileSync(saved.checkpoint))),states=new Map(Object.entries(corpus.states).map(([key,state])=>[key,JSON.parse(state)]));
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
let fullPortfolios=0;
for(const row of corpus.prices){
 const s=states.get(row.stateKey),p=s.players.players.find(p=>p.id===row.playerId);
 const f=mod.exports.diagnosticValueFacts(s,p);
 const a=values0.purposeCapital(f),b=values1.purposeCapital(f);assert.deepEqual(a,b);assert.equal(a.total,row.value);fullPortfolios++;
}
const cold=read(F+'v318-cold-income-before-amiba-20261107-v1.json'),f=read(cold.fixture);
const s=JSON.parse(f.compositionEnvelope.session?.session?.workingState?JSON.stringify(f.compositionEnvelope.session.session.workingState):f.compositionEnvelope.committedState),p=s.players.players.find(p=>p.id===f.seatId);
const facts=candidate.factsFromState(s,p),portfolio=(_hand,_publicity,{resources})=>(resources.credits+resources.energy)*.5;
const original=structuredClone(facts),fixtureBefore=JSON.stringify(facts);
let scalar=0;
for(const cr of [0,1,2,4,12,64])for(const en of [0,1,3,6])for(const weight of [weights,{...weights,credits:1.75,energy:.5}]){
 const q={...facts,player:{...facts.player,credits:cr,energy:en},investment:portfolio,initialInvestmentCapital:(cr+en)*.5};
 const expected=reference.quote(q,weight),detailed=candidate.quote(q,weight);
 assert.deepEqual(detailed,expected);assert.equal(candidate.quoteValue(q,weight),expected.value);scalar++;
}
assert.equal(JSON.stringify(facts),fixtureBefore);
const q={...facts,player:{...facts.player,credits:12,energy:8},investment:portfolio,initialInvestmentCapital:10};
const wanted=reference.quote(q,weights).value;assert.equal(candidate.quoteValue(q,weights),wanted);
const visible=candidate.requirements(q);assert(visible.length);
const mutated=visible[0].endpointFacts.cost.credits;
visible[0].endpointFacts.cost.credits=100;
try{assert.equal(candidate.quoteValue(q,weights),wanted,'diagnostic callers cannot mutate private funding directory');}
finally{visible[0].endpointFacts.cost.credits=mutated;}
const shallow={...original,board:{...original.board,rockets:Object.freeze(original.board.rockets)}};
const ship=shallow.board.rockets.find(x=>x.surface==='solar-board'&&x.playerId===facts.player.id);assert(ship);
assert.deepEqual(candidate.requirements(shallow),reference.requirements(shallow));ship.sectorX=(ship.sectorX+1)%8;
assert.deepEqual(candidate.requirements(shallow),reference.requirements(shallow),'shallow freezing is not an immutable geometry certificate');
const detached=freeze(structuredClone(facts));
assert.deepEqual(candidate.requirements(detached),reference.requirements(detached));
assert.deepEqual(candidate.requirements(detached),reference.requirements(detached));
const result={scope:'341 captured full portfolios and Native mission scalar/menu controls. Distinct wallet and weights, private directory isolation and mutable shallow-freeze fallback. No new search.',manifest,manifestSha256:sha(manifest),fullPortfolios,scalar,privateDirectoryIsolation:true,mutableGeometryFallback:true,immutableGeometryParity:true,newAiQueries:0,newAutonomousRuns:0};
fs.writeFileSync(D+'probe-scalar-controls-20261107-v1.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
