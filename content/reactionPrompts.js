// content/reactionPrompts.js — thin loader for reactionPrompts.json
const data = require("./reactionPrompts.json");

function getRandomPrompts(count = 4) {
  const shuffled = [...data.prompts].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

module.exports = { getRandomPrompts };
