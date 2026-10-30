"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { createAnalysisPort } = require("./analysis-port");
const { searchDecision } = require("./decision-search");
const { createStateValueEvaluator } = require("./state-value");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const f = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../adhoc/ai-decision-corpus-20261023-v1/case-008-20261023-v1.json")));
// Session handles are rebuilt on restore; preserve a bijection of every reference.
// Committed rule state, physical entity IDs, RNG and all other fields stay exact.
function normalizeSessionHandles(envelope) {
  if (!envelope.session) return envelope;
  const names = new Map();
  const session = JSON.stringify(envelope.session).replace(/effect-session-[0-9]+(?=[:"\\])/g, name => {
    if (!names.has(name)) names.set(name, `effect-session-ref-${names.size}`);
    return names.get(name);
  });
  return { ...envelope, session: JSON.parse(session) };
}
const seed = f.source.seed;
function kernel() {
  const k = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
    trustedProjectionReader: true, projectCounterfactualState: (s,v) => buildRuleObservation(s,seed,v?.playerId) });
  k.newGame({ seed }); assert(k.composition.lifecycle.restore(f.compositionEnvelope).ok); return k;
}
function submit(comp, id) {
  const current = comp.inspect(), action = (current.phase === "awaiting_input" ? current.session.decision.choices : comp.inputPort.enumerateActions({})).find(a => a.actionId === id);
  assert(action);
  const out = current.phase === "awaiting_input" ? comp.inputPort.submitDecision({ decisionId: current.session.decision.decisionId,
    decisionVersion: current.session.decision.decisionVersion, ownerId: current.session.decision.ownerId, choice: action })
    : action.phase === "quick" ? comp.inputPort.submitQuickAction(action) : comp.inputPort.submitAction(action);
  assert(out.ok, out.message); return out;
}
const evaluate = createStateValueEvaluator(f.seatId);
const options = { ...require("./search-agent").OPTIONS, evaluate, modelKey: evaluate.modelKey, resourceDominance:true,moneyCapacityDominance:true,
  cardTradePruning:true,postMainPruning:true,openingPruning:true,cardChoiceEquivalence:true,
  budget:{transitions:4096,nodes:4097,frontier:4096,milliseconds:15000} };
const k = kernel(), comp = k.composition, port = createAnalysisPort({ composition: comp, seatId:f.seatId,maxCacheEntries:0 });
let root=port.openRoot(), result=searchDecision({ ...options,port,root,planReuse:true });
assert(result.complete);assert(result.planContinuation,"已闭合复杂窗口须产生一般最优前缀证书");
assert.deepEqual(Object.keys(result.planContinuation),[]);
let token = result.planContinuation;const first = result.actionId, initialCertificate=port.exportPlan(token);
assert.equal(port.getDiagnostics().planEvidenceEntries,1);
assert(port.getDiagnostics().planPrefixEntries<=port.getDiagnostics().maxPlanPrefixEntries);
const inputs=[result.diagnostics.transitions], actions=[], before=comp.lifecycle.save().envelope;
let hits=0,refreshes=0;
let expectedAfter=null;
for(let i=0;i<32;i++) {
  const expectedChild=port.expand(root,result.actionId), boundary=["information-barrier","other-owner","terminal"].includes(expectedChild.status);
  port.close();submit(comp,result.actionId);actions.push(result.actionId);
  if(expectedAfter)assert.deepEqual(normalizeSessionHandles(comp.lifecycle.save().envelope),normalizeSessionHandles(expectedAfter),"复用与恢复冷算正式状态及会话引用逐输入一致");
  if(boundary)break;
  root=port.openRoot();
  const actualBefore=comp.lifecycle.save().envelope;
  result=searchDecision({ ...options,port,root,planReuse:true,planContinuation:token });
  const recovered=kernel();assert(recovered.composition.lifecycle.restore(actualBefore).ok);
  const reference=createAnalysisPort({composition:recovered.composition,seatId:f.seatId,maxCacheEntries:0});
  const cold=searchDecision({ ...options,port:reference,root:reference.openRoot() });
  assert(cold.complete);assert.equal(result.actionId,cold.actionId);assert.equal(result.value,cold.value);
  if(result.diagnostics.planContinuation==="hit"){
    assert.equal(result.reusedCoverage.distance,cold.lines[0].distance);assert.equal(result.diagnostics.transitions,0);hits+=1;
    assert.equal(result.diagnostics.resourceDominance,"reused-complete-window");
  }else{
    // Taking a technology really reveals new bonus facts. A certificate tied to
    // the earlier information set must be recomputed; equality is checked with
    // a fresh native planner, rather than requiring an invalid cache hit.
    assert.equal(result.diagnostics.planContinuation,"dependencies-changed");assert(result.diagnostics.transitions>0);assert(result.planContinuation);token=result.planContinuation;refreshes++;
    assert.equal(result.lines[0].distance,cold.lines[0].distance);
  }
  assert.deepEqual(comp.lifecycle.save().envelope,actualBefore);
  submit(recovered.composition,cold.actionId);expectedAfter=recovered.composition.lifecycle.save().envelope;
  reference.close();recovered.composition.dispose();
  inputs.push(result.diagnostics.transitions);
}
assert(hits>1);assert(actions.length>2);port.close();
// A restored runtime has no token and must recompute the same next action.
assert(comp.lifecycle.restore(before).ok);submit(comp,first);
root=port.openRoot();token=port.importPlan(initialCertificate);assert(token);
assert.equal(port.reusePlan(root,token,"changed-model").reason,"model-changed");
const changedOptions=searchDecision({...options,port,root,planReuse:true,planContinuation:token,cardChoiceEquivalence:false,
  budget:{...options.budget,transitions:1}});
assert.equal(changedOptions.diagnostics.planContinuation,"model-changed");
assert.equal(changedOptions.planContinuation,null);
assert.throws(()=>searchDecision({...options,port,root,evaluate:()=>0,planReuse:true}),/PLAN_MODEL_INVALID|MODEL_INVALID/);
let clock=0;
const late=searchDecision({...options,port,root,planReuse:true,planContinuation:token,now:()=>clock+=2,
  budget:{...options.budget,milliseconds:1}});
assert.equal(late.complete,false);assert.equal(late.actionId,null);assert.equal(late.planContinuation,null);
assert.equal(late.stopReason,"watchdog");
const foreign=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:0}), foreignRoot=foreign.openRoot();
assert.equal(foreign.reusePlan(foreignRoot,token,"changed-model").reason,"unknown-evidence");foreign.close();
const changed=structuredClone(comp.lifecycle.save().envelope), state=changed.session?.session?.workingState || JSON.parse(changed.committedState);
state.players.players.find(p=>p.id===f.seatId).resources.energy+=1;
if(!changed.session)changed.committedState=JSON.stringify(state);
port.close();assert(comp.lifecycle.restore(changed).ok);root=port.openRoot();
assert(root.legalActions.some(a=>a.actionId===actions[1]),"反例保持原下一步合法");
const stale=searchDecision({...options,port,root,planReuse:true,planContinuation:token,budget:{...options.budget,transitions:1}});
assert.equal(stale.diagnostics.planContinuation,"dependencies-changed");assert.equal(stale.planContinuation,null);
port.close();assert(comp.lifecycle.restore(before).ok);
submit(comp,comp.inputPort.enumerateActions({}).find(a=>a.family==="pass").actionId);
root=port.openRoot();
assert(port.passReserveChoiceSpec(root),"实际公开后仍可选择预留牌");
const afterInformation=searchDecision({...options,port,root,planReuse:true,planContinuation:token});
assert.equal(afterInformation.diagnostics.planContinuation,"dependencies-changed");
assert(afterInformation.complete);assert.notEqual(afterInformation.planContinuation,token);
assert.equal(port.reusePlan(root,token,"changed-model").reason,"unknown-evidence");
port.close();comp.dispose();
console.log(JSON.stringify({planPrefixReuse:"passed",hits,refreshes,actions:actions.length,inputs}));
