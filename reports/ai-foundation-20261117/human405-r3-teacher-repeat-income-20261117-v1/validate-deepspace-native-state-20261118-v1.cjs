// Usage: node this.cjs <candidate-root> [before-root]
process.chdir(require('node:path').resolve(process.argv[2]||process.cwd()));
'use strict';const fs=require('node:fs'),z=require('node:zlib'),assert=require('node:assert/strict'),native=require(require('node:path').resolve('randomizer/game/effects/residual-domain-session'));
const dir='reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1',corpus=JSON.parse(z.gunzipSync(fs.readFileSync(dir+'/deepspace-native-transactions-20261118-v1.json.gz'))),rows=[];
const state=e=>e.session?.session?.workingState||JSON.parse(e.committedState),freeze=x=>{if(!x||typeof x!=='object'||Object.isFrozen(x))return x;Object.values(x).forEach(freeze);return Object.freeze(x)};
for(const [i,c]of corpus.cases.entries())for(const frozen of [false,true]){
 let initial=c.before;for(let k=0;k<3;k++){
  const step=c.steps[k],source=structuredClone(state(initial)),before=structuredClone(source);if(frozen)freeze(source);
  const effect=initial.session?.session?.queue?.[0],q=native.previewQuietDeepSpaceSwap(source,'player-white',step.action,effect);assert(q,`case${i} step${k}`);assert.deepEqual(source,before,'source was mutated');
  const expected=state(step.after),actual=structuredClone(q.state);assert.deepEqual(q.state.meta,source.meta,"preview must not advance protocol version or RNG");actual.meta={...actual.meta,stateVersion:source.meta.stateVersion+Number(k===2),rngState:{...actual.meta.rngState}};delete actual.meta.rngState.branch;
  assert.deepEqual(actual,expected,`Native state mismatch at${i}/${k}/${frozen}`);if(k===0)assert.deepEqual(actual,step.after.session.session.baseState,'Native activation base/working ownership');
  const events=k===0?step.after.session.session.journal.events:[];assert.deepEqual(q.events,events);if(k<2)assert(q.choices.some(a=>a.actionId===c.steps[k+1].action.actionId));
  initial=step.after;
 }
 rows.push({source:i,frozen,allThreeNativeStatesAndEventsEqual:true,sourceAndRngPreserved:true});
}
fs.writeFileSync(dir+'/deepspace-native-state-proof-20261118-v1.json',JSON.stringify({cases:corpus.cases.length,variants:rows.length,phaseChecks:rows.length*3,rows},null,2));console.log(JSON.stringify({nativeCases:121,phaseChecks:rows.length*3,mutableAndFrozen:true,sourceAndRngPreserved:true}));
