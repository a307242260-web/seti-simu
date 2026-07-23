(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppBootstrap = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  function installBeforeUnloadSave(context = {}) {
    const targetRoot = context.root || root;
    const startScreenState = context.startScreenState;
    const savePersistentGameStateNow = context.savePersistentGameStateNow;
    if (!targetRoot?.addEventListener || !startScreenState || typeof savePersistentGameStateNow !== "function") {
      return null;
    }
    const handler = () => {
      if (!startScreenState.entered) return;
      savePersistentGameStateNow({ label: "刷新前状态" });
    };
    targetRoot.addEventListener("beforeunload", handler);
    return handler;
  }

  function initializeAppBootstrap(context = {}) {
    const targetRoot = context.root || root;
    context.initializeShell?.();
    installBeforeUnloadSave({
      root: targetRoot,
      startScreenState: context.startScreenState,
      savePersistentGameStateNow: context.savePersistentGameStateNow,
    });
    const publicApiFactory = context.publicApiFactory || targetRoot.SetiAppPublicApi;
    if (!publicApiFactory?.createPublicApi) {
      throw new Error("Missing SETI app dependency: SetiAppPublicApi");
    }
    const publicApi = publicApiFactory.createPublicApi(context.publicApiContext || {});
    targetRoot.SetiRandomizer = publicApi;
    return publicApi;
  }

  function createBrowserShellInitializer(context = {}) {
    const {
      actionLogViewRuntime,
      renderRuntime,
      startScreenRuntime,
    } = context;
    if (!actionLogViewRuntime || !renderRuntime || !startScreenRuntime) {
      throw new TypeError("Browser shell initializer 缺少 owner runtime");
    }
    return function initializeBrowserShell() {
      renderRuntime.setTokenAssetSizes();
      startScreenRuntime.syncStartScreenDebugOption();
      startScreenRuntime.syncStartScreenActionLogOption();
      startScreenRuntime.syncStartScreenAlienOptions();
      startScreenRuntime.syncStartScreenIndustryOptions();
      startScreenRuntime.setDebugToolsEnabled(false);
      actionLogViewRuntime.setReportTab("action");
      actionLogViewRuntime.setLogOpen(false);
      renderRuntime.updateContinueButton();
    };
  }

  return Object.freeze({
    createBrowserShellInitializer,
    installBeforeUnloadSave,
    initializeAppBootstrap,
  });
});
