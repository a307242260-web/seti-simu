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

  function resourceSummary(player) {
    return Object.entries(player?.resources || {})
      .filter(([, value]) => Number.isFinite(Number(value)))
      .map(([key, value]) => `${key}:${value}`)
      .join(" · ");
  }

  function createResidentRenderer(options = {}) {
    const document = options.document;
    const els = options.els || {};
    if (!document?.createElement) throw new TypeError("常驻 renderer 需要 document.createElement");

    function renderRoundStatus(input) {
      const projection = assertInput(input);
      if (els.roundStatusRound) {
        els.roundStatusRound.textContent = projection.match.terminal
          ? "游戏结束"
          : `第 ${Number(projection.match.round) || 1} 轮`;
      }
      if (els.roundStatusTurn) {
        els.roundStatusTurn.textContent = projection.match.terminal
          ? "终局计分"
          : `第 ${Number(projection.match.turn) || 1} 回合`;
      }
    }

    function createPlayerCard(player, current) {
      const card = document.createElement("article");
      card.className = "opponent-stat-card";
      card.dataset.playerId = text(player.id);
      card.classList.toggle("is-current", current);
      if (player.color) card.style.setProperty("--player-color", text(player.color));
      const title = document.createElement("strong");
      title.className = "opponent-stat-player";
      title.textContent = player.colorLabel || player.name || player.id;
      const stats = document.createElement("span");
      stats.className = "opponent-stat-summary";
      stats.textContent = `${resourceSummary(player)} · hand:${Number(player.handCount) || 0} · reserved:${Number(player.reservedCount) || 0}`;
      card.append(title, stats);
      return card;
    }

    function renderPlayers(input) {
      const projection = assertInput(input);
      const own = projection.players?.[projection.viewer.playerId] || null;
      if (els.playerStats) {
        if (!own) els.playerStats.replaceChildren();
        else {
          const row = document.createElement("div");
          row.className = "player-stats-row player-stats-main-row";
          row.dataset.playerId = text(own.id);
          row.textContent = `${own.colorLabel || own.name || own.id} · ${resourceSummary(own)}`;
          els.playerStats.replaceChildren(row);
        }
      }
      if (els.opponentStatGrid) {
        els.opponentStatGrid.replaceChildren(...Object.values(projection.players || {})
          .map((player) => createPlayerCard(player, player.id === projection.match.currentPlayerId)));
      }
    }

    function renderPublicCards(input) {
      const projection = assertInput(input);
      if (!els.publicCardRow) return;
      const cards = projection.cards?.market || [];
      els.publicCardRow.replaceChildren(...cards.map((card, index) => {
        const slot = document.createElement("div");
        slot.className = "public-card-slot";
        slot.dataset.publicSlot = String(index);
        if (!card) {
          slot.classList.add("is-empty");
          slot.setAttribute("aria-hidden", "true");
          return slot;
        }
        const image = document.createElement("img");
        image.className = "public-card";
        image.src = card.src || "";
        image.alt = card.cardName || `公共牌 ${index + 1}`;
        image.width = 747;
        image.height = 1040;
        image.decoding = "async";
        image.dataset.cardId = text(card.id || card.cardId);
        slot.append(image);
        return slot;
      }));
    }

    function renderSolarSystem(input) {
      const projection = assertInput(input);
      const rotation = Number(projection.board?.solarSystem?.rotation) || 0;
      for (const [sectorId, wheel] of Object.entries(els.wheels || {})) {
        if (!wheel) continue;
        wheel.dataset.projectionRotation = String(rotation);
        wheel.dataset.projectionSector = String(sectorId);
      }
      if (!els.tokenLayer) return;
      const pieces = projection.board?.pieces?.public || [];
      els.tokenLayer.replaceChildren(...pieces.map((piece, index) => {
        const token = document.createElement("img");
        token.className = "rocket-token browser-projection-token";
        token.dataset.pieceId = text(piece.id || `piece-${index + 1}`);
        token.dataset.playerId = text(piece.playerId);
        token.src = piece.tokenSrc || piece.src || "";
        token.alt = piece.label || "公开棋子";
        const x = piece.position?.x ?? piece.x;
        const y = piece.position?.y ?? piece.y;
        if (Number.isFinite(Number(x))) token.style.setProperty("--x", `${Number(x)}px`);
        if (Number.isFinite(Number(y))) token.style.setProperty("--y", `${Number(y)}px`);
        return token;
      }));
    }

    function renderFinalScoring(input) {
      const projection = assertInput(input);
      const tiles = projection.board?.finalScoring?.tiles || {};
      for (const wrap of els.finalScoreTileWraps || []) {
        const tileId = wrap.dataset.finalId;
        const tile = Array.isArray(tiles)
          ? tiles.find((entry) => entry?.id === tileId)
          : tiles[tileId];
        const layer = wrap.querySelector?.(".final-score-token-layer");
        if (!layer) continue;
        layer.replaceChildren(...(tile?.marks || []).map((mark, index) => {
          const token = document.createElement("img");
          token.className = "final-score-token";
          token.dataset.finalSlot = text(mark.slotIndex);
          token.dataset.playerColor = text(mark.playerColor);
          token.dataset.markId = text(mark.id || `${tileId}:${index}`);
          token.src = mark.tokenSrc || "../assets/tokens/normal_token.png";
          token.alt = "";
          token.setAttribute("aria-hidden", "true");
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
      const supply = projection.tech?.supply || {};
      for (const tile of els.techTiles || []) {
        const tileId = tile.dataset.techId;
        const entry = supplyEntry(supply, tileId);
        const available = entry == null ? true : entry.available !== false && entry.taken !== true;
        tile.hidden = !available;
        tile.classList.remove("is-takable", "is-selected-tech", "is-muted");
        tile.dataset.projectionAvailable = String(available);
      }
    }

    function renderAll(input) {
      assertInput(input);
      renderRoundStatus(input);
      renderPlayers(input);
      renderSolarSystem(input);
      renderFinalScoring(input);
      renderTechSupply(input);
      renderPublicCards(input);
    }

    return Object.freeze({
      renderAll,
      renderRoundStatus,
      renderPlayers,
      renderSolarSystem,
      renderFinalScoring,
      renderTechSupply,
      renderPublicCards,
    });
  }

  function createDesktopRenderPort(context = {}) {
    return function render() {
      const input = context.createRenderInput();
      if (!input) return;
      context.renderer.renderAll(input);
      context.decisionRenderer.render(input);
    };
  }

  return Object.freeze({ SCHEMA_VERSION, createResidentRenderer, createDesktopRenderPort });
});
