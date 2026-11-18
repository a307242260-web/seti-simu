"use strict";
const fs=require("node:fs"),z=require("node:zlib"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");process.chdir(path.resolve(process.argv[2]));
const {open}=require(path.join(__dirname,"native-root-harness-20261118-v1.cjs"));const dir=__dirname,out=path.join(dir,"known-old-cargo-after-pickup-20261118-v1.json.gz");assert(!fs.existsSync(out));
const root=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(dir,"teacher-r4-point289-end-task-control-20261118-v1.json.gz")))).root,m=open(root),actions=[],facts=[];
const rockets=require(path.resolve("randomizer/game/rockets")),solar=require(path.resolve("randomizer/solar-system/core")),ability=require(path.resolve("randomizer/game/abilities/rocket")),evaluate=require(path.resolve("randomizer/game/ai/state-value")).createStateValueEvaluator("player-white");
const apply=a=>{actions.push(a);m.apply(a);facts.push({facts:m.facts(),value:evaluate(m.owner("player-white"))});};
try{
 apply(m.menu().find(a=>a.target.fossilId==="fossil_06"));const afterPickup=m.save(),base=facts.at(-1);
 const state=m.state(),ship=state.pieces.rockets.find(r=>r.fossilId==="fossil_07"),at=rockets.getRocketSectorCoordinate(ship),earth=solar.collectPlanetLocations(state.solarSystem).find(p=>p.planetId==="earth"),can=rockets.createStaticCoordinateMoveQuery(state.pieces,ship.id);
 const seen=new Set(),queue=[{at,path:[],cost:0}];let route;
 for(const row of queue){const key=row.at.x+":"+row.at.y;if(seen.has(key))continue;seen.add(key);if(row.at.x===earth.x&&row.at.y===earth.y){route=row;break;}if(row.path.length>=4)continue;const cost=ability.getRequiredMovePointsFromCoordinate(state,m.player(),row.at);for(const d of ability.MOVE_DIRECTIONS){const v=can(row.at,d.deltaX,d.deltaY);if(v.ok)queue.push({at:v.to,path:[...row.path,{rocketId:ship.id,deltaX:d.deltaX,deltaY:d.deltaY}],cost:row.cost+cost});}}
 assert(route);assert(route.cost<=m.player().resources.energy);console.log(JSON.stringify({from:at,earth,route}));
 for(const step of route.path){apply(m.menu().find(a=>a.family==="quick_trade"&&a.target.tradeId==="energy-for-move"));const a=m.menu().find(a=>a.target.rocketId===step.rocketId&&a.target.deltaX===step.deltaX&&a.target.deltaY===step.deltaY);apply(a);}
 const arrive=m.save(),arrivalValue=evaluate(m.owner("player-white"));const claim=m.menu().find(a=>a.family==="complete_task"&&a.target.ruleId==="transport"&&a.target.cardInstanceId==="alien-chong-3-10");console.log(JSON.stringify({menu:m.menu().filter(a=>a.family==="complete_task"),facts:m.facts()}));assert(claim);apply(claim);
 const final=m.save();fs.writeFileSync(out,z.gzipSync(JSON.stringify({kind:"controlled Native witness; known old F07 shipment after actual new F06 reveal; no autonomous game or hidden-predecision pricing",root,actions,facts,route,afterPickup,arrive,final,delta:{arrival:arrivalValue-base.value,claimed:facts.at(-1).value-base.value},rootRuleSha256:crypto.createHash("sha256").update(fs.readFileSync("randomizer/game/cards/play-domain.js")).digest("hex")})));console.log(JSON.stringify({inputs:actions.length,base:base.value,after:facts.at(-1).value,facts:facts.at(-1)}));
}finally{m.dispose()}
