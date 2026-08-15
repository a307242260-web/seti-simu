(function () {
  "use strict";

  const dependencies = window.SetiAppDependencies.collectDependencies(window);
  const {
    productionKernel,
    browserRuleComposition,
    projectionAdapter,
    viewStateStore,
    inputAdapter,
    policyInputAdapter,
    browserAiBootstrap,
    trajectoryRecorder,
    trajectoryRecording: trajectoryRecordingModule,
    outcomeModel,
    expectedScoreEvaluator,
    heuristicPolicy,
    actionBar,
    decisionUi,
    residentRenderer,
    gameRecovery,
    publicApi,
    dom,
    finalReadModel,
    browserReadModel,
    finalScoring,
    endGameScoring,
    cardEffects,
    cards,
    initialCards,
    solar,
    planetReferenceLayout,
    planetStats,
    alienPlacement,
    data,
    aliens,
    tech,
  } = dependencies;
  const document = window.document;
  const els = dom.collectElements(document);
  const humanSeat = { playerId: null };
  let automationScheduled = false;
  let refreshScheduled = false;
  let aiDifficulty = "laughable";
  let trajectoryRecording = null;
  let trajectoryGameSequence = 0;
  const actionLog = [];
  const PLAYER_LOG_COLORS = { blue: "#4da3ff", green: "#56d37a", brown: "#b2845a", white: "#f3f5ef" };

  function createBrowserRandom(initialState = 1) {
    let state = Number(initialState) >>> 0 || 1;
    const random = () => {
      state = Math.imul(state ^ (state >>> 15), 1 | state);
      state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
      return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
    };
    random.getState = () => state >>> 0;
    random.setState = (nextState) => { state = Number(nextState) >>> 0 || 1; };
    return random;
  }

  // 固定盘面（开始界面下拉选择）：RNG 起点契约 = hashSeed(seed)，Production
  // Composition 的 createInitialState 显式从该状态开始，Browser 与 Simulation
  // 用同一 seed 得到同一盘面。
  const FIXED_BOARDS = Object.freeze({
    "seti-107": "双发盘面（寰宇动力 / 异星实验室）",
    "seti-free-analyze-v1": "免电分析盘面（异星实验室 / 深空探测）",
  });
  function hashSeed(seed) {
    const text = String(seed);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createRenderPresentation(input = {}) {
    const state = input.state || {};
    const players = input.players || [];
    const viewerId = input.viewer?.playerId || null;
    const publicCards = state.cards?.publicCards || [];
    const own = players.find((player) => String(player?.id) === String(viewerId)) || null;
    const finalPlayers = input.finalReadModel?.players || [];
    const playerColors = {
      blue: "#4da3ff",
      green: "#56d37a",
      brown: "#b2845a",
      white: "#f3f5ef",
    };
    const rocketAssets = {
      blue: "../assets/tokens/rocket-blue.png",
      green: "../assets/tokens/rocket-green.png",
      brown: "../assets/tokens/rocket-brown.png",
      white: "../assets/tokens/rocket-white.png",
    };
    const markerAssets = {
      orbit: {
        blue: "../assets/tokens/normal_token-blue.png",
        green: "../assets/tokens/normal_token-green.png",
        brown: "../assets/tokens/normal_token-brown.png",
        white: "../assets/tokens/normal_token-white.png",
      },
      land: {
        blue: "../assets/tokens/landding-blue.png",
        green: "../assets/tokens/landding-green.png",
        brown: "../assets/tokens/landding-brown.png",
        white: "../assets/tokens/landding-white.png",
      },
      satellite: {
        blue: "../assets/tokens/satellite-blue.png",
        green: "../assets/tokens/satellite-green.png",
        brown: "../assets/tokens/satellite-brown.png",
        white: "../assets/tokens/satellite-white.png",
      },
    };
    function presentBoardToken(token) {
      const boardPoint = Number.isFinite(Number(token.radius))
        && Number.isFinite(Number(token.angleDegrees))
        ? solar.polarToGlobalPoint(Number(token.radius), Number(token.angleDegrees))
        : null;
      return {
        ...structuredClone(token),
        target: "solar-board",
        percentX: boardPoint
          ? (Number(boardPoint.x) / solar.GLOBAL_COORDINATE_SYSTEM.size) * 100
          : null,
        percentY: boardPoint
          ? (Number(boardPoint.y) / solar.GLOBAL_COORDINATE_SYSTEM.size) * 100
          : null,
        imageSrc: token.kind === "chong-fossil" && token.fossilId
          ? aliens.chong.getFossilSrc(token.fossilId)
          : rocketAssets[token.color] || "../assets/tokens/rocket.png",
      };
    }
    function presentPlanetMarkers() {
      const result = [];
      for (const planetId of planetStats.PLANET_IDS) {
        for (const kind of ["orbit", "land"]) {
          const markers = kind === "orbit"
            ? planetStats.getPlanetOrbitMarkers(state.planets, planetId)
            : planetStats.getPlanetLandingMarkers(state.planets, planetId);
          for (const marker of markers) {
            if (!marker.displayed) continue;
            const placement = planetReferenceLayout.getPlanetSlot(
              planetId,
              kind,
              marker.displaySlot,
            );
            if (!placement) continue;
            result.push({
              id: `planet:${planetId}:${kind}:${marker.sequence}`,
              playerId: marker.playerId,
              color: marker.color,
              kind: "planet-marker",
              referenceKind: kind,
              target: "planets-reference",
              percentX: (placement.x / planetReferenceLayout.PLANETS_REFERENCE_SIZE.width) * 100,
              percentY: (placement.y / planetReferenceLayout.PLANETS_REFERENCE_SIZE.height) * 100,
              referenceOffsetTokenWidths: Number(marker.referenceOffsetTokenWidths) || 0,
              imageSrc: markerAssets[kind][marker.color] || markerAssets[kind].white,
            });
          }
        }
        for (const marker of planetStats.getSatelliteLandingMarkers(state.planets, planetId)) {
          const placement = planetReferenceLayout.getSatellitePlacement(
            planetId,
            marker.satelliteId,
          );
          if (!placement) continue;
          result.push({
            id: `planet:${planetId}:satellite:${marker.satelliteId}`,
            playerId: marker.playerId,
            color: marker.color,
            kind: "planet-marker",
            referenceKind: "satellite",
            target: "planets-reference",
            percentX: (placement.x / planetReferenceLayout.PLANETS_REFERENCE_SIZE.width) * 100,
            percentY: (placement.y / planetReferenceLayout.PLANETS_REFERENCE_SIZE.height) * 100,
            referenceOffsetTokenWidths: Number(marker.referenceOffsetTokenWidths) || 0,
            imageSrc: markerAssets.satellite[marker.color] || markerAssets.satellite.white,
          });
        }
      }
      return result;
    }
    const speciesPresentation = {
      九折: {
        api: aliens.jiuzhe,
        layout: alienPlacement.getJiuzheTraceMarkerLayout,
      },
      异常点: {
        api: aliens.yichangdian,
        layout: alienPlacement.getYichangdianTraceMarkerLayout,
      },
      方舟: {
        api: aliens.fangzhou,
        layout: alienPlacement.getFangzhouTraceMarkerLayout,
      },
      半人马: {
        api: aliens.banrenma,
        layout: alienPlacement.getBanrenmaTraceMarkerLayout,
      },
      虫: {
        api: aliens.chong,
        layout: alienPlacement.getChongTraceMarkerLayout,
      },
      阿米巴: {
        api: aliens.amiba,
        layout: alienPlacement.getAmibaTraceMarkerLayout,
      },
      奥陌陌: {
        api: aliens.aomomo,
        layout: alienPlacement.getAomomoTraceMarkerLayout,
      },
      符文族: {
        api: aliens.runezu,
        layout: alienPlacement.getRunezuTraceMarkerLayout,
      },
    };
    const displayedCardIndexField = {
      异常点: "displayedCardIndex",
      方舟: "displayedCard1Index",
      半人马: "displayedCardIndex",
      虫: "displayedCardIndex",
      阿米巴: "displayedCardIndex",
      奥陌陌: "displayedCardIndex",
      符文族: "displayedCardIndex",
    };
    function traceImageSrc(color) {
      return markerAssets.orbit[color] || "../assets/tokens/normal_token.png";
    }
    function presentGenericTraces(slotId, slot) {
      const traces = [];
      for (const traceType of aliens.TRACE_TYPES) {
        const traceSlot = slot?.traces?.[traceType];
        const firstLayout = aliens.getAlienTraceMarkerLayout(slotId, traceType);
        if (traceSlot?.firstPlaced && firstLayout) {
          traces.push({
            id: `alien:${slotId}:${traceType}:first`,
            traceType,
            color: traceSlot.ownerPlayerColor,
            imageSrc: traceImageSrc(traceSlot.ownerPlayerColor),
            layout: structuredClone(firstLayout),
            surface: "state",
          });
        }
        const extraLayout = aliens.getAlienExtraTraceMarkerLayout(slotId, traceType);
        for (let index = 0; index < Number(traceSlot?.extraCount || 0); index += 1) {
          const color = aliens.getExtraTraceOwnerColor(traceSlot, index);
          traces.push({
            id: `alien:${slotId}:${traceType}:extra:${index + 1}`,
            traceType,
            color,
            imageSrc: traceImageSrc(color),
            layout: {
              ...structuredClone(extraLayout),
              percentX: Number(extraLayout?.percentX) + (index % 3 - 1) * 13,
              percentY: Number(extraLayout?.percentY) + (Math.floor(index / 3) - 1) * 13,
            },
            surface: "state",
          });
        }
      }
      return traces;
    }
    function presentSpeciesTraces(slotId, alienId) {
      const species = speciesPresentation[alienId];
      const grid = species?.api?.getTraceGrid?.(state.aliens, slotId);
      if (!grid) return [];
      const traces = [];
      for (const traceType of aliens.TRACE_TYPES) {
        for (const [position, value] of Object.entries(grid[traceType] || {})) {
          const entries = Array.isArray(value) ? value : value ? [value] : [];
          entries.forEach((entry, stackIndex) => {
            const layout = species.layout?.(slotId, traceType, Number(position));
            if (!layout) return;
            const color = entry?.playerColor || entry?.ownerPlayerColor || entry?.color || null;
            traces.push({
              id: entry?.id || `alien:${slotId}:${alienId}:${traceType}:${position}:${stackIndex}`,
              traceType,
              color,
              imageSrc: traceImageSrc(color),
              layout: {
                ...structuredClone(layout),
                percentY: Number(layout.percentY) - stackIndex * 5,
              },
              surface: "face",
            });
          });
        }
      }
      return traces;
    }
    function presentAlienSlots() {
      return aliens.ALIEN_SLOT_IDS.map((slotId) => {
        const slot = aliens.getAlienSlot(state.aliens, slotId);
        const alienId = slot?.revealed ? slot.alienId : null;
        const species = speciesPresentation[alienId];
        const stateKey = {
          九折: "jiuzhe",
          异常点: "yichangdian",
          方舟: "fangzhou",
          半人马: "banrenma",
          虫: "chong",
          阿米巴: "amiba",
          奥陌陌: "aomomo",
          符文族: "runezu",
        }[alienId];
        const resolvedSpeciesState = state.aliens?.[stateKey] || null;
        const displayedCardIndex = resolvedSpeciesState?.[displayedCardIndexField[alienId]];
        const statusLines = [];
        if (alienId === "九折") {
          if (resolvedSpeciesState?.freeScoreThreshold != null) {
            statusLines.push(`免费阈值 ${resolvedSpeciesState.freeScoreThreshold}`);
          }
          if (resolvedSpeciesState?.paidScoreThreshold != null) {
            statusLines.push(`付费阈值 ${resolvedSpeciesState.paidScoreThreshold}`);
          }
        }
        if (alienId === "半人马") {
          const marks = Object.values(resolvedSpeciesState?.scoreMarksByPlayerId || {})
            .flat()
            .filter((mark) => !mark.resolved);
          if (marks.length) statusLines.push(`待结算分数标记 ${marks.length}`);
        }
        return {
          slotId,
          revealed: Boolean(slot?.revealed),
          alienId,
          label: alienId ? aliens.getAlienLabel(alienId) : `外星人 ${slotId}`,
          faceImageSrc: alienId ? aliens.getAlienFaceSrc(alienId) : aliens.ALIEN_BACK_SRC,
          stateImageSrc: `../assets/aliens/state${slotId}.png`,
          displayedCardImageSrc: displayedCardIndex == null
            ? null
            : alienId === "方舟"
              ? species?.api?.getCard1Src?.(displayedCardIndex)
              : species?.api?.getCardSrc?.(displayedCardIndex),
          statusLines,
          traces: [
            ...presentGenericTraces(slotId, slot),
            ...presentSpeciesTraces(slotId, alienId),
            ...(alienId === "符文族"
              ? [
                ...aliens.runezu.listPanelSymbols(state.aliens).flatMap((symbol) => {
                  const layout = alienPlacement.getRunezuPanelSymbolMarkerLayout(
                    slotId,
                    symbol.slotId,
                  );
                  return layout ? [{
                    id: `runezu:panel:${symbol.slotId}`,
                    traceType: "symbol",
                    color: null,
                    imageSrc: aliens.runezu.getSymbolSrc(symbol.symbolId),
                    layout: structuredClone(layout),
                    surface: "face",
                  }] : [];
                }),
                ...aliens.runezu.listFaceSymbolSlots(state.aliens).flatMap((symbol) => {
                  const layout = alienPlacement.getRunezuFaceSymbolSlotMarkerLayout(
                    slotId,
                    symbol.position,
                  );
                  return layout ? [{
                    id: `runezu:face:${symbol.position}`,
                    traceType: "symbol",
                    color: null,
                    imageSrc: aliens.runezu.getSymbolSrc(symbol.symbolId),
                    layout: structuredClone(layout),
                    surface: "face",
                  }] : [];
                }),
              ]
              : []),
          ],
        };
      });
    }
    function polarMarkerPoint(location, radialFraction, angularFraction) {
      if (!location) return null;
      const boundary = solar.getSectorCoordinateBoundary(location.x, location.y);
      const polar = boundary?.polarBoundary;
      if (!polar) return boundary?.boardCenter || null;
      return solar.polarToGlobalPoint(
        polar.innerRadius + (polar.outerRadius - polar.innerRadius) * radialFraction,
        polar.startAngleDegrees
          + (polar.endAngleDegrees - polar.startAngleDegrees) * angularFraction,
      );
    }
    function presentAlienBoardMarkers() {
      const planetLocations = input.boardCoordinate?.planetLocations || [];
      const anomalies = (state.aliens?.yichangdian?.anomalies || []).flatMap((anomaly) => {
        const point = aliens.getYichangdianAnomalyMarkerBoardPoint(solar, anomaly);
        return point ? [{
          id: `anomaly:${anomaly.markerId}:${anomaly.sectorX}`,
          imageSrc: aliens.yichangdian.getAnomalyMarkerSrc(anomaly.markerId),
          percentX: (point.x / solar.GLOBAL_COORDINATE_SYSTEM.size) * 100,
          percentY: (point.y / solar.GLOBAL_COORDINATE_SYSTEM.size) * 100,
        }] : [];
      });
      const planetFossils = ["jupiter", "saturn"].flatMap((planetId) => {
        const fossils = aliens.chong.getAvailablePlanetFossils(state.aliens, planetId);
        const point = fossils.length
          ? polarMarkerPoint(
            planetLocations.find((planet) => planet.planetId === planetId),
            0.78,
            0.72,
          )
          : null;
        return point ? [{
          id: `chong-fossils:${planetId}`,
          planetId,
          count: fossils.length,
          imageSrc: aliens.CHONG_FOSSIL_BACK_SRC,
          percentX: (point.x / solar.GLOBAL_COORDINATE_SYSTEM.size) * 100,
          percentY: (point.y / solar.GLOBAL_COORDINATE_SYSTEM.size) * 100,
        }] : [];
      });
      const runezuSymbols = aliens.runezu.listSourceSymbols(state.aliens).flatMap((symbol) => {
        if (symbol.claimedByPlayerId || symbol.claimedByPlayerColor) return [];
        if (symbol.sourceType === "tech") {
          return [{
            id: `runezu:${symbol.sourceType}:${symbol.sourceId}`,
            target: "tech",
            sourceId: symbol.sourceId,
            imageSrc: aliens.runezu.getSymbolSrc(symbol.symbolId),
          }];
        }
        let point = null;
        if (symbol.sourceType === "planet") {
          point = polarMarkerPoint(
            planetLocations.find((planet) => planet.planetId === symbol.sourceId),
            0.72,
            0.72,
          );
        } else if (symbol.sourceType === "sector") {
          for (let x = 0; x < 8 && !point; x += 1) {
            const nebula = solar.getNebulaAtCoordinate(
              x,
              5,
              state.solarSystem?.sectorBySlot,
            );
            if (nebula?.id !== symbol.sourceId) continue;
            point = polarMarkerPoint({ x, y: 5 }, 0.38, 0.72);
          }
        }
        return point ? [{
          id: `runezu:${symbol.sourceType}:${symbol.sourceId}`,
          target: "solar-board",
          sourceId: symbol.sourceId,
          imageSrc: aliens.runezu.getSymbolSrc(symbol.symbolId),
          percentX: (point.x / solar.GLOBAL_COORDINATE_SYSTEM.size) * 100,
          percentY: (point.y / solar.GLOBAL_COORDINATE_SYSTEM.size) * 100,
        }] : [];
      });
      return { anomalies, planetFossils, runezuSymbols };
    }
    function presentSectorData() {
      return Object.fromEntries([1, 2, 3, 4].map((sectorId) => {
        const tokens = [];
        const wins = [];
        for (const nebulaId of data.listNebulaIdsForSector(sectorId)) {
          for (const token of data.listNebulaTokens(state.data, nebulaId)) {
            const layout = data.getNebulaDataSlotLayout(nebulaId, token.slotIndex);
            if (!layout) continue;
            tokens.push({
              id: token.id,
              nebulaId,
              slotIndex: token.slotIndex,
              imageSrc: token.replacedByPlayerColor
                ? traceImageSrc(token.replacedByPlayerColor)
                : data.DATA_TOKEN_SRC,
              panelRegion: structuredClone(data.getNebulaPanelRegion(nebulaId)),
              layout: structuredClone(layout),
              displayScale: Number(data.DATA_TOKEN_DISPLAY_SCALE) || 3.5,
            });
          }
          for (const record of data.listSectorWinRecords(state.data, nebulaId)) {
            const layout = data.getSectorWinMarkerLayout(
              nebulaId,
              record.slotKind,
              record.markerIndex,
            );
            if (!layout) continue;
            wins.push({
              id: `sector-win:${nebulaId}:${record.settlementNumber}`,
              nebulaId,
              playerColor: record.playerColor,
              imageSrc: traceImageSrc(record.playerColor),
              layout: structuredClone(layout),
            });
          }
        }
        return [String(sectorId), { tokens, wins }];
      }));
    }
    function presentAomomoData() {
      if (!state.solarSystem?.aomomoActive) return [];
      const location = input.boardCoordinate?.planetLocations?.find(
        (planet) => planet.planetId === "aomomo",
      );
      if (!location) return [];
      const boundary = solar.getSectorCoordinateBoundary(location.x, 3);
      if (!boundary) return [];
      return data.listNebulaTokens(state.data, data.AOMOMO_NEBULA_ID).flatMap((token) => {
        const slot = data.getNebulaDataSlotLayout(data.AOMOMO_NEBULA_ID, token.slotIndex);
        if (!slot) return [];
        const radialSpan = boundary.polarBoundary.outerRadius - boundary.polarBoundary.innerRadius;
        const angleSpan = boundary.polarBoundary.endAngleDegrees - boundary.polarBoundary.startAngleDegrees;
        const radius = boundary.polarBoundary.innerRadius + radialSpan * Number(slot.radialFraction);
        const angle = boundary.polarBoundary.startAngleDegrees
          + angleSpan * Number(slot.angularFraction);
        const point = solar.polarToGlobalPoint(radius, angle);
        return [{
          id: token.id,
          nebulaId: data.AOMOMO_NEBULA_ID,
          imageSrc: token.replacedByPlayerColor
            ? traceImageSrc(token.replacedByPlayerColor)
            : data.DATA_TOKEN_SRC,
          percentX: (point.x / solar.GLOBAL_COORDINATE_SYSTEM.size) * 100,
          percentY: (point.y / solar.GLOBAL_COORDINATE_SYSTEM.size) * 100,
        }];
      });
    }
    function presentCard(card, fallbackLabel) {
      const entry = cards.getCatalogEntryForCard(card);
      const alienModuleBySet = {
        "alien:异常点": aliens.yichangdian,
        "alien:半人马": aliens.banrenma,
        "alien:虫": aliens.chong,
        "alien:阿米巴": aliens.amiba,
        "alien:奥陌陌": aliens.aomomo,
        "alien:符文族": aliens.runezu,
      };
      const alienModule = alienModuleBySet[card?.set] || null;
      const alienDefinition = alienModule?.getCardDefinition
        ? alienModule.getCardDefinition(card)
        : alienModule?.CARD_BY_ID?.[card?.cardId] || null;
      const fangzhouDefinition = card?.fangzhouCard2
        ? aliens.fangzhou.createCard2Definition(
          card.fangzhouTraceType || card.traceType,
          card.variant,
        )
        : null;
      return {
        id: card?.id || card?.cardId || fallbackLabel,
        definitionId: card?.cardId || entry?.card_id || null,
        imageSrc: fangzhouDefinition?.src
          || (alienDefinition && alienModule?.getCardSrc
            ? alienModule.getCardSrc(alienDefinition.index)
            : entry ? cards.getCardSrc(entry) : ""),
        label: fangzhouDefinition?.cardName
          || alienDefinition?.cardName
          || entry?.card_name
          || card?.cardId
          || fallbackLabel,
        incomeGain: structuredClone(cards.getIncomeGainForCard?.(card) || null),
      };
    }
    function presentInitialSelection(setup) {
      const source = structuredClone(setup || {});
      if (!source.offer) return source;
      const presentOption = (card) => {
        const value = card?.value;
        const industry = card?.kind === "industry";
        const label = industry
          ? String(value || "").replace(/\.[^./\\]+$/, "")
          : initialCards.getInitialCardEffect(Number(value))?.label || `资源牌 ${value}`;
        return {
          ...structuredClone(card),
          label,
          imageSrc: industry
            ? `../assets/industry/${value}`
            : `../assets/initial_card/split/${value}.png`,
        };
      };
      source.offer.industryOptions = (source.offer.industryOptions || []).map(presentOption);
      source.offer.initialOptions = (source.offer.initialOptions || []).map(presentOption);
      return source;
    }
    const resourceIcons = {
      credits: "../assets/symbol/effect/credits.webp",
      energy: "../assets/symbol/effect/energy.webp",
      publicity: "../assets/symbol/effect/publicity.webp",
      availableData: "../assets/symbol/effect/data.webp",
      additionalPublicScan: "../assets/symbol/effect/scan_action.webp",
      aomomoFossils: "../assets/aliens/奥陌陌/fossil.webp",
    };
    const resourceLabels = {
      credits: "信用点",
      energy: "能量",
      publicity: "宣传",
      availableData: "可用数据",
      additionalPublicScan: "额外公共扫描",
      aomomoFossils: "奥陌陌化石",
    };
    const rotateStateSlots = [
      { id: "top-left", percentX: 34.81, percentY: 27.3 },
      { id: "bottom-left", percentX: 34.15, percentY: 71.18 },
      { id: "right-middle", percentX: 76.68, percentY: 49.96 },
    ];
    const rotationCount = Number(state.solarSystem?.rotation?.rotationCount) || 0;
    return {
      boardChrome: {
        wheelTransforms: [1, 2, 3, 4].map((wheelId) => ({
          wheelId,
          degrees: solar.getWheelStep(state.solarSystem?.rotation, wheelId) * 45,
        })),
        sectors: Object.entries(state.solarSystem?.sectorBySlot || {}).map(
          ([slotId, sectorId]) => ({ slotId: Number(slotId), sectorId: Number(sectorId) }),
        ),
        aomomoWheelImageSrc: state.solarSystem?.aomomoActive
          ? aliens.AOMOMO_WHEEL3_AMM_SRC
          : null,
        rotateTokenSlot: structuredClone(
          rotateStateSlots[((rotationCount % rotateStateSlots.length) + rotateStateSlots.length)
            % rotateStateSlots.length],
        ),
      },
      tokenPresentation: {
        activeRocketId: input.boardCoordinate?.activeRocketId || null,
        draggingRocketId: null,
        tokens: [
          ...(input.boardCoordinate?.tokens || []).map(presentBoardToken),
          ...presentPlanetMarkers(),
        ],
      },
      playerPanels: {
        currentPlayerId: input.turnFlow?.currentPlayerId || null,
        interfacePlayerId: viewerId,
        players: players.map((player) => ({
          ...structuredClone(player),
          displayName: player.name || player.id,
          uiColor: player.uiColor || playerColors[player.color] || "",
          score: Number(player.resources?.score || player.score || 0),
          resourceStats: Object.keys(resourceLabels).map((key) => ({
            label: resourceLabels[key],
            value: key === "publicity"
              ? `${Number(player.resources?.publicity) || 0}/10`
              : Number(player.resources?.[key]) || 0,
            iconSrc: resourceIcons[key],
          })),
        })),
      },
      turnPresentation: structuredClone(input.turnFlow || {}),
      cardPanels: {
        publicCards: publicCards.map((card, index) => ({
          ...presentCard(card, `公共牌 ${index + 1}`),
          empty: !card,
          selectable: false,
          selected: false,
        })),
        handCards: (own?.hand || []).map((card, index) => (
          presentCard(card, `手牌 ${index + 1}`)
        )),
        publicControls: {},
        handPanel: { count: own?.hand?.length || 0, empty: !own?.hand?.length },
        initialSelection: presentInitialSelection(input.initialSetup),
        reservedCards: {
          items: (own?.reservedCards || []).map((card, index) => (
            presentCard(card, `保留牌 ${index + 1}`)
          )),
        },
      },
      dataPresentation: {
        playerTokens: (own?.dataState?.placedTokens || []).map((token) => ({
            ...structuredClone(token),
            imageSrc: "../assets/tokens/data.png",
          })),
        blueDropZones: [],
        sectorTokensBySectorId: presentSectorData(),
        aomomoTokens: presentAomomoData(),
      },
      markerPresentation: presentAlienBoardMarkers(),
      alienPresentation: { slots: presentAlienSlots() },
      techTilePresentation: {
        supplyTiles: Object.values(state.tech?.stacks || {}).map((stack) => ({
          tileId: stack.tileId,
          remaining: Number(stack.remaining) || 0,
          bonusId: stack.bonusId || null,
          bonusImageSrc: stack.bonusId ? `../assets/tech_tile/${stack.bonusId}.png` : "",
          firstTakeAvailable: stack.firstTakeClaimedBy == null,
        })),
        playerTiles: Object.keys(own?.techState?.ownedTiles || {}).map((tileId) => {
          const blueSlot = own?.techState?.blueBoardSlots?.[tileId] || null;
          return {
            tileId,
            imageSrc: `../assets/tech_tile/${tileId}.png`,
            disabled: Boolean(own?.techState?.disabledTiles?.[tileId]),
            layout: structuredClone(tech.getPlacementLayout(tileId, blueSlot)),
          };
        }),
      },
      finalScorePresentation: {
        tiles: structuredClone(state.finalScoring?.tiles || {}),
        tileVariants: structuredClone(state.finalScoring?.tileVariants || {}),
        breakdownsByPlayerId: Object.fromEntries(finalPlayers.map((player) => [
          String(player.id),
          structuredClone(player.breakdown || {}),
        ])),
      },
    };
  }

  const finalReadModelOwner = finalReadModel.createFinalReadModelOwner({
    finalScoring,
    endGameScoring,
    cardEffects,
  });
  const browserReadModelOwner = browserReadModel.createBrowserReadModelOwner({
    solar,
    aliens,
    tech,
  });
  const browserRandom = createBrowserRandom();
  const ruleComposition = browserRuleComposition.createBrowserRuleComposition({
    productionKernelApi: productionKernel,
    random: browserRandom,
    browserProjection: {
      visibilityPolicy: projectionAdapter.defaultVisibilityPolicy,
      getFinalReadModelOwner: () => finalReadModelOwner,
      getBrowserReadModelOwner: () => browserReadModelOwner,
      createRenderPresentation,
    },
  });
  const residentViewState = viewStateStore.createViewStateStore();

  function getViewer() {
    return humanSeat.playerId == null
      ? { viewerId: "browser:spectator", playerId: null, role: "spectator" }
      : {
        viewerId: `browser:player:${humanSeat.playerId}`,
        playerId: String(humanSeat.playerId),
        role: "player",
      };
  }

  const canonicalProjection = projectionAdapter.createBrowserProjectionAdapter({
    stateSource: ruleComposition.projectionSource,
    sourceStateIsVisible: true,
    decisionPresenter: projectionAdapter.defaultDecisionPresenter,
    createActionContext: ({ state }) => ({ actorId: state?.match?.currentPlayerId ?? null }),
    actionAdapter: {
      enumerate(context) {
        return ruleComposition.inputPort.enumerateActions(
          context.actorId == null ? {} : { actorId: context.actorId },
        );
      },
    },
  });

  function readProjection() {
    return canonicalProjection.projectSource({ viewer: getViewer() });
  }

  function rawDispatchAction(action) {
    return action?.phase === "quick"
      ? ruleComposition.inputPort.submitQuickAction(action)
      : ruleComposition.inputPort.submitAction(action);
  }

  function rawSubmitDecision(submission) {
    return ruleComposition.inputPort.submitDecision(submission);
  }

  const residentInput = inputAdapter.createBrowserInputAdapter({
    dispatchAction(action) {
      const result = trajectoryRecording
        ? trajectoryRecording.dispatchAction(action, rawDispatchAction)
        : rawDispatchAction(action);
      if (result?.ok) {
        recordActionLog("action", action.actorId, action.family, action.summary || action.family);
      }
      return result;
    },
    submitDecision(submission) {
      const result = trajectoryRecording
        ? trajectoryRecording.submitDecision(submission, rawSubmitDecision)
        : rawSubmitDecision(submission);
      if (result?.ok) recordDecisionLog(submission);
      return result;
    },
    viewStateStore: residentViewState,
    refreshProjection: readProjection,
  });
  const humanActionInput = inputAdapter.createHumanActionInputAdapter({
    readLegalActions: () => ruleComposition.inputPort.enumerateActions({}),
    dispatchAction: (action) => residentInput.dispatchAction(action),
    afterDispatch: () => scheduleRefreshAndAutomation(),
  });
  const humanDecisionInput = inputAdapter.createHumanDecisionInputAdapter({
    readDecisionProjection: () => readProjection().decision,
    readActiveDecision: () => ruleComposition.inspect().session?.decision || null,
    submitDecision: (submission) => residentInput.submitDecision(submission),
    afterSubmit: () => scheduleRefreshAndAutomation(),
  });
  const browserAi = browserAiBootstrap.createBrowserAiBootstrap({
    ruleComposition,
    outcomeModel,
    expectedScoreEvaluator,
    policyInputAdapterModule: policyInputAdapter,
    projectionAdapter: canonicalProjection,
    inputAdapter: residentInput,
    createPolicy: () => heuristicPolicy.createHeuristicPolicy({ difficulty: aiDifficulty }),
    projectionSource: ruleComposition.projectionSource,
    isMachineSeat: (seatId) => (
      humanSeat.playerId != null && String(seatId) !== String(humanSeat.playerId)
    ),
  });

  function createTrajectoryRecording() {
    trajectoryGameSequence += 1;
    return trajectoryRecordingModule.createTrajectoryRecordingAdapter({
      createRecorder: () => trajectoryRecorder.createTrajectoryRecorder({
        seed: `browser-human-${Date.now()}-${trajectoryGameSequence}`,
        mode: "human-demo",
        episodeIndex: 0,
      }),
      enumerateActions: () => ruleComposition.inputPort.enumerateActions({}),
      inspectDecision: () => ruleComposition.inspect().session?.decision || null,
      projectObservation: (seatId) => (
        outcomeModel.createDecisionObservation(
          canonicalProjection.projectSource({
            viewer: {
              viewerId: `browser:record:${seatId}`,
              playerId: seatId,
              role: "player",
            },
          }),
          { seatId },
        )
      ),
      createReward: (before, after) => outcomeModel.createReward(before, after),
      isMachineSeat: (seatId) => (
        humanSeat.playerId != null && String(seatId) !== String(humanSeat.playerId)
      ),
      isTerminal: () => {
        const state = ruleComposition.projectionSource.read({
          viewerId: "browser:recorder",
          playerId: null,
          role: "spectator",
        }).state;
        return Boolean(state?.turn?.gameEnded && state?.match?.finalScoringSettled === true);
      },
      readFinalPlayers: () => {
        const projection = readProjection();
        return (projection.resident?.players?.players || []).map((player) => ({
          playerId: player.id ?? player.playerId ?? null,
          score: Number(player.resources?.score ?? player.score ?? 0),
          finalScore: Number(player.finalScore ?? player.resources?.score ?? player.score ?? 0),
        }));
      },
      onFinalized: (recorder) => {
        const stepCount = recorder.getStepCount();
        console.info(`本局轨迹已录制完成：${stepCount} 个已确认输入（self-play 格式）`);
        downloadTrajectory(recorder);
      },
    });
  }

  function downloadTrajectory(recorder) {
    const jsonl = recorder.getJsonl();
    if (!jsonl) return;
    const blob = new Blob([jsonl], { type: "application/x-ndjson;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `seti-demo-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  // 存盘：用规则内核正规存档 API（lifecycle.save）导出完整 committed state，
  // 写入 localStorage 并下载 JSON，方便开发者读取排查
  function saveGameStateToLocal() {
    let saved = null;
    try {
      saved = ruleComposition.lifecycle.save();
    } catch (error) {
      console.error("读取游戏状态失败", error);
      window.alert(`读取游戏状态失败：${error?.message || error}`);
      return;
    }
    if (!saved?.ok) {
      console.error("读取游戏状态失败", saved);
      window.alert(`读取游戏状态失败：${saved?.message || saved?.code || "内核 save 失败"}`);
      return;
    }
    const envelope = saved.envelope || {};
    let readableState = null;
    try {
      readableState = envelope.committedState ? JSON.parse(envelope.committedState) : null;
    } catch (error) {
      console.warn("committedState 解析失败，仅保留序列化原文", error);
    }
    const meta = readableState?.meta || {};
    const payload = {
      schema: "seti-browser-save-v2",
      savedAt: new Date().toISOString(),
      seed: meta?.seed ?? null,
      gameId: meta?.gameId ?? null,
      rulesetVersion: meta?.rulesetVersion ?? null,
      stateVersion: meta?.stateVersion ?? null,
      committedState: envelope.committedState || null,
      session: envelope.session || null,
      readableState,
    };
    const json = JSON.stringify(payload, null, 2);
    let storedLocally = false;
    try {
      localStorage.setItem("seti-browser-save", json);
      storedLocally = true;
    } catch (error) {
      console.warn("localStorage 存档失败", error);
    }
    // 文件名中的 seed 可能含路径/空格等非法字符，统一安全化避免下载被浏览器拦截
    const safeSeed = String(meta?.seed ?? "game")
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "game";
    const fileName = `seti-save-${safeSeed}-v${meta?.stateVersion ?? 0}.json`;
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    window.alert(
      `状态已保存（${storedLocally ? "localStorage + " : ""}开始下载 ${fileName}）\n`
      + "请在浏览器下载栏找到该文件，放到仓库目录或告诉我路径，便于排查。",
    );
  }

  ruleComposition.subscribe((event) => {
    if (trajectoryRecording && event?.source === "session" && event?.event?.type === "opened") {
      trajectoryRecording.onSessionOpened();
    }
  });

  const decisionController = decisionUi.createDecisionUiController({
    dispatchIntent(intent) {
      if (intent?.kind === "decision") return humanDecisionInput.submit(intent.submission);
      const result = residentInput.dispatchIntent(intent);
      scheduleRefresh();
      return result;
    },
  });
  const decisionRenderer = decisionUi.createDecisionDomRenderer({
    root: document.getElementById("compositionDecisionRoot"),
    controller: decisionController,
  });
  const desktopRenderer = residentRenderer.createResidentRenderer({ document, els });
  const renderDesktop = residentRenderer.createDesktopRenderPort({
    createRenderInput() {
      const projection = readProjection();
      residentViewState.reconcileProjection(projection);
      return { projection, viewState: residentViewState.getSnapshot() };
    },
    renderer: desktopRenderer,
    decisionRenderer,
  });

  function selectActionBarProjection() {
    return actionBar.selectActionBarProjection(readProjection(), {
      inspection: ruleComposition.inspect(),
    });
  }
  const desktopActionBar = actionBar.createBrowserDesktopActionBarController({
    projectionPort: { getProjection: selectActionBarProjection },
    inputPort: {
      dispatchIntent(intent) {
        if (intent?.kind !== "action") {
          return { ok: false, code: "BROWSER_ACTION_INTENT_INVALID", message: "仅接受 Standard Action" };
        }
        return humanActionInput.submit(intent.action);
      },
    },
    hostPort: {
      els,
      getViewerCompany() {
        const projection = readProjection();
        const viewerId = projection?.viewer?.playerId;
        if (viewerId == null) return null;
        return projection?.players?.[String(viewerId)]?.companyLabel || null;
      },
      getSelectedHandCardId() {
        const entity = residentViewState.getSnapshot().focus.entityRef;
        return entity?.kind === "hand-card" ? String(entity.id) : null;
      },
      syncFinalResultButton() {},
    },
  });

  const browserCheckpoint = gameRecovery.createBrowserCheckpointAdapter({
    ruleLifecycle: ruleComposition.lifecycle,
    viewStateStore: residentViewState,
    viewSchemaVersion: viewStateStore.SCHEMA_VERSION,
  });

  function renderInitialSelection(projection) {
    const setup = projection.resident?.initialSetup || {};
    els.initialSelectionArea.hidden = !setup.active;
    if (!setup.active) {
      els.initialSelectionArea.replaceChildren();
      return;
    }
    const marker = document.createElement("button");
    marker.type = "button";
    marker.disabled = true;
    marker.className = "initial-selection-card-button";
    marker.textContent = setup.interactive ? "请在决策框完成初始选择" : "等待其他玩家完成初始选择";
    els.initialSelectionArea.replaceChildren(marker);
  }

  function refresh() {
    const projection = readProjection();
    renderDesktop();
    renderInitialSelection(projection);
    desktopActionBar.updateActionButtons();
    renderActionLog();
    return projection;
  }

  function scheduleRefresh() {
    if (refreshScheduled) return;
    refreshScheduled = true;
    queueMicrotask(() => {
      refreshScheduled = false;
      refresh();
    });
  }

  function scheduleAutomation() {
    if (automationScheduled) return;
    const seatId = browserAi.machinePlayerPort.inspect().seatId;
    if (!seatId || String(seatId) === String(humanSeat.playerId)) return;
    automationScheduled = true;
    window.setTimeout(async () => {
      let result;
      try {
        result = await browserAi.machinePlayerPort.runOnce();
      } finally {
        automationScheduled = false;
      }
      if (result?.ok) scheduleRefreshAndAutomation();
      else if (result?.code !== "BROWSER_MACHINE_SEAT_NOT_CONTROLLED") {
        console.error("Browser Machine Player 已暂停", result);
      }
    }, 0);
  }

  function scheduleRefreshAndAutomation() {
    scheduleRefresh();
    scheduleAutomation();
  }

  function recordActionLog(kind, playerId, family, summary) {
    const projection = readProjection();
    const match = projection.match || {};
    const players = projection.playerPanels?.players || [];
    const player = players.find((entry) => String(entry?.id) === String(playerId));
    actionLog.push({
      seq: actionLog.length + 1,
      playerId: String(playerId),
      playerName: player?.displayName || player?.name || String(playerId),
      color: player?.color || "",
      kind,
      family,
      summary: String(summary || family || kind),
      round: Number(match.roundNumber) || 1,
      turn: Number(match.turnNumber) || 1,
    });
  }

  function recordDecisionLog(submission) {
    const decision = ruleComposition.inspect().session?.decision || null;
    const choice = (decision?.choices || []).find((candidate) => (
      String(candidate?.choiceId) === String(submission?.choice?.choiceId)
    ));
    recordActionLog(
      "decision",
      submission?.ownerId,
      choice?.family || "decision",
      choice?.summary || choice?.label || submission?.choice?.choiceId,
    );
  }

  function renderActionLog() {
    if (!els.actionLogList) return;
    els.actionLogList.replaceChildren(...actionLog.map((entry) => {
      const row = document.createElement("div");
      row.className = "action-log-row";
      const player = document.createElement("span");
      player.className = "action-log-player";
      player.textContent = entry.playerName;
      if (PLAYER_LOG_COLORS[entry.color]) player.style.color = PLAYER_LOG_COLORS[entry.color];
      const summary = document.createElement("span");
      summary.className = "action-log-summary";
      summary.textContent = entry.summary;
      const meta = document.createElement("span");
      meta.className = "action-log-meta";
      meta.textContent = `R${entry.round} T${entry.turn}`;
      row.append(player, summary, meta);
      return row;
    }));
    if (els.actionLogList.scrollTop != null) {
      els.actionLogList.scrollTop = els.actionLogList.scrollHeight;
    }
  }

  function findSingleAction(family, predicate = () => true) {
    const actions = humanActionInput.listLegalActions()
      .filter((action) => action.family === family && predicate(action));
    return actions.length === 1 ? actions[0] : null;
  }

  // 选择固定盘面 = 预填对应 seed 并锁定；选"无"后清空，回到普通局。
  function syncFixedBoardSeedInput() {
    if (!els.startSeedInput) return;
    const fixedSeed = els.startFixedBoard?.value || "";
    if (fixedSeed) {
      els.startSeedInput.value = fixedSeed;
      els.startSeedInput.disabled = true;
    } else {
      els.startSeedInput.value = "";
      els.startSeedInput.disabled = false;
    }
  }

  function startNewGame() {
    const fixedSeed = els.startFixedBoard?.value || "";
    const seedText = (els.startSeedInput?.value || "").trim();
    const seeded = Boolean(seedText || fixedSeed);
    const seed = seedText || fixedSeed || null;
    // 有种子（固定盘面或自定义）时与训练侧 Simulation 对齐：4 人局、weak_start、
    // RNG 起点 = hashSeed(seed)。
    const activePlayerCount = seeded
      ? 4
      : Math.max(2, Math.min(4, Number(els.startPlayerCount?.value) || 4));
    aiDifficulty = seeded
      ? "weak_start"
      : (els.startAiDifficulty?.value || "laughable");
    trajectoryRecording = els.startRecordTrajectory?.checked === true
      ? createTrajectoryRecording()
      : null;
    if (trajectoryRecording) trajectoryRecording.reset();
    actionLog.length = 0;
    browserRandom.setState(seed ? hashSeed(seed) : 1);
    const result = ruleComposition.newGame({
      activePlayerCount,
      aiDifficulty,
      rngState: {
        algorithm: "seti-browser-mulberry32-v1",
        state: browserRandom.getState(),
      },
    });
    if (result?.ok === false) throw new Error(result.message || result.code);
    const spectator = ruleComposition.projectionSource.read({
      viewerId: "browser:spectator",
      playerId: null,
      role: "spectator",
    }).state;
    humanSeat.playerId = spectator.match?.currentPlayerId
      || Object.keys(spectator.players || {})[0]
      || null;
    const startAction = findSingleAction(
      "choose_card",
      (action) => action.target?.kind === "start_initial_setup",
    );
    if (!startAction) throw new Error("Production Composition 未提供 start_initial_setup");
    const started = humanActionInput.submit(startAction);
    if (started?.ok === false) throw new Error(started.message || started.code);
    els.startScreen.hidden = true;
    if (els.appWrap) els.appWrap.hidden = false;
    scheduleRefreshAndAutomation();
  }

  function bindActionButton(button) {
    button?.addEventListener("click", () => {
      if (!button.dataset.actionId) return;
      residentInput.dispatchIntent({ kind: "view", type: "focus.clear" });
      const result = desktopActionBar.activateAction(button.dataset.actionId);
      if (result?.ok === false) throw new Error(result.message || result.code);
      scheduleRefreshAndAutomation();
    });
  }

  els.startScreenStartButton?.addEventListener("click", startNewGame);
  els.startFixedBoard?.addEventListener("change", syncFixedBoardSeedInput);
  syncFixedBoardSeedInput();

  function openCardViewer(src, alt) {
    if (!els.cardViewer || !els.cardViewerImage) return;
    els.cardViewerImage.src = src || "";
    els.cardViewerImage.alt = alt || "卡牌";
    els.cardViewer.hidden = false;
  }
  function closeCardViewer() {
    if (els.cardViewer) els.cardViewer.hidden = true;
  }
  els.publicCardRow?.addEventListener("click", (event) => {
    const image = event.target.closest(".public-card");
    if (!image?.src) return;
    openCardViewer(image.src, image.alt);
  });
  els.reservedCardFan?.addEventListener("click", (event) => {
    const image = event.target.closest(".reserved-card");
    if (!image?.src) return;
    openCardViewer(image.src, image.alt);
  });
  els.cardViewer?.addEventListener("click", closeCardViewer);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCardViewer();
  });
  [
    els.actionLaunchButton, els.actionOrbitButton, els.actionLandButton, els.actionScanButton,
    els.actionAnalyzeButton, els.actionPlayCardButton, els.actionResearchTechButton,
    els.actionPlaceDataButton,
    els.actionPassButton, els.actionConfirmButton,
  ].forEach(bindActionButton);
  els.playerHandFan?.addEventListener("click", (event) => {
    const card = event.target.closest?.("[data-hand-card-id]");
    if (!card) return;
    const cardId = String(card.dataset.handCardId);
    const selected = residentViewState.getSnapshot().focus.entityRef;
    residentInput.dispatchIntent({
      kind: "view",
      type: selected?.kind === "hand-card" && String(selected.id) === cardId
        ? "focus.clear"
        : "focus.set",
      ...(selected?.kind === "hand-card" && String(selected.id) === cardId
        ? {}
        : { entityRef: { kind: "hand-card", id: cardId }, controlId: "player-hand" }),
    });
    scheduleRefresh();
  });
  els.actionQuickButton?.addEventListener("click", () => desktopActionBar.toggleQuickPanel());
  els.actionSaveStateButton?.addEventListener("click", saveGameStateToLocal);
  els.quickActionsTrades?.addEventListener("click", (event) => {
    const button = event.target.closest?.(
      "[data-quick-trade][data-action-id], [data-quick-action][data-action-id]",
    );
    if (!button || button.disabled || !button.dataset.actionId) return;
    const result = desktopActionBar.activateAction(button.dataset.actionId);
    if (result?.ok === false) throw new Error(result.message || result.code);
    scheduleRefreshAndAutomation();
  });
  els.actionUndoButton?.addEventListener("click", () => {
    const inspection = ruleComposition.inspect();
    const result = ruleComposition.inputPort.undo({
      sessionId: inspection.session?.sessionId || null,
      revision: inspection.session?.revision ?? null,
    });
    if (result?.ok === false) throw new Error(result.message || result.code);
    if (trajectoryRecording && result?.journal) {
      trajectoryRecording.reconcile(result.journal.replay?.length);
    }
    scheduleRefreshAndAutomation();
  });

  // 太阳系转动预览：纯前端计算未来几次转动的轮盘位置，不修改任何游戏状态。
  const SOLAR_PREVIEW_STEPS = 3;
  function renderSolarPreview() {
    if (!els.solarPreviewBody) return;
    const projection = readProjection();
    const rotation = structuredClone(
      projection.resident?.solar?.rotation
      ?? projection.solarSystem?.rotation
      ?? null,
    );
    if (!rotation || typeof rotation !== "object") {
      els.solarPreviewBody.replaceChildren();
      return;
    }
    const rows = [];
    const rotations = [rotation];
    for (let step = 1; step <= SOLAR_PREVIEW_STEPS; step += 1) {
      rotations.push(solar.applySolarOrbitRotation(
        structuredClone(rotations[rotations.length - 1]),
        1,
      ));
    }
    const visibleWheelIds = solar.VISIBLE_WHEEL_IDS || [1, 2, 3, 4];
    for (let step = 0; step < rotations.length; step += 1) {
      const wheelDegrees = visibleWheelIds.map((wheelId) => (
        solar.getWheelStep(rotations[step], wheelId) * 45
      ));
      const row = document.createElement("div");
      row.className = "solar-preview-row";
      const label = document.createElement("span");
      label.className = "solar-preview-step";
      label.textContent = step === 0 ? "当前" : `+${step} 次`;
      row.appendChild(label);
      visibleWheelIds.forEach((wheelId, index) => {
        const cell = document.createElement("span");
        cell.className = "solar-preview-wheel";
        cell.textContent = `轮${index + 1} ${wheelDegrees[index]}°`;
        row.appendChild(cell);
      });
      rows.push(row);
    }
    els.solarPreviewBody.replaceChildren(...rows);
  }
  els.solarPreviewButton?.addEventListener("click", () => {
    if (!els.solarPreviewPanel) return;
    renderSolarPreview();
    els.solarPreviewPanel.hidden = !els.solarPreviewPanel.hidden;
  });
  els.solarPreviewClose?.addEventListener("click", () => {
    if (els.solarPreviewPanel) els.solarPreviewPanel.hidden = true;
  });

  window.SetiRandomizer = publicApi.createPublicApi({
    structuredClone,
    inspectProjection: readProjection,
    inspectInput: () => residentInput.inspectInputState(),
    inspectMachinePlayer: () => browserAi.machinePlayerPort.inspect(),
    capture: () => browserCheckpoint.capture(),
    restore(envelope) {
      const result = browserCheckpoint.restore(envelope);
      if (result?.ok) {
        if (trajectoryRecording) trajectoryRecording.reset();
        scheduleRefreshAndAutomation();
      }
      return result;
    },
    dispatchAction: (action) => humanActionInput.submit(action),
    submitDecision: (submission) => humanDecisionInput.submit(submission),
    getRecordedTrajectory: () => (trajectoryRecording ? trajectoryRecording.getJsonl() : null),
    isTrajectoryRecordingEnabled: () => trajectoryRecording != null,
  });

  if (els.appWrap) els.appWrap.hidden = false;
  refresh();
})();
