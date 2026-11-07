'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const [input,output]=process.argv.slice(2),q=JSON.parse(fs.readFileSync(input)).blueWitnesses;
const seed='seti-free-analyze-v1',seatId='player-white',k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});
k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope,rows=[];
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function get(predicate){const d=c.inspect().session?.decision,options=d?.choices||c.inputPort.enumerateActions({});return{d,a:options.find(predicate)};}
function take(predicate){
 const {d,a}=get(predicate);if(!a)return null;
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
 :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);return a;
}
function diff(a,b,path=''){
 if(a===b)return [];
 if(a&&b&&typeof a==='object'&&typeof b==='object'){
  return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>diff(a[k],b[k],path+'/'+k));
 }
 return [path];
}
try{
 for(const x of q.filter(r=>r.tail.edges.some(e=>e.actionId.startsWith('complete_task:')))){
  restore(x.start.e);const before=save();
  const blue=[];
  for(const old of x.after.actions){const a=take(a=>a.actionId===old.actionId);assert.deepEqual(a,old);blue.push(a);}
  assert.deepEqual(save(),x.after.e);
  const task=take(a=>a.family==='complete_task');assert(task);
  const blueFirst=save();
  restore(before);const taskFirstAction=take(a=>a.actionId===task.actionId);
  if(!taskFirstAction){rows.push({node:x.node,reason:'task-not-ready-before-blue',before,blueFirst});continue;}
  const sequence=[taskFirstAction];
  for(const a of blue){const step=take(x=>x.actionId===a.actionId);if(!step)break;sequence.push(step);}
  if(sequence.length!==blue.length+1){rows.push({node:x.node,reason:'blue-menu-changed-after-task',before,blueFirst,sequence});continue;}
  const taskFirst=save(),changed=diff(JSON.parse(blueFirst.committedState),JSON.parse(taskFirst.committedState));
  const e1={...blueFirst,committedState:null},e2={...taskFirst,committedState:null},envelopeChanges=diff(e1,e2);
  rows.push({node:x.node,reason:changed.length?'state-diff':'state-exact',before,blueFirst,taskFirst,sequence,changed,envelopeChanges});
 }
 fs.writeFileSync(output,JSON.stringify({rows},null,2)+'\n',{flag:'wx'});
 for(const x of rows)console.log(x.node,x.reason,x.changed?.slice(0,9),x.envelopeChanges?.slice(0,4));
}finally{c.dispose();}
