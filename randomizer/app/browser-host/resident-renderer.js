(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserResidentRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-browser-host-v1";

  function assertInput(input) {
    if (!input?.projection || input.projection.schemaVersion !== SCHEMA_VERSION) {
      throw new TypeError(`常驻 renderer 需要 ${SCHEMA_VERSION} BrowserProjection`);
    }
    if (!input.viewState || typeof input.viewState !== "object") {
      throw new TypeError("常驻 renderer 需要 ViewState");
    }
    return input.projection;
  }

  function text(value) {
    return value == null ? "" : String(value);
  }

  function getRenderModel(projection) {
    return projection.resident?.browserReadModel?.render || null;
  }

  function createResidentRenderer(options = {}) {
    const document = options.document;
    const els = options.els || {};
    if (!document?.createElement) throw new TypeError("常驻 renderer 需要 document.createElement");

    function createPlayerStatIcon(stat) {
      const item = document.createElement("span");
      const icon = document.createElement("img");
      const value = document.createElement("span");
      item.className = "player-stat player-stat-with-icon";
      item.setAttribute("aria-label", `${stat.label} ${stat.value}`);
      icon.className = "player-stat-icon";
      icon.src = stat.iconSrc || "";
      icon.alt = "";
      icon.width = 296;
      icon.height = 296;
      icon.decoding = "async";
      icon.setAttribute("aria-hidden", "true");
      value.className = "player-stat-value";
      value.textContent = text(stat.value);
      item.append(icon, value);
      return item;
    }

    function createCurrentPlayerHeader(player) {
      const item = document.createElement("span");
      const marker = document.createElement("span");
      const name = document.createElement("span");
      item.className = "player-stat player-stat-current";
      item.style.setProperty("--player-color", player.uiColor || "");
      marker.className = "player-color-marker";
      marker.setAttribute("aria-hidden", "true");
      name.className = "player-stat-value";
      name.textContent = player.displayName || player.colorLabel || player.name || player.id;
      item.append(marker, name, createPlayerStatIcon({
        label: "分数",
        value: Number(player.score) || 0,
        iconSrc: "../assets/symbol/effect/score.webp",
      }));
      return item;
    }

  function getPlayerPanels(projection) {
      return getRenderModel(projection)?.playerPanels || null;
    }

    function visibleCurrentResourceStats(player) {
      const alwaysVisible = new Set(["信用点", "能量", "宣传", "可用数据"]);
      const positiveOnly = new Set(["奥陌陌化石", "额外公共扫描"]);
      return (player?.resourceStats || []).filter((stat) => (
        alwaysVisible.has(stat.label)
        || (positiveOnly.has(stat.label) && Number(stat.value) > 0)
      ));
    }

    function renderRoundStatus(input) {
      const projection = assertInput(input);
      const render = getRenderModel(projection);
      const slot = render?.boardChrome?.rotateTokenSlot;
      const turn = render?.turnPresentation;
      if (!turn) throw new TypeError("Resident renderer 缺少 BrowserReadModel turnPresentation");
      if (els.roundStatusToken && slot) {
        els.roundStatusToken.style.setProperty("--rotate-token-x", `${Number(slot.percentX)}%`);
        els.roundStatusToken.style.setProperty("--rotate-token-y", `${Number(slot.percentY)}%`);
        els.roundStatusToken.dataset.slotId = text(slot.id);
      }
      if (els.roundStatusRound) {
        els.roundStatusRound.textContent = turn.terminal
          ? "游戏结束"
          : `第 ${Number(turn.roundNumber) || 1} 轮`;
      }
      if (els.roundStatusTurn) {
        els.roundStatusTurn.textContent = turn.terminal
          ? "终局计分"
          : `第 ${Number(turn.displayedTurnNumber) || 1} 回合`;
      }
    }

    function createPlayerCard(player, current) {
      const card = document.createElement("article");
      card.className = "opponent-stat-card";
      card.dataset.playerId = text(player.id);
      card.classList.toggle("is-current", current);
      if (player.color) card.style.setProperty("--player-color", text(player.color));
      const row = document.createElement("div");
      row.className = "player-stats-row opponent-stat-row";
      row.append(
        createCurrentPlayerHeader(player),
        ...visibleCurrentResourceStats(player).map(createPlayerStatIcon),
        createPlayerStatIcon({
          label: "手牌",
          value: Number(player.handCount) || 0,
          iconSrc: "../assets/symbol/effect/card.webp",
        }),
      );
      card.append(row);
      return card;
    }

    function renderPlayers(input) {
      const projection = assertInput(input);
      const playerPanels = getPlayerPanels(projection);
      const own = playerPanels?.players?.find(
        (player) => String(player.id) === String(playerPanels.interfacePlayerId),
      ) || null;
      if (els.playerStats) {
        if (!own) els.playerStats.replaceChildren();
        else {
          const row = document.createElement("div");
          row.className = "player-stats-row player-stats-main-row";
          row.dataset.playerId = text(own.id);
          row.append(
            createCurrentPlayerHeader(own),
            ...visibleCurrentResourceStats(own).map(createPlayerStatIcon),
          );
          els.playerStats.replaceChildren(row);
        }
      }
      if (els.opponentStatGrid) {
        els.opponentStatGrid.replaceChildren(...(playerPanels?.players || [])
          .filter((player) => String(player.id) !== String(playerPanels.interfacePlayerId))
          .map((player) => createPlayerCard(
            player,
            String(player.id) === String(playerPanels.currentPlayerId),
          )));
      }
    }

    function renderPublicCards(input) {
      const projection = assertInput(input);
      if (!els.publicCardRow) return;
      const projectedCards = getRenderModel(projection)?.cardPanels?.publicCards;
      if (!Array.isArray(projectedCards)) {
        throw new TypeError("Resident renderer 缺少 BrowserReadModel publicCards");
      }
      const cards = projectedCards;
      els.publicCardRow.replaceChildren(...cards.map((card, index) => {
        const slot = document.createElement("div");
        slot.className = "public-card-slot";
        slot.dataset.publicSlot = String(index);
        if (!card || card.empty) {
          slot.classList.add("is-empty");
          slot.setAttribute("aria-hidden", "true");
          return slot;
        }
        const image = document.createElement("img");
        image.className = "public-card";
        image.src = card.imageSrc || "";
        image.alt = card.label || `公共牌 ${index + 1}`;
        image.width = 747;
        image.height = 1040;
        image.decoding = "async";
        image.dataset.cardId = text(card.id);
        slot.append(image);
        return slot;
      }));
    }

    function createCardImage(card, className) {
      const image = document.createElement("img");
      image.className = className;
      image.dataset.cardId = text(card?.id);
      image.src = card?.imageSrc || "";
      image.alt = card?.label || "卡牌";
      image.width = 747;
      image.height = 1040;
      image.decoding = "async";
      return image;
    }

    function renderPrivateCards(input) {
      const projection = assertInput(input);
      const cards = getRenderModel(projection)?.cardPanels || {};
      const handCards = cards.handCards || [];
      const reservedCards = cards.reservedCards?.items || [];
      if (els.playerHandFan) {
        els.playerHandFan.replaceChildren(...handCards.map((card) => (
          createCardImage(card, "player-hand-card")
        )));
      }
      if (els.reservedCardFan) {
        els.reservedCardFan.replaceChildren(...reservedCards.map((card) => (
          createCardImage(card, "reserved-card")
        )));
      }
      els.playerHandPanel?.classList.toggle("is-empty", handCards.length === 0);
      els.reservedCardPanel?.classList.toggle("is-empty", reservedCards.length === 0);
      if (els.playerHandPanelHandCount) {
        els.playerHandPanelHandCount.textContent = `(${handCards.length})`;
      }
      if (els.playerHandPanelTitleHint) {
        els.playerHandPanelTitleHint.textContent = "";
      }
    }

    function renderSolarSystem(input) {
      const projection = assertInput(input);
      const render = getRenderModel(projection);
      const chrome = render?.boardChrome || {};
      const wheelTransforms = new Map((chrome.wheelTransforms || []).map(
        (entry) => [String(entry.wheelId), entry],
      ));
      for (const [wheelId, wheel] of Object.entries(els.wheels || {})) {
        if (!wheel) continue;
        const entry = wheelTransforms.get(String(wheelId));
        const degrees = Number(entry?.degrees) || 0;
        wheel.dataset.projectionRotation = String(degrees);
        wheel.style.setProperty("transform", `rotate(${degrees}deg)`);
      }
      if (els.wheels?.[3]) {
        els.wheels[3].style.setProperty(
          "background-image",
          chrome.aomomoWheelImageSrc ? `url("${chrome.aomomoWheelImageSrc}")` : "",
        );
      }
      const sectors = new Map((chrome.sectors || []).map(
        (entry) => [String(entry.slotId), entry],
      ));
      for (const [slotId, wrap] of Object.entries(els.sectorWraps || {})) {
        if (!wrap) continue;
        const entry = sectors.get(String(slotId));
        const sector = entry ? document.createElement("div") : null;
        if (sector) {
          sector.className = `sector sector-${entry.sectorId}`;
          sector.dataset.sectorId = text(entry.sectorId);
          const sectorData = render?.dataPresentation?.sectorTokensBySectorId?.[
            String(entry.sectorId)
          ] || {};
          const nebulaPanels = new Map();
          for (const tokenEntry of sectorData.tokens || []) {
            let panel = nebulaPanels.get(tokenEntry.nebulaId);
            if (!panel) {
              const region = tokenEntry.panelRegion || {};
              panel = document.createElement("div");
              panel.className = "nebula-panel";
              panel.dataset.nebulaId = text(tokenEntry.nebulaId);
              panel.style.setProperty("left", `${Number(region.originX) || 0}%`);
              panel.style.setProperty("width", `${Number(region.widthPercent) || 50}%`);
              nebulaPanels.set(tokenEntry.nebulaId, panel);
              sector.append(panel);
            }
            const token = document.createElement("img");
            token.className = "nebula-data-token";
            token.dataset.tokenId = text(tokenEntry.id);
            token.src = tokenEntry.imageSrc || "";
            token.alt = "";
            token.setAttribute("aria-hidden", "true");
            token.style.setProperty("left", `${Number(tokenEntry.layout?.percentX)}%`);
            token.style.setProperty("top", `${Number(tokenEntry.layout?.percentY)}%`);
            token.style.setProperty(
              "--data-scale",
              String(
                ((Number(tokenEntry.layout?.scalePercent) || 11.8) / 100)
                * (Number(tokenEntry.displayScale) || 3.5),
              ),
            );
            panel.append(token);
          }
          for (const winEntry of sectorData.wins || []) {
            const token = document.createElement("img");
            token.className = "sector-win-token";
            token.dataset.winId = text(winEntry.id);
            token.src = winEntry.imageSrc || "";
            token.alt = "";
            token.setAttribute("aria-hidden", "true");
            token.style.setProperty("left", `${Number(winEntry.layout?.percentX)}%`);
            token.style.setProperty("top", `${Number(winEntry.layout?.percentY)}%`);
            token.style.setProperty("--win-scale", `${Number(winEntry.layout?.scalePercent) || 9.4}%`);
            sector.append(token);
          }
        }
        wrap.replaceChildren(...(sector ? [sector] : []));
      }
      const solarTokens = [];
      const referenceTokens = [];
      for (const [index, piece] of (render?.tokenPresentation?.tokens || []).entries()) {
        const token = document.createElement("img");
        token.className = "rocket-token browser-projection-token";
        token.dataset.pieceId = text(piece.id || `piece-${index + 1}`);
        token.dataset.playerId = text(piece.playerId);
        token.dataset.playerColor = text(piece.color);
        token.src = piece.imageSrc || "";
        token.alt = piece.label || "公开棋子";
        if (piece.kind === "chong-fossil") token.classList.add("is-chong-fossil");
        if (piece.chongDelivered) token.classList.add("is-chong-delivered");
        if (Number.isFinite(Number(piece.percentX))) {
          token.style.setProperty("left", `${Number(piece.percentX)}%`);
        }
        if (Number.isFinite(Number(piece.percentY))) {
          token.style.setProperty("top", `${Number(piece.percentY)}%`);
        }
        if (piece.target === "planets-reference") {
          token.classList.add("is-reference-placed");
          if (piece.referenceKind) {
            token.classList.add("is-planet-marker", `is-reference-${piece.referenceKind}`);
          }
          if (Number(piece.referenceOffsetTokenWidths)) {
            token.classList.add("is-reference-offset");
            token.style.setProperty(
              "--reference-offset-token-widths",
              String(Number(piece.referenceOffsetTokenWidths)),
            );
          }
          referenceTokens.push(token);
        } else {
          solarTokens.push(token);
        }
      }
      els.tokenLayer?.replaceChildren(...solarTokens);
      for (const entry of render?.dataPresentation?.aomomoTokens || []) {
        const token = document.createElement("img");
        token.className = "aomomo-data-token";
        token.dataset.tokenId = text(entry.id);
        token.src = entry.imageSrc || "";
        token.alt = "";
        token.setAttribute("aria-hidden", "true");
        token.style.setProperty("left", `${Number(entry.percentX)}%`);
        token.style.setProperty("top", `${Number(entry.percentY)}%`);
        els.tokenLayer?.append(token);
      }
      const markers = render?.markerPresentation || {};
      for (const entry of markers.anomalies || []) {
        const marker = document.createElement("img");
        marker.className = "projection-board-marker projection-anomaly-marker";
        marker.dataset.markerId = text(entry.id);
        marker.src = entry.imageSrc || "";
        marker.alt = "";
        marker.setAttribute("aria-hidden", "true");
        marker.style.setProperty("left", `${Number(entry.percentX)}%`);
        marker.style.setProperty("top", `${Number(entry.percentY)}%`);
        els.tokenLayer?.append(marker);
      }
      for (const entry of markers.planetFossils || []) {
        const marker = document.createElement("span");
        marker.className = "projection-board-marker projection-fossil-marker";
        marker.dataset.markerId = text(entry.id);
        const image = document.createElement("img");
        image.src = entry.imageSrc || "";
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        const count = document.createElement("span");
        count.textContent = text(entry.count);
        marker.append(image, count);
        marker.style.setProperty("left", `${Number(entry.percentX)}%`);
        marker.style.setProperty("top", `${Number(entry.percentY)}%`);
        els.tokenLayer?.append(marker);
      }
      for (const entry of markers.runezuSymbols || []) {
        if (entry.target !== "solar-board") continue;
        const marker = document.createElement("img");
        marker.className = "projection-board-marker projection-runezu-marker";
        marker.dataset.markerId = text(entry.id);
        marker.src = entry.imageSrc || "";
        marker.alt = "";
        marker.setAttribute("aria-hidden", "true");
        marker.style.setProperty("left", `${Number(entry.percentX)}%`);
        marker.style.setProperty("top", `${Number(entry.percentY)}%`);
        els.tokenLayer?.append(marker);
      }
      els.planetsTokenLayer?.replaceChildren(...referenceTokens);
    }

    function renderFinalScoring(input) {
      const projection = assertInput(input);
      const presentation = getRenderModel(projection)?.finalScorePresentation;
      if (!presentation) {
        throw new TypeError("Resident renderer 缺少 BrowserReadModel finalScorePresentation");
      }
      const tiles = presentation.tiles;
      const variants = presentation.tileVariants;
      const slotPoints = {
        1: { x: 18.5, y: 54.4 },
        2: { x: 40.4, y: 54.4 },
        3: { x: 66, y: 54.4, stepX: 8.5, stepY: 9.5, columns: 3 },
      };
      for (const image of els.finalScoreTiles || []) {
        const tileId = image.dataset.finalId;
        const variant = Number(variants[tileId]) || 1;
        image.src = `../assets/final/final_${tileId}${variant}.png`;
        image.alt = `终局计分 ${tileId.toUpperCase()}${variant}`;
      }
      for (const wrap of els.finalScoreTileWraps || []) {
        const tileId = wrap.dataset.finalId;
        const tile = Array.isArray(tiles)
          ? tiles.find((entry) => entry?.id === tileId)
          : tiles[tileId];
        const layer = wrap.querySelector?.(".final-score-token-layer");
        if (!layer) continue;
        layer.replaceChildren(...(tile?.marks || []).map((mark, index) => {
          const token = document.createElement("img");
          const slotIndex = Number(mark.slotIndex) || 3;
          const slot = slotPoints[slotIndex] || slotPoints[3];
          const order = slotIndex === 3 ? Math.max(1, Number(mark.slot3Order) || 1) - 1 : 0;
          const x = slot.x + (order % (slot.columns || 1)) * (slot.stepX || 0);
          const y = slot.y + Math.floor(order / (slot.columns || 1)) * (slot.stepY || 0);
          token.className = "final-score-token";
          token.dataset.finalSlot = text(mark.slotIndex);
          token.dataset.playerColor = text(mark.playerColor);
          token.dataset.markId = text(mark.id || `${tileId}:${index}`);
          token.src = mark.tokenSrc
            || (mark.playerColor
              ? `../assets/tokens/normal_token-${mark.playerColor}.png`
              : "../assets/tokens/normal_token.png");
          token.alt = "";
          token.setAttribute("aria-hidden", "true");
          token.style.setProperty("--final-token-x", `${x}%`);
          token.style.setProperty("--final-token-y", `${y}%`);
          return token;
        }));
      }
    }

    function supplyEntry(supply, tileId) {
      if (supply?.stacks) return supply.stacks[tileId] || null;
      return supply?.[tileId] || null;
    }

    function renderTechSupply(input) {
      const projection = assertInput(input);
      const presentation = getRenderModel(projection)?.techTilePresentation || {};
      const supply = Object.fromEntries((presentation.supplyTiles || []).map((entry) => [
        entry.tileId,
        entry,
      ]));
      for (const tile of els.techTiles || []) {
        const tileId = tile.dataset.techId;
        const entry = supplyEntry(supply, tileId);
        const available = entry == null ? false : Number(entry.remaining) > 0;
        tile.hidden = !available;
        tile.dataset.projectionAvailable = String(available);
        tile.dataset.remaining = text(entry?.remaining);
      }
      for (const bonus of els.techBonuses || []) {
        const entry = supply[bonus.dataset.techBonusFor];
        bonus.hidden = !entry?.bonusImageSrc;
        bonus.src = entry?.bonusImageSrc || "";
      }
      for (const overlay of els.techOverlays || []) {
        const entry = supply[overlay.dataset.techOverlayFor];
        overlay.hidden = !entry?.firstTakeAvailable;
      }
      const runezuByTechId = new Map(
        (getRenderModel(projection)?.markerPresentation?.runezuSymbols || [])
          .filter((entry) => entry.target === "tech")
          .map((entry) => [String(entry.sourceId), entry]),
      );
      for (const wrap of els.techTileWraps || []) {
        const entry = runezuByTechId.get(String(wrap.dataset.techWrapFor));
        const marker = entry ? document.createElement("img") : null;
        if (marker) {
          marker.className = "projection-tech-symbol";
          marker.dataset.markerId = text(entry.id);
          marker.src = entry.imageSrc || "";
          marker.alt = "";
          marker.setAttribute("aria-hidden", "true");
        }
        const retained = [...(wrap.children || [])].filter(
          (child) => !String(child.className).includes("projection-tech-symbol"),
        );
        wrap.replaceChildren(...retained, ...(marker ? [marker] : []));
      }
      if (els.playerBoardTechLayer) {
        els.playerBoardTechLayer.replaceChildren(...(presentation.playerTiles || []).map((entry) => {
          const tile = document.createElement("img");
          tile.className = "player-tech-tile";
          tile.dataset.techId = text(entry.tileId);
          tile.src = entry.imageSrc || "";
          tile.alt = entry.tileId || "科技";
          tile.classList.toggle("is-disabled", Boolean(entry.disabled));
          if (Number.isFinite(Number(entry.layout?.percentX))) {
            tile.style.setProperty("--x", `${Number(entry.layout.percentX)}%`);
          }
          if (Number.isFinite(Number(entry.layout?.percentY))) {
            tile.style.setProperty("--y", `${Number(entry.layout.percentY)}%`);
          }
          return tile;
        }));
      }
    }

    function renderPlayerData(input) {
      const projection = assertInput(input);
      const presentation = getRenderModel(projection)?.dataPresentation || {};
      if (!els.playerBoardDataLayer) return;
      els.playerBoardDataLayer.replaceChildren(...(presentation.playerTokens || []).map((entry) => {
        const token = document.createElement("img");
        token.className = "player-data-token";
        token.dataset.tokenId = text(entry.id);
        token.dataset.placementKind = text(entry.placementKind);
        token.src = entry.imageSrc || "";
        token.alt = "";
        token.setAttribute("aria-hidden", "true");
        if (Number.isFinite(Number(entry.percentX))) {
          token.style.setProperty("--x", `${Number(entry.percentX)}%`);
        }
        if (Number.isFinite(Number(entry.percentY))) {
          token.style.setProperty("--y", `${Number(entry.percentY)}%`);
        }
        return token;
      }));
    }

    function createAlienTrace(entry) {
      const token = document.createElement("img");
      token.className = "alien-projection-trace";
      token.dataset.traceId = text(entry.id);
      token.dataset.traceType = text(entry.traceType);
      token.dataset.playerColor = text(entry.color);
      token.src = entry.imageSrc || "";
      token.alt = "";
      token.setAttribute("aria-hidden", "true");
      if (Number.isFinite(Number(entry.layout?.percentX))) {
        token.style.setProperty("left", `${Number(entry.layout.percentX)}%`);
      }
      if (Number.isFinite(Number(entry.layout?.percentY))) {
        token.style.setProperty("top", `${Number(entry.layout.percentY)}%`);
      }
      if (Number.isFinite(Number(entry.layout?.scalePercent))) {
        token.style.setProperty("--trace-scale", `${Number(entry.layout.scalePercent)}%`);
      }
      return token;
    }

    function renderAliens(input) {
      const projection = assertInput(input);
      const slots = getRenderModel(projection)?.alienPresentation?.slots || [];
      const roots = new Map((els.alienSlots || []).map(
        (root) => [String(root.dataset.alienSlotRoot), root],
      ));
      for (const entry of slots) {
        const root = roots.get(String(entry.slotId));
        if (!root) continue;
        const title = document.createElement("strong");
        title.className = "alien-projection-title";
        title.textContent = entry.revealed ? entry.label : `外星人 ${entry.slotId} · 未揭示`;
        const face = document.createElement("div");
        face.className = "alien-projection-surface alien-projection-face";
        const faceImage = document.createElement("img");
        faceImage.className = "alien-projection-image";
        faceImage.src = entry.faceImageSrc || "";
        faceImage.alt = entry.label || `外星人 ${entry.slotId}`;
        face.append(
          faceImage,
          ...(entry.traces || []).filter((trace) => trace.surface === "face").map(createAlienTrace),
        );
        const state = document.createElement("div");
        state.className = "alien-projection-surface alien-projection-state";
        const stateImage = document.createElement("img");
        stateImage.className = "alien-projection-image";
        stateImage.src = entry.stateImageSrc || "";
        stateImage.alt = `外星人 ${entry.slotId} 痕迹状态`;
        state.append(
          stateImage,
          ...(entry.traces || []).filter((trace) => trace.surface === "state").map(createAlienTrace),
        );
        const details = document.createElement("div");
        details.className = "alien-projection-details";
        for (const line of entry.statusLines || []) {
          const textLine = document.createElement("span");
          textLine.textContent = text(line);
          details.append(textLine);
        }
        if (entry.displayedCardImageSrc) {
          const card = document.createElement("img");
          card.className = "alien-projection-card";
          card.src = entry.displayedCardImageSrc;
          card.alt = `${entry.label}展示牌`;
          details.append(card);
        }
        root.dataset.revealed = String(Boolean(entry.revealed));
        root.dataset.alienId = text(entry.alienId);
        root.replaceChildren(title, face, state, details);
      }
    }

    function renderAll(input) {
      assertInput(input);
      renderRoundStatus(input);
      renderPlayers(input);
      renderSolarSystem(input);
      renderFinalScoring(input);
      renderTechSupply(input);
      renderPlayerData(input);
      renderAliens(input);
      renderPublicCards(input);
      renderPrivateCards(input);
    }

    return Object.freeze({
      renderAll,
      renderRoundStatus,
      renderPlayers,
      renderSolarSystem,
      renderFinalScoring,
      renderTechSupply,
      renderPlayerData,
      renderAliens,
      renderPublicCards,
      renderPrivateCards,
    });
  }

  function createDesktopRenderPort(context = {}) {
    return function render() {
      const input = context.createRenderInput();
      if (!input) return Object.freeze({ ok: true, rendered: false });
      try {
        context.renderer.renderAll(input);
        context.decisionRenderer.render(input);
        return Object.freeze({ ok: true, rendered: true });
      } catch (error) {
        const failure = Object.freeze({
          ok: false,
          code: "BROWSER_RENDER_FAILED",
          message: error?.message || "Browser renderer 失败",
        });
        context.onRenderError?.(failure, error);
        return failure;
      }
    };
  }

  return Object.freeze({ SCHEMA_VERSION, createResidentRenderer, createDesktopRenderPort });
});
