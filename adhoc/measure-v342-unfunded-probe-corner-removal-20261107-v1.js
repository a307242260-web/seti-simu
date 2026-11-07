'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const probePath=require.resolve('../randomizer/game/ai/probe-capital');
for(const p of [probePath,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const counts={opportunities:0,existing:0,ownedProbes:0,ordinaryOwned:0,noFundedMission:0,exactInert:0,paidQuoteMs:0};
globalThis.__publicityRemovalProbe=counts;
function load(p,modify){const m=new Module(p,module);m.filename=p;m.paths=module.paths;const src=modify(fs.readFileSync(p,'utf8'));require.cache[p]=m;m._compile(src,p);m.loaded=true;}
function replace(s,a,b){assert.equal(s.split(a).length,2);return s.replace(a,b);}
load(probePath,s=>replace(s,'  return Object.freeze({ diagnosticRequirementRefs:',`  function privateMissionFunded(facts,weights){
    const p=facts.player,directory=loadRequirements(facts,true),prepared=preparedFundedGoals(directory,p,weights);
    if(!prepared)return true;
    const card=heldLandingCard(facts,weights);
    return prepared.length>0||Boolean(card&&preparedHeldLandings(directory,prepared,p,card.cost.credits,weights));
  }
  return Object.freeze({privateMissionFunded, diagnosticRequirementRefs:`));
load(valuePath,s=>replace(s,`    publicityPortfolio.removalIsInert=(current,card)=>!supportedResearch(card)
      &&!probeCapital.ownedProbes(current.board?.rockets,current.player).length
      &&!(current.nextFinalMark?.valuationSafe&&current.player.score>=current.nextFinalMark.threshold);`,`    publicityPortfolio.removalIsInert=(current,card)=>{
      const t=globalThis.__publicityRemovalProbe;t.opportunities++;
      if(supportedResearch(card)||current.nextFinalMark?.valuationSafe&&current.player.score>=current.nextFinalMark.threshold)return false;
      if(!probeCapital.ownedProbes(current.board?.rockets,current.player).length){t.existing++;return true;}
      t.ownedProbes++;
      if(weights!==DEFAULT_WEIGHTS||probeCapital.heldLandingCost(card))return false;
      t.ordinaryOwned++;
      if(probeCapital.privateMissionFunded(current,weights))return false;
      t.noFundedMission++;
      const start=performance.now(),before=basePurposeCapital(current,weights),after=basePurposeCapital({...current,
        hand:current.hand.filter(c=>c.id!==card.id),player:{...current.player,handSize:current.hand.length-1+current.extraUnknownCount}},weights);
      if(before.total!==after.total)throw Error('unfunded ordinary removal disagrees');
      t.exactInert++;t.paidQuoteMs+=(performance.now()-start)*.5;
      return false;
    };`));
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Measure lower publicity-corner valuations with an owned but unfundable mission. Original decision retained, not a cold test.',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
