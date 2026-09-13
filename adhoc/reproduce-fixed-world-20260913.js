"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),{execFileSync}=require("node:child_process");
const cards=require("../randomizer/game/cards/deck"),aliens=require("../randomizer/game/aliens");
const {createSeededRandom}=require("../randomizer/game/random");
const output="adhoc/fixed-world-reproduction-20260913.json";
if(fs.existsSync(output)){console.log(`已有复现 ${output}`);process.exit(0);}
const seed="seti-free-analyze-v1";
function normalDraw(skip){
 const random=createSeededRandom(seed),state=cards.createCardState();
 state.drawPileCardIds=cards.CARD_CATALOG.slice(0,12).map(c=>c.card_id);
 const orderedBefore=[...state.drawPileCardIds];
 const player={id:"p1",hand:[],resources:{handSize:0}},players={players:[player]};
 for(let i=0;i<skip;i++)random();
 const result=cards.blindDraw(state,players,player,random,{createCardInstance:entry=>cards.createCardInstance(entry,"fixture")});
 assert.equal(result.ok,true);return {skip,orderedBefore,drawn:result.card.cardId,remaining:state.drawPileCardIds};
}
function alienDraw(skip){
 const state=aliens.createDefaultAlienState();
 const a=aliens.amiba.ensureAmibaState(state);a.cardDeck=[0,1,2,3,4,5,6,7,8,9];a.displayedCardIndex=10;
 const random=createSeededRandom(seed);for(let i=0;i<skip;i++)random();
 const before=[...a.cardDeck],result=aliens.amiba.blindDrawCard(state,random,{sequence:1});
 assert.equal(result.ok,true);return {skip,orderedBefore:before,drawn:result.card.cardId,remaining:a.cardDeck};
}
function reveal(skip){
 const random=createSeededRandom(seed),state=aliens.createDefaultAlienState();
 assert.equal(aliens.randomizeAlienAssignments(state,{random}).ok,true);
 for(const t of Object.values(state.aliens[1].traces))t.firstPlaced=true;
 const before=state.aliens[1].assignedAlienId;for(let i=0;i<skip;i++)random();
 const result=aliens.revealRandomAlien(state,1,random);assert.equal(result.ok,true);
 return {skip,assignedBefore:before,revealed:result.alienId};
}
const cases={normalCards:[0,1,2,3].map(normalDraw),alienCards:[0,1,2,3].map(alienDraw),alienReveal:[0,1,2,3].map(reveal)};
assert(new Set(cases.normalCards.map(x=>x.drawn)).size>1);
assert(new Set(cases.alienCards.map(x=>x.drawn)).size>1);
assert(new Set(cases.alienReveal.map(x=>x.revealed)).size>1);
const report={commit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),seed,
 scope:"受控primitive反例：同有序牌库/同seed，额外消费随机数后再抽牌或揭示。不是完整游戏轨迹，不据此证明某条实际行动调用了几次随机数。",
 cases,verdict:"三类均未满足动作无关的固定底层盘面契约；此脚本断言复现旧缺陷，不是修复通过测试。"};
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n",{flag:"wx"});console.log(JSON.stringify(report,null,2));
