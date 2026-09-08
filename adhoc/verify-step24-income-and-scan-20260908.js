// 正式输入对照，不调用AI。检查收入盲抽与扫描前弃牌的数据必要性。
const fs=require('node:fs'),assert=require('node:assert/strict');
const base='/Users/bilibili/code/seti-simu',out=base+'/reports/iteration/step24-income-and-scan-20260908.json';
if(fs.existsSync(out)){console.log('已有证据：'+out);process.exit(0);}
const req=require('node:module').createRequire('/private/tmp/seti-white-income-baseline-20260907/adhoc/verify24.js');
const config=JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const save=JSON.parse(fs.readFileSync(base+'/seti-saves/seti-save-research-trigger-scan-mapping-20260907-aaaed8d0-full-v339.json'));
const report={base:'aaaed8d0',scope:'正式输入重放，无AI搜索',variants:[]};
for(const discard of [true,false]){
 const env=req('../randomizer/app/simulation-env').createSimulationEnv();const v={discard,steps:[]};
 const state=()=>{const s=env.saveBrowserSave();const root=typeof s.committedState==='string'?JSON.parse(s.committedState):s.committedState;return root.players.players.find(p=>p.id==='player-white');};
 const run=a=>{assert.ok(a);const result=env.step(a);assert.equal(result.ok,true);v.steps.push({action:a,result,player:state()});};
 try{env.reset(config);for(const x of save.replaySteps.slice(0,32)){const a=env.legalActions().find(a=>a.actionId===x.action.actionId);assert.deepEqual(a,x.action);run(a);assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,x.after);}
 v.afterIncome=state();
 const match=x=>env.legalActions().find(a=>a.family===x.family&&JSON.stringify(a.target)===JSON.stringify(x.target));
 if(discard)for(const x of save.replaySteps.slice(32,35))run(match(x.action));
 v.beforeScan=state();for(const x of save.replaySteps.slice(35,38))run(match(x.action));v.afterScan=state();
 while(state().dataState.placedTokens.length<6){run(env.legalActions().find(a=>a.family==='place_data'));run(env.legalActions().find(a=>a.family==='choose_target'&&a.target.choiceId==='data:computer'));}
 v.final=state();v.requirements=env.observe('player-white').dataAnalyzeRequirements;report.variants.push(v);
 }finally{env.dispose();}
}
const [a,b]=report.variants;assert.equal(a.final.dataState.placedTokens.length,6);assert.equal(b.final.dataState.placedTokens.length,6);
assert.ok(b.final.hand.some(c=>c.cardId==='dlc_40.png'));assert.ok(!a.final.hand.some(c=>c.cardId==='dlc_40.png'));
report.conclusion={withDiscard:{hand:a.final.hand.map(c=>c.cardId),data:a.final.resources.availableData},withoutDiscard:{hand:b.final.hand.map(c=>c.cardId),data:b.final.resources.availableData},bothComputerFull:true,scanDataGain:a.afterScan.resources.availableData-a.beforeScan.resources.availableData};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({out,...report.conclusion}));
