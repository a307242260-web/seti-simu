'use strict';
const fs=require('node:fs'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random');
const output='adhoc/six-greedy-plan-fixtures-20261028-v1.json';if(fs.existsSync(output))throw new Error('Reuse captured native fixtures');
const cases={};
for(const [name,id,target] of [['advance','152',67],['income','105',41],['discard','152',42],['blue','152',37],['optional','105',13]]){
 const fp=`adhoc/ai-decision-corpus-20261023-v1/case-${id}-20261023-v1.json`,rawPath=`adhoc/ai-decision-corpus-20261023-v1/audit-case-${id}-data-plan-no-borrow-corpus-20261028-v2.raw.json.gz`,f=JSON.parse(fs.readFileSync(fp)),rawBytes=fs.readFileSync(rawPath),raw=JSON.parse(zlib.gunzipSync(rawBytes)),paths=new Map([[0,[]]]);
 for(const line of raw.lines)for(const e of line.edges)if(paths.has(line.node)&&!paths.has(e.target))paths.set(e.target,[...paths.get(line.node),...(e.steps||[e.actionId])]);
 assert(paths.has(target));const seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);
 for(const id of paths.get(target)){const v=c.inspect(),choices=v.phase==='awaiting_input'?v.session.decision.choices:c.inputPort.enumerateActions({}),a=choices.find(a=>a.actionId===id);assert(a,id);const r=v.phase==='awaiting_input'?c.inputPort.submitDecision({decisionId:v.session.decision.decisionId,decisionVersion:v.session.decision.decisionVersion,ownerId:v.session.decision.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));}
 cases[name]={seatId:f.seatId,source:{seed,fixture:fp,rawPath,rawSha256:crypto.createHash('sha256').update(rawBytes).digest('hex'),node:target,path:paths.get(target)},compositionEnvelope:c.lifecycle.save().envelope};c.dispose();
}
fs.writeFileSync(output,JSON.stringify({schemaVersion:'seti-native-greedy-plan-fixtures-v1',cases},null,2)+'\n');console.log(output);
