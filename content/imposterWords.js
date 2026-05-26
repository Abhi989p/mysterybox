// content/imposterWords.js — thin loader for imposterWords.json
const data = require("./imposterWords.json");
const CATEGORIES = Object.keys(data);

function getRandomWordPair() {
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const pairs = data[category];
  const pair = pairs[Math.floor(Math.random() * pairs.length)];
  return { category, normal: pair.normal, imposter: pair.imposter };
}

module.exports = { getRandomWordPair, CATEGORIES };
