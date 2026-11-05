'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),local=require('./local-decision-plans'),data=require('../data');
const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../reports/ai-foundation-20261105/third-round-teacher-v1/v225-paired-paired-scan-setup-dlc31-15-root-20261106-v1.json'))),source=JSON.parse(f.compositionEnvelope.committedState),state=structuredClone(source),seat=f.seatId,p=state.players.players.find(p=>p.id===seat),incoming=state.cards.publicCards.find(c=>c?.cardId==='b_48.webp'),outgoing=p.hand[0];
// Controlled helper input, not a teacher checkpoint: preserve existing card
// and token identities, unfill the first blue slot and make its token available.
p.hand=[incoming];state.cards.publicCards=state.cards.publicCards.map(c=>c?.id===incoming.id?outgoing:c);p.mainActionCompleted=true;p.industryRoundMarkRound=state.turn.roundNumber;p.resources.credits=0;p.resources.energy=0;
const token=p.dataState.placedTokens.find(t=>t.placementKind==='blueBonus'&&t.blueSlot===1);p.dataState.placedTokens=p.dataState.placedTokens.filter(t=>t!==token);p.dataState.poolTokens.push({id:token.id,index:token.index,slotIndex:p.dataState.poolTokens.length+1});p.resources.availableData=p.dataState.poolTokens.length;
const input={state,seatId:seat,firstBlueGoal:{kind:'blue-data',id:'data:blue:1',blueSlot:1},trackPurposeDelta:true,canLeaveProbeStationary:()=>true};
const quiet=local.dataTailCompletion({...input,canContinue:()=>true});assert(quiet.available);assert(!quiet.plans.some(p=>p.goal.blueSlot===2),'the terminal second blue is locally negative');
let inspectedLastBlue=false;
const guarded=local.dataTailCompletion({...input,canContinue:preview=>{const last=data.listBlueBonusPlacedTokens(preview.players.players.find(p=>p.id===seat)).some(t=>t.blueSlot===2);if(last)inspectedLastBlue=true;return !last;}});
assert.equal(guarded.available,false,'a locally negative skipped blue may activate a later purpose; its closure must decline');assert(inspectedLastBlue,'inspect the actual fixed negative branch before declaring it dominated');assert.equal(guarded.reason,'nonpositive-blue-needs-native-continuation');
assert.equal(JSON.stringify(source),f.compositionEnvelope.committedState);console.log(JSON.stringify({negativeRemainingBlueGuard:true,quietClosureStillAvailable:true,laterPurposeRetainsNativeContinuation:true,existingCardAndTokenIdsOnly:true,noNativeGameOrSearch:true}));
