(function () {
  "use strict";
  const body = document.body;
  const output = document.querySelector("#result");
  const frame = document.querySelector("#app");

  function finish(ok, message) {
    body.dataset.result = ok ? "passed" : "failed";
    output.textContent = message;
  }

  frame.addEventListener("load", async () => {
    try {
      const w = frame.contentWindow;
      const doc = frame.contentDocument;
      for (let attempt = 0; attempt < 200 && !w.SetiRandomizer; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      if (!w.SetiRandomizer) throw new Error("production page 未完成装配");

      const inspected = w.SetiRandomizer.inspect();
      const alienProjection = inspected.projection.aliens;
      if (!alienProjection || !Object.isFrozen(alienProjection)) {
        throw new Error("Browser 未提供冻结的 alien projection");
      }
      const renderer = window.SetiAppAlienSpeciesRuntime.createAlienSpeciesRenderer({
        renderPort: {
          document: doc,
          els: w.SetiAppDom.collectElements(doc),
        },
        readProjection: () => ({
          slots: Object.fromEntries([1, 2, 3].map((slotId) => [
            slotId,
            {
              speciesId: alienProjection.revealed?.[slotId]?.speciesId || "",
              revealed: Boolean(alienProjection.revealed?.[slotId]),
            },
          ])),
        }),
      });
      const rendered = renderer.renderAlienPanels();
      if (!rendered.ok || rendered.renderedSlots < 1) {
        throw new Error(`alien projection render 失败: ${JSON.stringify(rendered)}`);
      }

      finish(true, "alien frozen projection → pure renderer passed");
    } catch (error) {
      finish(false, error.stack || error.message);
    }
  });
})();
