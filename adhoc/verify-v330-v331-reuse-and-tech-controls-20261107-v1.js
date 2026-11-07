'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),z=require('node:zlib'),crypto=require('node:crypto'),Module=require('node:module');
const W='reports/ai-foundation-20261107/',D=W+'v331-paid-research-v1/',F='reports/ai-foundation-20261105/third-round-teacher-v1/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),raw=p=>JSON.parse(z.gunzipSync(fs.readFileSync(p)));
const prior=read(W+'v329-landing-income-v1/source-manifest-20261107-v1.json');
function loadPrior(name,override){const n='randomizer/game/ai/'+name+'.js',p=require.resolve('../'+n),b=prior.changedSourceSnapshot+'/'+n,m=new Module(p,module);assert.equal(sha(b),prior.sourceHashes[n]);m.filename=p;m.paths=module.paths;if(override){const orig=m.require.bind(m);m.require=k=>Object.hasOwn(override,k)?override[k]:orig(k);}m._compile(fs.readFileSync(b,'utf8'),p);return m.exports;}
const oldProbe=loadPrior('probe-capital'),old=loadPrior('state-value',{'./probe-capital':oldProbe}),values=require('../randomizer/game/ai/state-value'),probe=require('../randomizer/game/ai/probe-capital'),weights=values.DEFAULT_WEIGHTS;
const native=read(W+'v329-landing-income-v1/native-income-and-uranus-landing-20261107-v1.json'),seat=read(native.fixture).seatId,s=JSON.parse(native.branches[1].envelope.committedState),p=s.players.players.find(p=>p.id===seat),f=probe.factsFromState(s,p),traceTypes=['yellow','pink','blue'];
let quoteCases=0;for(let flags=0;flags<256;flags++)for(const publicity of [0,9,10,11]){
 const projected=f.board.aliens.slots.map((slot,i)=>({...slot,revealed:!!(flags&(1<<(4*i))),traces:Object.fromEntries(traceTypes.map((t,k)=>[t,{...slot.traces[t],firstPlaced:!!(flags&(1<<(4*i+k+1)))}]))}));
 const ctx={...f,player:{...f.player,publicity,credits:5,energy:1},board:{...f.board,aliens:{...f.board.aliens,slots:projected}},initialInvestmentCapital:0,
  investment:(hand,publicity,funding,progress)=>hand.length*.5+publicity*.25+(progress.traceSlots||[]).reduce((n,x)=>n+traceTypes.filter(t=>x.traces[t].firstPlaced).length*.5,0),
  dataContinuation:({wallet,traceSlots})=>({value:(wallet.availableData+(traceSlots?.filter(x=>x.revealed).length||0))*.5})};
 const bytes=JSON.stringify(projected);assert.equal(probe.quoteReadOnlyPortfolio(ctx,weights),oldProbe.quoteValue(ctx,weights));assert.equal(JSON.stringify(projected),bytes);quoteCases++;
}
const committed=W+'committed-computer-recovery-v323-v1/serial-cold-gate-20261107-v1.json',roots=new Map(read(committed).rows.map(r=>[r.identity,r.fixture]));
const industry=require('../randomizer/game/industry/passives'),tech=require('../randomizer/game/tech/resolver');let modelCases=0;
for(const fixture of roots.values()){
 const q=read(fixture),st=q.compositionEnvelope.session?.session?.workingState||JSON.parse(q.compositionEnvelope.committedState),owner=st.players.players.find(p=>p.id===q.seatId);
 const input={...probe.factsFromState(st,owner),supply:st.tech,researchCost:tech.getResearchPublicityCost(owner),analyzeEnergyCost:industry.canAnalyzeWithoutEnergy(owner)?0:1};
 const out=(m,w)=>{try{return JSON.parse(JSON.stringify(m.purposeCapital(input,w)));}catch(e){return{error:e.message};}};
 assert.deepEqual(out(values,weights),out(old,weights),fixture);modelCases++;
}
function cold(n){const r=read(F+'v'+n+'-cold-income-before-amiba-20261107-v1.json');assert.equal(sha(r.rawPath),r.rawSha256);const x=JSON.parse(z.gunzipSync(fs.readFileSync(r.rawPath)).toString().replace(/seti-complete-decision-search-v(?:329|330|331)/g,'version'));delete x.diagnostics.milliseconds;return[r,x];}
const [a,b,c]=[329,330,331].map(cold);assert.deepEqual(a[1],b[1]);assert.deepEqual(b[1],c[1]);
const techRaw=D+'v323-r3-tech-native-counterfactuals-20261107-v1.json.gz',repairRaw=D+'v323-r3-tech-native-repair-20261107-v1.json.gz',t=raw(techRaw),r=raw(repairRaw),rec=read(t.record);
assert.equal(sha(t.record),t.recordSha256);assert(t.sourceRestored&&r.sourceRestored);assert.equal(t.selected.length,21);assert.equal(r.branches.length,11);assert.equal(t.submittedCounterfactual,101);assert.equal(r.nativeInputs,18);
for(const row of t.selected.filter(x=>x.isOfficial))assert.deepEqual(row.end.envelope,t.official);
const valued={};for(const [root,choice]of [[186,187],[200,202]]){const s=rec.metrics.searches.find(x=>x.step===root),input=rec.metrics.searches.find(x=>x.step===choice);
 assert.equal(input.diagnostics.planContinuation,'hit');valued[choice]=Object.fromEntries(s.lines[0].edges.filter(e=>e.resourcePlan?.goal?.tileId).map(e=>{const g=e.resourcePlan.goal;return[g.tileId+(g.blueSlot?':'+g.blueSlot:''),s.lines[e.target].value];}));}
const primary=t.selected.find(x=>x.step===187&&x.isOfficial);assert.equal(primary.immediate.wallet.availableData,4);
for(const id of ['purple2','orange2','orange4']){const e=t.selected.find(x=>x.step===187&&x.tileId===id);assert.equal(e.immediate.wallet.availableData,2);assert.equal(e.blocked.step,195);assert.equal(e.end.wallet.availableData,0);}
const cols=require('../randomizer/game/data/placement');
console.log(JSON.stringify({scope:'Exact archived full graphs; private trace comparison across 256 visible flags and capped wallets; complete portfolios over historical roots; source-hash verified replay receipts.',quoteCases,modelCases,graphExact:[329,330,331],roundEndNativeBranches:t.selected.filter(x=>x.atSameRoundEnd).length,repairBranches:r.branches.length,searchValuesByTech:valued,blueUnlockSlots:[cols.getRequiredComputerSlotForBlueBonus(3),cols.getRequiredComputerSlotForBlueBonus(4)],newAutonomousRuns:0}));
