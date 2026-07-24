(function (root, factory) {
  "use strict";

  let catalog = root.SetiIndustryCatalog;
  let passives = root.SetiIndustryPassives;

  if (typeof require === "function") {
    catalog = catalog || require("./catalog");
    passives = passives || require("./passives");
  }

  const api = factory(catalog, passives);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiIndustryAbilities = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (catalog, passives) {
  "use strict";

  const PUBLICITY_PICK_COST = 2;
  const FENWICK_PUBLICITY_PICK_COST = 1;
  const STRATUS_PUBLIC_CARD_LIMIT = 3;
  const HUANYU_FREE_MOVE_COUNT = 2;
  const FUTURE_SPAN_PICK_ADVANCE_AMOUNT = 2;

  function isAlienCard(card) {
    const cardId = String(card?.cardId || card?.id || "");
    const src = String(card?.src || "");
    return cardId.includes("alien") || src.includes("/aliens/");
  }

  function getCornerReward(cards, card) {
    if (!cards || !card) return null;
    const resourceReward = cards.getDiscardActionRewardForCard(card);
    if (resourceReward) return { kind: "resource", ...resourceReward };
    const moveReward = cards.getDiscardActionMoveRewardForCard?.(card);
    if (moveReward) return { kind: "move", ...moveReward };
    return null;
  }

  function getCornerRewardIcon(reward) {
    if (reward?.kind === "move") return "movement";
    if (Math.max(0, Math.round(Number(reward?.dataCount) || 0)) > 0) return "data";
    if (reward?.gain?.score) return "score";
    if (reward?.gain?.publicity) return "publicity";
    return "pick_card";
  }

  function normalizeRewardAmount(value) {
    return Math.max(0, Math.round(Number(value) || 0));
  }

  function cloneRewardGain(gain) {
    return Object.fromEntries(
      Object.entries(gain || {})
        .map(([key, value]) => [key, Number(value) || 0])
        .filter(([, value]) => value !== 0),
    );
  }

  function addRewardGain(target, gain) {
    for (const [key, value] of Object.entries(gain || {})) {
      const amount = Number(value) || 0;
      if (!amount) continue;
      target[key] = (Number(target[key]) || 0) + amount;
      if (!target[key]) delete target[key];
    }
  }

  function getCornerRewardMergeKey(reward) {
    if (!reward) return "none";
    if (reward.code !== undefined && reward.code !== null) {
      return `${reward.kind || "unknown"}:${reward.code}`;
    }
    const gainKey = Object.entries(reward.gain || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}:${Number(value) || 0}`)
      .join(",");
    return [
      reward.kind || "unknown",
      `move:${normalizeRewardAmount(reward.movementPoints)}`,
      `data:${normalizeRewardAmount(reward.dataCount)}`,
      `gain:${gainKey}`,
    ].join("|");
  }

  function pushRewardLabelPart(parts, value, label) {
    const amount = normalizeRewardAmount(value);
    if (amount > 0) parts.push(`${amount}${label}`);
  }

  function formatMergedCornerRewardLabel(reward) {
    const parts = [];
    const gain = reward?.gain || {};
    if (reward?.kind === "move") pushRewardLabelPart(parts, reward.movementPoints, "移动");
    pushRewardLabelPart(parts, gain.credits, "信用点");
    pushRewardLabelPart(parts, gain.energy, "能量");
    pushRewardLabelPart(parts, gain.publicity, "宣传");
    pushRewardLabelPart(parts, reward?.dataCount, "数据");
    pushRewardLabelPart(parts, gain.score, "分");
    return parts.length ? `弃牌换${parts.join("+")}` : (reward?.label || "弃牌角标");
  }

  function createMergedCornerReward(reward) {
    const merged = {
      kind: reward?.kind || "resource",
      code: reward?.code ?? null,
      label: reward?.label || "弃牌角标",
      gain: {},
      dataCount: 0,
      movementPoints: 0,
      sourceCount: 0,
    };
    return mergeCornerRewardInto(merged, reward);
  }

  function mergeCornerRewardInto(target, reward) {
    if (!target || !reward) return target;
    addRewardGain(target.gain, reward.gain);
    target.dataCount = normalizeRewardAmount(target.dataCount) + normalizeRewardAmount(reward.dataCount);
    target.movementPoints = normalizeRewardAmount(target.movementPoints) + normalizeRewardAmount(reward.movementPoints);
    target.sourceCount = normalizeRewardAmount(target.sourceCount) + 1;
    target.label = formatMergedCornerRewardLabel(target);
    return target;
  }

  function snapshotCornerReward(reward) {
    if (!reward) return null;
    return {
      kind: reward.kind,
      code: reward.code ?? null,
      label: reward.label,
      gain: cloneRewardGain(reward.gain),
      dataCount: normalizeRewardAmount(reward.dataCount),
      movementPoints: normalizeRewardAmount(reward.movementPoints),
      sourceCount: normalizeRewardAmount(reward.sourceCount),
    };
  }

  function formatStratusEffectNodeLabel(group) {
    const count = group.cards.length;
    if (!group.reward) {
      return `层云核心：${group.cardLabels[0] || "公共牌"} 无弃牌角标`;
    }
    if (count <= 1) {
      return `层云核心：${group.cardLabels[0] || "公共牌"} 弃牌角标`;
    }
    return `层云核心：${count} 张公共牌合并为${group.reward.label}`;
  }

  function buildStratusPublicCornerEffectNodes(cards, publicCards) {
    const groups = [];
    const rewardGroups = new Map();

    (publicCards || [])
      .slice(0, STRATUS_PUBLIC_CARD_LIMIT)
      .forEach((card, index) => {
        if (!card) return null;
        const reward = getCornerReward(cards, card);
        const cardLabel = cards?.getCardLabel?.(card) || card.cardName || card.cardId || `公共牌 ${index + 1}`;
        const snapshot = snapshotPlayedCard(card);
        if (!reward) {
          groups.push({
            key: `none:${index}`,
            firstIndex: index,
            reward: null,
            cards: [snapshot],
            cardLabels: [cardLabel],
            publicSlotIndexes: [index],
          });
          return null;
        }

        const key = getCornerRewardMergeKey(reward);
        let group = rewardGroups.get(key);
        if (!group) {
          group = {
            key,
            firstIndex: index,
            reward: createMergedCornerReward(reward),
            cards: [],
            cardLabels: [],
            publicSlotIndexes: [],
          };
          rewardGroups.set(key, group);
          groups.push(group);
        } else {
          mergeCornerRewardInto(group.reward, reward);
        }
        group.cards.push(snapshot);
        group.cardLabels.push(cardLabel);
        group.publicSlotIndexes.push(index);
        return null;
      });

    return groups
      .sort((left, right) => left.firstIndex - right.firstIndex)
      .map((group) => {
        const firstCard = group.cards[0] || null;
        const slotPart = group.publicSlotIndexes.join("-");
        const idSource = group.reward
          ? `${group.reward.kind || "reward"}-${group.reward.code ?? group.key}`
          : `${firstCard?.id || firstCard?.cardId || firstCard?.src || "card"}`;
        return {
          id: `industry-stratus-corner-${slotPart}-${idSource}`,
          type: "industry_stratus_corner",
          label: formatStratusEffectNodeLabel(group),
          icon: getCornerRewardIcon(group.reward),
          status: "pending",
          undoable: true,
          options: {
            publicSlotIndex: group.publicSlotIndexes[0],
            publicSlotIndexes: [...group.publicSlotIndexes],
            card: firstCard,
            cards: group.cards.filter(Boolean),
            cardLabels: [...group.cardLabels],
            reward: snapshotCornerReward(group.reward),
          },
        };
      });
  }

  function buildHuanyuFreeMoveEffectNodes(options = {}) {
    const label = options.label || "寰宇动力";
    const count = Math.max(0, Math.round(Number(options.count ?? HUANYU_FREE_MOVE_COUNT) || 0));
    const groupId = options.groupId || "industry-huanyu-free-moves";
    const nodes = [];
    for (let index = 0; index < count; index += 1) {
      const moveNumber = index + 1;
      nodes.push({
        id: `${groupId}-move-${moveNumber}`,
        type: "card_move",
        label: `${label}：移动 ${moveNumber}/${count}`,
        icon: "movement",
        status: "pending",
        undoable: true,
        options: {
          movementPoints: 1,
          historyLabel: `${label}：移动 ${moveNumber}/${count}`,
          source: "industry",
          industryHuanyuMoveGroupId: groupId,
          industryHuanyuMoveIndex: moveNumber,
          industryHuanyuMoveCount: count,
          requireDifferentRocketInGroup: true,
        },
      });
    }
    return nodes;
  }

  function applyCornerReward(players, data, player, reward) {
    const results = [];
    if (!reward || !player) {
      return { ok: false, message: "没有可结算的弃牌角标奖励", results };
    }
    if (reward.kind === "resource") {
      if (reward.gain && Object.keys(reward.gain).length) {
        players.gainResources(player, reward.gain);
      }
      const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
      for (let index = 0; index < dataCount; index += 1) {
        results.push(data.gainData(player, { source: "industry_corner" }));
      }
      const parts = [];
      if (reward.gain?.publicity) parts.push(`宣传+${reward.gain.publicity}`);
      if (reward.gain?.score) parts.push(`分+${reward.gain.score}`);
      if (dataCount) parts.push(`数据+${results.filter((item) => item.ok).length}`);
      return {
        ok: true,
        message: parts.length ? parts.join("、") : reward.label,
        results,
      };
    }
    if (reward.kind === "move") {
      if (reward.gain && Object.keys(reward.gain).length) {
        players.gainResources(player, reward.gain);
      }
      return {
        ok: true,
        message: reward.label,
        results,
        pendingFreeMove: {
          movementPoints: reward.movementPoints || 1,
        },
      };
    }
    return { ok: false, message: "不支持的弃牌角标奖励", results };
  }

  function applyIncomeResourcesFromCard(cards, players, data, player, card, options = {}) {
    const gain = cards.getIncomeGainForCard(card);
    if (!gain) {
      return { ok: false, message: `无法识别卡牌收入：${cards.getCardLabel(card)}` };
    }
    const resourceGain = {};
    const dataResults = [];
    const drawnCards = [];
    if (gain.credits) resourceGain.credits = gain.credits;
    if (gain.energy) resourceGain.energy = gain.energy;
    if (gain.publicity) resourceGain.publicity = gain.publicity;
    if (Object.keys(resourceGain).length) {
      players.gainResources(player, resourceGain);
    }
    const dataCount = Math.max(0, Math.round(Number(gain.availableData) || 0));
    for (let index = 0; index < dataCount; index += 1) {
      dataResults.push(data.gainData(player, { source: "industry_income" }));
    }
    const handCount = Math.max(0, Math.round(Number(gain.handSize) || 0));
    if (handCount > 0) {
      if (typeof options.blindDraw === "function") {
        for (let index = 0; index < handCount; index += 1) {
          const result = options.blindDraw(player);
          if (!result?.ok) {
            return {
              ok: false,
              message: result?.message || "任务中继站盲抽收入结算失败",
              gain,
              dataResults,
              drawnCards,
            };
          }
          if (result.card) drawnCards.push(result.card);
        }
      } else {
        players.gainResources(player, { handSize: handCount });
        drawnCards.push(...(player.hand || []).slice(-handCount));
      }
    }
    const labels = {
      credits: "信用点",
      energy: "能量",
      publicity: "宣传",
      availableData: "数据",
    };
    const parts = Object.entries(resourceGain).map(([key, value]) => `${value}${labels[key] || key}`);
    if (dataCount) parts.push(`${dataCount}数据`);
    if (handCount) parts.push(`盲抽${drawnCards.length || handCount}张`);
    return {
      ok: true,
      message: parts.join("、") || "无收入奖励",
      gain,
      dataResults,
      drawnCards,
    };
  }

  function prepareActiveAbility(player, companyLabel) {
    const definition = catalog.getIndustryDefinition(companyLabel);
    if (!definition?.activeAbilityId) {
      return { ok: false, message: "该公司没有可执行的 1x 行动" };
    }
    if (catalog.SKIPPED_ACTIVE_LABELS.includes(catalog.normalizeIndustryLabel(companyLabel))) {
      return { ok: false, message: "该公司 1x 行动尚未实现" };
    }
    return { ok: true, abilityId: definition.activeAbilityId, label: definition.label };
  }

  function canStartActiveAbility(player, companyLabel) {
    const prepared = prepareActiveAbility(player, companyLabel);
    if (!prepared.ok) return prepared;

    if (prepared.abilityId === "mission_publicity_pick_income"
      && (!player?.resources || player.resources.publicity < PUBLICITY_PICK_COST)) {
      return { ok: false, message: `宣传不足，需要 ${PUBLICITY_PICK_COST} 宣传` };
    }
    if (prepared.abilityId === "fenwick_publicity_pick_corner"
      && (!player?.resources || player.resources.publicity < FENWICK_PUBLICITY_PICK_COST)) {
      return { ok: false, message: `宣传不足，需要 ${FENWICK_PUBLICITY_PICK_COST} 宣传` };
    }
    if (prepared.abilityId === "deepspace_swap_cards" && !(player?.hand || []).length) {
      return { ok: false, message: `${prepared.label}：没有手牌可与公共牌交换` };
    }
    if (prepared.abilityId === "future_span_pick_advance") {
      const futureState = player?.industryFutureSpan;
      const targetScore = Number(futureState?.targetScore);
      if (!futureState?.card || futureState.playing || !Number.isFinite(targetScore)) {
        return { ok: false, message: `${prepared.label}：没有已标记的目标牌，无法使用该能力` };
      }
    }
    if (prepared.abilityId === "helios_remove_tech_income") {
      const ownedTiles = player?.techState?.ownedTiles || {};
      const disabledTiles = player?.techState?.disabledTiles || {};
      const hasRemovableTech = Object.entries(ownedTiles)
        .some(([tileId, owned]) => owned && !disabledTiles[tileId] && !String(tileId).startsWith("blue"));
      if (!hasRemovableTech) {
        return { ok: false, message: `${prepared.label}：没有可无效的非蓝色科技` };
      }
      if (!(player?.hand || []).length) {
        return { ok: false, message: `${prepared.label}：没有手牌可用于增加收入` };
      }
    }
    return prepared;
  }

  function normalizeRoundNumber(roundNumber) {
    return Math.max(1, Math.round(Number(roundNumber) || 1));
  }

  function normalizeTurnNumber(turnNumber) {
    return Math.max(1, Math.round(Number(turnNumber) || 1));
  }

  function armAbilityState(player, abilityId, roundNumber, turnNumber = 1) {
    const round = Math.max(1, Math.round(Number(roundNumber) || 1));
    const turn = normalizeTurnNumber(turnNumber);
    if (abilityId === "sentinel_arm_play_corner") {
      player.industrySentinelArmedRound = round;
      player.industrySentinelArmedTurn = turn;
    }
    if (abilityId === "huanyu_free_moves") {
      player.industryHuanyuFreeMoveRound = 0;
      player.industryHuanyuFreeMoveTurn = 0;
      player.industryHuanyuFreeMovesLeft = 0;
      player.industryHuanyuMovedRocketIds = [];
    }
    if (abilityId === "turing_borrow_tech") {
      player.industryBorrowedTechTileId = null;
      player.industryBorrowedTechRound = 0;
      player.industryBorrowedTechTurn = 0;
    }
  }

  function buildActiveAbilityFlow(player, companyLabel, roundNumber, turnNumber = 1) {
    const prepared = canStartActiveAbility(player, companyLabel);
    if (!prepared.ok) return prepared;

    const abilityId = prepared.abilityId;
    armAbilityState(player, abilityId, roundNumber, turnNumber);

    switch (abilityId) {
      case "stratus_public_corners":
        return {
          ok: true,
          abilityId,
          flowType: "stratus_public_corners",
          label: prepared.label,
          message: `${prepared.label}：请按效果栏依次结算公共牌区 ${STRATUS_PUBLIC_CARD_LIMIT} 张牌的弃牌角标（不弃牌）`,
        };
      case "turing_borrow_tech":
        return {
          ok: true,
          abilityId,
          flowType: "turing_borrow_tech",
          label: prepared.label,
          message: `${prepared.label}：请选择一项橙色或紫色科技借用当前回合效果（不获得板块与 bonus）`,
        };
      case "sentinel_arm_play_corner":
        return {
          ok: true,
          abilityId,
          flowType: "sentinel_arm_play_corner",
          label: prepared.label,
          message: `${prepared.label}：已启用本回合打牌后弃牌角标奖励`,
        };
      case "huanyu_free_moves":
        return {
          ok: true,
          abilityId,
          flowType: "huanyu_free_moves",
          label: prepared.label,
          movesLeft: HUANYU_FREE_MOVE_COUNT,
          message: `${prepared.label}：请按效果栏结算 2 次移动；每次提供 1 点移动力，且必须选择不同火箭`,
        };
      case "helios_remove_tech_income":
        return {
          ok: true,
          abilityId,
          flowType: "helios_remove_tech",
          label: prepared.label,
          message: `${prepared.label}：请选择要无效的科技（不可选蓝色），确认后清除 3 个奖励槽标记并增加 1 次收入`,
        };
      case "mission_publicity_pick_income": {
        return {
          ok: true,
          abilityId,
          flowType: "mission_publicity_pick",
          label: prepared.label,
          publicityCost: PUBLICITY_PICK_COST,
          message: `${prepared.label}：消耗 ${PUBLICITY_PICK_COST} 宣传精选 1 张牌并获得其收入角标奖励`,
        };
      }
      case "fenwick_publicity_pick_corner": {
        return {
          ok: true,
          abilityId,
          flowType: "fenwick_publicity_pick",
          label: prepared.label,
          publicityCost: FENWICK_PUBLICITY_PICK_COST,
          message: `${prepared.label}：消耗 ${FENWICK_PUBLICITY_PICK_COST} 宣传精选 1 张牌并获得弃牌角标奖励（不弃牌）`,
        };
      }
      case "deepspace_swap_cards":
        return {
          ok: true,
          abilityId,
          flowType: "deepspace_swap",
          label: prepared.label,
          message: `${prepared.label}：请选择 1 张手牌，再选择 1 张公共牌交换`,
        };
      case "future_span_pick_advance": {
        return {
          ok: true,
          abilityId,
          flowType: "future_span_pick",
          label: prepared.label,
          advanceAmount: FUTURE_SPAN_PICK_ADVANCE_AMOUNT,
          message: `${prepared.label}：精选 1 张公共牌，并将专属标记目标分提高 ${FUTURE_SPAN_PICK_ADVANCE_AMOUNT}`,
        };
      }
      case "strategy_pick_card":
        return {
          ok: true,
          abilityId,
          flowType: "strategy_pick",
          label: prepared.label,
          message: `${prepared.label}：请精选 1 张公共牌，并清除当前 3 个奖励槽标记`,
        };
      default:
        return { ok: false, message: `未实现的公司 1x 行动：${abilityId}` };
    }
  }

  function isSentinelPlayCornerReady(player, roundNumber, turnNumber = 1) {
    const round = normalizeRoundNumber(roundNumber);
    const turn = normalizeTurnNumber(turnNumber);
    return player?.industrySentinelArmedRound === round
      && player?.industrySentinelArmedTurn === turn
      && player?.industryRoundMarkRound === round;
  }

  function snapshotPlayedCard(card) {
    if (!card) return null;
    return Object.fromEntries(Object.entries({
      id: card.id,
      src: card.src,
      cardName: card.cardName,
      label: card.label,
      cardId: card.cardId,
      discardActionCode: card.discardActionCode,
      incomeActionCode: card.incomeActionCode,
    }).filter(([, value]) => value !== undefined));
  }

  function shouldAppendSentinelPlayCornerEffect(cards, player, roundNumber, turnNumber, playedCard) {
    if (arguments.length === 4) {
      playedCard = turnNumber;
      turnNumber = 1;
    }
    if (!playedCard || !player) return false;
    if (!isSentinelPlayCornerReady(player, roundNumber, turnNumber)) return false;
    if (isAlienCard(playedCard)) return false;
    return Boolean(getCornerReward(cards, playedCard));
  }

  function buildSentinelPlayCornerEffectNode(cards, playedCard) {
    const reward = getCornerReward(cards, playedCard);
    if (!reward) return null;
    const cardLabel = cards.getCardLabel(playedCard);
    return {
      id: `industry-sentinel-corner-${playedCard.id || playedCard.src}`,
      type: "industry_sentinel_corner",
      label: `哨兵探测网络：${cardLabel} 弃牌角标`,
      icon: getCornerRewardIcon(reward),
      status: "pending",
      undoable: true,
      options: {
        playedCard: snapshotPlayedCard(playedCard),
      },
    };
  }

  function buildSentinelPlayCornerEffectNodes(cards, player, roundNumber, turnNumber, playedCard) {
    if (arguments.length === 4) {
      playedCard = turnNumber;
      turnNumber = 1;
    }
    if (!shouldAppendSentinelPlayCornerEffect(cards, player, roundNumber, turnNumber, playedCard)) {
      return [];
    }
    const node = buildSentinelPlayCornerEffectNode(cards, playedCard);
    return node ? [node] : [];
  }

  function resolveSentinelPlayCorner(cards, players, data, player, card) {
    if (isAlienCard(card)) {
      return { ok: false, message: "外星人卡牌不能触发哨兵弃牌角标" };
    }
    const reward = getCornerReward(cards, card);
    if (!reward) {
      return { ok: false, message: "该牌没有弃牌角标奖励" };
    }
    const applied = applyCornerReward(players, data, player, reward);
    return {
      ...applied,
      reward,
      message: applied.ok ? `哨兵探测网络：${applied.message}` : applied.message,
    };
  }

  function resetRoundIndustryRuntimeState(player) {
    if (!player) return player;
    player.industryBorrowedTechTileId = null;
    player.industryBorrowedTechRound = 0;
    player.industryBorrowedTechTurn = 0;
    player.industrySentinelArmedRound = 0;
    player.industrySentinelArmedTurn = 0;
    player.industryHuanyuFreeMoveRound = 0;
    player.industryHuanyuFreeMoveTurn = 0;
    player.industryHuanyuFreeMovesLeft = 0;
    player.industryHuanyuMovedRocketIds = [];
    player.industryPlayedCardThisRound = false;
    player.industryLastPlayedCardThisRound = null;
    player.industryPlayedCardRound = 0;
    player.industryPlayedCardTurn = 0;
    return player;
  }

  return Object.freeze({
    PUBLICITY_PICK_COST,
    FENWICK_PUBLICITY_PICK_COST,
    STRATUS_PUBLIC_CARD_LIMIT,
    HUANYU_FREE_MOVE_COUNT,
    FUTURE_SPAN_PICK_ADVANCE_AMOUNT,
    isAlienCard,
    getCornerReward,
    buildStratusPublicCornerEffectNodes,
    buildHuanyuFreeMoveEffectNodes,
    applyCornerReward,
    applyIncomeResourcesFromCard,
    prepareActiveAbility,
    canStartActiveAbility,
    armAbilityState,
    buildActiveAbilityFlow,
    isSentinelPlayCornerReady,
    shouldAppendSentinelPlayCornerEffect,
    buildSentinelPlayCornerEffectNode,
    buildSentinelPlayCornerEffectNodes,
    resolveSentinelPlayCorner,
  });
});
