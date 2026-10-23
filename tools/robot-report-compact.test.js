"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createReportSave}=require('./robot-report-fixture'),{REPO_ROOT,buildActionLogReport,replaySaveEnriched}=require('./robot-iteration-lib');
const savePath='seti-saves/seti-save-research-ai-foundation-dev-07-20261022-2bc7b88c-full-v122.json';
const original=fs.readFileSync(path.join(REPO_ROOT,savePath)),save=JSON.parse(original);assert(save.replaySteps.every(step=>step.after===null));
const html=buildActionLogReport({savePath,versionId:'compact-report-regression',mode:'full'});
assert(!html.includes('R?·T?'),'精简存档必须从真实重放恢复轮次，不能把所有动作合为一回合');
const finalState=JSON.parse(save.committedState),lastRound=finalState.turn.roundNumber;assert(html.includes(`第 ${lastRound} 轮`));assert(!html.includes('色玩家 · 1 个回合'));
const enrich=replaySaveEnriched(savePath);assert.equal(enrich.size,save.replaySteps.length);
for(const step of save.replaySteps){const row=enrich.get(step.stepIndex);assert(Number.isInteger(row.before.r));assert(Number.isInteger(row.before.t));assert(Array.isArray(row.after.p[step.actorPlayerId]));}
assert([...enrich.values()].some(row=>row.before.t!==row.after.t),'实际保存end_turn交接前后归属');
const groups=new Map();
for(const step of save.replaySteps){const before=enrich.get(step.stepIndex).before,key=`${before.r}|${before.t}|${step.actorPlayerId}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(step);}
for(const [actor,label]of [['player-blue','蓝'],['player-green','绿'],['player-brown','棕'],['player-white','白']]){
 const count=[...groups.values()].filter(rows=>rows[0].actorPlayerId===actor && rows.some(row=>row.action.family!=='end_turn')).length;
 assert(html.includes(`${label}色玩家 · ${count} 个回合`),`${actor}须按执行前归属计算${count}个回合`);
 const last=enrich.get(save.replaySteps.at(-1).stepIndex).after.p[actor],player=finalState.players.players.find(p=>p.id===actor);
 assert.deepEqual(last,[player.resources.score,player.resources.credits,player.resources.energy,player.resources.publicity,player.hand.length,player.reservedCards.length]);
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'seti-report-compact-'));
try{
 const rich=JSON.parse(original);for(const step of rich.replaySteps)step.after=enrich.get(step.stepIndex).after;
 const p=path.join(temp,'expanded.json');fs.writeFileSync(p,JSON.stringify(rich));
 const expanded=buildActionLogReport({savePath:path.relative(REPO_ROOT,p),versionId:'compact-report-regression',mode:'full'});
 // 保存形式不同不能改变回合顺序、步骤和资源正文。
 const panels=text=>[...text.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)].map(m=>m[0]);assert.deepEqual(panels(html),panels(expanded));
 const incomplete=createReportSave();for(const step of incomplete.replaySteps)step.after=null;fs.writeFileSync(p,JSON.stringify(incomplete));
 const current=buildActionLogReport({savePath:path.relative(REPO_ROOT,p),versionId:'compact-incomplete'});assert(!current.includes('R?·T?'));assert(!current.includes('白 —'),'非终局末步资源也必须从重放取得');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
assert.deepEqual(fs.readFileSync(path.join(REPO_ROOT,savePath)),original,'报告不得改写原存档');
console.log(JSON.stringify({compactReport:'passed',steps:save.replaySteps.length,rounds:lastRound,richParity:true,sourceSaveUnchanged:true}));
