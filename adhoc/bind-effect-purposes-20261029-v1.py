from pathlib import Path
p=Path('randomizer/game/ai/resource-demand.js');s=p.read_text()
s=s.replace("const protectedCard=(c,g)=>c.id===g.cardId||c.id===g.incomeCardId;", "const protectedCard=(c,g)=>c.id===g.cardId||c.id===g.incomeCardId;")
s=s.replace('    if(placed(p)<4&&p.hand.some', '''    // Income and free/card-sourced research enter as purpose plans too. The native
    // effect queue still determines costs and every distinct research tile choice.
    for(const action of actions){
      if(action.family==='play_card'){
        const card=p.hand.find(c=>c.id===action.target?.cardInstanceId);
        const types=card&&effects.buildPlayEffects(card).map(e=>e.type)||[];
        const purpose=types.includes('card_research_tech')?'tech':types.some(t=>['card_income','card_tuck_played_card_to_income','card_discard_any_for_income'].includes(t))?'income':null;
        if(purpose&&!p.mainActionCompleted)add({id:`effect:${purpose}:card:${card.id}`,kind:'effect-purpose',purpose,cardId:card.id,sourceFamily:'play_card',required:effects.getCardPlayCost(card)});
      }else if(action.family==='industry'&&['helios_remove_tech_income','mission_publicity_pick_income'].includes(action.target?.abilityId)){
        add({id:`effect:income:industry:${action.target.abilityId}`,kind:'effect-purpose',purpose:'income',abilityId:action.target.abilityId,sourceFamily:'industry',required:{}});
      }
    }
    if(placed(p)<4&&p.hand.some''',1)
# If the same unfunded card is already represented by a purpose, don't retain an unbound funding alternative.
s=s.replace("return goals.filter(g=>g.kind!=='route'||g===chosen).sort", "return goals.filter(g=>(g.kind!=='route'||g===chosen)&&!(g.kind==='play_card'&&!g.paidRewardPolicy&&goals.some(p=>p.kind==='effect-purpose'&&p.cardId===g.cardId))).sort")
s=s.replace("    goal=currentGoal(state,goal);\n    const p=owner(state,seatId),d=needs(state,seatId,goal);", """    goal=currentGoal(state,goal);
    if(goal.kind==='effect-purpose'&&operation.targetStarted){
      return status==='stable'?{kind:'complete',reason:'purpose-effect-completed'}
        :{kind:'fallback',reason:'purpose-effect-native-choice',actionIds:actions.map(a=>a.actionId)};
    }
    const p=owner(state,seatId),d=needs(state,seatId,goal);""",1)
s=s.replace("    const a=actions.find(a=>a.family===goal.kind", """    if(goal.kind==='effect-purpose'){
      const a=actions.find(a=>a.family===goal.sourceFamily&&(goal.cardId?a.target?.cardInstanceId===goal.cardId:a.target?.abilityId===goal.abilityId));
      return a?{kind:'start-target',actionId:a.actionId,reason:'start-bound-'+goal.purpose}:{kind:'infeasible',reason:'purpose-source-unavailable'};
    }
    const a=actions.find(a=>a.family===goal.kind""",1)
p.write_text(s)
p=Path('randomizer/game/ai/analysis-port.js');s=p.read_text()
s=s.replace('      if(goal.kind==="scan-flow"){','''      if(goal.kind==="effect-purpose"&&operation.targetStarted){
        if(node.status==="stable")return{kind:"complete",reason:"purpose-effect-completed"};
        const fixed=local?.selectedActionId?{kind:"fixed",actionId:local.selectedActionId,reason:local.kind}:null;
        if(fixed)return fixed;
        const income=resourceDemand.incomeChoice({state,seatId,goal,actions:node.legalActions});if(income)return income;
        return{kind:"fallback",reason:"purpose-effect-native-choice",actionIds:local?.retainedActionIds||node.legalActions.map(a=>a.actionId)};
      }
      if(goal.kind==="scan-flow"){''',1)
s=s.replace('a.family==="industry"&&a.target?.abilityId==="turing_borrow_tech"||a.family', 'a.family==="industry"&&a.target?.abilityId==="turing_borrow_tech"||plans.some(p=>p.goal.kind==="effect-purpose"&&p.firstActionId===a.actionId)||a.family',1)
p.write_text(s)
p=Path('randomizer/game/ai/search-agent.test.js');s=p.read_text().replace('assert.equal(prefixHits,0,"资源准备中间步骤须从物理状态重算，不沿用没有持久目标的前缀证据");','assert(prefixHits>0,"资源固定计划须跨实际输入复用，恢复携带同一份完成证据");').replace('if (step === 0) assert(b.searches[0].diagnostics.transitions > 0, "恢复不能携带旧临时token");','if (step === 0) assert.equal(b.searches[0].diagnostics.transitions,0,"恢复通过可序列化证据重建新token并校验依赖");')
p.write_text(s)
