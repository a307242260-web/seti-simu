    function cargoGainReuseKey(state,known,forbiddenCoordinate){
      const t=state.turn,p=state.players.players.find(q=>q.id===seatId),cargo=state.aliens.chong;
      if(!p||t.roundNumber!==4||t.currentPlayerId!==seatId||t.gameEnded
        ||p.passCompletionPending||t.passedPlayerIds.includes(seatId)||!t.activePlayerIds.includes(seatId)
        ||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))
        ||t.cardTurnEventBonuses?.length||state.match.initialSetup||p.industryBorrowedTechTileId
        ||!Number.isSafeInteger(p.resources.score)||!cargo?.revealInitialized
        ||!knownRootAlienIds.has("虫")||!knownRootAlienIds.has("阿米巴")
        ||Object.values(state.aliens.aliens).some(s=>!s.revealed||!["虫","阿米巴"].includes(s.alienId))
        ||[...p.hand,...p.reservedCards].some(c=>!known.has(c.id))
        ||state.pieces.rockets.some(r=>r.playerId===seatId&&rockets.isControllablePlayerRocket(r))
        ||cardEffects.listPendingTriggerKeys(p,t).length
        ||p.reservedCards.some(c=>{const done=c.cardEffectState?.consumedTriggerIds||[];return cardEffects.getCardModel(c)?.triggers?.some(trigger=>!done.includes(trigger.id)&&trigger.event?.type!=="researchTech");})
        ||endScoring.shouldApplyJiuzheThreatPenalty(p,state)
        ||p.reservedCards.some(c=>{const rule=endScoring.resolveCardEndGameRule(c,cardEffects);
          return rule&&!["planetLandingPairs","amibaTraceCount","chongTraceCount"].includes(rule.kind);}))return null;
      const company=industryCatalog.getPlayerIndustryDefinition(p);
      if(company?.activeAbilityId!=="deepspace_swap_cards"||company.passiveIds.length!==1
        ||company.passiveIds[0]!=="deepspace_free_analyze"
        ||state.finalScoring.thresholds.some(n=>!Object.values(state.finalScoring.tiles)
          .some(tile=>tile.marks.some(m=>m.playerId===seatId&&m.threshold===n))))return null;
      const pool=p.dataState?.poolTokens;
      if(!Array.isArray(pool)||pool.length!==p.resources.availableData
        ||pool.some(token=>!Number.isInteger(token.slotIndex)||!Object.hasOwn(data.DATA_POOL_SLOTS,token.slotIndex))
        ||new Set(pool.map(token=>token.slotIndex)).size!==pool.length)return null;
      const jobs=cargo.transportTasksByRocketId;
      if(!jobs||Object.values(jobs).some(job=>!cargo.fossilsById?.[job.fossilId]))return null;
      const owner={...p,resources:{...p.resources,score:null},scoreSources:null,dataState:{poolCount:pool.length}};
      // The cache stores a value delta, never a Native successor. Discard/draw
      // history, token IDs, scan marks and unchanged scoring terms cancel.
      // Actual wallet caps, card runtime state, task count, collision geometry,
      // job/fossil status and the public forbidden pickup coordinate remain.
      const fossils=Object.fromEntries(Object.values(jobs).map(job=>[job.fossilId,cargo.fossilsById[job.fossilId]]));
      return JSON.stringify([owner,t,state.pieces,state.solarSystem,state.finalScoring,
        jobs,fossils,cargo.panelFossilSlots,cargo.unlockedBluePositions,forbiddenCoordinate]);
    }
