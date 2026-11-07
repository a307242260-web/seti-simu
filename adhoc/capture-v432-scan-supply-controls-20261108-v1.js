'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const [source,out]=process.argv.slice(2),src=JSON.parse(fs.readFileSync(source)),envelope=src.compositionEnvelope;
const parse=()=>JSON.parse(envelope.committedState),cards=require(path.resolve('randomizer/game/cards/deck'));
assert(!envelope.session);
const write=(label,state)=>fs.writeFileSync(path.join(out,label+'-20261108-v1.json'),
 JSON.stringify({...src,compositionEnvelope:{...envelope,committedState:JSON.stringify(state)}},null,2)+'\n',{flag:'wx'});
const m=parse();
for(const deck of [m.cards.drawPileCardIds,m.aliens.amiba.cardDeck]){
 assert(deck.length>2);
 [deck[0],deck[1]]=[deck[1],deck[0]];
}
write('reverse-blue3-mask-both',m);
const n=parse(),i=n.cards.publicCards.findIndex(c=>c?.cardId==='dlc_24.png');
assert(i>=0);
const next=n.cards.drawPileCardIds.findIndex(id=>cards.getCatalogEntryForCard({cardId:id})?.scan_action_code===1);
const entry=cards.CARD_CATALOG.find(x=>x.card_id===n.cards.drawPileCardIds[next]);
assert(entry&&next>=0);
cards.addToDiscardPile(n.cards,n.cards.publicCards[i]);
n.cards.drawPileCardIds.splice(next,1);
n.cards.publicCards[i]=cards.createCommittedCardInstance(n,entry);
assert(n.cards.publicCards.every(c=>c.scanActionCode===1));
write('reverse-blue3-no-scan-supply',n);
