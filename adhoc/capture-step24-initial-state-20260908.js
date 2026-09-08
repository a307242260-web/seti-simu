// 只重放23个正式输入，不运行AI搜索。
const fs=require('node:fs'),assert=require('node:assert/strict');
const base='/Users/bilibili/code/seti-simu';
const out=base+'/reports/iteration/step24-initial-state-aaaed8d0-20260908.json';
if(fs.existsSync(out)){console.log('已有初始状态：'+out);process.exit(0);}
const req=require('node:module').createRequire('/private/tmp/seti-white-income-baseline-20260907/adhoc/state24.js');
const config=JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const record=JSON.parse(fs.readFileSync(base+'/reports/research/7dfcf27e.aaaed8d0.full.json'));
const save=JSON.parse(fs.readFileSync(base+'/'+record.savePath));
const env=req('../randomizer/app/simulation-env').createSimulationEnv();
try{env.reset(config);for(const expected of save.replaySteps.slice(0,23)){const a=env.legalActions().find(a=>a.actionId===expected.action.actionId);assert.deepEqual(a,expected.action);assert.equal(env.step(a).ok,true);assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after);}const state=env.saveBrowserSave();const observation=env.observe('player-white');fs.writeFileSync(out,JSON.stringify({source:record.gitCommit,step:24,method:'前23步正式输入重放，Action及after一致，无AI运行',state,observation,legal:env.legalActions()},null,2)+'\n',{flag:'wx'});console.log(out);}finally{env.dispose();}
