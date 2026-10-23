"use strict";
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),crypto=require("node:crypto"),zlib=require("node:zlib"),assert=require("node:assert/strict");
const {createSimulationRuleComposition}=require("../randomizer/training/simulation-rule-composition"),{createSeededRandom}=require("../randomizer/game/random"),{buildRuleObservation}=require("../randomizer/app/rule-observation"),{createStateValueEvaluator}=require("../randomizer/game/ai/state-value");
const output="reports/ai-foundation-20261023/choice-boundary-replay-v1.json";assert(!fs.existsSync(output) && !fs.existsSync(output+".gz"),"Reuse replay checkpoint");
const sourcePath="randomizer/game/ai/analysis-port.js",filename=path.resolve(sourcePath),source=fs.readFileSync(filename,"utf8"),needle="expandPostMainOptimalPlan, close, getDiagnostics });";assert(source.includes(needle));
const instrumented=source.replace(needle,"expandPostMainOptimalPlan, proofDebugNode: node => structuredClone(nodes.get(node).envelope), close, getDiagnostics });");
const loader=new Module(filename,module);loader.filename=filename;loader.paths=Module._nodeModulePaths(path.dirname(filename));loader._compile(instrumented,filename);
const fixturePath="adhoc/ai-decision-corpus-20261023-v1/case-008-20261023-v1.json",graphPath="adhoc/ai-decision-corpus-20261023-v1/attained-case008-v2.raw.json.gz",f=JSON.parse(fs.readFileSync(fixturePath)),graph=JSON.parse(zlib.gunzipSync(fs.readFileSync(graphPath))),seed=f.source.seed;
assert(graph.complete);const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const comp=k.composition;assert(comp.lifecycle.restore(f.compositionEnvelope).ok);
const before=comp.lifecycle.save().envelope,p=loader.exports.createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:0}),evaluate=createStateValueEvaluator(f.seatId),mapped=new Map([[0,p.openRoot()]]),groups={},decisions=[],counts={};let submissions=0;
try{
 for(const line of graph.lines){const node=mapped.get(line.node);assert(node,`missing graph node ${line.node}`);assert.equal(node.status,line.status);
  if(["information-barrier","other-owner","terminal"].includes(line.status))assert.equal(evaluate(node.observation),line.value);
  if(node.status==="decision"){
   const envelope=p.proofDebugNode(node),session=envelope.session?.session||envelope.session;const metadata={...session};delete metadata.workingState;
   const actions=node.legalActions.map(a=>({actionId:a.actionId,family:a.family,target:a.target,payload:a.payload}));
   const successors=line.edges.map(e=>({actionId:e.actionId,status:graph.lines[e.target].status,value:graph.lines[e.target].value,cost:e.cost,distance:graph.lines[e.target].distance}));
   decisions.push({node:line.node,legal:actions,successors,metadata});
  }
  for(const edge of line.edges){let child=node;const steps=edge.steps||[edge.actionId];assert.equal(steps.length,edge.cost);
   for(const id of steps){const a=child.legalActions.find(a=>a.actionId===id);assert(a,`missing action ${id} at ${line.node}`);
    const key=`${child.status}/${a.family}/${a.target?.kind||""}/${a.target?.choiceId?.replace(/:[^:]+$/,'')||""}`;counts[key]=(counts[key]||0)+1;
    child=p.expand(child,id);submissions+=1;
   }
   if(mapped.has(edge.target))assert.equal(p.identity(child),p.identity(mapped.get(edge.target)),`equivalent target ${edge.target}`);else mapped.set(edge.target,child);
  }
 }
 assert.deepEqual(comp.lifecycle.save().envelope,before);assert.equal(mapped.size,graph.lines.length);
 for(const d of decisions){const a=d.legal[0],key=`${a.family}/${a.target?.kind||""}/${d.legal.length}`;const g=groups[key]||={nodes:0,inputs:0,allEdgesToSameBoundary:0,sample:d};g.nodes+=1;g.inputs+=d.successors.length;
  if(d.successors.length===d.legal.length&&d.successors.every(s=>["information-barrier","other-owner","terminal"].includes(s.status)&&s.cost===1)&&new Set(d.successors.map(s=>`${s.status}/${s.value}`)).size===1)g.allEdgesToSameBoundary+=1;
 }
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),detailPath="adhoc/ai-decision-corpus-20261023-v1/choice-boundary-replay-v1.raw.json.gz",detail=zlib.gzipSync(JSON.stringify({decisions})+'\n');fs.writeFileSync(detailPath,detail);
 const report={scope:"Replay of every saved edge in the existing complete008 graph, no new AI search, no game or timing grade. Native state equivalence and all boundary values checked. Debug accessor exists only in this local instrumented adapter.",fixturePath,graphPath,graphSha256:sha(fs.readFileSync(graphPath)),nativeSubmissions:submissions,mappedNodes:mapped.size,rootUnchanged:true,counts,groups,detailPath,detailSha256:sha(detail),analysisSourceSha256:sha(source),instrumentedSourceSha256:sha(instrumented)};fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({nodes:mapped.size,submissions,groups:Object.fromEntries(Object.entries(groups).map(([k,g])=>[k,{nodes:g.nodes,inputs:g.inputs,sameBoundary:g.allEdgesToSameBoundary}]))}));
}finally{p.close();comp.dispose();}
