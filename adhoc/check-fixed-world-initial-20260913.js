"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),{createHash}=require("node:crypto");
const {createSimulationEnv}=require("../randomizer/app/simulation-env");
const output=process.argv[2]||"adhoc/fixed-world-initial-20260913.json";
if(fs.existsSync(output)){console.log(`已有初态证据 ${output}`);process.exit(0);}
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
function capture(env,seed){
 env.reset({seed,activePlayerCount:4,aiDifficulty:"laughable"});
 const state=JSON.parse(env.saveBrowserSave().committedState);
 return {seed,solar:state.solarSystem,tech:state.tech,passPiles:state.cards.passReservePiles,
  publicCards:state.cards.publicCards,ordinaryDeckLength:state.cards.drawPileCardIds.length,
  alienAssignments:Object.values(state.aliens.aliens).map(s=>s.assignedAlienId)};
}
const env=createSimulationEnv(),fresh=createSimulationEnv();
try{
 const a=capture(env,"seti-free-analyze-v1"),aa=capture(env,"seti-free-analyze-v1"),cold=capture(fresh,"seti-free-analyze-v1");
 assert.deepEqual(aa,a);assert.deepEqual(cold,a);
 capture(env,"seti-107");const restored=capture(env,"seti-free-analyze-v1");assert.deepEqual(restored,a);
 assert.deepEqual(Object.keys(a.passPiles).sort(),["1","2","3"]);
 assert(Object.values(a.passPiles).every(p=>p.length===5));
 const report={scope:"正式Simulation.reset的初态：fresh A/A、同实例A/A和A/B/A，不运行AI。不是全部运行期随机独立性证明。",
  seed:a.seed,initialHash:hash(a),techHash:hash(a.tech),solarHash:hash(a.solar),passPilesHash:hash(a.passPiles),publicCardsHash:hash(a.publicCards),
  passPileSizes:Object.fromEntries(Object.entries(a.passPiles).map(([k,v])=>[k,v.length])),
  ordinaryDeckLength:a.ordinaryDeckLength,alienAssignments:a.alienAssignments,
  conclusion:"初始科技/基础盘面/三轮末预留牌的重复初始化核验通过；完整固定世界是否达成还需核对牌序、物种预分配与运行期隔离。"};
 fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n",{flag:"wx"});console.log(JSON.stringify(report,null,2));
}finally{env.dispose();fresh.dispose();}
