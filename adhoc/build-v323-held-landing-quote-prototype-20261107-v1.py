from pathlib import Path
runtime=Path('/private/tmp/seti-v323-autonomous-first3-20261107-v1/randomizer/game/ai/probe-capital.js')
s=runtime.read_text()
def edit(old,new):
 global s
 assert s.count(old)==1,old
 s=s.replace(old,new)
edit('''  function quoteValue(facts, weights) {return evaluateMission(facts, weights, true);}''','''  // An already-known simple paid card can replace the ordinary landing
  // energy, but only for an existing legal standard planet endpoint. Do
  // not price secondary card effects, satellite exceptions or reserve V.
  function heldLandingCard(facts, weights) {
    if (weights !== arithmetic.DEFAULT_WEIGHTS || facts.passing || facts.round >= 4
      || facts.pendingNativeEffects || !Array.isArray(facts.hand)) return null;
    let chosen = null;
    for (const card of facts.hand) {
      if (!card.id || !card.cardId || card.hidden) continue;
      const model = cardEffects.getCardModel(card), effects = model?.playEffects;
      if (model?.cardType !== 3 || effects?.length !== 1 || model.triggers?.length
        || model.tasks?.length || model.temporaryTasks?.length || effects[0].type !== 'card_land') continue;
      const options = effects[0].options;
      if (!options.skipCost || !options.grantRewards || options.allowDuplicateLanding || options.allowDuplicateSatelliteLanding
        || options.allowSatelliteWithoutTech || options.forceFirstLandingReward || options.afterLandRewards?.length
        || options.displayLandingSlot != null || options.referenceOffsetTokenWidths != null
        || (options.repeat ?? 1) !== 1) continue;
      const cost = cardEffects.getCardPlayCost(card);
      if (Object.keys(cost).length !== 1 || !Number.isSafeInteger(cost.credits) || cost.credits <= 0) continue;
      // More than one eligible supplier needs an explicit opportunity-cost rule.
      if (chosen) return null;
      chosen = { card, cost };
    }
    return chosen;
  }

  function quoteValue(facts, weights) {return evaluateMission(facts, weights, true);}''')
edit('''    if (planetAbility.BASE_LAND_ENERGY_COST''','''    const cardRoute=heldLandingCard(facts,weights);
    if (!cardRoute && planetAbility.BASE_LAND_ENERGY_COST''')
edit('''    if(prepared?.length===0&&Array.isArray(facts.hand)&&player.income!=null){''','''    const alternatives=[];
    if (cardRoute) for (const goal of goals) {
      if (goal.endpointFamily !== 'land' || !goal.requirementId.endsWith(':planet')) continue;
      const ordinaryCost={...goal.endpointFacts.cost,energy:(goal.endpointFacts.cost.energy||0)+goal.route.cost};
      if (funding(player,ordinaryCost,weights)) continue;
      const payment=funding(player,{...cardRoute.cost,energy:goal.route.cost},weights);
      if(payment) alternatives.push({goal,payment,card:cardRoute.card});
    }
    const portfolio=alternatives.length?[...(prepared||goals.map(goal=>({goal}))),...alternatives]:null;
    if(!portfolio&&prepared?.length===0&&Array.isArray(facts.hand)&&player.income!=null){''')
edit('''    for (const entry of prepared||goals) {
      const goal=prepared?entry.goal:entry,cost=goal.endpointFacts.cost;
      const payment=prepared?entry.payment:funding(player,{...cost,energy:(cost.energy||0)+goal.route.cost},weights);
      if (!payment) { if(candidates)candidates.push({ id: goal.requirementId, funded: false, value: 0 }); continue; }
      const hand = knownHand.slice();''','''    for (const entry of portfolio||prepared||goals) {
      const goal=portfolio||prepared?entry.goal:entry,cost=goal.endpointFacts.cost,card=entry.card;
      const payment=entry.payment||funding(player,{...cost,energy:(cost.energy||0)+goal.route.cost},weights);
      if (!payment) { if(candidates)candidates.push({ id: goal.requirementId, funded: false, value: 0 }); continue; }
      const hand = card ? knownHand.filter(c=>c.id!==card.id) : knownHand.slice();''')
edit('''let delta = -payment.value, unknownCount = facts.hand.length - hand.length + facts.extraUnknownCount, supported = true;''','''let delta = -payment.value - (card ? weights.handSize : 0), unknownCount = facts.hand.length - knownHand.length + facts.extraUnknownCount, supported = true;''')
edit('''if(candidates)candidates.push({ id: goal.requirementId, family: goal.endpointFamily, planet: goal.planetId, funded: true,
        supported, payment, route: goal.route, ledger, capitalDelta, dataContinuation,value });''','''if(candidates)candidates.push({ id: card ? goal.requirementId+':card:'+card.id : goal.requirementId, family: goal.endpointFamily, planet: goal.planetId, funded: true,
        ...(card?{knownLandingCardId:card.id}:{}), supported, payment, route: goal.route, ledger, capitalDelta, dataContinuation,value });''')
d=Path('reports/ai-foundation-20261107/v323-known-landing-quote-prototype-v1');d.mkdir(exist_ok=True)
p=d/'probe-capital-held-landing-prototype-20261107-v1.js';p.write_text(s)
