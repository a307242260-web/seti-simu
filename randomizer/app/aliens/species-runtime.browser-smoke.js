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
      const dependencies = w.SetiAppDependencies.collectDependencies(w);
      const residual = w.SetiResidualDomainSession;
      const aliens = dependencies.aliens;
      const playerState = dependencies.players.createPlayerState({
        players: dependencies.players.PLAYER_COLOR_IDS.map((color) => ({ color })),
        currentPlayerColor: dependencies.players.DEFAULT_PLAYER_COLOR,
      });
      const owner = playerState.players[0];
      const root = {
        meta: { seed: "alien-browser-smoke", rngState: {}, cardInstanceSequence: 0 },
        match: { decisionVersion: 1 },
        playerState,
        turnState: { roundNumber: 2, turnNumber: 1, passedPlayerIds: [] },
        cardState: dependencies.cards.createCardState(),
        alienGameState: aliens.createDefaultAlienState(),
        finalScoringState: dependencies.finalScoring.createFinalScoringState(),
        rocketState: dependencies.rocketActions.createRocketState(),
        solarState: dependencies.solar.createBaselineState(),
        planetStatsState: dependencies.planetStats.createPlanetStatsState(),
        nebulaDataState: dependencies.data.createDefaultNebulaDataState(),
        techGameState: dependencies.tech.createState(() => 0.5),
      };
      const executors = new Map();
      residual.createResidualDomain({
        runtime: {
          registerExecutor(type, executor) {
            executors.set(type, typeof executor === "function" ? { execute: executor } : executor);
          },
        },
        commitWorkingState() { return {}; },
      });
      const execute = (type, effect) => executors.get(type).execute(root, effect, { workingRoot: root });
      for (const traceType of aliens.TRACE_TYPES) {
        const traced = aliens.placeFirstTrace(
          root.alienGameState,
          1,
          traceType,
          owner.color,
        );
        if (!traced.ok) throw new Error(`准备揭示痕迹失败: ${JSON.stringify(traced)}`);
      }
      const revealed = execute(residual.HANDOFF_TYPE, {
        type: residual.HANDOFF_TYPE,
        kind: "handoff",
        ownerId: owner.id,
        payload: {
          schemaVersion: residual.HANDOFF_SCHEMA,
          domain: "alien",
          effectType: "reveal_species",
          data: { slotId: 1, speciesId: "aomomo" },
        },
      });
      if (!revealed.ok || !aliens.getAlienSlot(root.alienGameState, 1).revealed) {
        throw new Error(`真实 reveal_species 失败: ${JSON.stringify(revealed)}`);
      }

      let activeDecision = null;
      let submitted = null;
      const runtime = w.SetiAppAlienSpeciesRuntime.createAlienSpeciesRuntime({
        speciesRules: dependencies.alienSpeciesRules,
        constants: { RESOURCE_ICON_SRC: {} },
        renderPort: {
          document: doc,
          window: w,
          els: w.SetiAppDom.collectElements(doc),
          banrenmaBonusMarkerElements: new Map(),
          renderRunezuBoardSymbols() {},
        },
        hostPort: {
          readProjection: () => structuredClone(root),
          inspect: () => activeDecision
            ? { phase: "awaiting_input", session: { decision: activeDecision } }
            : { phase: "idle", session: null },
          submitActiveDecision(kind, matcher) {
            const choice = activeDecision.choices.find((candidate) => (
              candidate.target?.kind === kind && matcher(candidate.target, candidate)
            ));
            if (!choice) return { ok: false, code: "CHOICE_MISSING" };
            submitted = executors.get(residual.EFFECT_TYPES.ALIEN_CARD_DECISION)
              .resolveDecision(root, activeDecision.effect, choice, { workingRoot: root });
            return submitted;
          },
        },
      });
      runtime.renderAlienPanels();
      const panel = doc.querySelector('.alien-panel[data-alien-slot="1"]');
      const aomomoArea = panel?.querySelector(".alien-aomomo-card-area");
      if (!panel || panel.querySelector(".alien-back")?.hidden !== false || aomomoArea?.hidden) {
        throw new Error("正式 aomomo projection 未真实渲染盘面/展示牌");
      }

      const handoff = execute(residual.HANDOFF_TYPE, {
        type: residual.HANDOFF_TYPE,
        kind: "handoff",
        ownerId: owner.id,
        payload: {
          schemaVersion: residual.HANDOFF_SCHEMA,
          domain: "alien",
          effectType: "planet_reward_aomomo_card",
          data: {},
        },
      });
      const effect = handoff.spawnedEffects?.[0]?.effect;
      const choiceExecutor = executors.get(residual.EFFECT_TYPES.ALIEN_CARD_DECISION);
      const choices = choiceExecutor.getLegalChoices(root, effect, { workingRoot: root });
      if (!effect || !choices.length) throw new Error("正式 aomomo Decision 没有合法选择");
      activeDecision = {
        decisionId: "alien-browser-smoke-decision",
        decisionVersion: 1,
        ownerId: owner.id,
        effect,
        choices,
      };
      const button = doc.createElement("button");
      button.id = "alien-human-decision-smoke";
      button.textContent = choices[0].summary;
      button.addEventListener("click", () => {
        runtime.handleAomomoCardGainChoice(choices[0].target.choiceId);
      });
      panel.append(button);
      button.click();
      if (!submitted?.ok) throw new Error(`人类正式物种 Decision 提交失败: ${JSON.stringify(submitted)}`);
      finish(true, "真实 reveal_species → projection render → human residual Decision passed");
    } catch (error) {
      finish(false, error.stack || error.message);
    }
  });
})();
