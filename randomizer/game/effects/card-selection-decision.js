(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiCardSelectionDecision = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const DECISION_EFFECT_TYPE = "standard_action_session_decision";

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function normalizePending(pending) {
    if (!pending) return null;
    const player = pending.player || null;
    const normalized = {
      ...clone(pending),
      playerId: pending.playerId || player?.id || null,
      playerColor: pending.playerColor || player?.color || null,
      effectId: pending.effectId || pending.effect?.id || null,
    };
    delete normalized.player;
    delete normalized.effect;
    delete normalized.selectedSlots;
    return normalized;
  }

  function createCardSelectionDecisionOwner(options = {}) {
    if (typeof options.resolvePlayer !== "function" || typeof options.getCardLabel !== "function") {
      throw new TypeError("card selection Decision owner 缺少 player/card 领域能力");
    }

    let activeRuleTransaction = null;

    function readActiveEffect() {
      const inspection = options.inspectSession?.();
      const effect = inspection?.session?.currentEffect || inspection?.currentEffect || null;
      return effect?.kind === "decision" && effect.type === DECISION_EFFECT_TYPE
        && effect.payload?.cardSelection
        ? effect
        : null;
    }

    function read() {
      return clone(readActiveEffect()?.payload?.cardSelection || null);
    }

    function createCandidates(workingRoot, pending) {
      const player = options.resolvePlayer(workingRoot, pending);
      if (!player?.id) return { actorPlayer: null, candidates: [] };
      const attach = (candidate) => ({
        ...candidate,
        cardSelection: clone(pending),
      });

      if (["industry_deepspace_hand", "industry_future_hand"].includes(pending.type)) {
        return {
          actorPlayer: player,
          candidates: (player.hand || []).flatMap((card, handIndex) => (
            pending.type === "industry_future_hand" && !options.isFutureSpanEligibleHandCard?.(card)
              ? []
              : [attach({
                id: "conditionalChoice",
                family: "choose_card",
                label: options.getCardLabel(card),
                target: {
                  kind: "hand-card",
                  choiceId: String(handIndex),
                  cardId: card.cardId || card.id || null,
                  handIndex,
                },
                handIndex,
                pendingType: pending.type,
              })]
          )),
        };
      }

      const selectedSlots = new Set(options.getSelectedPublicSlots?.() || []);
      const maxSelectable = Math.max(1, Math.round(Number(pending.maxSelectable) || 1));
      const candidates = (workingRoot.cardState?.publicCards || []).flatMap((card, slotIndex) => (
        card
          && !selectedSlots.has(slotIndex)
          && selectedSlots.size < maxSelectable
          && (pending.type !== "public_scan"
            || options.getPublicScanChoicesForCard?.(workingRoot, card)?.ok)
          ? [attach({
            id: "conditionalChoice",
            family: "choose_card",
            label: options.getCardLabel(card),
            target: {
              kind: "public-card",
              choiceId: String(slotIndex),
              slotId: String(slotIndex),
              cardId: card.cardId || card.id || null,
            },
            slotIndex,
          })]
          : []
      ));

      if (
        pending.type === "card_public_corner_discard"
        && selectedSlots.size >= options.getPublicCardMultiSelectMinSelectable(pending)
      ) {
        candidates.push(attach({
          id: "conditionalChoice",
          family: "choose_branch",
          label: "确认弃除公共牌",
          target: { kind: "confirm-public-corner-discard", choiceId: "confirm" },
        }));
      }
      if (
        pending.type === "public_scan"
        && selectedSlots.size >= options.getPublicScanMinSelectable(pending)
      ) {
        candidates.push(attach({
          id: "conditionalChoice",
          family: "choose_branch",
          label: "确认公共牌扫描",
          target: { kind: "confirm-public-scan", choiceId: "confirm" },
        }));
      }
      if (pending.allowBlindDraw !== false && options.canBlindDraw?.(workingRoot)) {
        candidates.push(attach({
          id: "conditionalChoice",
          family: "choose_card",
          label: "盲抽",
          target: { kind: "blind-draw", choiceId: "blind-draw" },
        }));
      }
      return { actorPlayer: player, candidates };
    }

    function createDecisionEffect(workingRoot, rawPending) {
      const pending = normalizePending(rawPending);
      if (!pending) {
        throw new TypeError("card selection DecisionEffect 缺少 pending payload");
      }
      const described = createCandidates(workingRoot, pending);
      return {
        ownerId: described.actorPlayer?.id || null,
        type: DECISION_EFFECT_TYPE,
        kind: "decision",
        decisionKind: described.candidates[0]?.family || "choose_card",
        payload: {
          choices: described.candidates,
          cardSelection: pending,
        },
      };
    }

    function runRuleTransaction(workingRoot, operation) {
      if (!workingRoot || typeof workingRoot !== "object" || typeof operation !== "function") {
        throw new TypeError("card selection rule transaction 缺少 workingRoot/operation");
      }
      if (activeRuleTransaction) return operation();
      const frame = { workingRoot, openedDecisionEffect: null };
      activeRuleTransaction = frame;
      try {
        return operation();
      } finally {
        activeRuleTransaction = null;
      }
    }

    function open(workingRoot, pending) {
      if (!pending) return null;
      if (!activeRuleTransaction || activeRuleTransaction.workingRoot !== workingRoot) {
        throw new Error("card selection DecisionEffect 只能在当前规则事务内 open");
      }
      if (activeRuleTransaction.openedDecisionEffect) {
        throw new Error("同一规则事务不能 open 两个 card selection DecisionEffect");
      }
      const effect = createDecisionEffect(workingRoot, pending);
      activeRuleTransaction.openedDecisionEffect = effect;
      return clone(effect.payload.cardSelection);
    }

    function takeOpenedDecisionEffect() {
      if (!activeRuleTransaction?.openedDecisionEffect) return null;
      const effect = activeRuleTransaction.openedDecisionEffect;
      activeRuleTransaction.openedDecisionEffect = null;
      return clone(effect);
    }

    return Object.freeze({
      read,
      runRuleTransaction,
      open,
      takeOpenedDecisionEffect,
    });
  }

  return Object.freeze({
    DECISION_EFFECT_TYPE,
    createCardSelectionDecisionOwner,
  });
});
