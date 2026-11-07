from pathlib import Path
r=Path('/private/tmp/seti-v320-income-before-amiba-scalar-work-20261107-v1/randomizer/game/ai/ready-analysis-capital.js')
s=r.read_text()
i=s.index(' function prepaidCapital(');j=s.index(' function quote(',i)
s=s[:i]+''' const extraTraceGain=aliens.getExtraTraceReward().gain,firstTraceGains=new Map();
 function firstTraceGain(slotId){
  if(!Number.isSafeInteger(slotId))return aliens.getFirstTraceRewardForSlot(slotId).gain;
  if(!firstTraceGains.has(slotId))firstTraceGains.set(slotId,aliens.getFirstTraceRewardForSlot(slotId).gain);
  return firstTraceGains.get(slotId);
 }
 function prepaidCapital(facts,weights){
  if(facts.terminal||facts.round+Number(facts.passing)>=4||facts.analyzeEnergyCost!==0||!quiet(facts.reservedCards,true))return 0;
  const slots=facts.computerSlots||[],count=slots.length,required=data.ANALYZE_REQUIRED_COMPUTER_SLOT;
  if(!count||count>=required)return 0;
  let seen=0;
  for(const slot of slots){
   if(!Number.isInteger(slot)||slot<1||slot>count)return 0;
   seen|=1<<(slot-1);
  }
  if(seen!==(1<<count)-1)return 0;
  if(!Array.isArray(facts.board?.aliens?.slots))throw Error('READY_ANALYSIS_ALIEN_FACTS_MISSING');
  const {score,publicity}=facts.player,cap=players.RESOURCE_LIMITS.publicity;let best=0;
  for(const slot of facts.board.aliens.slots){
   if(slot.revealed)continue;
   const first=!slot.traces?.blue?.firstPlaced;
   if(first&&slot.traces?.yellow?.firstPlaced&&slot.traces?.pink?.firstPlaced)continue;
   const gain=first?firstTraceGain(slot.slotId):extraTraceGain;
   if(Object.keys(gain).some(k=>k!=='score'&&k!=='publicity'))continue;
   // Pure quote of the same existing score delta and Native publicity cap;
   // there is no game action or mutation of the wallet during valuation.
   if(Number.isFinite(score)&&Number.isFinite(publicity)){
    const scoreAfter=gain.score==null?score:score+gain.score;
    const publicityAfter=gain.publicity==null?publicity:Math.min(cap,Math.max(0,publicity+gain.publicity));
    best=Math.max(best,scoreAfter-score+(publicityAfter-publicity)*weights.publicity);
   }else{
    const wallet={...facts.player};players.gainResources({resources:wallet},gain);
    best=Math.max(best,wallet.score-score+(wallet.publicity-publicity)*weights.publicity);
   }
  }
  return arithmetic.normalize(best*count/required,weights);
 }
'''+s[j:]
d=Path('reports/ai-foundation-20261107/income-before-amiba-prepaid-trace-v1');d.mkdir(exist_ok=True)
(d/'ready-analysis-prepaid-trace-prototype-20261107-v1.js').write_text(s)
