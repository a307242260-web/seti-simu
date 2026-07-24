(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppAlienSpeciesRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createAlienSpeciesRenderer(context = {}) {
    const { document, els } = context.renderPort || {};
    const species = context.speciesPresentation || {};
    if (!document?.createElement || !els?.alienPanels) {
      throw new TypeError("Alien species renderer 需要真实 DOM presentation port");
    }
    if (typeof context.readProjection !== "function") {
      throw new TypeError("Alien species renderer 需要 viewer-safe projection");
    }

    function findElement(collection, slotId) {
      return [...(collection || [])].find((element) => (
        Number(element.dataset.alienSlot) === Number(slotId)
      )) || null;
    }

    function renderCardArea(area, card) {
      if (!area) return;
      area.hidden = !card;
      area.replaceChildren();
      if (!card) return;
      const image = document.createElement("img");
      image.className = "alien-species-projection-card";
      image.src = card.image || "";
      image.alt = card.label || "外星人展示牌";
      image.width = 747;
      image.height = 1040;
      area.append(image);
    }

    function renderAlienPanels() {
      const projection = context.readProjection();
      if (!projection || typeof projection !== "object" || Array.isArray(projection)) {
        throw new TypeError("Alien species renderer projection 无效");
      }
      for (const panel of els.alienPanels) {
        const slotId = Number(panel.dataset.alienSlot);
        const slot = projection.slots?.[slotId] || projection.slots?.[String(slotId)] || null;
        const back = panel.querySelector(".alien-back");
        if (back) {
          back.hidden = false;
          if (slot?.backImage) back.src = slot.backImage;
        }
        const aomomoArea = findElement(els.alienAomomoCardAreas, slotId);
        renderCardArea(aomomoArea, slot?.speciesId === "aomomo" ? slot.displayCard : null);
        panel.dataset.projectionSpecies = slot?.speciesId || "";
        panel.dataset.projectionRevealed = String(Boolean(slot?.revealed));
      }
      species.afterRender?.(structuredClone(projection));
      return Object.freeze({ ok: true, renderedSlots: els.alienPanels.length });
    }

    return Object.freeze({ renderAlienPanels });
  }

  return Object.freeze({
    createAlienSpeciesRenderer,
  });
});
