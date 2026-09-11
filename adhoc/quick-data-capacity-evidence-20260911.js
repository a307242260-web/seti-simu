"use strict";

// 正式数据领域原语的容量边界；不模拟扫描选择、奖励结算或机器人搜索。
const assert = require("node:assert/strict");
const data = require("../randomizer/game/data");
const players = require("../randomizer/game/players");
const placement = require("../randomizer/game/data/placement");
const capacity = placement.DATA_POOL_SLOT_IDS.length;
function run(pool, incoming, prepare) {
  const player = players.getCurrentPlayer(players.createPlayerState({currentPlayer:{
    color:"white",resources:{availableData:0,energy:10},
  }}));
  const root = {meta:{sequences:{dataToken:1}}};
  for(let i=0;i<pool;i++) assert(data.gainData(player,{root}).ok);
  const needed = prepare ? Math.max(0,pool+incoming-capacity) : 0;
  for(let i=0;i<needed;i++) assert(data.placeDataToComputer(player).ok);
  let received=0;
  for(let i=0;i<incoming;i++) {
    const result=data.gainData(player,{root});
    if(result.ok) received++;
    else assert.equal(result.discarded,true,"容量超限必须明确报告丢弃");
  }
  return {prepared:needed,received,poolAfter:data.listPoolTokens(player).length,
    placed:data.listComputerPlacedTokens(player).length,discarded:player.dataState.discardedCount};
}
const cases=[];
for(const pool of [3,4,5,6]) for(const incoming of [1,2,3]) {
  const immediate=run(pool,incoming,false),prepared=run(pool,incoming,true);
  assert.equal(immediate.discarded,Math.max(0,pool+incoming-capacity));
  assert.equal(prepared.discarded,0);
  assert.equal(prepared.received,incoming);
  assert.equal(prepared.poolAfter+prepared.placed,pool+incoming);
  cases.push({pool,incoming,immediate,prepared});
}
console.log(JSON.stringify({capacity,scope:"只证明获得给定数量数据前腾容量的必要性，不证明扫描实际获得数量或策略已支持",cases},null,2));
