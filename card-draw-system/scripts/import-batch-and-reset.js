const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const cardsPath = path.join(root, "data", "cards.json");
const statePath = path.join(root, "data", "state.json");

const tiers = {
  SSR: { start: 1, accent: "#c993ff" },
  S: { start: 31, accent: "#7ea7ff" },
  A: { start: 56, accent: "#8ee6ce" }
};

const batch = {
  SSR: [
    {
      title: "绝对指令权",
      desc: "今晚锐锐需无条件接受可心的一条指令（限合理范围）！"
    },
    {
      title: "思念的深度提问",
      desc: "可心今晚可向锐锐提出两个最私密、最渴望知道的、关于身体的深度问题，锐锐必须切实回答并进行最细节的描述。"
    },
    {
      title: "未来同居夜",
      desc: "下次连线，可心可要求锐锐关闭灯光，两人盖上被子，只用私密的“气音”，互相讲述对未来同居生活的三个最大期待。"
    },
    {
      title: "恋爱剧本导演",
      desc: "可心写一个“小情节”，锐锐必须在有空的时候把它完整演出来（语音/文字/剧情皆可）。"
    }
  ],
  S: [
    {
      title: "抱抱召唤卡",
      desc: "可心随时说一声，锐锐就给可心一个抱抱（或语音版抱抱）。"
    },
    {
      title: "指定夸夸卡",
      desc: "可心可以要求锐锐针对某个方面夸可心，锐锐必须夸到可心满意为止。"
    },
    {
      title: "甜度升级卡",
      desc: "今天可心可以要求锐锐说一句平时不好意思说的情话。"
    },
    {
      title: "小任性保护卡",
      desc: "今天可心可以任性一次，锐锐必须无条件接住（小事范围）。"
    },
    {
      title: "今日愿望许可卡",
      desc: "可心可以提一个小愿望，锐锐需要在今天完成。"
    },
    {
      title: "随机甜蜜任务卡",
      desc: "可心今天可以让锐锐为可心做一件“超小但超暖心”的事，由可心指定。"
    },
    {
      title: "生活建议卡",
      desc: "可心问任何小问题，锐锐必须认真给出一个靠谱建议。"
    },
    {
      title: "好消息速递卡",
      desc: "今天锐锐必须给可心传递一件真实的小好消息。"
    },
    {
      title: "今日小幸运卡",
      desc: "锐锐必须给可心说一件可心今天会遇到的小幸运（预言型）。"
    }
  ],
  A: [
    {
      title: "小小命令卡",
      desc: "可心可以命令锐锐立刻做一件非常小的事情，比如“喝水”“拍猫猫手势”。"
    },
    {
      title: "情绪天线卡",
      desc: "可心今天说一句“锐锐有点情绪”，锐锐必须马上切换成陪伴模式。"
    },
    {
      title: "语音选手卡",
      desc: "可心可以要求锐锐发一条可心指定风格的语音（可爱/低沉/搞怪）。"
    },
    {
      title: "表情包投喂卡",
      desc: "可心可以随时喊，锐锐要立刻给可心投喂一波表情包。"
    },
    {
      title: "情感电量补给卡",
      desc: "可心说缺电，锐锐必须立刻补给一句动力话。"
    },
    {
      title: "照片召唤卡",
      desc: "可心可以要求锐锐拍一张当下的小照片（场景随缘）。"
    },
    {
      title: "早睡强制令",
      desc: "锐锐今日必须在可心指定的时间睡觉，不许熬夜学习！"
    }
  ]
};

const cards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const bySlot = new Map(cards.map((card) => [Number(card.slot), card]));

Object.entries(batch).forEach(([tier, items]) => {
  const config = tiers[tier];
  items.forEach((item, index) => {
    const slot = config.start + index;
    const existing = bySlot.get(slot) || {};
    bySlot.set(slot, {
      ...existing,
      id: `${tier.toLowerCase()}-batch-${String(slot).padStart(2, "0")}`,
      slot,
      title: `【${item.title}】`,
      rarityTier: tier,
      rarity: tier,
      frontText: tier === "SSR" ? "超稀有心动" : tier === "S" ? "今日特别心动" : "今日小心动",
      backTitle: item.title,
      backText: item.desc.replaceAll("情情", "可心"),
      actionText: item.title,
      accent: config.accent,
      isCustom: false,
      enabled: true
    });
  });
});

const nextCards = Array.from({ length: 90 }, (_, index) => bySlot.get(index + 1)).filter(Boolean);
fs.writeFileSync(cardsPath, `${JSON.stringify(nextCards, null, 2)}\n`);

const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const todayKey = getDrawDayKey();
const validIds = new Set(nextCards.map((card) => card.id));
state.collection = Array.isArray(state.collection) ? state.collection.filter((id) => validIds.has(id)) : [];
state.history = Array.isArray(state.history) ? state.history.filter((entry) => entry.dayKey !== todayKey) : [];
state.customCards = filterRecord(state.customCards, validIds);
state.usedCards = filterRecord(state.usedCards, validIds);
fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

console.log(JSON.stringify({
  imported: Object.fromEntries(Object.entries(batch).map(([tier, items]) => [tier, items.length])),
  resetDay: todayKey,
  totalCards: nextCards.length
}, null, 2));

function getDrawDayKey(date = new Date()) {
  const zoned = getZonedParts(date);
  if (zoned.hour < 7) {
    const previous = new Date(date.getTime() - 24 * 60 * 60 * 1000);
    return formatDayKey(getZonedParts(previous));
  }
  return formatDayKey(zoned);
}

function getZonedParts(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
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
    hour: Number(parts.hour)
  };
}

function formatDayKey(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function filterRecord(record, validIds) {
  if (!record || typeof record !== "object") {
    return {};
  }

  return Object.fromEntries(Object.entries(record).filter(([id]) => validIds.has(id)));
}
