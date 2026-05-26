// gameEngine.js — PATCHED
// Fix 1: submitHotTakeVote — allow vote regardless of phase field (phase field never set to "voting" server-side between prompts)
// Fix 2: submitImposterClue — remove strict phase check so late clues don't get dropped
const { getRandomQuestions } = require("./content/hotTakeBank");
const { getRandomPrompts } = require("./content/reactionPrompts");
const { getRandomWordPair } = require("./content/imposterWords");
const { assignCards, createBlockState, applyBlock, isSwapBlocked, getCardName } = require("./cardEngine");
const {
  addScore, reactionScore, applyImposterScores,
  getLeaderboard, getMostVoted, getDraftOrder,
} = require("./scoreEngine");
const {
  createGameLog, logEvent, logBoxState, logVote,
  logCardAssignment, logFinalAccusation, computeCorrectAccusers, getPrizeHolder,
} = require("./logger");
const { startTimer, clearTimer } = require("./timerEngine");

const LOSS_MESSAGES = [
  "Not even close bestie.",
  "The box was always empty, just like your strategy.",
  "You played so hard for absolutely nothing.",
  "Better luck next paranoia spiral.",
  "Your box had vibes though. Just not prize vibes.",
  "The audacity to lose this spectacularly 💀",
  "You were this close. Just kidding, you weren't.",
];

function getLossMessage() {
  return LOSS_MESSAGES[Math.floor(Math.random() * LOSS_MESSAGES.length)];
}

// ─── BOX ASSIGNMENT ───────────────────────────────────────────────────────────

function assignBoxes(room) {
  const players = room.players;
  const indices = players.map((_, i) => i + 1);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  players.forEach((p, i) => { p.boxNumber = indices[i]; });

  const prizeBox = indices[Math.floor(Math.random() * indices.length)];
  room.gameState = {
    prizeBox,
    phase: "BOX_ASSIGNMENT",
    round: 0,
    sealedBoxes: new Set(),  // playerIds whose boxes are currently sealed
    pendingSwaps: new Map(),
    hotTake: null,
    reaction: null,
    imposter: null,
    mostLikelyTo: null,
    finalAccusation: null,
    draft: null,
    cardPhase: null,
    disconnectVotes: new Map(),
  };
  room.gameLog = createGameLog(room.id, players, prizeBox);
  logEvent(room.gameLog, "phase_change", 0, { phase: "BOX_ASSIGNMENT" });
  return prizeBox;
}

// ─── SWAP HELPERS ─────────────────────────────────────────────────────────────

function executeSwap(room, playerIdA, playerIdB) {
  const a = room.players.find((p) => p.id === playerIdA);
  const b = room.players.find((p) => p.id === playerIdB);
  if (!a || !b) return false;
  [a.boxNumber, b.boxNumber] = [b.boxNumber, a.boxNumber];
  logBoxState(room.gameLog, room.players, room.gameState.prizeBox);
  logEvent(room.gameLog, "swap", room.gameState.round, {
    playerA: playerIdA, playerB: playerIdB,
    boxA: a.boxNumber, boxB: b.boxNumber,
  });
  return true;
}

// ─── STARTING SWAP PHASE ──────────────────────────────────────────────────────

function handleSwapRequest(io, room, fromSocket, toPlayerId) {
  const gs = room.gameState;
  if (gs.phase !== "STARTING_SWAP") return;

  const fromPlayer = room.players.find((p) => p.socketId === fromSocket.id);
  if (!fromPlayer) return;

  // Self-swap guard
  if (fromPlayer.id === toPlayerId) {
    fromSocket.emit("swap_request_blocked", { message: "Cannot swap with yourself" });
    return;
  }

  const targetHasPending = [...gs.pendingSwaps.values()].some((r) => r.to === toPlayerId);
  if (targetHasPending) {
    fromSocket.emit("swap_request_blocked", {
      message: `${room.players.find((p) => p.id === toPlayerId)?.name} already has a pending request`,
    });
    return;
  }
  if (gs.pendingSwaps.has(fromPlayer.id)) {
    fromSocket.emit("swap_request_blocked", { message: "You already have a pending swap request" });
    return;
  }

  gs.pendingSwaps.set(fromPlayer.id, { from: fromPlayer.id, to: toPlayerId });
  const targetPlayer = room.players.find((p) => p.id === toPlayerId);
  if (targetPlayer) {
    io.to(targetPlayer.socketId).emit("swap_request_incoming", {
      fromId: fromPlayer.id,
      fromName: fromPlayer.name,
    });
  }
}

function handleSwapResponse(io, room, responderSocket, accepted) {
  const gs = room.gameState;
  const responder = room.players.find((p) => p.socketId === responderSocket.id);
  if (!responder) return;

  let requesterId = null;
  for (const [rId, req] of gs.pendingSwaps.entries()) {
    if (req.to === responder.id) { requesterId = rId; break; }
  }
  if (!requesterId) return;
  gs.pendingSwaps.delete(requesterId);

  if (accepted) {
    executeSwap(room, requesterId, responder.id);
    const reqPlayer = room.players.find((p) => p.id === requesterId);
    io.to(room.id).emit("swap_executed", {
      playerA: { id: requesterId, name: reqPlayer?.name, boxNumber: reqPlayer?.boxNumber },
      playerB: { id: responder.id, name: responder.name, boxNumber: responder.boxNumber },
    });
  }
}

// ─── ROUND 1 — HOT TAKE ───────────────────────────────────────────────────────

function initHotTake(room) {
  const questions = getRandomQuestions(3);
  room.gameState.hotTake = {
    questions,
    currentQ: 0,
    answers: {},     // questionIndex -> { playerId: answerText }
    votes: {},       // questionIndex -> { voterId: answeredByPlayerId }
    totalVotes: {},
    phase: "answering",
  };
  room.gameState.phase = "ROUND_1";
  room.gameState.round = 1;
  return questions[0];
}

function submitHotTakeAnswer(room, playerId, questionIndex, answer) {
  const ht = room.gameState.hotTake;
  if (!ht) return false;
  if (!answer?.trim()) return false; // Reject blank answers
  // Accept answers in both answering and voting phase (late submission)
  if (!ht.answers[questionIndex]) ht.answers[questionIndex] = {};
  if (ht.answers[questionIndex][playerId]) return false; // already answered
  ht.answers[questionIndex][playerId] = answer.trim();
  return true;
}

function getShuffledAnswers(room, questionIndex) {
  const ht = room.gameState.hotTake;
  const raw = ht.answers[questionIndex] || {};
  const entries = Object.entries(raw).map(([pid, text]) => ({ pid, text }));
  return entries.sort(() => Math.random() - 0.5);
}

function submitHotTakeVote(room, voterId, questionIndex, votedPid) {
  const ht = room.gameState.hotTake;
  if (!ht) return false;
  if (voterId === votedPid) return false;
  if (!ht.votes[questionIndex]) ht.votes[questionIndex] = {};
  if (ht.votes[questionIndex][voterId]) return false; // already voted
  ht.votes[questionIndex][voterId] = votedPid;
  logVote(room.gameLog, 1, questionIndex, voterId, votedPid);
  return true;
}

function tallyHotTakeVotes(room) {
  const ht = room.gameState.hotTake;
  const totals = {};
  room.players.forEach((p) => { totals[p.id] = 0; });
  for (const qVotes of Object.values(ht.votes)) {
    for (const votedPid of Object.values(qVotes)) {
      totals[votedPid] = (totals[votedPid] || 0) + 1;
    }
  }
  ht.totalVotes = totals;
  return totals;
}

function getHotTakeWinner(room) {
  const totals = tallyHotTakeVotes(room);
  const maxVotes = Math.max(...Object.values(totals), 0);
  // Award score points for votes received this round
  for (const [pid, votes] of Object.entries(totals)) {
    if (votes > 0) addScore(room.gameLog, pid, votes);
  }
  // If nobody voted (all 0), all players are tied — tiebreak will resolve
  const winners = Object.entries(totals).filter(([, v]) => v === maxVotes).map(([id]) => id);
  return winners.length > 0 ? winners : room.players.map((p) => p.id);
}

// ─── ROUND 2 — REACTION RACE ──────────────────────────────────────────────────

function initReactionRace(room) {
  const prompts = getRandomPrompts(4);
  room.gameState.reaction = {
    prompts,
    currentPrompt: 0,
    promptStartTime: null,
    scores: {},
    answers: {},
    phase: "waiting",
  };
  room.players.forEach((p) => { room.gameState.reaction.scores[p.id] = 0; });
  room.gameState.phase = "ROUND_2";
  room.gameState.round = 2;
  return prompts[0];
}

function startReactionPrompt(room) {
  const rr = room.gameState.reaction;
  rr.promptStartTime = Date.now();
  rr.phase = "answering";
  rr.answers[rr.currentPrompt] = {};
}

function submitReactionAnswer(room, playerId, promptIndex, answerIndex) {
  const rr = room.gameState.reaction;
  if (!rr) return null;
  if (rr.currentPrompt !== promptIndex) return null;
  if (rr.answers[promptIndex] && rr.answers[promptIndex][playerId]) return null;

  const elapsed = Date.now() - rr.promptStartTime;
  const prompt = rr.prompts[promptIndex];
  const isCorrect = answerIndex === prompt.correctIndex;
  const pts = reactionScore(isCorrect, elapsed, 10000);
  if (!rr.answers[promptIndex]) rr.answers[promptIndex] = {};
  rr.answers[promptIndex][playerId] = { answerIndex, elapsed, isCorrect, pts };
  rr.scores[playerId] = (rr.scores[playerId] || 0) + pts;
  return pts;
}

function getReactionWinner(room) {
  const rr = room.gameState.reaction;
  const maxScore = Math.max(...Object.values(rr.scores), 0);
  for (const [pid, pts] of Object.entries(rr.scores)) {
    addScore(room.gameLog, pid, pts);
  }
  return Object.entries(rr.scores)
    .filter(([, s]) => s === maxScore)
    .map(([id]) => id);
}

// ─── ROUND 3 — IMPOSTER GUESS ─────────────────────────────────────────────────

function initImposterGuess(room) {
  const { category, normal, imposter } = getRandomWordPair();
  const playerIds = room.players.map((p) => p.id);
  const imposterIdx = Math.floor(Math.random() * playerIds.length);
  const imposterId = playerIds[imposterIdx];
  const clueOrder = [...playerIds].sort(() => Math.random() - 0.5);

  room.gameState.imposter = {
    category,
    normalWord: normal,
    imposterWord: imposter,
    imposterId,
    clueOrder,
    currentClueIndex: 0,
    clues: [],
    votes: {},
    phase: "clues",
  };
  room.gameState.phase = "ROUND_3";
  room.gameState.round = 3;
  return { category, imposterId, clueOrder };
}

function submitImposterClue(room, playerId, clue) {
  const ig = room.gameState.imposter;
  if (!ig || ig.phase === "voting" || ig.phase === "result") return false;
  ig.clues.push({ playerId, clue });
  ig.currentClueIndex++;
  return true;
}

function submitImposterVote(room, voterId, votedId) {
  const ig = room.gameState.imposter;
  if (!ig) return false;
  if (voterId === votedId) return false;
  if (ig.votes[voterId]) return false; // already voted
  ig.votes[voterId] = votedId;
  logVote(room.gameLog, 3, "imposter", voterId, votedId);
  return true;
}

function resolveImposterRound(room) {
  const ig = room.gameState.imposter;
  // Snapshot scores BEFORE applying imposter scoring to find this-round gain
  const preScores = {};
  room.players.forEach((p) => { preScores[p.id] = room.gameLog.scores[p.id] || 0; });

  applyImposterScores(room.gameLog, ig.imposterId, ig.votes, room.players.map((p) => p.id));

  // Round 3 winner = player who gained the most points in THIS round
  let maxGain = -Infinity;
  let roundWinnerId = null;
  for (const p of room.players) {
    const gain = (room.gameLog.scores[p.id] || 0) - preScores[p.id];
    if (gain > maxGain) { maxGain = gain; roundWinnerId = p.id; }
  }
  // Fallback if nobody scored (all voted wrong + imposter fooled nobody)
  if (!roundWinnerId || maxGain <= 0) {
    roundWinnerId = getLeaderboard(room.gameLog)[0]?.playerId || room.players[0]?.id;
  }

  const winners = getMostVoted(ig.votes);
  return { imposterId: ig.imposterId, votes: ig.votes, winners, roundWinnerId };
}

// ─── ROUND 4 — MOST LIKELY TO ─────────────────────────────────────────────────

function initMostLikelyTo(room) {
  const questions = [
    "Who has been the most suspiciously quiet this game?",
    "Who would you least trust with your box right now?",
    "Who do you think will win this whole game?",
    "Who currently has the prize?",
  ];
  room.gameState.mostLikelyTo = {
    questions,
    currentQ: 0,
    votes: {},
    phase: "voting",
  };
  room.gameState.phase = "ROUND_4";
  room.gameState.round = 4;
  return questions;
}

function submitMostLikelyVote(room, voterId, questionIndex, votedId) {
  const mlt = room.gameState.mostLikelyTo;
  if (!mlt) return false;
  if (!mlt.votes[questionIndex]) mlt.votes[questionIndex] = {};
  if (mlt.votes[questionIndex][voterId]) return false; // already voted
  mlt.votes[questionIndex][voterId] = votedId;
  logVote(room.gameLog, 4, questionIndex, voterId, votedId);
  return true;
}

function getMostLikelyWinner(room) {
  const mlt = room.gameState.mostLikelyTo;
  const lockedIdx = mlt.questions.length - 1;
  const lockedVotes = mlt.votes[lockedIdx] || {};
  const winners = getMostVoted(lockedVotes);
  if (winners.length === 0) {
    // No votes on final question — fall back to overall score leader
    const lb = getLeaderboard(room.gameLog);
    return lb.length > 0 ? [lb[0].playerId] : [room.players[0]?.id];
  }
  return winners;
}

// ─── ROUND 5 — FINAL ACCUSATION ───────────────────────────────────────────────

function initFinalAccusation(room) {
  room.gameState.finalAccusation = { votes: {}, phase: "voting" };
  room.gameState.phase = "ROUND_5";
  room.gameState.round = 5;
}

function submitFinalAccusation(room, voterId, accusedId) {
  const fa = room.gameState.finalAccusation;
  if (!fa) return false;
  if (voterId === accusedId) return false;
  if (fa.votes[voterId]) return false; // already voted
  fa.votes[voterId] = accusedId;
  logFinalAccusation(room.gameLog, voterId, accusedId);
  return true;
}

function resolveFinalAccusation(room) {
  const fa = room.gameState.finalAccusation;
  const mostAccused = getMostVoted(fa.votes);
  let chosen;
  if (mostAccused.length === 0) {
    // No votes cast — pick score leader as draft first-pick (they're "most suspected" by default)
    const lb = getLeaderboard(room.gameLog);
    chosen = lb[0]?.playerId || room.players[0]?.id;
  } else {
    chosen = mostAccused[Math.floor(Math.random() * mostAccused.length)];
  }
  room.gameState.finalAccusation.mostAccusedId = chosen;
  logEvent(room.gameLog, "vote", 5, { mostAccusedId: chosen, votes: fa.votes });
  return { mostAccusedId: chosen, votes: fa.votes };
}

// ─── ROUND 6 — POSITION DRAFT ─────────────────────────────────────────────────

function initPositionDraft(room) {
  const mostAccusedId = room.gameState.finalAccusation?.mostAccusedId;
  const order = getDraftOrder(mostAccusedId, room.gameLog);
  const slots = room.players.map((_, i) => i + 1);
  room.gameState.draft = {
    order,
    currentIdx: 0,
    slots,
    picks: {},
    phase: "picking",
  };
  room.gameState.phase = "ROUND_6";
  room.gameState.round = 6;
  return { order, slots };
}

function submitDraftPick(room, playerId, slot) {
  const d = room.gameState.draft;
  if (!d || d.phase !== "picking") return false;
  if (d.order[d.currentIdx] !== playerId) return false;
  if (!d.slots.includes(slot)) return false;
  d.picks[playerId] = slot;
  d.slots = d.slots.filter((s) => s !== slot);
  d.currentIdx++;
  logEvent(room.gameLog, "phase_change", 6, { playerId, slot });
  return true;
}

function autoAssignDraftSlot(room) {
  const d = room.gameState.draft;
  if (!d || d.slots.length === 0) return null;
  const playerId = d.order[d.currentIdx];
  const slot = d.slots[0];
  d.picks[playerId] = slot;
  d.slots = d.slots.filter((s) => s !== slot);
  d.currentIdx++;
  return { playerId, slot };
}

// ─── ROUND 7 — FINAL CARD PHASE ───────────────────────────────────────────────

function initCardPhase(room) {
  const assignments = assignCards(room.players);
  Object.entries(assignments).forEach(([pid, card]) => {
    logCardAssignment(room.gameLog, pid, card);
  });

  const draft = room.gameState.draft;
  const actionOrder = Object.entries(draft.picks)
    .sort((a, b) => a[1] - b[1])
    .map(([pid]) => pid);

  room.gameState.cardPhase = {
    assignments,
    blockState: createBlockState(),
    actionOrder,
    currentActionIdx: 0,
    usedCards: new Set(),
    pendingSeeSwap: null,
    phase: "acting",
  };
  room.gameState.phase = "ROUND_7";
  room.gameState.round = 7;
  return { assignments, actionOrder };
}

function handleBlindSwap(io, room, playerId, targetId) {
  const cp = room.gameState.cardPhase;
  if (!canAct(cp, playerId, "blind_swap")) return { error: "Cannot act" };
  if (isSwapBlocked(cp.blockState, playerId, targetId)) {
    io.to(room.id).emit("swap_blocked_by_card", {
      attackerName: room.players.find((p) => p.id === playerId)?.name,
      defenderName: room.players.find((p) => p.id === targetId)?.name,
    });
    cp.usedCards.add(playerId);
    return { blocked: true };
  }
  executeSwap(room, playerId, targetId);
  cp.usedCards.add(playerId);
  const a = room.players.find((p) => p.id === playerId);
  const b = room.players.find((p) => p.id === targetId);
  io.to(room.id).emit("swap_executed", {
    playerA: { id: a.id, name: a.name, boxNumber: a.boxNumber },
    playerB: { id: b.id, name: b.name, boxNumber: b.boxNumber },
  });
  // Seal both players immediately after card-phase blind swap
  if (room.gameState.sealedBoxes) {
    room.gameState.sealedBoxes.add(playerId);
    room.gameState.sealedBoxes.add(targetId);
    io.to(a.socketId).emit("box_sealed");
    io.to(b.socketId).emit("box_sealed");
  }
  logEvent(room.gameLog, "card_used", 7, { card: "blind_swap", playerId, targetId });
  return { ok: true };
}

function handleViewCard(io, room, playerId, targetId, isSeeSwap = false) {
  const cp = room.gameState.cardPhase;
  const cardType = isSeeSwap ? "see_swap" : "view";
  if (!canAct(cp, playerId, cardType)) return { error: "Cannot act" };

  const targetPlayer = room.players.find((p) => p.id === targetId);
  const hasPrize = targetPlayer?.boxNumber === room.gameState.prizeBox;

  const requesterSocket = room.players.find((p) => p.id === playerId)?.socketId;
  io.to(requesterSocket).emit("view_result", {
    targetId,
    targetName: targetPlayer?.name,
    targetBox: targetPlayer?.boxNumber,
    hasPrize,
  });

  const viewerName = room.players.find((p) => p.id === playerId)?.name;
  io.to(room.id).emit("view_broadcast", { viewerName, targetName: targetPlayer?.name });

  if (!isSeeSwap) {
    cp.usedCards.add(playerId);
    logEvent(room.gameLog, "card_used", 7, { card: "view", playerId, targetId, hasPrize });
  } else {
    cp.pendingSeeSwap = { playerId, targetId, viewed: true };
    logEvent(room.gameLog, "card_used", 7, { card: "see_swap_view", playerId, targetId, hasPrize });
  }
  return { ok: true };
}

function handleSeeSwapDecision(io, room, playerId, doSwap) {
  const cp = room.gameState.cardPhase;
  if (!cp.pendingSeeSwap || cp.pendingSeeSwap.playerId !== playerId) return;
  const { targetId } = cp.pendingSeeSwap;
  if (doSwap) {
    if (!isSwapBlocked(cp.blockState, playerId, targetId)) {
      executeSwap(room, playerId, targetId);
      const a = room.players.find((p) => p.id === playerId);
      const b = room.players.find((p) => p.id === targetId);
      io.to(room.id).emit("swap_executed", {
        playerA: { id: a.id, name: a.name, boxNumber: a.boxNumber },
        playerB: { id: b.id, name: b.name, boxNumber: b.boxNumber },
      });
      // Seal both players immediately after see_swap card swap
      if (room.gameState.sealedBoxes) {
        room.gameState.sealedBoxes.add(playerId);
        room.gameState.sealedBoxes.add(targetId);
        io.to(a.socketId).emit("box_sealed");
        io.to(b.socketId).emit("box_sealed");
      }
    } else {
      io.to(room.id).emit("swap_blocked_by_card", {
        attackerName: room.players.find((p) => p.id === playerId)?.name,
        defenderName: room.players.find((p) => p.id === targetId)?.name,
      });
    }
  }
  cp.usedCards.add(playerId);
  cp.pendingSeeSwap = null;
  logEvent(room.gameLog, "card_used", 7, { card: "see_swap_decision", playerId, doSwap });
}

function handleBlockCard(io, room, blockerId, targetId) {
  const cp = room.gameState.cardPhase;
  if (!canAct(cp, blockerId, "block")) return { error: "Cannot act" };
  applyBlock(cp.blockState, blockerId, targetId);
  cp.usedCards.add(blockerId);
  const blockerName = room.players.find((p) => p.id === blockerId)?.name;
  const targetName = room.players.find((p) => p.id === targetId)?.name;
  io.to(room.id).emit("block_broadcast", { blockerName, targetName });
  logEvent(room.gameLog, "card_used", 7, { card: "block", blockerId, targetId });
  return { ok: true };
}

function canAct(cp, playerId, cardType) {
  if (cp.usedCards.has(playerId)) return false;
  if (cp.assignments[playerId] !== cardType) return false;
  if (cp.actionOrder[cp.currentActionIdx] !== playerId) return false;
  return true;
}

function advanceCardPhaseAction(cp) {
  cp.currentActionIdx++;
}

// ─── ROUND 8 — FINAL REVEAL ───────────────────────────────────────────────────

function buildFinalReveal(room) {
  const gs = room.gameState;
  const prizeHolder = room.players.find((p) => p.boxNumber === gs.prizeBox);
  computeCorrectAccusers(room.gameLog, prizeHolder?.id);

  const accusationVotes = room.gameState.finalAccusation?.votes || {};
  const accuseCount = {};
  room.players.forEach((p) => { accuseCount[p.id] = 0; });
  for (const v of Object.values(accusationVotes)) {
    accuseCount[v] = (accuseCount[v] || 0) + 1;
  }
  const revealOrder = [...room.players].sort((a, b) => accuseCount[a.id] - accuseCount[b.id]);

  const lb = getLeaderboard(room.gameLog);
  const bestPlayerId = lb[0]?.playerId;
  const correctAccusers = room.gameLog.correctAccusers;

  const reveals = revealOrder.map((p) => ({
    playerId: p.id,
    name: p.name,
    boxNumber: p.boxNumber,
    isWinner: p.id === prizeHolder?.id,
    lossMessage: p.id !== prizeHolder?.id ? getLossMessage() : null,
  }));

  const badges = {
    winner: prizeHolder?.id,
    sharpestEye: correctAccusers,
    bestPlayer: bestPlayerId,
  };

  return { reveals, badges, gameLog: room.gameLog };
}

module.exports = {
  assignBoxes, executeSwap, handleSwapRequest, handleSwapResponse,
  initHotTake, submitHotTakeAnswer, getShuffledAnswers, submitHotTakeVote, getHotTakeWinner,
  initReactionRace, startReactionPrompt, submitReactionAnswer, getReactionWinner,
  initImposterGuess, submitImposterClue, submitImposterVote, resolveImposterRound,
  initMostLikelyTo, submitMostLikelyVote, getMostLikelyWinner,
  initFinalAccusation, submitFinalAccusation, resolveFinalAccusation,
  initPositionDraft, submitDraftPick, autoAssignDraftSlot,
  initCardPhase, handleBlindSwap, handleViewCard, handleSeeSwapDecision, handleBlockCard,
  advanceCardPhaseAction, buildFinalReveal,
};
