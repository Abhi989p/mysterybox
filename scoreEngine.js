// scoreEngine.js — Scoring for all rounds

function addScore(gameLog, playerId, points) {
  if (gameLog.scores[playerId] === undefined) gameLog.scores[playerId] = 0;
  gameLog.scores[playerId] += points;
}

// Round 2 — Reaction Race: sliding speed bonus
// maxTime = prompt duration in ms; elapsed = ms since prompt shown (server-measured)
function reactionScore(isCorrect, elapsedMs, maxTimeMs = 10000) {
  if (!isCorrect) return 0;
  const base = 100;
  const speedFraction = Math.max(0, 1 - elapsedMs / maxTimeMs);
  const bonus = Math.round(speedFraction * 100); // 0–100 bonus
  return base + bonus;
}

// Round 3 — Imposter scoring
// normals: +1 for each correct imposter ID
// imposter: +1 for each player fooled (voted for wrong person)
function applyImposterScores(gameLog, imposterId, votes, playerIds) {
  // Count how many normals voted correctly (voted for imposter)
  for (const [voterId, votedId] of Object.entries(votes)) {
    if (voterId === imposterId) continue; // imposter doesn't score this way
    if (votedId === imposterId) {
      addScore(gameLog, voterId, 1); // normal correctly identified imposter
    } else {
      addScore(gameLog, imposterId, 1); // imposter fooled this normal player
    }
  }
}

// Get sorted leaderboard: [{playerId, score}, ...]
function getLeaderboard(gameLog) {
  return Object.entries(gameLog.scores)
    .map(([playerId, score]) => ({ playerId, score }))
    .sort((a, b) => b.score - a.score);
}

// Determine round winner from vote tally (most votes)
// Returns array of tied winner ids
function getMostVoted(votes) {
  const tally = {};
  for (const votedId of Object.values(votes)) {
    tally[votedId] = (tally[votedId] || 0) + 1;
  }
  const maxVotes = Math.max(...Object.values(tally), 0);
  if (maxVotes === 0) return [];
  return Object.entries(tally)
    .filter(([, count]) => count === maxVotes)
    .map(([id]) => id);
}

// Draft order: most accused first, then descending score, ties broken randomly
function getDraftOrder(mostAccusedId, gameLog) {
  const leaderboard = getLeaderboard(gameLog);
  const others = leaderboard
    .filter((e) => e.playerId !== mostAccusedId)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Math.random() - 0.5;
    })
    .map((e) => e.playerId);
  return [mostAccusedId, ...others];
}

module.exports = {
  addScore,
  reactionScore,
  applyImposterScores,
  getLeaderboard,
  getMostVoted,
  getDraftOrder,
};
