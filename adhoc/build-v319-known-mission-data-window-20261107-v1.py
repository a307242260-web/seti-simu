from pathlib import Path
root=Path('/private/tmp/seti-v319-income-before-amiba-probe-20261107-v1')
out=Path('reports/ai-foundation-20261107/income-before-amiba-scalar-work-v1')
s=(root/'randomizer/game/ai/state-value.js').read_text()
a="""    const mission=probeCapital.quoteValue({...facts,investment,initialInvestmentCapital:arithmetic.sum([held+paid,computer],weights),
      dataContinuation:context=>researchIncome.missionDataContinuation({...context,facts,investment:context.traceSlots?dataInvestmentFor({...facts,board:{...facts.board,aliens:{slots:context.traceSlots}}},weights):investment},weights)},weights);"""
b="""    // The typed data tail rejects any revealed alien. A mission reward can
    // mark a trace in a local copy, but it cannot undo an existing reveal.
    const dataContinuation=facts.passing||facts.round>=4
      ||(Array.isArray(facts.board?.aliens?.slots)&&facts.board.aliens.slots.some(s=>s?.revealed))
      ?undefined:context=>researchIncome.missionDataContinuation({...context,facts,investment:context.traceSlots?dataInvestmentFor({...facts,board:{...facts.board,aliens:{slots:context.traceSlots}}},weights):investment},weights);
    const mission=probeCapital.quoteValue({...facts,investment,initialInvestmentCapital:arithmetic.sum([held+paid,computer],weights),dataContinuation},weights);"""
assert s.count(a)==1
(out/'state-value-mission-data-window-prototype-20261107-v2.js').write_text(s.replace(a,b))
(out/'probe-scalar-work-prototype-20261107-v2.js').write_bytes((out/'probe-scalar-work-prototype-20261107-v1.js').read_bytes())
