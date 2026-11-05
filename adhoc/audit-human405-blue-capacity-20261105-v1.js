'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),tech=require('../randomizer/game/tech/player-tech'),catalog=require('../randomizer/game/tech/catalog');
const output='reports/ai-foundation-20261105/third-round-teacher-v1/v193-blue-capacity-audit-20261105-v1.json';assert(!fs.existsSync(output),'reuse saved audit');
const ids=catalog.TILE_IDS_BY_TYPE.blue;assert.equal(ids.length,4);let states=0,orderedPairs=0;
for(let owned=0;owned<16;owned++)for(let disabled=0;disabled<16;disabled++){
 if(disabled&~owned)continue;
 const chosen=ids.filter((id,i)=>owned&(1<<i)),state=tech.createPlayerTechState({ownedTiles:Object.fromEntries(chosen.map(id=>[id,true])),disabledTiles:Object.fromEntries(ids.filter((id,i)=>disabled&(1<<i)).map(id=>[id,true])),blueBoardSlots:Object.fromEntries(chosen.map((id,i)=>[id,i+1]))});
 const unowned=ids.filter(id=>!state.ownedTiles[id]),forecastFree=4-new Set(Object.values(state.blueBoardSlots)).size;
 assert(unowned.length<=forecastFree);assert(unowned.length<=tech.getAvailableBlueSlots(state).length);states++;
 for(const first of unowned)for(const second of unowned){if(first===second)continue;const copy=structuredClone(state);
  assert(tech.recordPlayerTake(copy,first,tech.getAvailableBlueSlots(copy)[0]).ok);
  assert(tech.recordPlayerTake(copy,second,tech.getAvailableBlueSlots(copy)[0]).ok);orderedPairs++;
 }
}
const paths=['randomizer/game/tech/player-tech.js','randomizer/game/tech/catalog.js','randomizer/game/ai/state-value.js'];
fs.writeFileSync(output,JSON.stringify({status:'hypothesis-refuted',states,orderedPairs,runtimeChanged:false,policyQueries:0,newAutonomousRuns:0,conclusion:'Four distinct blue technologies and four slots. Every distinct remaining research pair has native capacity, including disabled ownership cases; same target is already excluded. No new slot pruning or search branch needed. This does not prove future placement preferences optimal.',sourceHashes:Object.fromEntries(paths.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]))},null,2)+'\n');console.log(JSON.stringify({output,states,orderedPairs,hypothesisRefuted:true}));
