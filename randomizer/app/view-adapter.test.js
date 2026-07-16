"use strict";

const assert = require("node:assert/strict");
const { createNoopViewAdapter } = require("./view-adapter");

const adapter = createNoopViewAdapter();

assert.equal(adapter.kind, "noop");
assert.equal(Object.prototype.hasOwnProperty.call(adapter, "document"), false);
assert.equal(Object.prototype.hasOwnProperty.call(adapter, "window"), false);
assert.deepEqual(adapter.els.finalScoreTileWraps, []);
assert.equal(adapter.hoverRuntime.ensure(), null);
assert.equal(adapter.hoverRuntime.attach("anchor"), "anchor");
assert.doesNotThrow(() => {
  adapter.renderRuntime.renderPlayerStats();
  adapter.renderRuntime.renderPublicCards();
  adapter.actionLogViewRuntime.renderActionLog();
});

console.log("view-adapter tests passed");
