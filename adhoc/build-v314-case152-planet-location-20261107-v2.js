'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const D='reports/ai-foundation-20261107/case152-planet-location-v1/',src=D+'goal-movement-planet-location-prototype-20261107-v1.js';
let s=fs.readFileSync(src,'utf8');
function edit(old,next){assert.equal(s.split(old).length,2,old);s=s.replace(old,next);}
edit('    const normalized={...owner,reservedCards:owner.reservedCards.map(c=>{const copy=structuredClone(c);effects.ensureCardEffectState(copy);return copy;})};',
`    let visitCards;
    function triggerPlayer() {
      // Native collection itself ignores cards with no triggers. Normalize
      // only matching-capable entities, once for this query, without writing
      // the owner's stored cards. A native match still checks the event.
      if (visitCards === undefined) visitCards={...owner,reservedCards:owner.reservedCards
        .filter(c=>effects.getCardModel(c)?.triggers?.length)
        .map(c=>{const copy=structuredClone(c);effects.ensureCardEffectState(copy);return copy;})};
      return visitCards;
    }`);
edit(`      if(!route.path.length)continue;const c=solar.resolveVisibleContent(route.coordinate.x,route.coordinate.y,state.solarSystem).content;`,
`      // add() already rejects these routes before comparing gains. Check the
      // same resource and legal-first-step conditions before reading events.
      if(!route.path.length)continue;
      const first=route.path[0];
      if((!mandatoryPrefix&&route.cost>allowance)||(!objectiveOnly&&!moving.some(a=>matches(a,ship.id,first)))){
        __planetQueries.skippedUnusableVisitQuotes++;continue;
      }
      const c=solar.resolveVisibleContent(route.coordinate.x,route.coordinate.y,state.solarSystem).content;`);
edit(`      const ownOrbit=(state.planets.planets[c.planetId]?.orbitMarkers||[]).some(m=>m.playerId===seatId||m.playerColor===owner.color||m.color===owner.color);
      const event={type,planetId:c.planetId,playerId:seatId,source:free?'card':'move',hasOwnOrbit:ownOrbit};
      const rewards=effects.collectMatchingTriggers(normalized,event).map(match=>({id:\`\${match.card.id}:\${match.trigger.id}\`,value:value(match.trigger.effect)})).sort((a,b)=>b.value-a.value||(a.id<b.id?-1:1));`,
`      const normalized=triggerPlayer();
      let rewards=[];
      if(normalized.reservedCards.length){
        const ownOrbit=(state.planets.planets[c.planetId]?.orbitMarkers||[]).some(m=>m.playerId===seatId||m.playerColor===owner.color||m.color===owner.color);
        const event={type,planetId:c.planetId,playerId:seatId,source:free?'card':'move',hasOwnOrbit:ownOrbit};
        rewards=effects.collectMatchingTriggers(normalized,event).map(match=>({id:\`\${match.card.id}:\${match.trigger.id}\`,value:value(match.trigger.effect)})).sort((a,b)=>b.value-a.value||(a.id<b.id?-1:1));
      }`);
edit('solar.createSolarSnapshot(state.solarSystem).planetLocations','solar.collectPlanetLocations(state.solarSystem)');
edit('const __planetQueries={builds:0,reuses:0};','const __planetQueries={builds:0,reuses:0,skippedUnusableVisitQuotes:0};');
fs.writeFileSync(D+'goal-movement-planet-location-prototype-20261107-v2.js',s,{flag:'wx'});
