'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),Module=require('node:module');
const W='reports/ai-foundation-20261107/',F='reports/ai-foundation-20261105/third-round-teacher-v1/',D=W+'v329-landing-income-v1/',proofPath=D+'native-income-and-uranus-landing-20261107-v1.json';
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifests=Object.fromEntries([['325','v325-timing-cache-v1'],['327','v327-prepaid-analysis-v1'],['328','v328-landing-payments-v1'],['329','v329-landing-income-v1']].map(([n,d])=>[n,read(W+d+'/source-manifest-20261107-v1.json')]));
const source=(n,name,p)=>{const rel='randomizer/game/ai/'+name+'.js';assert.equal(sha(p),manifests[n].sourceHashes[rel]||manifests[n].baseRuntimeHashes[rel]);return p;};
function ownModule(name,filename,override){const p=require.resolve('../randomizer/game/ai/'+name),m=new Module(p,module);m.filename=p;m.paths=module.paths;if(override){const req=m.require.bind(m);m.require=k=>Object.hasOwn(override,k)?override[k]:req(k);}m._compile(fs.readFileSync(filename,'utf8'),p);return m.exports;}
const [baseReady,oldProbe]=process.argv.slice(2),priorReady=ownModule('ready-analysis-capital',source('325','ready-analysis-capital',baseReady)),priorProbe=ownModule('probe-capital',source('327','probe-capital',oldProbe));
const ready=require('../randomizer/game/ai/ready-analysis-capital'),probe=require('../randomizer/game/ai/probe-capital'),value=require('../randomizer/game/ai/state-value'),pass=require('../randomizer/game/industry/passives');
const record=read(proofPath),fixture=read(record.fixture);assert.equal(sha(record.fixture),record.fixtureSha256);const seat=fixture.seatId;
const proof=record.branches;assert.deepEqual(proof[0].wallet,proof[1].wallet);assert.deepEqual(proof[0].income,proof[1].income);assert.equal(proof[0].heldLandingCandidates.length,0);assert.equal(proof[1].heldLandingCandidates.length,2);assert.equal(record.executedLanding.wallet.score,59);assert.equal(record.executedLanding.actions.length,12);assert(record.sourceRestored);
const saved=read(W+'committed-computer-recovery-v323-v1/serial-cold-gate-20261107-v1.json'),roots=new Map(saved.rows.map(r=>[r.identity,r.fixture]));
const weights=value.DEFAULT_WEIGHTS;let prepaidCases=0,paymentCases=0;
for(const p of roots.values()){
 const f=read(p),s=f.compositionEnvelope.session?.session?.workingState||JSON.parse(f.compositionEnvelope.committedState),o=s.players.players.find(x=>x.id===f.seatId);
 const facts={...probe.factsFromState(s,o),analyzeEnergyCost:pass.canAnalyzeWithoutEnergy(o)?0:1};
 for(const w of [weights,{...weights,publicity:.23}]){
  const prepared=ready.preparePrepaidCapital(facts,w);
  for(const score of [0,50,2**55])for(const publicity of [0,5,11,12]){
   const next={...facts,player:{...facts.player,score,publicity}};
   assert.equal(prepared(score,publicity),priorReady.prepaidCapital(next,w));assert.equal(ready.prepaidCapital(next,w),priorReady.prepaidCapital(next,w));prepaidCases++;
  }
 }
}
for(const b of [proof[1].envelope,record.shared.session?.session?.baseState&&{committedState:JSON.stringify(record.shared.session.session.baseState)}].filter(Boolean)){
 const s=JSON.parse(b.committedState),p=s.players.players.find(x=>x.id===seat),facts=probe.factsFromState(s,p);
 for(const credits of [0,1,2,3,4,5,7,10,64])for(const energy of [0,1,2,4,64])for(const price of [1,2,3,6]){
  const hand=p.hand.map(c=>c.cardId==='dlc_31.png'?{...c,price}:c);
  for(const hs of [hand,hand.map(c=>c.cardId==='dlc_31.png'?{...c,hidden:true}:c)]){
   const q={...facts,hand:hs,player:{...facts.player,credits,energy},investment:()=>0,initialInvestmentCapital:0};
   assert.deepEqual(probe.quote(q,weights),priorProbe.quote(q,weights));assert.equal(probe.quoteValue(q,weights),priorProbe.quoteValue(q,weights));paymentCases++;
  }
 }
}
const basis=record.shared.session.session.baseState,own=basis.players.players.find(p=>p.id===seat),cards=require('../randomizer/game/cards/deck'),a=own.hand.find(c=>c.cardId==='dlc_31.png'),b=own.hand.find(c=>c.cardId==='dlc_26.png');assert(a&&b);
assert.deepEqual(cards.getIncomeGainForCard(a),cards.getIncomeGainForCard(b));
const f={...probe.factsFromState(basis,own),supply:basis.tech,researchCost:6,analyzeEnergyCost:0};
let oldClasses,classes;
for(const [version,root] of [['328',process.argv[4]],['329',require.resolve('../randomizer/game/ai/state-value')]]){
 const observed=ownModule('state-value',source(version,'state-value',root),{'./ready-analysis-capital':{...ready,quote(facts,w,portfolio,base){
  if(facts===f){const got=[portfolio.incomeRemovalClass(a),portfolio.incomeRemovalClass(b)];if(version==='328')oldClasses=got;else classes=got;}
  return ready.quote(facts,w,portfolio,base);
 }}});
 observed.purposeCapital(f,observed.DEFAULT_WEIGHTS);
}
assert(oldClasses?.[0]!==null&&oldClasses[0]===oldClasses[1]);assert.equal(classes[0],null);assert.equal(classes[1],oldClasses[1]);
const norm=r=>{assert.equal(sha(r.rawPath),r.rawSha256);const x=JSON.parse(z.gunzipSync(fs.readFileSync(r.rawPath)).toString().replace(/seti-complete-decision-search-v(?:325|327|328|329)|seti-purpose-capital-state-value-v(?:55|56)/g,'version'));delete x.diagnostics.milliseconds;return x;};
function compare(label,oldVer,newVer){const [a,b]=[oldVer,newVer].map(n=>read(F+'v'+n+'-cold-'+label+'-20261107-v1.json')),x=norm(a),y=norm(b);assert.deepEqual(y,x,label);assert(a.rootAndRngUnchanged&&b.rootAndRngUnchanged);return [label,a.nativeInputs,b.nativeInputs,a.milliseconds,b.milliseconds];}
const graphComparisons=['teacher-r3-after-amiba-reveal','corpus-case-152','v323-blue1-keep-publicity-first-r3','v323-held-landing-after-launch','v323-held-landing-next-white'].map(label=>compare(label,325,327));
graphComparisons.push(compare('income-before-amiba',327,328));
const [v328,v329]=[328,329].map(n=>read(F+'v'+n+'-cold-income-before-amiba-20261107-v1.json'));const x=norm(v328),y=norm(v329),util=require('node:util');
assert.equal(x.actionId,y.actionId);assert.equal(x.value,y.value);assert(v329.rootAndRngUnchanged);
console.log(JSON.stringify({rootStates:roots.size,prepaidCases,paymentCases,oldIncomeRemovalClasses:oldClasses,newIncomeRemovalClasses:classes,actualNativeLandingScore:record.executedLanding.wallet.score,graphComparisons,correctionChangedGraphFields:Object.keys(x).filter(k=>!util.isDeepStrictEqual(x[k],y[k])),newAutonomousRuns:0}));
