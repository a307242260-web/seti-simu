from pathlib import Path
P=Path(__file__).resolve().parents[1]
p=P/'randomizer/game/aliens/amiba.js';s=p.read_text();old='blindCardCount:Array.isArray(amiba.cardDeck)?amiba.cardDeck.length:null,displayedCardAvailable:amiba.displayedCardIndex!=null};';assert old in s;s=s.replace(old,'blindCardCount:Array.isArray(amiba.cardDeck)?amiba.cardDeck.length:null,displayedCardAvailable:amiba.displayedCardIndex!=null,\n      displayedCardIndex:amiba.displayedCardIndex??null};');p.write_text(s)
p=P/'randomizer/game/rule-composition.js';s=p.read_text();s=s.replace('function maskAlienSlots(aliens, rootSlots) {','function maskAlienSlots(aliens, rootSlots, rootAliens) {');old='return changed ? { ...aliens, slots: masked } : aliens;';new='''let result = changed ? { ...aliens, slots: masked } : aliens;
    // Species aliases must obey the same root visibility as the slot itself.
    // The next display is a hidden refill, even when its availability is public.
    if (aliens.amibaTraces) {
      const traces = aliens.amibaTraces;
      if (!rootSlots.some(slot => slot.revealed && slot.alienId === "阿米巴"
        && Number(slot.slotId) === Number(traces.revealedSlotId))) {
        result = { ...result, amiba: null, amibaTraces: null };
      } else if (traces.displayedCardIndex !== rootAliens?.amibaTraces?.displayedCardIndex) {
        result = { ...result, amibaTraces: { ...traces, displayedCardIndex: null,
          ...(traces.displayedCardAvailable ? { displayedCardHidden: true } : {}) } };
      }
    }
    return result;''';assert s.count(old)==1;s=s.replace(old,new).replace('maskAlienSlots(board.aliens, rootBoard.aliens?.slots || [])','maskAlienSlots(board.aliens, rootBoard.aliens?.slots || [], rootBoard.aliens)');p.write_text(s)
p=P/'randomizer/game/ai/analysis-port.js';s=p.read_text()
def replace(old,new):
 global s
 assert old in s,old[:100];s=s.replace(old,new)
def scoped(start,end,old,new):
 global s
 a=s.index(start);b=s.index(end,a);chunk=s[a:b];assert old in chunk,(start,old);s=s[:a]+chunk.replace(old,new)+s[b:]
replace('function nodeIdentity(physicalKey,intent,cardControl,resourceControl) {','function nodeIdentity(physicalKey,intent,cardControl,resourceControl,knowledge = null) {')
replace('const key=JSON.stringify([physicalIdentityKeys.get(physicalKey),intent,cardControl,resourceControl]);','const parts=[physicalIdentityKeys.get(physicalKey),intent,cardControl,resourceControl];\n      if(knowledge)parts.push(knowledge);\n      const key=JSON.stringify(parts);')
replace('function policyDependencyKey(stored) {','''function policyPhysicalKey(stored) {
      const key=cardKnowledgeKey(stored.envelope);
      return key?JSON.stringify([stored.physicalKey,{knownAcquiredCardIds:key}]):stored.physicalKey;
    }
    function policyDependencyKey(stored) {''')
replace('const movementKey=stored.intent?JSON.stringify([stored.physicalKey,stored.intent]):stored.physicalKey;','const physical=policyPhysicalKey(stored);\n        const movementKey=stored.intent?JSON.stringify([physical,stored.intent]):physical;')
replace('let planningStates = new WeakMap();','''let planningStates = new WeakMap(), acquiredPlanningStates = new WeakMap();
    // Each immutable Native envelope owns one immutable knowledge context.
    // Sharing a view of that envelope preserves knowledge; siblings never mutate it.
    let envelopeKnowledge = new WeakMap();
    function knownCards(envelope) { return envelopeKnowledge.get(envelope)?.ids || knownRootCardIds; }
    function cardKnowledgeKey(envelope) { return envelopeKnowledge.get(envelope)?.key || null; }
    function inheritCardKnowledge(envelope, source, action) {
      if(!source)return;
      const inherited=envelopeKnowledge.get(source.envelope);
      if(inherited)envelopeKnowledge.set(envelope,inherited);
      const target=action?.target, index=rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex;
      if(action?.actorId!==seatId || action.family!=="choose_card" || target?.kind!=="residual-domain"
        ||target.source!=="display" || !Number.isSafeInteger(index) || target.cardIndex!==index
        ||target.choiceId!==`amiba:display:${index}` || !knownRootAlienIds.has("阿米巴"))return;
      const before=readIdentityState(source.envelope),after=readIdentityState(envelope);
      if(before.aliens.amiba?.displayedCardIndex!==index)return;
      const previous=new Set(before.players.players.find(p=>p.id===seatId).hand.map(c=>c.id));
      const acquired=after.players.players.find(p=>p.id===seatId).hand.filter(c=>!previous.has(c.id)
        &&c.amibaCard===true&&c.alienCardId===index&&c.cardId===`amiba_${index}.webp`);
      if(acquired.length!==1)throw new Error("ANALYSIS_PUBLIC_ALIEN_ACQUISITION_UNPROVED");
      const ids=new Set(inherited?.ids||knownRootCardIds);ids.add(acquired[0].id);
      const added=[...ids].filter(id=>!knownRootCardIds.has(id)).sort();
      envelopeKnowledge.set(envelope,{ids,key:JSON.stringify(added)});
    }''')
replace('barrier, knownRootCardIds)','barrier, knownCards(envelope))')
replace('nodeIdentity(this.physicalKey,this.intent,this.cardControl,this.resourceControl)','nodeIdentity(this.physicalKey,this.intent,this.cardControl,this.resourceControl,cardKnowledgeKey(this.envelope))')
replace('nodeIdentity(stored.physicalKey,stored.intent,stored.cardControl,stored.resourceControl)','nodeIdentity(stored.physicalKey,stored.intent,stored.cardControl,stored.resourceControl,cardKnowledgeKey(stored.envelope))')
replace('stored.informationBarrier, requested)))','stored.informationBarrier, requested, stored)))')
replace('function planningState(state, barrier) {','function planningState(state, barrier, knownCardIds = knownRootCardIds) {')
replace('if (planningStates.has(state)) return planningStates.get(state);','''let memo=planningStates;
      if(knownCardIds!==knownRootCardIds){
        if(!acquiredPlanningStates.has(knownCardIds))acquiredPlanningStates.set(knownCardIds,new WeakMap());
        memo=acquiredPlanningStates.get(knownCardIds);
      }
      if (memo.has(state)) return memo.get(state);''')
scoped('function planningState(', 'function passPlanningState(', 'knownRootCardIds.has(', 'knownCardIds.has(')
replace('freeze(result);planningStates.set(state,result); return result;','freeze(result);memo.set(state,result); return result;')
# Planning reads must use the same context as observation, not the original root IDs.
replace('planningState(readIdentityState(stored.envelope),stored.informationBarrier)','planningState(readIdentityState(stored.envelope),stored.informationBarrier,knownCards(stored.envelope))')
replace('planningState(session.baseState,stored.informationBarrier)','planningState(session.baseState,stored.informationBarrier,knownCards(stored.envelope))')
replace('planningState(readCommittedState(stored.envelope),stored.informationBarrier)','planningState(readCommittedState(stored.envelope),stored.informationBarrier,knownCards(stored.envelope))')
scoped('function describeCardPick(', 'function cardPickSpec(', 'planningState(session.baseState,barrier)', 'planningState(session.baseState,barrier,knownCards(envelope))')
scoped('function recoverMovementIntent(', 'function knownRewardChoices(', 'knownRootCardIds.has(', 'knownCards(envelope).has(')
scoped('function recoverMovementIntent(', 'function knownRewardChoices(', 'planningState(session.baseState,barrier)', 'planningState(session.baseState,barrier,knownCards(envelope))')
scoped('function knownRewardChoices(', 'function remember(key, child)', 'knownRootCardIds.has(', 'knownCards(envelope).has(')
replace('function finishChild(before, result, intent = null, resourceControl = null, carriedBarrier = null, sourceAction = null) {','function finishChild(before, result, intent = null, resourceControl = null, carriedBarrier = null, sourceAction = null, source = null) {')
replace('const envelope = snapshot(comp);\n      loadedEnvelope = envelope;','const envelope = snapshot(comp);\n      inheritCardKnowledge(envelope,source,sourceAction);\n      loadedEnvelope = envelope;')
replace('node: finishChild(outcome.before, outcome.result), actions,','node: finishChild(outcome.before, outcome.result, null, null, stored.informationBarrier, null, stored), actions,')
replace('const child = finishChild(outcome.before, outcome.result);','const child = finishChild(outcome.before, outcome.result, null, null, stored.informationBarrier, choice, stored);')
# All remaining known-identity guards below these helpers have a stored node.
scoped('function movementPlanValueBound(', 'function close()', 'knownRootCardIds.has(', 'knownCards(stored.envelope).has(')
replace('entry.committedGoal ? stored.physicalKey : policyDependencyKey(stored)','entry.committedGoal ? policyPhysicalKey(stored) : policyDependencyKey(stored)')
replace('entry.committedGoal?stored.physicalKey:policyDependencyKey(stored)','entry.committedGoal?policyPhysicalKey(stored):policyDependencyKey(stored)')
replace('JSON.stringify([stored.physicalKey,intent])','JSON.stringify([policyPhysicalKey(stored),intent])')
replace('forwardIdentity(neutral, "selection-component", null)]);','forwardIdentity(neutral, "selection-component", null),cardKnowledgeKey(envelope)]);')
replace('knownRootAlienIds=new Set();planningStates=new WeakMap();','knownRootAlienIds=new Set();planningStates=new WeakMap();acquiredPlanningStates=new WeakMap();envelopeKnowledge=new WeakMap();')
p.write_text(s)
p=P/'randomizer/game/ai/decision-search.js';s=p.read_text();assert 'seti-complete-decision-search-v277' in s;p.write_text(s.replace('seti-complete-decision-search-v277','seti-complete-decision-search-v278'))
