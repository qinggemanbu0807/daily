const CONFIG = {
  targetDate: new Date("2026-08-15T00:00:00+08:00"),
  storageKey: "love-card-frontend-only-v1"
};

const RARITY_META = {
  A: {
    weight: 45,
    rarityLine: "一张轻轻的日常喜欢",
    accent: "#3f876f"
  },
  S: {
    weight: 25,
    rarityLine: "今天的喜欢更亮了一点",
    accent: "#cfd5df"
  },
  SR: {
    weight: 20,
    rarityLine: "这份喜欢值得认真期待",
    accent: "#f3bd35"
  },
  SSR: {
    weight: 10,
    rarityLine: "小猪抽到了最闪的一份偏爱",
    accent: "#9eeaff"
  }
};

const cards = Array.isArray(window.LOVE_STATIC_CARDS)
  ? window.LOVE_STATIC_CARDS
      .filter((card) => card && card.enabled !== false)
      .sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0))
  : [];

const state = {
  currentCard: null,
  detailCard: null,
  countdownTimer: null,
  memorySaveTimer: null,
  detailMemorySaveTimer: null
};

const els = {
  statusLine: document.querySelector("#statusLine"),
  refreshButton: document.querySelector("#refreshButton"),
  countdownText: document.querySelector("#countdownText"),
  drawButton: document.querySelector("#drawButton"),
  resetCopy: document.querySelector("#resetCopy"),
  cardWrap: document.querySelector("#cardWrap"),
  drawCard: document.querySelector("#drawCard"),
  frontRarity: document.querySelector("#frontRarity"),
  frontText: document.querySelector("#frontText"),
  cardRarity: document.querySelector("#cardRarity"),
  cardTitle: document.querySelector("#cardTitle"),
  cardText: document.querySelector("#cardText"),
  cardAction: document.querySelector("#cardAction"),
  collectionGrid: document.querySelector("#collectionGrid"),
  collectionCount: document.querySelector("#collectionCount"),
  collectionEntryCount: document.querySelector("#collectionEntryCount"),
  openCollectionButton: document.querySelector("#openCollectionButton"),
  closeCollectionButton: document.querySelector("#closeCollectionButton"),
  collectionPage: document.querySelector("#collectionPage"),
  usagePanel: document.querySelector("#usagePanel"),
  useCardButton: document.querySelector("#useCardButton"),
  usedTimeText: document.querySelector("#usedTimeText"),
  memoryField: document.querySelector("#memoryField"),
  memoryInput: document.querySelector("#memoryInput"),
  editCustomFromUsageButton: document.querySelector("#editCustomFromUsageButton"),
  usageMessage: document.querySelector("#usageMessage"),
  customEditor: document.querySelector("#customEditor"),
  closeEditorButton: document.querySelector("#closeEditorButton"),
  closeDetailButton: document.querySelector("#closeDetailButton"),
  cardDetail: document.querySelector("#cardDetail"),
  detailCard: document.querySelector("#detailCard"),
  detailRarity: document.querySelector("#detailRarity"),
  detailTitle: document.querySelector("#detailTitle"),
  detailText: document.querySelector("#detailText"),
  detailAction: document.querySelector("#detailAction"),
  detailUseCardButton: document.querySelector("#detailUseCardButton"),
  detailUsedTimeText: document.querySelector("#detailUsedTimeText"),
  detailMemoryField: document.querySelector("#detailMemoryField"),
  detailMemoryInput: document.querySelector("#detailMemoryInput"),
  detailEditCustomButton: document.querySelector("#detailEditCustomButton"),
  detailUsageMessage: document.querySelector("#detailUsageMessage"),
  starterGift: document.querySelector("#starterGift")
};

boot();

function boot() {
  els.drawButton.addEventListener("click", drawCard);
  els.refreshButton.addEventListener("click", loadState);
  els.openCollectionButton.addEventListener("click", openCollectionPage);
  els.closeCollectionButton.addEventListener("click", closeCollectionPage);
  els.closeDetailButton.addEventListener("click", closeCardDetail);
  els.cardDetail.addEventListener("click", (event) => {
    if (event.target === els.cardDetail) {
      closeCardDetail();
    }
  });
  els.useCardButton.addEventListener("click", markCurrentCardUsed);
  els.memoryInput.addEventListener("input", queueMemorySave);
  els.detailUseCardButton.addEventListener("click", markDetailCardUsed);
  els.detailMemoryInput.addEventListener("input", queueDetailMemorySave);
  els.closeEditorButton.addEventListener("click", () => {
    els.customEditor.classList.add("is-hidden");
  });
  if (els.starterGift) {
    els.starterGift.hidden = true;
  }

  startCountdown();
  loadState();
}

function loadState() {
  renderPublicState(buildPublicState());
}

async function drawCard() {
  const publicState = buildPublicState();

  if (publicState.drawEnded) {
    setEndedState(publicState);
    return;
  }

  resetCardFront();
  els.drawButton.disabled = true;
  els.drawButton.querySelector("span").textContent = "正在洗牌...";
  els.drawCard.classList.add("is-drawing");

  await wait(850);

  const pickedCard = pickUncollectedCard();
  if (!pickedCard) {
    const endedState = buildPublicState();
    setEndedState(endedState);
    els.drawCard.classList.remove("is-drawing");
    return;
  }

  const localState = readLocalState();
  const now = new Date().toISOString();
  localState.collectionIds.push(pickedCard.id);
  localState.history.push({
    cardId: pickedCard.id,
    drawnAt: now
  });
  writeLocalState(localState);

  const hydratedCard = hydrateCard(pickedCard, localState);
  renderCard(hydratedCard);
  await wait(120);
  els.drawCard.classList.remove("is-drawing");
  els.drawCard.classList.add("is-flipped");
  const nextPublicState = buildPublicState();
  renderPublicState(nextPublicState, hydratedCard);
  setStatus(nextPublicState.drawEnded ? "已经抽卡结束" : "已抽取一份喜欢~");
}

function buildPublicState() {
  const localState = readLocalState();
  const collectedIds = new Set(localState.collectionIds);
  const collection = localState.collectionIds
    .map((id) => getCardById(id, localState))
    .filter(Boolean);
  const collectionSlots = cards.map((card) => {
    const collected = collectedIds.has(card.id);
    return {
      slot: card.slot,
      collected,
      collectedAt: getCollectedAt(card.id, localState),
      rarityTier: card.rarityTier,
      accent: getCardAccent(card),
      isCustom: false,
      card: collected ? getCardById(card.id, localState) : card
    };
  });
  const remainingCards = cards.length - collection.length;

  return {
    targetDate: CONFIG.targetDate.toISOString(),
    collection,
    collectionSlots,
    totalCards: cards.length,
    remainingCards,
    drawEnded: remainingCards <= 0,
    canDrawToday: remainingCards > 0
  };
}

function renderPublicState(data, justDrawnCard = null) {
  const countText = `${data.collection.length} / ${data.totalCards}`;
  els.collectionCount.textContent = countText;
  els.collectionEntryCount.textContent = countText;
  renderCollection(data.collectionSlots || []);

  if (justDrawnCard) {
    renderCard(justDrawnCard);
    els.drawCard.classList.add("is-flipped");
  } else if (!state.currentCard) {
    resetCardFront();
  }

  if (data.drawEnded) {
    setEndedState(data);
    return;
  }

  els.drawButton.disabled = false;
  els.drawButton.querySelector("span").textContent = "抽取一张卡片";
  els.resetCopy.textContent = `还剩 ${data.remainingCards} 张可抽卡，抽完就会显示结束。`;
  if (!justDrawnCard) {
    setStatus("还可以继续抽卡哦~");
  }
}

function setEndedState(data) {
  els.drawButton.disabled = true;
  els.drawButton.querySelector("span").textContent = "已经抽卡结束";
  els.resetCopy.textContent = "已经抽卡结束";
  setStatus("已经抽卡结束");
  if (!state.currentCard) {
    resetCardFront();
  }
}

function pickUncollectedCard() {
  const localState = readLocalState();
  const collectedIds = new Set(localState.collectionIds);
  const pool = cards.filter((card) => !collectedIds.has(card.id));
  const totalWeight = pool.reduce((sum, card) => sum + getRarityWeight(card), 0);
  let roll = Math.random() * totalWeight;

  for (const card of pool) {
    roll -= getRarityWeight(card);
    if (roll <= 0) {
      return card;
    }
  }

  return pool[pool.length - 1] || null;
}

function renderCard(card) {
  if (!card) {
    resetCardFront();
    return;
  }

  state.currentCard = card;
  const tier = String(card.rarityTier || "A").toLowerCase();
  els.drawCard.className = `draw-card tier-${tier} ${els.drawCard.classList.contains("is-flipped") ? "is-flipped" : ""}`;
  els.cardWrap.style.setProperty("--accent", getCardAccent(card));
  els.frontRarity.textContent = card.frontText || "小猪专属";
  els.frontText.textContent = card.title || "今日卡片";
  els.cardRarity.textContent = `${card.rarityName || card.rarityTier || "A"} · ${trimEndingPeriod(card.rarityLine || getRarityLine(card))}`;
  els.cardTitle.textContent = card.backTitle || card.title || "今天抽到";
  els.cardText.textContent = card.backText || "这张卡的内容还在路上。";
  els.cardAction.textContent = card.actionText || "今日兑换";
  renderUsagePanel(card);
}

function resetCardFront() {
  els.drawCard.className = "draw-card";
  hideUsagePanel();
  els.cardWrap.style.setProperty("--accent", "#ff8fa8");
  els.frontRarity.textContent = "小猪专属";
  els.frontText.textContent = "这次会抽到什么呢";
  els.cardRarity.textContent = "等待";
  els.cardTitle.textContent = "等待抽卡";
  els.cardText.textContent = "卡片会在这里翻开。";
  els.cardAction.textContent = "本次兑换";
}

function renderCollection(slots) {
  els.collectionGrid.innerHTML = "";

  slots.forEach((slot) => {
    const card = slot.card;
    const tier = (card?.rarityTier || slot.rarityTier || "").toLowerCase();
    const item = document.createElement("article");
    item.className = `mini-card ${slot.collected ? "is-collected" : "is-locked"} ${tier ? `tier-${tier}` : ""}`;
    item.style.setProperty("--accent", getCardAccent(card || slot));
    item.innerHTML = `
      <span>${slot.collected ? escapeHtml(card.rarityName || card.rarityTier || "A") : `${escapeHtml(slot.rarityTier || "?")} · No. ${pad(slot.slot)}`}</span>
      <h3>${slot.collected ? escapeHtml(card.title || "小猪卡") : "未解锁"}</h3>
      <p>${slot.collected ? `<b>${escapeHtml(formatCollectedDate(slot.collectedAt))}</b><br>${escapeHtml(collectionSubtitle(card))}` : "等待小猪抽到这张卡。"}</p>
    `;

    if (slot.collected && card) {
      item.addEventListener("click", () => openCardDetail(card));
    }

    els.collectionGrid.appendChild(item);
  });
}

function collectionSubtitle(card) {
  if (card.usage?.usedAt) {
    return "已经使用，留下了一段回忆。";
  }

  return card.actionText || card.backTitle || "已经收藏";
}

function openCollectionPage() {
  els.collectionPage.classList.remove("is-hidden");
}

function closeCollectionPage() {
  els.collectionPage.classList.add("is-hidden");
}

function openCardDetail(card) {
  state.detailCard = card;
  const tier = String(card.rarityTier || "A").toLowerCase();
  els.detailCard.className = `detail-card tier-${tier}`;
  els.detailCard.style.setProperty("--accent", getCardAccent(card));
  els.detailRarity.textContent = `${card.rarityName || card.rarityTier || "A"} · No. ${pad(card.slot)}`;
  els.detailTitle.textContent = card.backTitle || card.title || "小猪卡";
  els.detailText.textContent = card.backText || "这张卡的内容还在路上。";
  els.detailAction.textContent = card.actionText || "今日兑换";
  renderDetailUsagePanel(card);
  els.cardDetail.classList.remove("is-hidden");
}

function closeCardDetail() {
  window.clearTimeout(state.detailMemorySaveTimer);
  els.cardDetail.classList.add("is-hidden");
  state.detailCard = null;
}

function renderUsagePanel(card) {
  if (!card?.id) {
    hideUsagePanel();
    return;
  }

  const used = Boolean(card.usage?.usedAt);
  els.usagePanel.classList.remove("is-hidden");
  els.useCardButton.disabled = false;
  els.useCardButton.textContent = used ? "取消使用" : "使用这张卡";
  els.usedTimeText.textContent = used
    ? `使用时间：${formatFullDateTime(card.usage.usedAt)}`
    : "使用后会记录时间，也可以写下这张卡带来的回忆。";
  els.memoryField.classList.toggle("is-hidden", !used);
  els.memoryInput.value = card.usage?.memory || "";
  els.editCustomFromUsageButton.classList.add("is-hidden");
  els.usageMessage.textContent = used ? "修改回忆时会自动保存在这个浏览器里。" : "";
}

function renderDetailUsagePanel(card) {
  const used = Boolean(card.usage?.usedAt);
  els.detailUseCardButton.disabled = false;
  els.detailUseCardButton.textContent = used ? "取消使用" : "使用这张卡";
  els.detailUsedTimeText.textContent = used
    ? `使用时间：${formatFullDateTime(card.usage.usedAt)}`
    : "使用后会记录时间，也可以写下这张卡带来的回忆。";
  els.detailMemoryField.classList.toggle("is-hidden", !used);
  els.detailMemoryInput.value = card.usage?.memory || "";
  els.detailEditCustomButton.classList.add("is-hidden");
  els.detailUsageMessage.textContent = used ? "修改回忆时会自动保存在这个浏览器里。" : "";
}

function hideUsagePanel() {
  els.usagePanel.classList.add("is-hidden");
  els.usageMessage.textContent = "";
}

function markCurrentCardUsed() {
  if (!state.currentCard) {
    return;
  }

  const updatedCard = toggleCardUsage(state.currentCard.id, els.memoryInput.value.trim());
  state.currentCard = updatedCard;
  renderPublicState(buildPublicState(), updatedCard);
  renderCard(updatedCard);
  els.drawCard.classList.add("is-flipped");
  els.usageMessage.textContent = updatedCard.usage?.usedAt
    ? "已经标记使用，可以写下这次的回忆。"
    : "已经恢复为未使用。";
}

function markDetailCardUsed() {
  if (!state.detailCard) {
    return;
  }

  const updatedCard = toggleCardUsage(state.detailCard.id, els.detailMemoryInput.value.trim());
  state.detailCard = updatedCard;
  renderPublicState(buildPublicState());
  openCardDetail(updatedCard);
  els.detailUsageMessage.textContent = updatedCard.usage?.usedAt
    ? "已经标记使用，可以写下这次的回忆。"
    : "已经恢复为未使用。";
}

function toggleCardUsage(cardId, memory) {
  const localState = readLocalState();
  const existing = localState.usageById[cardId] || {};

  if (existing.usedAt) {
    localState.usageById[cardId] = {
      memory: existing.memory || memory || ""
    };
  } else {
    localState.usageById[cardId] = {
      usedAt: new Date().toISOString(),
      memory: memory || existing.memory || ""
    };
  }

  writeLocalState(localState);
  return getCardById(cardId, localState);
}

function queueMemorySave() {
  if (!state.currentCard?.usage?.usedAt) {
    return;
  }

  window.clearTimeout(state.memorySaveTimer);
  els.usageMessage.textContent = "正在保存回忆...";
  state.memorySaveTimer = window.setTimeout(() => {
    const updatedCard = saveCardMemory(state.currentCard.id, els.memoryInput.value.trim());
    state.currentCard = updatedCard;
    renderPublicState(buildPublicState(), updatedCard);
    renderCard(updatedCard);
    els.drawCard.classList.add("is-flipped");
    els.usageMessage.textContent = "回忆已经保存在这个浏览器里。";
  }, 650);
}

function queueDetailMemorySave() {
  if (!state.detailCard?.usage?.usedAt) {
    return;
  }

  window.clearTimeout(state.detailMemorySaveTimer);
  els.detailUsageMessage.textContent = "正在保存回忆...";
  state.detailMemorySaveTimer = window.setTimeout(() => {
    const updatedCard = saveCardMemory(state.detailCard.id, els.detailMemoryInput.value.trim());
    state.detailCard = updatedCard;
    renderPublicState(buildPublicState());
    openCardDetail(updatedCard);
    els.detailUsageMessage.textContent = "回忆已经保存在这个浏览器里。";
  }, 650);
}

function saveCardMemory(cardId, memory) {
  const localState = readLocalState();
  const existing = localState.usageById[cardId] || {};
  localState.usageById[cardId] = {
    ...existing,
    memory
  };
  writeLocalState(localState);
  return getCardById(cardId, localState);
}

function readLocalState() {
  const fallback = {
    collectionIds: [],
    history: [],
    usageById: {}
  };

  try {
    const parsed = JSON.parse(localStorage.getItem(CONFIG.storageKey) || "null");
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }

    return {
      collectionIds: Array.isArray(parsed.collectionIds)
        ? parsed.collectionIds.filter((id, index, all) => cards.some((card) => card.id === id) && all.indexOf(id) === index)
        : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      usageById: parsed.usageById && typeof parsed.usageById === "object" ? parsed.usageById : {}
    };
  } catch (error) {
    return fallback;
  }
}

function writeLocalState(nextState) {
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(nextState));
}

function getCardById(cardId, localState = readLocalState()) {
  const card = cards.find((item) => item.id === cardId);
  if (!card) {
    return null;
  }

  return hydrateCard(card, localState);
}

function hydrateCard(card, localState = readLocalState()) {
  return {
    ...card,
    accent: getCardAccent(card),
    rarityLine: card.rarityLine || getRarityLine(card),
    collectedAt: getCollectedAt(card.id, localState),
    usage: localState.usageById[card.id] || {}
  };
}

function getCollectedAt(cardId, localState) {
  const record = [...(localState.history || [])].reverse().find((item) => item.cardId === cardId);
  return record?.drawnAt || null;
}

function getCardAccent(card) {
  const tier = card?.rarityTier || "A";
  return card?.accent || RARITY_META[tier]?.accent || "#ff8fa8";
}

function getRarityWeight(card) {
  return RARITY_META[card.rarityTier]?.weight || 1;
}

function getRarityLine(card) {
  return RARITY_META[card.rarityTier]?.rarityLine || "今日喜欢";
}

function startCountdown() {
  window.clearInterval(state.countdownTimer);
  updateCountdown();
  state.countdownTimer = window.setInterval(updateCountdown, 1000);
}

function updateCountdown() {
  const diff = Math.max(0, CONFIG.targetDate.getTime() - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  els.countdownText.textContent = `${days} 天 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function setStatus(message) {
  els.statusLine.textContent = message;
}

function formatCollectedDate(value) {
  if (!value) {
    return "抽到日期：未知";
  }

  return `抽到日期：${new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value))}`;
}

function formatFullDateTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function trimEndingPeriod(value) {
  return String(value).replace(/[。.]$/, "");
}
