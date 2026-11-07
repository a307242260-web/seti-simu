'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {buildRuleObservation}=load('randomizer/app/rule-observation');
const {evaluateStateValue}=load('randomizer/game/ai/state-value');
const [normal,masked,out]=process.argv.slice(2),seat='player-white',owner=s=>s.players.players.find(p=>p.id===seat);
const placeholder=()=>({hidden:true,faceUp:false});
const rows=[];
for(const [variant,p] of [['normal',normal],['masked',masked]]){
 const d=read(p),source=JSON.parse(d.source.committedState),base=owner(source);
 const known=new Set([...base.hand,...base.reservedCards,...source.cards.publicCards].map(c=>c.id));
 for(const line of d.rows){
  for(const [i,r] of line.rounds.entries()){
   assert.equal(r.envelope.session,null);
   const s=JSON.parse(r.envelope.committedState),o=buildRuleObservation(s,s.meta.seed,seat),board=o.publicState.board;
   const maskedObservation=structuredClone(o),copy=maskedObservation.publicState.board;
   const retainedA7=s.aliens.amiba.displayedCardIndex===source.aliens.amiba.displayedCardIndex
     ?null:owner(s).hand.find(c=>c.alienCardId===source.aliens.amiba.displayedCardIndex);
   if(retainedA7)known.add(retainedA7.id);
   maskedObservation.selfState.hand=o.selfState.hand.map(c=>known.has(c.id)?c:placeholder());
   copy.publicCards=board.publicCards.map(c=>c&&(known.has(c.id)?c:placeholder()));
   if(copy.aliens.amibaTraces?.displayedCardIndex!==source.aliens.amiba.displayedCardIndex){
    copy.aliens.amibaTraces.displayedCardAvailable=Boolean(copy.aliens.amibaTraces.displayedCardAvailable);
    copy.aliens.amibaTraces.displayedCardIndex=null;
   }
   for(const [k,tech] of Object.entries(copy.techSupply?.stacks||{})){
    if(s.tech.stacks[k].bonusIndex!==source.tech.stacks[k].bonusIndex){tech.bonusHidden=true;tech.bonusId=null;}
   }
   const v=evaluateStateValue(maskedObservation,seat);
   rows.push({variant,mode:line.mode,horizon:i+1,turn:r.asset.turn,value:v.total,components:v.components,
    probeCount:s.pieces.rockets.filter(r=>r.playerId===seat).length,knownHand:maskedObservation.selfState.hand.map(c=>c.cardId||'opaque')});
  }
 }
}
fs.writeFileSync(out,JSON.stringify({scope:'Post-action value model at matched fixed witnesses, root-hidden hand and public identities opaque',rows},null,2)+'\n',{flag:'wx'});
for(const r of rows.filter(x=>x.horizon>=5))console.log(JSON.stringify(r));
