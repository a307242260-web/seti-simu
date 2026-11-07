from pathlib import Path
root=Path('/private/tmp/seti-v319-income-before-amiba-probe-20261107-v1')
out=Path('reports/ai-foundation-20261107/income-before-amiba-scalar-work-v1');out.mkdir(exist_ok=True)
s=(root/'randomizer/game/ai/probe-capital.js').read_text()
def edit(a,b):
 global s
 assert s.count(a)==1,a
 s=s.replace(a,b)
edit('const hand = knownHand.slice(), publicCards = (facts.board.publicCards || []).filter(c => c && !c.hidden && c.cardId);','const hand = knownHand.slice();\n      let publicCards = scalarOnly ? null : (facts.board.publicCards || []).filter(c => c && !c.hidden && c.cardId);')
edit('const incomePurpose = (card, availableHand, projectedData=0) => {','const incomePurpose = (card, availableHand, projectedData=0, commonCapital) => {')
edit('''const after=capital(availableHand.filter(c=>c!==card),nextWallet,nextIncome,traceSlots);
        const linear=weighted(immediate)+weighted(gain)*(4-planningRound)-weights.handSize;
        const following=facts.dataContinuation?facts.dataContinuation({hand:availableHand.filter(c=>c!==card),wallet:nextWallet,income:nextIncome,traceSlots}):null;
        return{card,gain,wallet:nextWallet,income:nextIncome,after,linear,value:arithmetic.sum([linear,after,following?.value||0,-capital(availableHand,wallet,income,traceSlots)],weights)};''','''const remaining=availableHand.filter(c=>c!==card);
        const after=capital(remaining,nextWallet,nextIncome,traceSlots);
        const linear=weighted(immediate)+weighted(gain)*(4-planningRound)-weights.handSize;
        const following=facts.dataContinuation?facts.dataContinuation({hand:scalarOnly?remaining:availableHand.filter(c=>c!==card),wallet:nextWallet,income:nextIncome,traceSlots}):null;
        return{card,gain,wallet:nextWallet,income:nextIncome,after,linear,value:arithmetic.sum([linear,after,following?.value||0,-(commonCapital??capital(availableHand,wallet,income,traceSlots))],weights)};''')
edit('''const ranked = publicCards.map(card => ({ card, value: incomeLater ? incomePurpose(card, [...hand, card],projectedData).value
            : arithmetic.sum([capital([...hand, card], wallet, income,traceSlots),-capital(hand, wallet, income,traceSlots)],weights) }))''','''publicCards ||= (facts.board.publicCards || []).filter(c => c && !c.hidden && c.cardId);
          let commonCapital;
          const ranked = publicCards.map(card => ({ card, value: incomeLater ? incomePurpose(card, [...hand, card],projectedData).value
            : arithmetic.sum([capital([...hand, card], wallet, income,traceSlots),-(scalarOnly
              ? (commonCapital??=capital(hand,wallet,income,traceSlots)) : capital(hand,wallet,income,traceSlots))],weights) }))''')
edit('map(card=>incomePurpose(card,hand))','map(card=>incomePurpose(card,hand,0,scalarOnly?before:undefined))')
edit('const handPurposeCost=arithmetic.sum([before,-capital(hand, wallet, income,traceSlots)],weights);','const handPurposeCost=ledger ? arithmetic.sum([before,-capital(hand, wallet, income,traceSlots)],weights) : undefined;')
(out/'probe-scalar-work-prototype-20261107-v1.js').write_text(s)
