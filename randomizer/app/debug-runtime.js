(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppDebugRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  function createBrowserDebugRuntime(options = {}) {
    const viewStateStore = options.viewStateStore;
    const projectionPort = options.projectionPort || {};
    const browserPort = options.browserPort || {};
    const renderPort = options.renderPort || {};
    const els = renderPort.els || {};
    if (typeof viewStateStore?.dispatch !== "function" || typeof viewStateStore?.getSnapshot !== "function") {
      throw new TypeError("Browser Debug runtime 需要独立 ViewState store");
    }

    function renderChrome() {
      const debug = viewStateStore.getSnapshot().debug;
      els.appWrap?.classList.toggle("debug-collapsed", !debug.panelOpen);
      els.debugToggle?.setAttribute("aria-expanded", String(debug.panelOpen));
      if (els.debugPlayerMenu) els.debugPlayerMenu.hidden = !debug.playerMenuOpen;
      els.debugPlayerSwitchButton?.setAttribute("aria-expanded", String(debug.playerMenuOpen));
      els.appWrap?.classList.toggle("sector-win-debug-active", debug.sectorCalibration);
      els.debugSectorWinButton?.setAttribute("aria-pressed", String(debug.sectorCalibration));
      browserPort.resize?.();
      return debug;
    }

    function setDebugOpen(open) {
      const allowed = !els.appWrap?.classList.contains("debug-tools-disabled");
      viewStateStore.dispatch({ type: "debug.panel", open: Boolean(open) && allowed });
      return renderChrome();
    }

    function setDebugPlayerMenuOpen(open) {
      viewStateStore.dispatch({ type: "debug.playerMenu", open: Boolean(open) });
      return renderChrome();
    }

    function renderDebugPlayerSwitch() {
      const currentPlayer = projectionPort.getInterfacePlayer?.() || null;
      if (els.debugPlayerSwitchButton && currentPlayer) {
        const agentLabel = projectionPort.getPlayerAgentLabel?.(currentPlayer.id) || "人类";
        els.debugPlayerSwitchButton.textContent = `查看：${currentPlayer.colorLabel}（${agentLabel}）`;
      }
      if (!els.debugPlayerMenu) return;
      const players = projectionPort.getActivePlayers?.() || [];
      const documentRef = browserPort.document || root.document;
      els.debugPlayerMenu.replaceChildren(...players.map((player) => {
        const definition = projectionPort.getPlayerColorDefinition?.(player.color);
        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = "debug-player-option";
        button.style.setProperty("--player-color", definition?.uiColor || "#ffffff");
        button.textContent = `${definition?.label || player.colorLabel || player.color}（只读）`;
        button.disabled = true;
        button.setAttribute("aria-disabled", "true");
        return button;
      }));
    }

    function toggleSectorWinDebug() {
      const active = !viewStateStore.getSnapshot().debug.sectorCalibration;
      viewStateStore.dispatch({ type: "debug.sectorCalibration", active });
      renderChrome();
      renderPort.renderSectorNebulaDataBoard?.();
      return { ok: true, active };
    }

    function focusDebugCalibration(alienSlotId = 1) {
      setDebugOpen(false);
      const target = els.alienPanels?.[alienSlotId - 1]
        || projectionPort.getAlienJiuzheTraceLayer?.(alienSlotId);
      return browserPort.focusService?.scrollIntoView?.(target, {
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      }) || { ok: false, code: "BROWSER_SCROLL_UNAVAILABLE" };
    }

    function logAomomoDebugCoordinates() {
      const lines = projectionPort.getAomomoCalibrationLines?.() || [];
      for (const line of lines) console.info("[奥陌陌调试坐标]", line);
      return { ok: true, count: lines.length };
    }

    return Object.freeze({
      setDebugOpen,
      setDebugPlayerMenuOpen,
      renderDebugPlayerSwitch,
      toggleSectorWinDebug,
      focusDebugCalibration,
      logAomomoDebugCoordinates,
    });
  }

  return Object.freeze({ createBrowserDebugRuntime });
});
