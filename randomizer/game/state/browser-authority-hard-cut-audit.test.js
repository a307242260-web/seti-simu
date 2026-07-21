"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const audit = require("../../../tools/lib/browser-authority-hard-cut-audit");

function codes(source) {
  return audit.inspectSource("randomizer/app/arbitrary-production-name.js", source)
    .map((entry) => entry.code);
}

const negativeFixtures = [
  {
    label: "改名 getter 长期 owner",
    code: "BROWSER_LONG_LIVED_MUTABLE_OWNER",
    source: `
      function assembleVault() {
        const vault = { a: createPlayerState(), b: createTurnState(), c: createCardState(), d: createSolarState() };
        return { get snapshot() { return vault; } };
      }
    `,
  },
  {
    label: "Proxy 包装长期 owner",
    code: "BROWSER_LONG_LIVED_MUTABLE_OWNER",
    source: `
      function assembleVault() {
        const vault = { a: makePlayerModel(), b: makeTurnModel(), c: makeCardModel(), d: makeSolarModel() };
        return new Proxy(vault, {});
      }
    `,
  },
  {
    label: "wrapper 暴露长期 owner",
    code: "BROWSER_LONG_LIVED_MUTABLE_OWNER",
    source: `
      function assembleVault() {
        const current = { a: createPlayerState(), b: createTurnState(), c: createCardState(), d: createSolarState() };
        return Object.freeze({ current });
      }
    `,
  },
  {
    label: "slice 到 root 拼装",
    code: "BROWSER_SLICE_TO_ROOT_BRIDGE",
    source: `
      function compose(v) { return { match:v.a, turn:v.b, players:v.c, solarSystem:v.d, pieces:v.e,
        planets:v.f, data:v.g, cards:v.h, tech:v.i, aliens:v.j, finalScoring:v.k }; }
      function publish(v) { return store.compareAndCommit(0, compose(v)); }
    `,
  },
  {
    label: "root 到 slice 回填",
    code: "BROWSER_ROOT_TO_SLICE_HYDRATE",
    source: `
      function reload(root) { vault.a = root.players; vault.b = root.turn; vault.c = root.cards; vault.d = root.solarSystem; }
    `,
  },
  {
    label: "session 外直接写",
    code: "BROWSER_DIRECT_WRITE_OUTSIDE_SESSION",
    source: `
      const { roster, round } = authority.getWorkingSlices();
      roster.score += 1;
    `,
  },
  {
    label: "session 外提交",
    code: "BROWSER_COMMIT_OUTSIDE_EFFECT_SESSION",
    source: "function publish(candidate) { return authority.compareAndCommit(version, candidate); }",
  },
  {
    label: "双提交",
    code: "BROWSER_DOUBLE_COMMIT_PATH",
    source: `
      function publish(a, b) {
        store.compareAndCommit(version, a);
        return store.compareAndCommit(version + 1, b);
      }
    `,
  },
];

for (const fixture of negativeFixtures) {
  assert.ok(
    codes(fixture.source).includes(fixture.code),
    `${fixture.label} 应触发 ${fixture.code}，实际 ${JSON.stringify(codes(fixture.source))}`,
  );
}

const allowedFixtures = [
  {
    label: "只读 projection",
    source: `
      function project(source) {
        const state = source.getSnapshot();
        return Object.freeze({ match: state.match, turn: state.turn, players: state.players,
          solarSystem: state.solarSystem, pieces: state.pieces, planets: state.planets,
          data: state.data, cards: state.cards, tech: state.tech, aliens: state.aliens,
          finalScoring: state.finalScoring });
      }
    `,
  },
  {
    label: "短生命周期 Effect Session workingState",
    source: `
      function createSession(committed, meta) {
        return { phase: "open", baseVersion: meta.baseVersion, workingState: structuredClone(committed) };
      }
      function finish(session) { return store.compareAndCommit(session.baseVersion, session.workingState); }
    `,
  },
  {
    label: "StateStore 内部合法实现",
    source: `
      function deepFreeze(value) { return Object.freeze(value); }
      function createStateStore(initial) {
        let committed = deepFreeze(initial);
        function getSnapshot() { return structuredClone(committed); }
        function beginWorkingCopy() { return { baseVersion: 0, state: structuredClone(committed) }; }
        function compareAndCommit(version, candidate) { committed = deepFreeze(candidate); return { ok: true }; }
        return { getSnapshot, beginWorkingCopy, compareAndCommit };
      }
    `,
  },
];

for (const fixture of allowedFixtures) {
  assert.deepEqual(codes(fixture.source), [], `${fixture.label} 不应误报`);
}

console.log(`browser authority hard-cut fixtures passed (${negativeFixtures.length} negative, ${allowedFixtures.length} allowed)`);

if (process.argv.includes("--fixtures-only")) process.exit(0);

const repositoryRoot = path.resolve(__dirname, "../../..");
const production = audit.auditRepository(repositoryRoot);
if (production.violations.length) {
  console.error(JSON.stringify({
    ok: false,
    scannedFiles: production.scannedFiles,
    violations: production.violations,
  }, null, 2));
}
assert.deepEqual(
  production.violations,
  [],
  "Browser production authority 尚未硬切：必须删除长期 mutable owner、双向桥、session 外写和额外提交",
);

console.log(`browser authority production audit passed (${production.scannedFiles} files)`);
