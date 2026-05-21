const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "data", "cards.json");
const outputPath = path.join(root, "public", "static-cards.js");

const cards = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

function hasFinishedContent(card) {
  if (card.enabled === false || card.isCustom) {
    return false;
  }

  const haystack = [
    card.id,
    card.title,
    card.backTitle,
    card.backText,
    card.actionText
  ]
    .filter(Boolean)
    .join(" ");

  return !/placeholder|等待补充|之后在后台慢慢补上/.test(haystack);
}

const staticCards = cards
  .filter(hasFinishedContent)
  .sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0))
  .map((card) => ({
    id: card.id,
    slot: card.slot,
    title: card.title,
    rarityTier: card.rarityTier,
    rarity: card.rarity,
    rarityName: card.rarityName,
    rarityLine: card.rarityLine,
    frontText: card.frontText,
    backTitle: card.backTitle,
    backText: card.backText,
    actionText: card.actionText,
    accent: card.accent,
    isCustom: false,
    enabled: true
  }));

const body = [
  "window.LOVE_STATIC_CARDS = ",
  JSON.stringify(staticCards, null, 2),
  ";\n"
].join("");

fs.writeFileSync(outputPath, body, "utf8");
console.log(`Generated ${staticCards.length} static cards -> ${path.relative(root, outputPath)}`);
