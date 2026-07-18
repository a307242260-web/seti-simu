(function (root, factory) {
  "use strict";

  let players = root.SetiPlayers;
  let catalog = root.SetiTechCatalog;
  let resolver = root.SetiTechResolver;

  if (typeof require === "function") {
    players = players || require("../players");
    catalog = catalog || require("../tech/catalog");
    resolver = resolver || require("../tech/resolver");
  }

  const api = factory(players, catalog, resolver);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiActionResearchTech = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (players, catalog, resolver) {
  "use strict";

  const ACTION_ID = "researchTech";
  const ACTION_LABEL = "科技";

  function restoreObject(target, snapshot) {
    if (!target || !snapshot) return;
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, structuredClone(snapshot));
  }

  function getPlayerTechState(context) {
    const currentPlayer = players.getCurrentPlayer(context.playerState);
    if (!currentPlayer) return { ok: false, message: "没有当前玩家" };

    if (!currentPlayer.techState && context.ensurePlayerTechState) {
      context.ensurePlayerTechState(currentPlayer);
    }

    if (!currentPlayer.techState) {
      return { ok: false, message: "玩家科技状态未初始化" };
    }

    return { ok: true, currentPlayer };
  }

  function buildTechTypeOptions(options = {}) {
    const allowedTechTypes = resolver.normalizeTechTypeFilter(options);
    return allowedTechTypes ? { techTypes: allowedTechTypes } : {};
  }

  function getResearchOptions(context, options = {}) {
    const check = canExecute(context, options);
    if (!check.ok) return check;

    const currentPlayer = players.getCurrentPlayer(context.playerState);
    const choices = check.takeable.flatMap((tileId) => {
      if (catalog.getTechType(tileId) !== "blue") {
        return [{ tileId, blueSlot: null, label: `研究 ${tileId}` }];
      }
      return resolver.getAvailableBlueSlots(currentPlayer.techState).map((blueSlot) => ({
        tileId,
        blueSlot,
        label: `研究 ${tileId}（蓝槽 ${blueSlot}）`,
      }));
    });
    return {
      ...check,
      choices,
      needsChoice: choices.length > 1,
    };
  }

  function canExecute(context, options = {}) {
    const playerResult = getPlayerTechState(context);
    if (!playerResult.ok) return playerResult;

    const board = context.techBoardState;
    if (!board) return { ok: false, message: "科技版图状态未初始化" };

    const cheatMode = Boolean(context.techUiState?.cheatModeEnabled || options.skipCost);
    const researchCost = resolver.getResearchPublicityCost?.(playerResult.currentPlayer)
      ?? catalog.RESEARCH_PUBLICITY_COST;
    if (!cheatMode && !players.canAfford(playerResult.currentPlayer, { publicity: researchCost })) {
      return {
        ok: false,
        message: `宣传不足，研究科技需要 ${researchCost} 宣传`,
      };
    }

    const techTypeOptions = buildTechTypeOptions(options);
    const takeable = resolver.listTakeableTiles(board, playerResult.currentPlayer.techState, techTypeOptions);
    if (!takeable.length) {
      return {
        ok: false,
        message: techTypeOptions.techTypes ? "没有符合颜色限制的可研究科技板块" : "没有可研究的科技板块",
      };
    }

    return { ok: true, message: null, takeable, allowedTechTypes: techTypeOptions.techTypes || null };
  }

  function execute(context, options = {}) {
    if (options.tileId) {
      const techTypeOptions = buildTechTypeOptions(options);
      if (options.selectionOnly) {
        const playerResult = getPlayerTechState(context);
        if (!playerResult.ok) return playerResult;
        const snapshots = {
          player: structuredClone(playerResult.currentPlayer),
          board: structuredClone(context.techBoardState),
          ui: context.techUiState ? structuredClone(context.techUiState) : null,
        };
        const researchCost = resolver.getResearchPublicityCost?.(playerResult.currentPlayer)
          ?? catalog.RESEARCH_PUBLICITY_COST;
        if (!options.skipCost && !context.techUiState?.cheatModeEnabled) {
          const spend = players.spendResources(playerResult.currentPlayer, { publicity: researchCost });
          if (!spend.ok) return spend;
        }
        const result = resolver.selectTechTile(context, {
          tileId: options.tileId,
          blueSlot: options.blueSlot,
          ...techTypeOptions,
        });
        if (!result.ok || result.needsBlueSlotChoice) {
          restoreObject(playerResult.currentPlayer, snapshots.player);
          restoreObject(context.techBoardState, snapshots.board);
          restoreObject(context.techUiState, snapshots.ui);
          return result;
        }
        if (context.techUiState) {
          context.techUiState.techSelectionActive = false;
          context.techUiState.pendingTileId = null;
          context.techUiState.allowedTechTypes = null;
        }
        return {
          ...result,
          actionId: ACTION_ID,
          abilityId: "researchTechSelect",
          undoable: true,
          commands: [{
            label: "选择科技片",
            describe: "恢复选择科技片前状态",
            undo() {
              restoreObject(playerResult.currentPlayer, snapshots.player);
              restoreObject(context.techBoardState, snapshots.board);
              restoreObject(context.techUiState, snapshots.ui);
            },
          }],
          cost: options.skipCost ? {} : { publicity: researchCost },
          payload: {
            tileId: result.tileId,
            techType: result.techType,
            bonusId: result.bonusId,
            blueSlot: result.blueSlot,
            firstTake: result.firstTake,
          },
          events: [],
        };
      }
      return resolver.executeTakeTech(context, {
        tileId: options.tileId,
        blueSlot: options.blueSlot,
        ...techTypeOptions,
      });
    }

    const techTypeOptions = buildTechTypeOptions(options);
    const check = canExecute(context, techTypeOptions);
    if (!check.ok) {
      if (context.techUiState) context.techUiState.statusNote = check.message;
      return { ok: false, actionId: ACTION_ID, message: check.message };
    }

    if (context.techUiState) {
      context.techUiState.techSelectionActive = true;
      context.techUiState.allowedTechTypes = techTypeOptions.techTypes ? [...techTypeOptions.techTypes] : null;
      context.techUiState.statusNote = "请选择要研究的科技板块";
    }

    return {
      ok: true,
      actionId: ACTION_ID,
      awaitingTileSelection: true,
      takeable: check.takeable,
      allowedTechTypes: check.allowedTechTypes || null,
      message: "请选择要研究的科技板块",
    };
  }

  return Object.freeze({
    id: ACTION_ID,
    label: ACTION_LABEL,
    getResearchOptions,
    canExecute,
    execute,
  });
});
