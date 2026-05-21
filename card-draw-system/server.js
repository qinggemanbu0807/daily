const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 5200);
const ADMIN_KEY = process.env.ADMIN_KEY || "520520";
const TIME_ZONE = "Asia/Shanghai";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const CARDS_PATH = path.join(DATA_DIR, "cards.json");
const STATE_PATH = path.join(DATA_DIR, "state.json");
const TOTAL_CARD_SLOTS = 90;
const TEST_MODE_UNLIMITED_DRAWS = false;
const STARTER_GIFT_BONUS_DRAWS = 3;
const CAMPAIGN_START_DAY = "2026-05-20";
const CUSTOM_CARD_UNLOCK_DAY = 8;
const RARITY_TIERS = [
  { id: "A", name: "A", weight: 45, accent: "#4f9a83", line: "一张轻轻的日常喜欢。", slots: [56, 90] },
  { id: "S", name: "S", weight: 25, accent: "#d9dde7", line: "今天的喜欢更亮了一点。", slots: [31, 55] },
  { id: "SR", name: "SR", weight: 20, accent: "#f3bd35", line: "这份喜欢值得认真期待。", slots: [11, 30] },
  { id: "SSR", name: "SSR", weight: 10, accent: "#c993ff", line: "超稀有喜欢出现了。", slots: [1, 10] }
];
const CUSTOM_CARD_SLOTS = new Set([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon"
};

ensureDataFiles();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "SERVER_ERROR", message: "服务器刚刚走神了一下。" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  const lanAddresses = getLanAddresses();
  console.log(`520 card draw system is running at http://localhost:${PORT}`);
  console.log(`Admin page: http://localhost:${PORT}/admin.html`);
  console.log(`Admin key: ${ADMIN_KEY}`);

  if (lanAddresses.length) {
    console.log("Phone access (same Wi-Fi):");
    lanAddresses.forEach((address) => {
      console.log(`  http://${address}:${PORT}`);
    });
  } else {
    console.log("Phone access: connect phone to the same Wi-Fi, then use this PC's LAN IP with port", PORT);
  }
});

function getLanAddresses() {
  const addresses = new Set();

  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const item of interfaces || []) {
      if (item.family !== "IPv4" || item.internal) {
        continue;
      }

      addresses.add(item.address);
    }
  }

  return [...addresses];
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, getPublicState());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/draw") {
    sendJson(res, 200, drawCard());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/starter-gift") {
    sendJson(res, 200, claimStarterGift());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/custom-card") {
    const body = await readBody(req);
    sendJson(res, 200, updateCustomCard(body));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/card-usage") {
    const body = await readBody(req);
    sendJson(res, 200, updateCardUsage(body));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/summary") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, getAdminSummary());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/cards") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, { cards: readCards() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/cards") {
    if (!requireAdmin(req, res)) return;
    const body = await readBody(req);
    const card = upsertCard(body);
    sendJson(res, 200, { card, cards: readCards() });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/cards/")) {
    if (!requireAdmin(req, res)) return;
    const id = decodeURIComponent(url.pathname.split("/").pop());
    const cards = readCards().filter((card) => card.id !== id);
    writeCards(cards);
    sendJson(res, 200, { cards });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/reset-progress") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, resetPlayerProgress());
    return;
  }

  sendJson(res, 404, { error: "NOT_FOUND", message: "没有找到这个接口。" });
}

function requireAdmin(req, res) {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) {
    sendJson(res, 401, { error: "UNAUTHORIZED", message: "后台口令不对。" });
    return false;
  }
  return true;
}

function getPublicState() {
  const rawState = readState();
  const cards = hydrateCards(readCards(), rawState.customCards, rawState.usedCards);
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

function drawCard() {
  const rawState = readState();
  const todayKey = getDrawDayKey();
  const cards = hydrateCards(readCards(), rawState.customCards, rawState.usedCards)
    .filter((card) => card.enabled !== false)
    .filter((card) => isDrawableCard(card))
    .filter((card) => !card.isCustom || areCustomCardsUnlocked(todayKey));
  const state = normalizeState(rawState, cards);
  const uncollectedCards = cards.filter((card) => !state.collection.includes(card.id));
  const quota = getDrawQuota(state, todayKey);
  const latestTodayDraw = getLatestTodayDraw(state.history, todayKey);

  if (!quota.canDraw && !TEST_MODE_UNLIMITED_DRAWS) {
    const card = latestTodayDraw ? cards.find((item) => item.id === latestTodayDraw.cardId) : null;
    return {
      alreadyDrawn: true,
      draw: latestTodayDraw,
      card,
      state: getPublicState()
    };
  }

  if (cards.length === 0) {
    return {
      error: "NO_CARDS",
      message: "卡池里还没有可抽的卡。"
    };
  }

  if (uncollectedCards.length === 0) {
    return {
      error: "ALL_AVAILABLE_CARDS_COLLECTED",
      message: "当前可抽的卡已经全部收集完啦。",
      state: getPublicState()
    };
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
  if (!state.collection.includes(card.id)) {
    state.collection.unshift(card.id);
  }
  if (usesBonusDraw) {
    state.bonusDrawsRemaining = Math.max(0, state.bonusDrawsRemaining - 1);
  }
  writeState(state);

  return {
    alreadyDrawn: false,
    draw,
    card,
    state: getPublicState()
  };
}

function claimStarterGift() {
  const rawState = readState();
  const cards = hydrateCards(readCards(), rawState.customCards, rawState.usedCards);
  const state = normalizeState(rawState, cards);

  if (state.starterGiftClaimed) {
    return {
      error: "ALREADY_CLAIMED",
      message: "体验礼包已经领过啦。"
    };
  }

  state.starterGiftClaimed = true;
  state.bonusDrawsRemaining += STARTER_GIFT_BONUS_DRAWS;
  writeState(state);

  return {
    ok: true,
    bonusAdded: STARTER_GIFT_BONUS_DRAWS,
    bonusDrawsRemaining: state.bonusDrawsRemaining,
    message: `获得 ${STARTER_GIFT_BONUS_DRAWS} 次额外抽卡机会~`,
    state: getPublicState()
  };
}

function resetPlayerProgress() {
  const rawState = readState();
  const state = {
    collection: [],
    history: [],
    customCards: rawState.customCards && typeof rawState.customCards === "object" ? rawState.customCards : {},
    usedCards: {},
    starterGiftClaimed: false,
    bonusDrawsRemaining: 0
  };
  writeState(state);

  return {
    ok: true,
    message: "已清空抽卡记录和收藏夹。",
    summary: getAdminSummary()
  };
}

function getAdminSummary() {
  const rawState = readState();
  const cards = hydrateCards(readCards(), rawState.customCards, rawState.usedCards);
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

function upsertCard(body) {
  const cards = readCards();
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

  if (existingIndex >= 0) {
    cards[existingIndex] = card;
  } else {
    cards.unshift(card);
  }

  writeCards(cards);
  return card;
}

function updateCustomCard(body) {
  const rawState = readState();
  const cards = hydrateCards(readCards(), rawState.customCards, rawState.usedCards);
  const state = normalizeState(rawState, cards);
  const card = cards.find((item) => item.id === body.cardId);

  if (!card || !card.isCustom || !state.collection.includes(card.id)) {
    return {
      error: "CUSTOM_CARD_NOT_AVAILABLE",
      message: "这张自定义卡还不能编辑。"
    };
  }

  const previous = state.customCards[card.id] || {};
  const now = new Date().toISOString();
  state.customCards[card.id] = {
    title: String(body.title ?? previous.title ?? "").slice(0, 60),
    text: String(body.text ?? previous.text ?? "").slice(0, 500),
    status: body.status === "thinking" ? "thinking" : "saved",
    updatedAt: now
  };
  writeState(state);

  const updatedCards = hydrateCards(readCards(), state.customCards, state.usedCards);
  return {
    card: updatedCards.find((item) => item.id === card.id),
    state: getPublicState()
  };
}

function updateCardUsage(body) {
  const rawState = readState();
  const cards = hydrateCards(readCards(), rawState.customCards, rawState.usedCards);
  const state = normalizeState(rawState, cards);
  const card = cards.find((item) => item.id === body.cardId);

  if (!card || !state.collection.includes(card.id)) {
    return {
      error: "CARD_NOT_COLLECTED",
      message: "这张卡还没有收藏，暂时不能使用。"
    };
  }

  const previous = state.usedCards[card.id] || {};
  const now = new Date().toISOString();
  state.usedCards[card.id] = {
    usedAt: body.clearUsed ? null : previous.usedAt || (body.markUsed ? now : null),
    memory: String(body.memory ?? previous.memory ?? "").slice(0, 600),
    updatedAt: now
  };
  writeState(state);

  const updatedCards = hydrateCards(readCards(), state.customCards, state.usedCards);
  return {
    card: updatedCards.find((item) => item.id === card.id),
    state: getPublicState()
  };
}

function serveStatic(requestPath, res) {
  const normalizedPath = requestPath === "/" ? "/index.html" : decodeURIComponent(requestPath);
  const filePath = path.normalize(path.join(PUBLIC_DIR, normalizedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(res, 404, "Not found");
      return;
    }

    const type = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(content);
  });
}

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(CARDS_PATH)) {
    writeCards([
      {
        id: "morning-hug",
        slot: 1,
        title: "早安抱抱卡",
        rarityTier: "A",
        rarity: "A",
        frontText: "小猪今日限定",
        backTitle: "先抱一下",
        backText: "今天醒来第一件事，是想把所有早安都认真说给你听。",
        actionText: "兑换一次早安语音",
        accent: "#ff8fa8",
        enabled: true
      },
      {
        id: "miss-you",
        slot: 2,
        title: "想你证明卡",
        rarityTier: "S",
        rarity: "S",
        frontText: "距离也藏不住",
        backTitle: "证据确凿",
        backText: "今天也有认真想你，不是顺手想起，是心里留了一个固定位置给你。",
        actionText: "兑换一次睡前陪聊",
        accent: "#ffd57a",
        enabled: true
      },
      {
        id: "meet-promise",
        slot: 3,
        title: "见面预约卡",
        rarityTier: "SSR",
        rarity: "SSR",
        frontText: "8月19日前有效",
        backTitle: "见面那天",
        backText: "等见面的时候，我想把这段时间攒下来的喜欢，一点一点补给你。",
        actionText: "兑换一个很久很久的拥抱",
        accent: "#8ee6ce",
        enabled: true
      }
    ]);
  }

  if (!fs.existsSync(STATE_PATH)) {
    writeState({
      collection: [],
      history: [],
      customCards: {},
      usedCards: {},
      starterGiftClaimed: false,
      bonusDrawsRemaining: 0
    });
  }

  migrateCardPool();
  migrateState();
}

function migrateCardPool() {
  const existingCards = fs.existsSync(CARDS_PATH) ? readCards() : [];
  const bySlot = new Map(existingCards.map((card) => [Number(card.slot), card]));
  const nextCards = [];

  for (let slot = 1; slot <= TOTAL_CARD_SLOTS; slot += 1) {
    const existing = bySlot.get(slot);
    const tier = getTierForSlot(slot);
    const defaults = buildDefaultCard(slot);
    nextCards.push({
      ...defaults,
      ...existing,
      slot,
      rarityTier: tier.id,
      rarity: tier.name,
      accent: existing?.accent || tier.accent,
      isCustom: CUSTOM_CARD_SLOTS.has(slot),
      enabled: existing?.enabled === false ? false : true
    });
  }

  writeCards(nextCards);
}

function migrateState() {
  const state = readState();
  writeState({
    collection: Array.isArray(state.collection) ? state.collection : [],
    history: Array.isArray(state.history) ? state.history : [],
    customCards: state.customCards && typeof state.customCards === "object" ? state.customCards : {},
    usedCards: state.usedCards && typeof state.usedCards === "object" ? state.usedCards : {},
    starterGiftClaimed: Boolean(state.starterGiftClaimed),
    bonusDrawsRemaining: Math.max(0, Number(state.bonusDrawsRemaining) || 0)
  });
}

function getTodayDrawCount(history, todayKey) {
  return history.filter((entry) => entry.dayKey === todayKey).length;
}

function getLatestTodayDraw(history, todayKey) {
  return history.find((entry) => entry.dayKey === todayKey) || null;
}

function getDrawQuota(state, todayKey) {
  if (TEST_MODE_UNLIMITED_DRAWS) {
    return {
      canDraw: true,
      dailyRemaining: 1,
      bonusRemaining: state.bonusDrawsRemaining,
      totalRemaining: Number.POSITIVE_INFINITY
    };
  }

  const todayCount = getTodayDrawCount(state.history, todayKey);
  const dailyRemaining = todayCount === 0 ? 1 : 0;
  const bonusRemaining = Math.max(0, state.bonusDrawsRemaining);
  const totalRemaining = dailyRemaining + bonusRemaining;

  return {
    canDraw: totalRemaining > 0,
    dailyRemaining,
    bonusRemaining,
    totalRemaining
  };
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

function readCards() {
  return JSON.parse(fs.readFileSync(CARDS_PATH, "utf8"));
}

function writeCards(cards) {
  fs.writeFileSync(CARDS_PATH, `${JSON.stringify(cards, null, 2)}\n`);
}

function readState() {
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
}

function writeState(state) {
  fs.writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
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
    const custom = customCards[card.id] || null;
    const usage = usedCards[card.id] || null;
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
      custom,
      usage
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
    if (entry.cardId && entry.createdAt && !collectedAt.has(entry.cardId)) {
      collectedAt.set(entry.cardId, entry.createdAt);
    }
  });

  return collectedAt;
}

function getTierConfig(value) {
  const normalized = String(value || "A").toUpperCase();
  return RARITY_TIERS.find((tier) => tier.id === normalized || tier.name === normalized) || RARITY_TIERS[0];
}

function getTierForSlot(slot) {
  const number = Number(slot);
  return RARITY_TIERS.find((tier) => number >= tier.slots[0] && number <= tier.slots[1]) || RARITY_TIERS[0];
}

function drawWeightedCard(cards) {
  const availableTiers = RARITY_TIERS.filter((tier) => cards.some((card) => card.rarityTier === tier.id));
  const totalWeight = availableTiers.reduce((total, tier) => total + tier.weight, 0);
  let cursor = crypto.randomInt(1, totalWeight + 1);

  for (const tier of availableTiers) {
    cursor -= tier.weight;
    if (cursor <= 0) {
      const pool = cards.filter((card) => card.rarityTier === tier.id);
      return pool[crypto.randomInt(0, pool.length)];
    }
  }

  return cards[cards.length - 1];
}

function getTierStats(cards) {
  return RARITY_TIERS.map((tier) => {
    const tierCards = cards.filter((card) => card.rarityTier === tier.id);
    return {
      ...tier,
      total: tierCards.length,
      enabled: tierCards.filter((card) => card.enabled !== false).length
    };
  });
}

function isDrawableCard(card) {
  if (card.isCustom) {
    return true;
  }

  const placeholderTitle = `${card.rarityTier} 小猪卡 No.${String(card.slot).padStart(2, "0")}`;
  const defaultBackText = "这张卡的具体内容还可以之后在后台慢慢补上。";
  const defaultActionText = "等待补充卡片内容";

  return (
    card.title !== placeholderTitle &&
    card.backText !== defaultBackText &&
    card.actionText !== defaultActionText
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

  if (Number.isInteger(number) && number >= 1 && number <= TOTAL_CARD_SLOTS && !usedSlots.has(number)) {
    return number;
  }

  for (let slot = 1; slot <= TOTAL_CARD_SLOTS; slot += 1) {
    if (!usedSlots.has(slot)) {
      return slot;
    }
  }

  return TOTAL_CARD_SLOTS;
}

function getDrawDayKey(date = new Date()) {
  const zoned = getZonedParts(date);
  if (zoned.hour < 7) {
    const previous = new Date(date.getTime() - 24 * 60 * 60 * 1000);
    return formatDayKey(getZonedParts(previous));
  }
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
    const tomorrow = new Date(refresh.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowParts = getZonedParts(tomorrow);
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

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function sendText(res, status, data) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  res.end(data);
}

function safeId(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || crypto.randomUUID();
}
