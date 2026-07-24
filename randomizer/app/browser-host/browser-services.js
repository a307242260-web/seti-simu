(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserServices = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function fail(code, message, extra = {}) {
    return deepFreeze({ ok: false, code, message, ...clone(extra) });
  }

  function createStorageService(options = {}) {
    let storage = options.storage || null;
    if (!storage && options.window) {
      try { storage = options.window.localStorage || null; } catch (error) { storage = null; }
    }
    const storageKey = String(options.storageKey || "seti-browser-storage-v1");

    function write(value) {
      if (typeof storage?.setItem !== "function") {
        return fail("BROWSER_STORAGE_UNAVAILABLE", "local persistence 不可用");
      }
      try {
        storage.setItem(storageKey, JSON.stringify(clone(value)));
        return deepFreeze({ ok: true, storageKey });
      } catch (error) {
        return fail("BROWSER_STORAGE_WRITE_FAILED", error?.message || "local persistence 写入失败");
      }
    }

    function read() {
      if (typeof storage?.getItem !== "function") {
        return fail("BROWSER_STORAGE_UNAVAILABLE", "local persistence 不可用");
      }
      try {
        const raw = storage.getItem(storageKey);
        if (!raw) return fail("BROWSER_STORAGE_EMPTY", "没有本地存档");
        return deepFreeze({ ok: true, storageKey, value: clone(JSON.parse(raw)) });
      } catch (error) {
        return fail("BROWSER_STORAGE_READ_FAILED", error?.message || "local persistence 读取失败");
      }
    }

    function remove() {
      if (typeof storage?.removeItem !== "function") {
        return fail("BROWSER_STORAGE_UNAVAILABLE", "local persistence 不可用");
      }
      try {
        storage.removeItem(storageKey);
        return deepFreeze({ ok: true, storageKey });
      } catch (error) {
        return fail("BROWSER_STORAGE_CLEAR_FAILED", error?.message || "local persistence 清理失败");
      }
    }

    return Object.freeze({ read, write, remove });
  }

  function createTimerService(options = {}) {
    const scheduleTimeout = typeof options.setTimeout === "function"
      ? options.setTimeout
      : null;
    const cancelTimeout = typeof options.clearTimeout === "function"
      ? options.clearTimeout
      : null;
    const scheduleFrame = typeof options.requestAnimationFrame === "function"
      ? options.requestAnimationFrame
      : null;
    const cancelFrame = typeof options.cancelAnimationFrame === "function"
      ? options.cancelAnimationFrame
      : null;

    function schedule(callback, delay = 0) {
      if (typeof callback !== "function") return fail("BROWSER_TIMER_CALLBACK_INVALID", "timer callback 必须是函数");
      if (!scheduleTimeout) return fail("BROWSER_TIMER_UNAVAILABLE", "timer 不可用");
      try {
        return deepFreeze({
          ok: true,
          timerId: scheduleTimeout(callback, Math.max(0, Number(delay) || 0)),
        });
      } catch (error) {
        return fail("BROWSER_TIMER_SCHEDULE_FAILED", error?.message || "timer 调度失败");
      }
    }

    function cancel(timerId) {
      if (!cancelTimeout) return fail("BROWSER_TIMER_UNAVAILABLE", "timer cancel 不可用");
      try {
        cancelTimeout(timerId);
        return deepFreeze({ ok: true });
      } catch (error) {
        return fail("BROWSER_TIMER_CANCEL_FAILED", error?.message || "timer cancel 失败");
      }
    }

    function requestFrame(callback) {
      if (typeof callback !== "function") return fail("BROWSER_FRAME_CALLBACK_INVALID", "frame callback 必须是函数");
      if (!scheduleFrame) return schedule(callback, 0);
      try {
        return deepFreeze({ ok: true, frameId: scheduleFrame(callback) });
      } catch (error) {
        return fail("BROWSER_FRAME_SCHEDULE_FAILED", error?.message || "animation frame 调度失败");
      }
    }

    function cancelRequestedFrame(frameId) {
      if (!cancelFrame) return cancel(frameId);
      try {
        cancelFrame(frameId);
        return deepFreeze({ ok: true });
      } catch (error) {
        return fail("BROWSER_FRAME_CANCEL_FAILED", error?.message || "animation frame cancel 失败");
      }
    }

    return Object.freeze({ schedule, cancel, requestFrame, cancelFrame: cancelRequestedFrame });
  }

  function createFocusService(options = {}) {
    const timerService = options.timerService || null;

    function focus(element, focusOptions) {
      if (typeof element?.focus !== "function") return fail("BROWSER_FOCUS_TARGET_INVALID", "focus target 不可用");
      try {
        element.focus(focusOptions);
        return deepFreeze({ ok: true });
      } catch (error) {
        return fail("BROWSER_FOCUS_FAILED", error?.message || "focus 失败");
      }
    }

    function focusNextFrame(element, focusOptions) {
      if (typeof timerService?.requestFrame !== "function") {
        return fail("BROWSER_FOCUS_TIMER_MISSING", "focus 需要 timer service");
      }
      return timerService.requestFrame(() => focus(element, focusOptions));
    }

    function scrollIntoView(element, scrollOptions) {
      if (typeof element?.scrollIntoView !== "function") {
        return fail("BROWSER_SCROLL_TARGET_INVALID", "scroll target 不可用");
      }
      try {
        element.scrollIntoView(clone(scrollOptions));
        return deepFreeze({ ok: true });
      } catch (error) {
        return fail("BROWSER_SCROLL_FAILED", error?.message || "scrollIntoView 失败");
      }
    }

    return Object.freeze({ focus, focusNextFrame, scrollIntoView });
  }

  function createDownloadService(options = {}) {
    const { window, document, Blob, timerService } = options;
    return Object.freeze({
      save(request = {}) {
        if (typeof request.content !== "string" || !request.filename) {
          return fail("BROWSER_DOWNLOAD_REQUEST_INVALID", "下载只接受显式 filename/content");
        }
        const urlApi = window?.URL || window?.webkitURL;
        if (typeof Blob !== "function" || !urlApi?.createObjectURL || !document?.body) {
          return fail("BROWSER_DOWNLOAD_UNAVAILABLE", "当前浏览器不支持下载");
        }
        let url = null;
        try {
          const blob = new Blob([request.content], {
            type: request.mimeType || "text/plain;charset=utf-8",
          });
          url = urlApi.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = String(request.filename);
          link.hidden = true;
          document.body.append(link);
          link.click();
          link.remove();
          const scheduled = timerService?.schedule?.(() => urlApi.revokeObjectURL(url), 0);
          if (!scheduled?.ok) urlApi.revokeObjectURL(url);
          return deepFreeze({ ok: true, filename: String(request.filename) });
        } catch (error) {
          if (url) {
            try { urlApi.revokeObjectURL(url); } catch (revokeError) { /* best effort */ }
          }
          return fail("BROWSER_DOWNLOAD_FAILED", error?.message || "下载失败");
        }
      },
    });
  }

  function createBrowserServices(options = {}) {
    const storage = options.storageService || null;
    const timer = options.timerService || null;
    const focus = options.focusService || null;
    const download = options.downloadService || null;
    return Object.freeze({
      storage,
      timer,
      focus,
      download(request) {
        if (typeof download?.save !== "function") {
          return fail("BROWSER_DOWNLOAD_UNAVAILABLE", "download service 不可用");
        }
        return download.save(clone(request));
      },
    });
  }

  return Object.freeze({
    createBrowserServices,
    createStorageService,
    createTimerService,
    createFocusService,
    createDownloadService,
  });
});
