const ADMIN_KEY = "520520";
const TIME_ZONE = "Asia/Shanghai";
const TOTAL_CARD_SLOTS = 90;
const TEST_MODE_UNLIMITED_DRAWS = false;
const STARTER_GIFT_BONUS_DRAWS = 3;
const CAMPAIGN_START_DAY = "2026-05-20";
const CUSTOM_CARD_UNLOCK_DAY = 8;
const CUSTOM_CARD_SLOTS = new Set([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);

const RARITY_TIERS = [
  { id: "A", name: "A", weight: 45, accent: "#4f9a83", line: "一张轻轻的日常喜欢。", slots: [56, 90] },
  { id: "S", name: "S", weight: 25, accent: "#d9dde7", line: "今天的喜欢更亮了一点。", slots: [31, 55] },
  { id: "SR", name: "SR", weight: 20, accent: "#f3bd35", line: "这份喜欢值得认真期待。", slots: [11, 30] },
  { id: "SSR", name: "SSR", weight: 10, accent: "#c993ff", line: "超稀有喜欢出现了。", slots: [1, 10] }
];

const IMPORTED_BATCH = {
  SSR: [
    ["绝对指令权", "今晚锐锐需无条件接受可心的一条指令（限合理范围）！"],
    ["思念的深度提问", "可心今晚可向锐锐提出两个最私密、最渴望知道的、关于身体的深度问题，锐锐必须切实回答并进行最细节的描述。"],
    ["未来同居夜", "下次连线，可心可要求锐锐关闭灯光，两人盖上被子，只用私密的“气音”，互相讲述对未来同居生活的三个最大期待。"],
    ["恋爱剧本导演", "可心写一个“小情节”，锐锐必须在有空的时候把它完整演出来（语音/文字/剧情皆可）。"]
  ],
  S: [
    ["抱抱召唤卡", "可心随时说一声，锐锐就给可心一个抱抱（或语音版抱抱）。"],
    ["指定夸夸卡", "可心可以要求锐锐针对某个方面夸可心，锐锐必须夸到可心满意为止。"],
    ["甜度升级卡", "今天可心可以要求锐锐说一句平时不好意思说的情话。"],
    ["小任性保护卡", "今天可心可以任性一次，锐锐必须无条件接住（小事范围）。"],
    ["今日愿望许可卡", "可心可以提一个小愿望，锐锐需要在今天完成。"],
    ["随机甜蜜任务卡", "可心今天可以让锐锐为可心做一件“超小但超暖心”的事，由可心指定。"],
    ["生活建议卡", "可心问任何小问题，锐锐必须认真给出一个靠谱建议。"],
    ["好消息速递卡", "今天锐锐必须给可心传递一件真实的小好消息。"],
    ["今日小幸运卡", "锐锐必须给可心说一件可心今天会遇到的小幸运（预言型）。"]
  ],
  A: [
    ["小小命令卡", "可心可以命令锐锐立刻做一件非常小的事情，比如“喝水”“拍猫猫手势”。"],
    ["情绪天线卡", "可心今天说一句“锐锐有点情绪”，锐锐必须马上切换成陪伴模式。"],
    ["语音选手卡", "可心可以要求锐锐发一条可心指定风格的语音（可爱/低沉/搞怪）。"],
    ["表情包投喂卡", "可心可以随时喊，锐锐要立刻给可心投喂一波表情包。"],
    ["情感电量补给卡", "可心说缺电，锐锐必须立刻补给一句动力话。"],
    ["照片召唤卡", "可心可以要求锐锐拍一张当下的小照片（场景随缘）。"],
    ["早睡强制令", "锐锐今日必须在可心指定的时间睡觉，不许熬夜学习！"]
  ]
};

const BATCH_START_SLOT = { SSR: 1, S: 31, A: 56 };

export async function handleApi(context) {
  const request = context.request;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const store = getStore(context);

  try {
    await ensureSeed(store);

    if (method === "GET" && url.pathname === "/api/state") {
      return json(await getPublicState(store));
    }

    if (method === "POST" && url.pathname === "/api/draw") {
      return json(await drawCard(store));
    }

    if (method === "POST" && url.pathname === "/api/starter-gift") {
      return json(await claimStarterGift(store));
    }

    if (method === "POST" && url.pathname === "/api/custom-card") {
      return json(await updateCustomCard(store, await readJson(request)));
    }

    if (method === "POST" && url.pathname === "/api/card-usage") {
      return json(await updateCardUsage(store, await readJson(request)));
    }

    if (method === "GET" && url.pathname === "/api/admin/summary") {
      const denied = requireAdmin(request);
      if (denied) return denied;
      return json(await getAdminSummary(store));
    }

    if (method === "GET" && url.pathname === "/api/admin/cards") {
      const denied = requireAdmin(request);
      if (denied) return denied;
      return json({ cards: await readCards(store) });
    }

    if (method === "POST" && url.pathname === "/api/admin/cards") {
      const denied = requireAdmin(request);
      if (denied) return denied;
      const card = await upsertCard(store, await readJson(request));
      return json({ card, cards: await readCards(store) });
    }

    if (method === "DELETE" && url.pathname.startsWith("/api/admin/cards/")) {
      const denied = requireAdmin(request);
      if (denied) return denied;
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const cards = (await readCards(store)).filter((card) => card.id !== id);
      await writeCards(store, cards);
      return json({ cards });
    }

    if (method === "POST" && url.pathname === "/api/admin/reset-progress") {
      const denied = requireAdmin(request);
      if (denied) return denied;
      return json(await resetPlayerProgress(store));
    }

    return json({ error: "NOT_FOUND", message: "没有找到这个接口。" }, 404);
  } catch (error) {
    return json({ error: "SERVER_ERROR", message: error.message || "服务器刚刚走神了一下。" }, 500);
  }
}

async function getPublicState(store) {
  const rawState = await readState(store);
  const cards = hydrateCards(await readCards(store), rawState.customCards, rawState.usedCards);
  const state = normalizeState(rawState, cards);
  const todayKey = getDrawDayKey();
  const quota = getDrawQuota(state, todayKey);
  const todayDraw = getLatestTodayDraw(state.history, todayKey);
  const todayDrawn = !quota.canDraw && !TEST_MODE_UNLIMITED_DRAWS;

  return {
    nickname: "小猪",
    refreshTime: "每天 07:00",
    refreshTimeZone: "Asia/Shanghai",
    targetDate: "2026-08-15T00:00:00+08:00",
    drawDayKey: todayKey,
    campaignDay: getCampaignDay(todayKey),
    customCardsUnlocked: areCustomCardsUnlocked(todayKey),
    testModeUnlimitedDraws: TEST_MODE_UNLIMITED_DRAWS,
    starterGiftAvailable: !state.starterGiftClaimed,
    starterGiftClaimed: state.starterGiftClaimed,
    bonusDrawsRemaining: state.bonusDrawsRemaining,
    drawsRemainingToday: quota.totalRemaining,
    canDrawToday: quota.canDraw,
    todayDrawn,
    todayDraw: TEST_MODE_UNLIMITED_DRAWS ? null : todayDraw,
    nextRefreshAt: getNextRefreshIso(),
    collection: buildCollectedCards(cards, state.collection, state.history),
    collectionSlots: buildCollectionSlots(cards, state.collection, state.history),
    totalCards: TOTAL_CARD_SLOTS,
    createdCards: cards.length,
    rarityTiers: RARITY_TIERS
  };
}

async function drawCard(store) {
  const rawState = await readState(store);
  const todayKey = getDrawDayKey();
  const cards = hydrateCards(await readCards(store), rawState.customCards, rawState.usedCards)
    .filter((card) => card.enabled !== false)
    .filter((card) => isDrawableCard(card))
    .filter((card) => !card.isCustom || areCustomCardsUnlocked(todayKey));
  const state = normalizeState(rawState, cards);
  const uncollectedCards = cards.filter((card) => !state.collection.includes(card.id));
  const quota = getDrawQuota(state, todayKey);
  const latestTodayDraw = getLatestTodayDraw(state.history, todayKey);

  if (!quota.canDraw && !TEST_MODE_UNLIMITED_DRAWS) {
    const card = latestTodayDraw ? cards.find((item) => item.id === latestTodayDraw.cardId) : null;
    return { alreadyDrawn: true, draw: latestTodayDraw, card, state: await getPublicState(store) };
  }

  if (!cards.length) return { error: "NO_CARDS", message: "卡池里还没有可抽的卡。" };
  if (!uncollectedCards.length) {
    return { error: "ALL_AVAILABLE_CARDS_COLLECTED", message: "当前可抽的卡已经全部收集完啦。", state: await getPublicState(store) };
  }

  const card = drawWeightedCard(uncollectedCards);
  const draw = {
    id: crypto.randomUUID(),
    dayKey: todayKey,
    cardId: card.id,
    cardTitle: card.title,
    rarityTier: card.rarityTier,
    rarityName: card.rarityName,
    createdAt: new Date().toISOString()
  };

  const usesBonusDraw = getTodayDrawCount(state.history, todayKey) > 0;
  state.history.unshift(draw);
  if (!state.collection.includes(card.id)) state.collection.unshift(card.id);
  if (usesBonusDraw) state.bonusDrawsRemaining = Math.max(0, state.bonusDrawsRemaining - 1);
  await writeState(store, state);

  return { alreadyDrawn: false, draw, card, state: await getPublicState(store) };
}

async function claimStarterGift(store) {
  const rawState = await readState(store);
  const cards = hydrateCards(await readCards(store), rawState.customCards, rawState.usedCards);
  const state = normalizeState(rawState, cards);
  if (state.starterGiftClaimed) return { error: "ALREADY_CLAIMED", message: "体验礼包已经领过啦。" };
  state.starterGiftClaimed = true;
  state.bonusDrawsRemaining += STARTER_GIFT_BONUS_DRAWS;
  await writeState(store, state);
  return {
    ok: true,
    bonusAdded: STARTER_GIFT_BONUS_DRAWS,
    bonusDrawsRemaining: state.bonusDrawsRemaining,
    message: `获得 ${STARTER_GIFT_BONUS_DRAWS} 次额外抽卡机会~`,
    state: await getPublicState(store)
  };
}

async function resetPlayerProgress(store) {
  const rawState = await readState(store);
  const state = {
    collection: [],
    history: [],
    customCards: rawState.customCards && typeof rawState.customCards === "object" ? rawState.customCards : {},
    usedCards: {},
    starterGiftClaimed: false,
    bonusDrawsRemaining: 0
  };
  await writeState(store, state);
  return { ok: true, message: "已清空抽卡记录和收藏夹。", summary: await getAdminSummary(store) };
}

async function getAdminSummary(store) {
  const rawState = await readState(store);
  const cards = hydrateCards(await readCards(store), rawState.customCards, rawState.usedCards);
  const state = normalizeState(rawState, cards);
  const todayKey = getDrawDayKey();
  const todayDraw = state.history.find((entry) => entry.dayKey === todayKey) || null;
  return {
    todayKey,
    todayDrawn: Boolean(todayDraw) && !TEST_MODE_UNLIMITED_DRAWS,
    todayDraw: TEST_MODE_UNLIMITED_DRAWS ? null : todayDraw,
    cards,
    totalCards: TOTAL_CARD_SLOTS,
    createdCards: cards.length,
    enabledCards: cards.filter((card) => card.enabled !== false).length,
    rarityTiers: RARITY_TIERS,
    tierStats: getTierStats(cards),
    campaignDay: getCampaignDay(todayKey),
    customCardsUnlocked: areCustomCardsUnlocked(todayKey),
    testModeUnlimitedDraws: TEST_MODE_UNLIMITED_DRAWS,
    collectionCount: state.collection.length,
    history: state.history,
    nextRefreshAt: getNextRefreshIso()
  };
}

async function upsertCard(store, body) {
  const cards = await readCards(store);
  const id = safeId(body.id || body.title || crypto.randomUUID());
  const now = new Date().toISOString();
  let existingIndex = cards.findIndex((card) => card.id === id);
  const requestedSlot = Number(body.slot);
  if (existingIndex < 0 && Number.isInteger(requestedSlot) && requestedSlot >= 1 && requestedSlot <= TOTAL_CARD_SLOTS) {
    existingIndex = cards.findIndex((card) => Number(card.slot) === requestedSlot);
  }
  const existing = existingIndex >= 0 ? cards[existingIndex] : null;
  const slot = existing?.slot || normalizeSlot(body.slot, cards, existing?.id);
  const tier = getTierForSlot(slot);
  const card = {
    id,
    slot,
    title: String(body.title || existing?.title || "新的小猪卡"),
    rarityTier: tier.id,
    rarity: String(body.rarity || existing?.rarity || tier.name),
    frontText: String(body.frontText || existing?.frontText || "小猪专属"),
    backTitle: String(body.backTitle || existing?.backTitle || "今天抽到"),
    backText: String(body.backText || existing?.backText || "这里写卡片内容。"),
    actionText: String(body.actionText || existing?.actionText || "兑换一个认真抱抱"),
    accent: String(body.accent || existing?.accent || tier.accent),
    isCustom: CUSTOM_CARD_SLOTS.has(slot),
    enabled: body.enabled === false ? false : true,
    updatedAt: now,
    createdAt: existing?.createdAt || now
  };
  if (existingIndex >= 0) cards[existingIndex] = card;
  else cards.unshift(card);
  await writeCards(store, cards);
  return card;
}

async function updateCustomCard(store, body) {
  const rawState = await readState(store);
  const cards = hydrateCards(await readCards(store), rawState.customCards, rawState.usedCards);
  const state = normalizeState(rawState, cards);
  const card = cards.find((item) => item.id === body.cardId);
  if (!card || !card.isCustom || !state.collection.includes(card.id)) {
    return { error: "CUSTOM_CARD_NOT_AVAILABLE", message: "这张自定义卡还不能编辑。" };
  }
  const previous = state.customCards[card.id] || {};
  state.customCards[card.id] = {
    title: String(body.title ?? previous.title ?? "").slice(0, 60),
    text: String(body.text ?? previous.text ?? "").slice(0, 500),
    status: body.status === "thinking" ? "thinking" : "saved",
    updatedAt: new Date().toISOString()
  };
  await writeState(store, state);
  const updatedCards = hydrateCards(await readCards(store), state.customCards, state.usedCards);
  return { card: updatedCards.find((item) => item.id === card.id), state: await getPublicState(store) };
}

async function updateCardUsage(store, body) {
  const rawState = await readState(store);
  const cards = hydrateCards(await readCards(store), rawState.customCards, rawState.usedCards);
  const state = normalizeState(rawState, cards);
  const card = cards.find((item) => item.id === body.cardId);
  if (!card || !state.collection.includes(card.id)) {
    return { error: "CARD_NOT_COLLECTED", message: "这张卡还没有收藏，暂时不能使用。" };
  }
  const previous = state.usedCards[card.id] || {};
  state.usedCards[card.id] = {
    usedAt: body.clearUsed ? null : previous.usedAt || (body.markUsed ? new Date().toISOString() : null),
    memory: String(body.memory ?? previous.memory ?? "").slice(0, 600),
    updatedAt: new Date().toISOString()
  };
  await writeState(store, state);
  const updatedCards = hydrateCards(await readCards(store), state.customCards, state.usedCards);
  return { card: updatedCards.find((item) => item.id === card.id), state: await getPublicState(store) };
}

async function ensureSeed(store) {
  const cards = await kvGetJson(store, "cards");
  const state = await kvGetJson(store, "state");
  if (!cards) await writeCards(store, buildInitialCards());
  if (!state) await writeState(store, buildInitialState());
}

async function readCards(store) {
  return (await kvGetJson(store, "cards")) || buildInitialCards();
}

async function writeCards(store, cards) {
  await kvPutJson(store, "cards", cards);
}

async function readState(store) {
  return (await kvGetJson(store, "state")) || buildInitialState();
}

async function writeState(store, state) {
  await kvPutJson(store, "state", {
    collection: Array.isArray(state.collection) ? state.collection : [],
    history: Array.isArray(state.history) ? state.history : [],
    customCards: state.customCards && typeof state.customCards === "object" ? state.customCards : {},
    usedCards: state.usedCards && typeof state.usedCards === "object" ? state.usedCards : {},
    starterGiftClaimed: Boolean(state.starterGiftClaimed),
    bonusDrawsRemaining: Math.max(0, Number(state.bonusDrawsRemaining) || 0)
  });
}

function buildInitialCards() {
  const cards = Array.from({ length: TOTAL_CARD_SLOTS }, (_, index) => buildDefaultCard(index + 1));
  const bySlot = new Map(cards.map((card) => [card.slot, card]));
  Object.entries(IMPORTED_BATCH).forEach(([tier, items]) => {
    items.forEach(([title, desc], index) => {
      const slot = BATCH_START_SLOT[tier] + index;
      const config = getTierForSlot(slot);
      bySlot.set(slot, {
        ...bySlot.get(slot),
        id: `${tier.toLowerCase()}-batch-${String(slot).padStart(2, "0")}`,
        title: `【${title}】`,
        rarityTier: tier,
        rarity: tier,
        frontText: tier === "SSR" ? "超稀有心动" : tier === "S" ? "今日特别心动" : "今日小心动",
        backTitle: title,
        backText: desc.replaceAll("情情", "可心"),
        actionText: title,
        accent: config.accent,
        isCustom: false,
        enabled: true
      });
    });
  });
  return Array.from({ length: TOTAL_CARD_SLOTS }, (_, index) => bySlot.get(index + 1));
}

function buildInitialState() {
  return { collection: [], history: [], customCards: {}, usedCards: {}, starterGiftClaimed: false, bonusDrawsRemaining: 0 };
}

function buildDefaultCard(slot) {
  const tier = getTierForSlot(slot);
  const isCustom = CUSTOM_CARD_SLOTS.has(slot);
  const number = String(slot).padStart(2, "0");
  if (isCustom) {
    return {
      id: `sr-custom-${number}`,
      slot,
      title: `自定义卡 No.${number}`,
      rarityTier: tier.id,
      rarity: tier.name,
      frontText: "小猪设计局",
      backTitle: "这张卡由你来写",
      backText: "抽到这张卡后，可以先想一想，也可以写下你想要的卡面内容。",
      actionText: "编辑自定义卡面",
      accent: tier.accent,
      isCustom: true,
      enabled: true
    };
  }
  return {
    id: `${tier.id.toLowerCase()}-placeholder-${number}`,
    slot,
    title: `${tier.name} 小猪卡 No.${number}`,
    rarityTier: tier.id,
    rarity: tier.name,
    frontText: "小猪今日限定",
    backTitle: `${tier.name} 级喜欢`,
    backText: "这张卡的具体内容还可以之后在后台慢慢补上。",
    actionText: "等待补充卡片内容",
    accent: tier.accent,
    isCustom: false,
    enabled: true
  };
}

function normalizeState(state, cards) {
  const validIds = new Set(cards.map((card) => card.id));
  return {
    collection: Array.isArray(state.collection)
      ? state.collection.filter((id, index, array) => validIds.has(id) && array.indexOf(id) === index)
      : [],
    history: Array.isArray(state.history) ? state.history : [],
    customCards: state.customCards && typeof state.customCards === "object" ? state.customCards : {},
    usedCards: state.usedCards && typeof state.usedCards === "object" ? state.usedCards : {},
    starterGiftClaimed: Boolean(state.starterGiftClaimed),
    bonusDrawsRemaining: Math.max(0, Number(state.bonusDrawsRemaining) || 0)
  };
}

function hydrateCards(cards, customCards = {}, usedCards = {}) {
  return cards.map((card, index) => {
    const slot = normalizeSlot(card.slot || index + 1, cards, card.id);
    const tier = getTierForSlot(slot);
    return {
      ...card,
      slot,
      rarityTier: tier.id,
      rarityName: tier.name,
      rarityWeight: tier.weight,
      rarityLine: tier.line,
      accent: card.accent || tier.accent,
      rarity: tier.name,
      isCustom: CUSTOM_CARD_SLOTS.has(slot),
      custom: customCards[card.id] || null,
      usage: usedCards[card.id] || null
    };
  });
}

function buildCollectedCards(cards, collection, history) {
  const collectedAtByCard = getCollectedAtByCard(history);
  return collection
    .map((id) => {
      const card = cards.find((item) => item.id === id);
      return card ? { ...card, collectedAt: collectedAtByCard.get(id) || null } : null;
    })
    .filter(Boolean);
}

function buildCollectionSlots(cards, collection, history = []) {
  const bySlot = new Map(cards.map((card) => [card.slot, card]));
  const owned = new Set(collection);
  const collectedAtByCard = getCollectedAtByCard(history);
  return Array.from({ length: TOTAL_CARD_SLOTS }, (_, index) => {
    const slot = index + 1;
    const card = bySlot.get(slot) || null;
    const collected = card ? owned.has(card.id) : false;
    const collectedAt = collected ? collectedAtByCard.get(card.id) || null : null;
    return {
      slot,
      collected,
      collectedAt,
      card: collected ? { ...card, collectedAt } : null,
      rarityTier: card?.rarityTier || null,
      accent: card?.accent || getTierForSlot(slot).accent,
      isCustom: Boolean(card?.isCustom)
    };
  });
}

function getCollectedAtByCard(history) {
  const collectedAt = new Map();
  const entries = Array.isArray(history) ? [...history].reverse() : [];
  entries.forEach((entry) => {
    if (entry.cardId && entry.createdAt && !collectedAt.has(entry.cardId)) collectedAt.set(entry.cardId, entry.createdAt);
  });
  return collectedAt;
}

function getTodayDrawCount(history, todayKey) {
  return history.filter((entry) => entry.dayKey === todayKey).length;
}

function getLatestTodayDraw(history, todayKey) {
  return history.find((entry) => entry.dayKey === todayKey) || null;
}

function getDrawQuota(state, todayKey) {
  if (TEST_MODE_UNLIMITED_DRAWS) {
    return { canDraw: true, dailyRemaining: 1, bonusRemaining: state.bonusDrawsRemaining, totalRemaining: Number.POSITIVE_INFINITY };
  }
  const todayCount = getTodayDrawCount(state.history, todayKey);
  const dailyRemaining = todayCount === 0 ? 1 : 0;
  const bonusRemaining = Math.max(0, state.bonusDrawsRemaining);
  const totalRemaining = dailyRemaining + bonusRemaining;
  return { canDraw: totalRemaining > 0, dailyRemaining, bonusRemaining, totalRemaining };
}

function getTierForSlot(slot) {
  const number = Number(slot);
  return RARITY_TIERS.find((tier) => number >= tier.slots[0] && number <= tier.slots[1]) || RARITY_TIERS[0];
}

function drawWeightedCard(cards) {
  const availableTiers = RARITY_TIERS.filter((tier) => cards.some((card) => card.rarityTier === tier.id));
  const totalWeight = availableTiers.reduce((total, tier) => total + tier.weight, 0);
  let cursor = randomInt(1, totalWeight + 1);
  for (const tier of availableTiers) {
    cursor -= tier.weight;
    if (cursor <= 0) {
      const pool = cards.filter((card) => card.rarityTier === tier.id);
      return pool[randomInt(0, pool.length)];
    }
  }
  return cards[cards.length - 1];
}

function getTierStats(cards) {
  return RARITY_TIERS.map((tier) => {
    const tierCards = cards.filter((card) => card.rarityTier === tier.id);
    return { ...tier, total: tierCards.length, enabled: tierCards.filter((card) => card.enabled !== false).length };
  });
}

function isDrawableCard(card) {
  if (card.isCustom) return true;
  const placeholderTitle = `${card.rarityTier} 小猪卡 No.${String(card.slot).padStart(2, "0")}`;
  return (
    card.title !== placeholderTitle &&
    card.backText !== "这张卡的具体内容还可以之后在后台慢慢补上。" &&
    card.actionText !== "等待补充卡片内容"
  );
}

function normalizeSlot(value, cards, currentId) {
  const number = Number(value);
  const usedSlots = new Set(
    cards
      .filter((card) => card.id !== currentId)
      .map((card) => Number(card.slot))
      .filter((slot) => Number.isInteger(slot) && slot >= 1 && slot <= TOTAL_CARD_SLOTS)
  );
  if (Number.isInteger(number) && number >= 1 && number <= TOTAL_CARD_SLOTS && !usedSlots.has(number)) return number;
  for (let slot = 1; slot <= TOTAL_CARD_SLOTS; slot += 1) if (!usedSlots.has(slot)) return slot;
  return TOTAL_CARD_SLOTS;
}

function getDrawDayKey(date = new Date()) {
  const zoned = getZonedParts(date);
  if (zoned.hour < 7) return formatDayKey(getZonedParts(new Date(date.getTime() - 24 * 60 * 60 * 1000)));
  return formatDayKey(zoned);
}

function areCustomCardsUnlocked(dayKey = getDrawDayKey()) {
  return getCampaignDay(dayKey) >= CUSTOM_CARD_UNLOCK_DAY;
}

function getCampaignDay(dayKey = getDrawDayKey()) {
  const start = Date.UTC(...CAMPAIGN_START_DAY.split("-").map((part, index) => Number(part) - (index === 1 ? 1 : 0)));
  const current = Date.UTC(...dayKey.split("-").map((part, index) => Number(part) - (index === 1 ? 1 : 0)));
  return Math.max(1, Math.floor((current - start) / (24 * 60 * 60 * 1000)) + 1);
}

function getNextRefreshIso(date = new Date()) {
  const parts = getZonedParts(date);
  const targetParts = { ...parts, hour: 7, minute: 0, second: 0 };
  let refresh = zonedPartsToDate(targetParts);
  if (date >= refresh) {
    const tomorrowParts = getZonedParts(new Date(refresh.getTime() + 24 * 60 * 60 * 1000));
    refresh = zonedPartsToDate({ ...tomorrowParts, hour: 7, minute: 0, second: 0 });
  }
  return refresh.toISOString();
}

function getZonedParts(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function zonedPartsToDate(parts) {
  const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  const actual = getZonedParts(utcGuess);
  const offsetMs =
    Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second) -
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return new Date(utcGuess.getTime() - offsetMs);
}

function formatDayKey(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function safeId(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || crypto.randomUUID();
}

async function readJson(request) {
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

function requireAdmin(request) {
  if (request.headers.get("x-admin-key") !== ADMIN_KEY) {
    return json({ error: "UNAUTHORIZED", message: "后台口令不对。" }, 401);
  }
  return null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function getStore(context) {
  const env = context.env || {};
  const store = env.LOVE_KV || env.love_kv || env.KV || env.kv;
  if (!store) throw new Error("KV namespace is not bound. Bind it as LOVE_KV.");
  return store;
}

async function kvGetJson(store, key) {
  const value = await store.get(key);
  if (!value) return null;
  return typeof value === "string" ? JSON.parse(value) : value;
}

async function kvPutJson(store, key, value) {
  await store.put(key, JSON.stringify(value));
}

function randomInt(min, max) {
  const range = max - min;
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return min + (array[0] % range);
}
