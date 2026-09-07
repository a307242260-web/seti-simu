"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const scoring = require("../randomizer/game/end-game-scoring");
const initial = require("../randomizer/game/initial-cards");
const cardEffects = require("../randomizer/game/cards/effects");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/green-income-company-base-proof-20260908.json";
if(fs.existsSync(output)){console.log(`已有checkpoint：${output}`);process.exit(0);}
const review = JSON.parse(fs.readFileSync("reports/iteration/chong-blue-card-order-full-review-20260908.json"));
const config = JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config;
const report={scope:"只读已有两局存档，正式Action重放但不运行AI；显式提供公司初始收入的分数是规则诊断，不替换历史固定局记录",records:[],passed:false};
try {
  for(const tag of ["baseline","candidate"]){
    const raw=JSON.parse(fs.readFileSync(review[tag].file)),save=JSON.parse(fs.readFileSync(raw.savePath));
    const state=JSON.parse(save.committedState);
    const getBase=p=>{
      const effect=initial.getIndustryEffect(p.initialSelection.industry);
      assert.ok(effect?.baseIncome,"正式公司目录必须包含初始收入");return effect.baseIncome;
    };
    const ctx={...state,players:state.players.players,cardEffects,
      getCardTypeCode:card=>cardEffects.getRuntimeCardTypeCode(card,cardEffects.getCardModel(card)?.cardType)};
    const record={tag,file:review[tag].file,final:[],incomeEvents:[]};report.records.push(record);
    for(const p of state.players.players){
      const actual=scoring.computePlayerFinalScore(ctx,p), corrected=scoring.computePlayerFinalScore({...ctx,getPlayerCompanyBaseIncome:getBase},p);
      assert.deepEqual(actual,p.finalScoreBreakdown,"当前正式计分必须复现存档");
      record.final.push({playerId:p.id,income:p.income,company:p.initialSelection.industry,
        currentBase:scoring.getPlayerCompanyBaseIncome(p,ctx),companyBase:getBase(p),actual,corrected});
    }
    const env=createSimulationEnv();
    try{
      env.reset(config);
      let previous=env.observe("player-green").publicState.players.find(p=>p.playerId==="player-green");
      for(const [index,expected] of save.replaySteps.entries()){
        const action=env.legalActions().find(a=>a.actionId===expected.action.actionId);
        assert.deepEqual(action,expected.action);
        assert.equal(env.step(action).ok,true);
        const current=env.observe("player-green").publicState.players.find(p=>p.playerId==="player-green");
        assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after);
        if(JSON.stringify(previous.income)!==JSON.stringify(current.income)){
          record.incomeEvents.push({step:index+1,round:expected.after.r,turn:expected.after.t,action,
            before:previous.income,after:current.income,securedBefore:previous.securedEndGameBonus,securedAfter:current.securedEndGameBonus});
        }
        previous=current;
      }
      assert.equal(env.saveBrowserSave().committedState,save.committedState);
    } finally{env.dispose();}
  }
  const green=report.records.map(r=>r.final.find(p=>p.playerId==="player-green"));
  assert.deepEqual(green.map(p=>p.currentBase),[{},{}]);
  assert.deepEqual(green.map(p=>p.companyBase),[{credits:3,energy:1,handSize:1},{credits:3,energy:1,handSize:1}]);
  assert.deepEqual(green.map(p=>p.actual.tileScoresById.a),[44,22]);
  assert.deepEqual(green.map(p=>p.corrected.tileScoresById.a),[33,11]);
  report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{
  fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({output,passed:report.passed,error:report.error,records:report.records.map(r=>({tag:r.tag,
    scores:r.final.map(p=>({id:p.playerId,before:p.actual.totalScore,withCompanyBase:p.corrected.totalScore})),
    incomeEvents:r.incomeEvents.map(e=>({step:e.step,round:e.round,action:e.action.summary,before:e.before,after:e.after}))}))},null,2));
}
