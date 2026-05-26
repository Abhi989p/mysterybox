// logger.js — Server-side game log builder
// This log is NEVER sent to any client until final_reveal fires

function createGameLog(roomId, players, prizeBox) {
  return {
    roomId,
    players: players.map((p) => ({ id: p.id, name: p.name, boxNumber: p.boxNumber })),
    prizeBox,
    events: [],
    boxStateHistory: [{ timestamp: Date.now(), prizeHeldBy: getPrizeHolder(players, prizeBox) }],
    votes: {},
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    cardAssignments: {},
    finalAccusations: {},
    correctAccusers: [],
  };
}

function getPrizeHolder(players, prizeBox) {
  const holder = players.find((p) => p.boxNumber === prizeBox);
  return holder ? holder.id : null;
}

function logEvent(gameLog, type, round, data) {
  gameLog.events.push({
    type,
    timestamp: Date.now(),
    round,
    data,
  });
}

function logBoxState(gameLog, players, prizeBox) {
  const prizeHeldBy = getPrizeHolder(players, prizeBox);
  gameLog.boxStateHistory.push({ timestamp: Date.now(), prizeHeldBy });
}

function logVote(gameLog, round, question, voterId, votedPlayerId) {
  if (!gameLog.votes[round]) gameLog.votes[round] = {};
  if (!gameLog.votes[round][question]) gameLog.votes[round][question] = {};
  gameLog.votes[round][question][voterId] = votedPlayerId;
}

function logCardAssignment(gameLog, playerId, cardType) {
  gameLog.cardAssignments[playerId] = cardType;
}

function logFinalAccusation(gameLog, accuserId, accusedId) {
  gameLog.finalAccusations[accuserId] = accusedId;
}

function computeCorrectAccusers(gameLog, actualPrizeHolder) {
  const correct = [];
  for (const [accuserId, accusedId] of Object.entries(gameLog.finalAccusations)) {
    if (accusedId === actualPrizeHolder) correct.push(accuserId);
  }
  gameLog.correctAccusers = correct;
  return correct;
}

module.exports = {
  createGameLog,
  logEvent,
  logBoxState,
  logVote,
  logCardAssignment,
  logFinalAccusation,
  computeCorrectAccusers,
  getPrizeHolder,
};
