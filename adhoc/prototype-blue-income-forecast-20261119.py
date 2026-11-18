"""Build one isolated, hash-verified forecast prototype; never edit Production."""
import difflib
import hashlib
import json
from pathlib import Path
import shutil
import tempfile

repo = Path(__file__).resolve().parents[1]
directory = repo / 'reports/ai-foundation-20261119'
output = directory / 'blue-income-forecast-prototype-preflight-20261119-v1.json'
if output.exists():
    raise SystemExit('Existing prototype: reuse its runtime, do not rebuild.')
source = json.loads((directory / 'r3-b101-native-control-preflight-20261119-v1.json').read_text())
runtime = Path(tempfile.mkdtemp(prefix='seti-blue-income-prototype-20261119-', dir='/private/tmp'))
for name, digest in source['sourceFiles'].items():
    original = Path(source['runtime']) / name
    assert hashlib.sha256(original.read_bytes()).hexdigest() == digest, name
    target = runtime / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(original, target)

patches = []
def change(name, replacements):
    target = runtime / name
    before = target.read_text()
    after = before
    for old, new in replacements:
        assert after.count(old) == 1, (name, old[:100], after.count(old))
        after = after.replace(old, new)
    target.write_text(after)
    patches.extend(difflib.unified_diff(before.splitlines(True), after.splitlines(True),
                                      fromfile='a/' + name, tofile='b/' + name))

helper = r''' function publicIncomePreparation(facts,weights,portfolio,baseValue){
  // This is a quote of the existing fixed income purpose, not another search.
  // Only a fully funded, known public supplier is considered. Unknown refills
  // have no assumed identity or value and the consumed offer is removed.
  if(facts.passing||facts.hand.length||facts.extraUnknownCount||facts.pendingNativeEffects
    ||facts.pendingCardTriggers?.length||!quiet(facts.reservedCards)
    ||facts.board.aliens.slots.some(s=>s.revealed)
    ||facts.player.availableData<3)return zero('public-income-analysis-unavailable');
  const initial=facts.player,trade=trades.getTradeAction('publicity-for-card');
  if(Object.entries(trade.cost).some(([k,v])=>initial[k]<v))return zero('public-income-not-funded');
  const offers=facts.board.publicCards;
  if(!Array.isArray(offers)||offers.some(c=>c&&(!c.cardId||c.hidden)))return zero('public-income-identity-unknown');
  // Match the income-purpose public picker: preserve better certain plays,
  // then use its stable instance-id order. Do not rank new income branches.
  const pickNet=card=>{
   const model=effects.getCardModel(card),cost=effects.getCardPlayCost(card);
   let score=0,hasPlay=false,certain=true;
   for(const effect of model?.playEffects||[]){
    const repeat=effects.getEffectBuildRepeat(effect);if(!(repeat>0))continue;hasPlay=true;
    if(certain){if(effect.type!=='gain_resources'||Object.keys(effect.options?.gain||{}).some(k=>k!=='score'))certain=false;
     else for(let i=0;i<repeat;i++)score+=effect.options.gain.score||0;}
   }
   return hasPlay&&certain?score-Object.values(cost).reduce((n,v)=>n+v,0)-1:0;
  };
  const eligible=offers.filter(c=>c&&[0,1,2].includes(cards.getIncomeCodeForCard(c)))
   .map(card=>({card,net:pickNet(card)})).sort((a,b)=>a.net-b.net||(a.card.id<b.card.id?-1:a.card.id>b.card.id?1:0));
  const card=eligible[0]?.card,gain=card&&cards.getIncomeGainForCard(card);
  if(!gain||!Object.keys(gain).length||Object.keys(gain).some(k=>!['credits','energy'].includes(k)))return zero('public-currency-income-missing');
  // An already-owned income mark needs a separate secured-score ledger.
  if(facts.board.finalScoring?.tiles?.a?.marks?.some(m=>m.playerId===initial.id))return zero('public-income-owned-mark-needs-native-value');
  const wallet={...initial,availableData:initial.availableData-1,income:{...initial.income}};
  for(const[k,v]of Object.entries(trade.cost))wallet[k]-=v;
  players.gainResources({resources:wallet},gain);for(const[k,v]of Object.entries(gain))wallet.income[k]+=v;
  const columns=Object.entries(initial.techState.blueBoardSlots).filter(([id,slot])=>initial.techState.ownedTiles[id]
   &&!initial.techState.disabledTiles[id]&&placement.getRequiredComputerSlotForBlueBonus(slot)===4).length;
  players.gainResources({resources:wallet},{score:columns*placement.getBlueColumnScoreBonus().score});
  const nextFinalMark=facts.nextFinalMark&&{...facts.nextFinalMark,options:facts.nextFinalMark.options.map(o=>['a1','a2'].includes(o.formulaId)
   ?{...o,currentValue:end.getFormulaBaseValue(o.formulaId,wallet,{})*o.multiplier}:o)};
  const publicCards=offers.map(c=>c===card?null:c),ordinaryDrawCount=facts.board.ordinaryDrawCount;
  if(!Number.isSafeInteger(ordinaryDrawCount)||ordinaryDrawCount<0)return zero('public-income-stock-unknown');
  const progress={computerSlots:[1,2,3,4],publicCards,ordinaryDrawCount:Math.max(0,ordinaryDrawCount-1),nextFinalMark};
  const next={...facts,...progress,player:wallet,board:{...facts.board,publicCards,ordinaryDrawCount:progress.ordinaryDrawCount}};
  const after=portfolio(wallet,facts.board.aliens.slots,progress);
  const tail=quote(next,weights,(w,slots,updates={})=>portfolio(w,slots,{...progress,...updates}),after);
  if(!tail.selected)return zero('public-income-analysis-tail-unavailable');
  if(nextFinalMark&&tail.selected.endpointScore>=nextFinalMark.threshold
    &&(nextFinalMark.options.some(o=>o.currentValue>0)
      ||nextFinalMark.followingThreshold!=null&&tail.selected.endpointScore>=nextFinalMark.followingThreshold))return zero('public-income-new-mark-needs-native-value');
  const linear=arithmetic.sum([wallet.score-initial.score,...Object.entries(weights).filter(([k])=>k!=='handSize')
   .map(([k,w])=>(wallet[k]-initial[k])*w),...Object.entries(gain).map(([k,v])=>v*(weights[k]||0)*(4-facts.round))],weights);
  const net=arithmetic.sum([linear,after,tail.selected.planNetGain,-baseValue],weights);
  return{value:Math.max(0,net),selected:{...tail.selected,incomeCardId:card.id,preparationPlacements:3,
   incomePreparation:{tradeId:trade.id,linear,capitalAfter:after},planNetGain:net},
   reason:net>0?'funded-public-income-analysis':'public-income-analysis-not-profitable',
   scope:'One known public currency-income supplier chosen by the existing income-purpose order; pay actual acquisition and data costs, then one fixed ready-analysis quote. No assumed refill identity, new search node or Native successor.'};
 }
'''

change('randomizer/game/ai/ready-analysis-capital.js', [
    ("common?require('./amiba-analysis-capital'):root.SetiAmibaAnalysisCapital);", "common?require('./amiba-analysis-capital'):root.SetiAmibaAnalysisCapital,common?require('../cards/deck'):root.SetiCards,common?require('../actions/quick-trades'):root.SetiQuickTrades,common?require('../end-game-scoring'):root.SetiEndGameScoring);"),
    ('function(placement,data,aliens,players,effects,probe,arithmetic,amibaAnalysis){', 'function(placement,data,aliens,players,effects,probe,arithmetic,amibaAnalysis,cards,trades,end){'),
    (' function quote(facts,weights,portfolio,baseValue){', helper+' function quote(facts,weights,portfolio,baseValue){'),
    ("  if(needed.length&&(placed.length<4", "  if(placed.length===3&&placed.every((slot,i)=>slot===i+1))return publicIncomePreparation(facts,weights,portfolio,baseValue);\n  if(needed.length&&(placed.length<4"),
    ("traceType:'blue',payment,preparationPlacements:needed.length", "traceType:'blue',endpointScore:(tail?.wallet||selected.wallet).score,payment,preparationPlacements:needed.length"),
    ('placement.getRequiredComputerSlotForBlueBonus(slot)>=5', 'placement.getRequiredComputerSlotForBlueBonus(slot)>=4'),
    ('  return{linear:preparationColumns*', "  const income=progress?Math.max(0,...(progress.publicCards||[]).filter(c=>c?.cardId&&!c.hidden).map(c=>cards.getIncomeGainForCard(c)).filter(Boolean).map(g=>Object.entries(g).filter(([k])=>['credits','energy'].includes(k)).reduce((n,[k,v])=>n+v*(weights[k]||0)*(1+Math.max(0,4-progress.round)),0))):0;\n  return{linear:income+preparationColumns*"),
])
change('randomizer/game/ai/state-value.js', [
    ('seti-purpose-capital-state-value-v71', 'seti-purpose-capital-state-value-v72-public-income-prototype'),
    ('const {aliens,ordinaryDrawCount,...updates}=progress;', 'const {aliens,ordinaryDrawCount,publicCards,...updates}=progress;'),
    ('...(ordinaryDrawCount===undefined?{}:{ordinaryDrawCount}),aliens:', '...(ordinaryDrawCount===undefined?{}:{ordinaryDrawCount}),...(publicCards===undefined?{}:{publicCards}),aliens:'),
])
change('randomizer/game/ai/analysis-port.js', [
    ('{techState:owner.techState,computerSlots}):{linear:0,publicity:0}', '{techState:owner.techState,computerSlots,round:state.turn.roundNumber,publicCards:state.cards.publicCards}):{linear:0,publicity:0}'),
])
patch = directory / 'blue-income-forecast-prototype-20261119-v1.patch'
assert not patch.exists()
patch.write_text(''.join(patches))
changed = ['randomizer/game/ai/'+name for name in ['ready-analysis-capital.js','state-value.js','analysis-port.js']]
result = {'sourceCommit':source['sourceCommit'],'sourceRuntime':source['runtime'],'runtime':str(runtime),
          'patch':str(patch.relative_to(repo)), 'sourceFiles':source['sourceFiles'],
          'candidateChangedFiles':{name:hashlib.sha256((runtime/name).read_bytes()).hexdigest() for name in changed},
          'productionChanged':False,'formalScoreUnchanged':272,'formalGameSecondsUnchanged':16.1,
          'newNativeInputs':0,'newAutonomousGames':0}
output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'runtime':str(runtime),'changedFiles':changed,'patch':str(patch)}))
