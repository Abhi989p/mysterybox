const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const rm = require("./roomManager");
const ge = require("./gameEngine");
const { startTimer, clearTimer } = require("./timerEngine");
const { logEvent } = require("./logger");
const { getLeaderboard } = require("./scoreEngine");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: process.env.FRONTEND_URL || "*" },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
});

// Memory Management: Cleanup inactive rooms every 10 minutes
setInterval(() => {
  const deleted = rm.cleanupInactiveRooms?.(30 * 60 * 1000) || 0; // 30 mins
  if (deleted > 0) console.log(`[GC] Cleaned up ${deleted} inactive room(s)`);
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 3001;

// ── HELPERS ──────────────────────────────────────────────────────────────────

function broadcastRoomState(room) {
  io.to(room.id).emit("room_state", rm.getPublicRoomState(room));
}

function emitPhaseChange(room, phase, data = {}) {
  room.phase = phase;
  io.to(room.id).emit("phase_change", { phase, ...data });
}

function getRoomAndPlayer(socket) {
  const room = rm.getRoomBySocketId(socket.id);
  const player = room ? rm.getPlayer(room, socket.id) : null;
  return { room, player };
}

/**
 * Seal one or more players: add to sealedBoxes + emit box_sealed to their socket.
 * Safe to call even if sealedBoxes doesn't exist yet (guard included).
 */
function sealPlayers(room, ...playerIds) {
  if (!room.gameState?.sealedBoxes) return;
  playerIds.forEach((id) => {
    room.gameState.sealedBoxes.add(id);
    const p = rm.getPlayerById(room, id);
    if (p?.socketId) io.to(p.socketId).emit("box_sealed");
  });
}

// ── SCOREBOARD HELPER ────────────────────────────────────────────────────────

/**
 * Build and emit round_scoreboard to all players in the room.
 * Must be called BEFORE emitting round_winner / WINNER_ACTION phase.
 * @param {object} room
 * @param {number} round  1|2|3|4
 * @param {string} winnerId
 * @param {string} winnerName
 * @param {object} winMeta  — round-specific metadata for reason line
 */
function emitRoundScoreboard(room, round, winnerId, winnerName, winMeta) {
  const lb = getLeaderboard(room.gameLog);
  const prevScores = room.gameState._roundStartScores || {};

  const scores = lb.map((entry) => {
    const prev = prevScores[entry.playerId] || 0;
    const pointsThisRound = entry.score - prev;
    const player = rm.getPlayerById(room, entry.playerId);
    return {
      playerId: entry.playerId,
      name: player?.name || entry.playerId,
      totalPoints: entry.score,
      pointsThisRound,
      isRoundWinner: entry.playerId === winnerId,
    };
  });

  // Build win reason string
  let winReason = `👑 ${winnerName} wins this round!`;
  if (round === 1) {
    const votes = winMeta?.votes ?? "?";
    winReason = `👑 ${winnerName} got ${votes} vote${votes !== 1 ? "s" : ""} — the funniest in the room`;
  } else if (round === 2) {
    const pts = winMeta?.points ?? "?";
    winReason = `👑 ${winnerName} scored ${pts} points — fastest and most accurate`;
  } else if (round === 3) {
    if (winMeta?.wasImposter) {
      winReason = `👑 ${winnerName} gained ${winMeta.gain} points — fooled everyone as the imposter`;
    } else {
      winReason = `👑 ${winnerName} gained ${winMeta?.gain ?? "?"} points — correctly identified the imposter`;
    }
  } else if (round === 4) {
    const votes = winMeta?.votes ?? "?";
    winReason = `👑 ${winnerName} got ${votes} vote${votes !== 1 ? "s" : ""} — everyone thinks they have the prize`;
  }

  io.to(room.id).emit("round_scoreboard", { scores, winnerName, winReason });
}

// ── ROUND STARTERS ────────────────────────────────────────────────────────────

function startRound1(room) {
  const q0 = ge.initHotTake(room);
  // Snapshot scores at round start for scoreboard delta calculation
  const lb = getLeaderboard(room.gameLog);
  room.gameState._roundStartScores = {};
  lb.forEach((e) => { room.gameState._roundStartScores[e.playerId] = e.score; });
  emitPhaseChange(room, "RULES_1", {
    rulesText: "Everyone answers the question anonymously. Vote for the funniest answer — not your own. Most votes across 3 questions wins.",
  });
  startTimer(io, room.id, 10, () => {
    emitPhaseChange(room, "ROUND_1_ANSWERING", { question: q0, questionIndex: 0 });
    startTimer(io, room.id, 25, () => transitionHotTakeToVoting(room, 0));
  });
}

function advanceHotTakeVote(room, qIdx) {
  const ht = room.gameState.hotTake;
  if (qIdx < ht.questions.length - 1) {
    const nextQ = ht.questions[qIdx + 1];
    setTimeout(() => {
      emitPhaseChange(room, "ROUND_1_ANSWERING", { question: nextQ, questionIndex: qIdx + 1 });
      startTimer(io, room.id, 25, () => transitionHotTakeToVoting(room, qIdx + 1));
    }, 2000);
  } else {
    resolveHotTake(room);
  }
}

function transitionHotTakeToVoting(room, qIdx) {
  const answers = ge.getShuffledAnswers(room, qIdx);
  io.to(room.id).emit("hot_take_answers", { questionIndex: qIdx, answers });
  emitPhaseChange(room, "ROUND_1_VOTING", { questionIndex: qIdx });
  startTimer(io, room.id, 18, () => advanceHotTakeVote(room, qIdx));
}

function resolveHotTake(room) {
  const winners = ge.getHotTakeWinner(room);
  if (winners.length === 1) {
    const w = rm.getPlayerById(room, winners[0]);
    // Build vote-count for win reason
    const totals = room.gameState.hotTake?.totalVotes || {};
    const votes = totals[winners[0]] ?? 0;
    emitRoundScoreboard(room, 1, winners[0], w?.name, { votes });
    // Delay winner action by 8s (scoreboard display time)
    setTimeout(() => {
      room.gameState._winnerActionTaken = false;
      io.to(room.id).emit("round_winner", { round: 1, winnerId: winners[0], winnerName: w?.name });
      emitPhaseChange(room, "ROUND_1_WINNER_ACTION", { winnerId: winners[0] });
      startTimer(io, room.id, 20, () => handleWinnerAction(room, winners[0], "keep", null));
    }, 8000);
  } else {
    // tie_detected is emitted inside startTiebreak (new system)
    startTiebreak(room, winners, () => resolveHotTake(room), "ROUND_1_WINNER_ACTION");
  }
}

// ── TIEBREAKER SYSTEM ────────────────────────────────────────────────────────

const TIEBREAKER_PROMPTS = [
  "TYPE: BANANA", "TYPE: ROCKET",   "TYPE: MYSTERY",  "TYPE: CHAMPION",
  "TYPE: MANGO",  "TYPE: SUNRISE",  "TYPE: ELEPHANT", "TYPE: VICTORY",
];

/**
 * Final step: emit scoreboard → (8s) → round_winner + WINNER_ACTION.
 * Called after challenge or wheel winner is decided + shown.
 */
function finishTiebreakWithScoreboard(room, winnerId, winnerName, winnerActionPhase) {
  if (!room.gameState) return;
  const round = winnerActionPhase.includes("1") ? 1 : winnerActionPhase.includes("4") ? 4 : 1;
  emitRoundScoreboard(room, round, winnerId, winnerName, { votes: 0 });
  setTimeout(() => {
    if (!room.gameState) return;
    room.gameState._winnerActionTaken = false;
    io.to(room.id).emit("round_winner", { round: "tiebreak", winnerId, winnerName });
    emitPhaseChange(room, winnerActionPhase, { winnerId });
    startTimer(io, room.id, 20, () => handleWinnerAction(room, winnerId, "keep", null));
  }, 8000);
}

/**
 * Inspect answer timestamps and resolve: clear winner or wheel fallback.
 */
function resolveTiebreakerAnswers(room, tb) {
  const sorted = Object.entries(tb.firstAnswers).sort((a, b) => a[1] - b[1]);
  const fastest = sorted[0][1];
  const tiedFast = sorted.filter(([, t]) => t - fastest < 50);

  if (tiedFast.length > 1) {
    triggerWheelSpin(room, tiedFast.map(([id]) => id), tb.winnerActionPhase);
  } else {
    const winner = sorted[0][0];
    const w = rm.getPlayerById(room, winner);
    io.to(room.id).emit("tiebreaker_winner", { winnerId: winner, winnerName: w?.name, method: "challenge" });
    // 3s winner screen → scoreboard
    setTimeout(() => {
      if (!room.gameState) return;
      finishTiebreakWithScoreboard(room, winner, w?.name, tb.winnerActionPhase);
    }, 3000);
  }
}

/**
 * Trigger wheel spin: server pre-decides winner, sends wheel_spin_start,
 * then wheel_spin_result 3.5s later, then scoreboard 6s after that.
 */
function triggerWheelSpin(room, stillTiedIds, winnerActionPhase) {
  const tiedPlayers = stillTiedIds.map((id) => {
    const p = rm.getPlayerById(room, id);
    return { id, name: p?.name || id };
  });
  const winnerId = stillTiedIds[Math.floor(Math.random() * stillTiedIds.length)];
  const w = rm.getPlayerById(room, winnerId);

  io.to(room.id).emit("wheel_spin_start", { tiedPlayers });

  // Send result while wheel is spinning (client lands on winner)
  setTimeout(() => {
    if (!room.gameState) return;
    io.to(room.id).emit("wheel_spin_result", { winnerId, winnerName: w?.name, method: "wheel" });
    // 6s = 2.5s landing animation + 3.5s winner display, then scoreboard
    setTimeout(() => {
      if (!room.gameState) return;
      finishTiebreakWithScoreboard(room, winnerId, w?.name, winnerActionPhase);
    }, 6000);
  }, 3500);
}

/**
 * Full tiebreaker flow:
 * 1. Emit tie_detected (all players see 3s announcement)
 * 2. After 3s: send challenge to tied players, spectator screen for others
 * 3. First correct answer within 10s wins; simultaneous (<50ms) → wheel
 * 4. Nobody answers → wheel
 * Handles: disconnects during challenge, 3-way ties.
 */
function startTiebreak(room, tiedIds, onResolved, winnerActionPhase = "ROUND_1_WINNER_ACTION") {
  const tiedPlayers = tiedIds.map((id) => {
    const p = rm.getPlayerById(room, id);
    return { id, name: p?.name || id };
  });
  const round = winnerActionPhase.includes("1") ? "hot_take" : "most_likely";

  // Step 1: Announce tie to everyone
  io.to(room.id).emit("tie_detected", { tiedPlayers, round });

  // Step 2: After 3-second announcement, start challenge
  setTimeout(() => {
    if (!room.gameState) return;

    const prompt = TIEBREAKER_PROMPTS[Math.floor(Math.random() * TIEBREAKER_PROMPTS.length)];
    const word = prompt.replace("TYPE: ", "");

    // Only connected players participate
    const activeTied = tiedIds.filter((id) => {
      const p = rm.getPlayerById(room, id);
      return p && p.connected !== false;
    });

    // Edge case: disconnects reduced to ≤1 player during the 3s
    if (activeTied.length <= 1) {
      const winner = activeTied[0] || tiedIds[0];
      const w = rm.getPlayerById(room, winner);
      io.to(room.id).emit("tiebreaker_winner", { winnerId: winner, winnerName: w?.name, method: "challenge" });
      setTimeout(() => {
        if (!room.gameState) return;
        finishTiebreakWithScoreboard(room, winner, w?.name, winnerActionPhase);
      }, 3000);
      return;
    }

    room.gameState._tiebreak = {
      word,
      prompt,
      firstAnswers: {},
      tiedIds,
      activeTied,
      winnerActionPhase,
      resolveTimer: null, // 50ms simultaneous-answer window timer
    };

    // Send challenge to tied players only
    activeTied.forEach((id) => {
      const p = rm.getPlayerById(room, id);
      if (p) io.to(p.socketId).emit("tiebreaker_challenge", { prompt, timeLimit: 10000 });
    });

    // 10-second answer window
    startTimer(io, room.id, 10, () => {
      if (!room.gameState?._tiebreak) return; // already resolved
      const tb = room.gameState._tiebreak;
      if (tb.resolveTimer) { clearTimeout(tb.resolveTimer); tb.resolveTimer = null; }
      room.gameState._tiebreak = null;

      if (Object.keys(tb.firstAnswers).length === 0) {
        // Nobody answered → wheel
        triggerWheelSpin(room, tb.activeTied, winnerActionPhase);
      } else {
        resolveTiebreakerAnswers(room, tb);
      }
    });
  }, 3000);
}


function startRound2(room) {
  const p0 = ge.initReactionRace(room);
  // Snapshot scores at round start
  const lb = getLeaderboard(room.gameLog);
  room.gameState._roundStartScores = {};
  lb.forEach((e) => { room.gameState._roundStartScores[e.playerId] = e.score; });
  emitPhaseChange(room, "RULES_2", {
    rulesText: "4 rapid-fire prompts. Tap the correct answer as fast as you can. Speed + accuracy = points.",
  });
  startTimer(io, room.id, 10, () => runReactionPrompt(room, 0));
}

function runReactionPrompt(room, idx) {
  const rr = room.gameState.reaction;
  if (idx >= rr.prompts.length) { resolveReactionRace(room); return; }
  rr.currentPrompt = idx;
  ge.startReactionPrompt(room);
  // Strip correctIndex — never sent to client
  const { correctIndex: _ci, ...safePrompt } = rr.prompts[idx];
  emitPhaseChange(room, "ROUND_2_PROMPT", { promptIndex: idx, prompt: safePrompt });
  startTimer(io, room.id, 10, () => {
    io.to(room.id).emit("reaction_prompt_result", {
      promptIndex: idx,
      correctIndex: rr.prompts[idx].correctIndex,
    });
    setTimeout(() => runReactionPrompt(room, idx + 1), 2000);
  });
}

function resolveReactionRace(room) {
  const winners = ge.getReactionWinner(room);
  const w = rm.getPlayerById(room, winners[0]);
  const winnerPts = room.gameState.reaction?.scores?.[winners[0]] ?? 0;
  emitRoundScoreboard(room, 2, winners[0], w?.name, { points: winnerPts });
  setTimeout(() => {
    room.gameState._winnerActionTaken = false;
    io.to(room.id).emit("round_winner", { round: 2, winnerId: winners[0], winnerName: w?.name });
    emitPhaseChange(room, "ROUND_2_WINNER_ACTION", { winnerId: winners[0] });
    startTimer(io, room.id, 20, () => handleWinnerAction(room, winners[0], "keep", null));
  }, 8000);
}

function startRound3(room) {
  const { category, imposterId, clueOrder } = ge.initImposterGuess(room);
  // Snapshot scores at round start
  const lb = getLeaderboard(room.gameLog);
  room.gameState._roundStartScores = {};
  lb.forEach((e) => { room.gameState._roundStartScores[e.playerId] = e.score; });
  emitPhaseChange(room, "RULES_3", {
    rulesText: "Most players share a secret word. One imposter has a different but related word. Give subtle clues. Vote out the imposter.",
  });
  startTimer(io, room.id, 10, () => {
    const ig = room.gameState.imposter;
    room.players.forEach((p) => {
      const word = p.id === imposterId ? ig.imposterWord : ig.normalWord;
      io.to(p.socketId).emit("secret_word", { word, category: ig.category, isImposter: p.id === imposterId });
    });
    emitPhaseChange(room, "ROUND_3_CLUES", { clueOrder, category });
    runImposterClues(room, 0);
  });
}

function finishImposterVoting(room) {
  resolveImposterRound(room);
}

function runImposterClues(room, idx) {
  const ig = room.gameState.imposter;
  if (idx >= ig.clueOrder.length) {
    emitPhaseChange(room, "ROUND_3_DISCUSSION");
    startTimer(io, room.id, 60, () => {
      ig.phase = "voting";
      emitPhaseChange(room, "ROUND_3_VOTING");
      startTimer(io, room.id, 20, () => finishImposterVoting(room));
    });
    return;
  }
  const currentPlayerId = ig.clueOrder[idx];
  io.to(room.id).emit("imposter_clue_turn", { playerId: currentPlayerId });
  startTimer(io, room.id, 15, () => {
    if (!ig.clues.find((c) => c.playerId === currentPlayerId)) {
      ig.clues.push({ playerId: currentPlayerId, clue: "..." });
      io.to(room.id).emit("imposter_clue_submitted", { playerId: currentPlayerId, clue: "..." });
    }
    runImposterClues(room, idx + 1);
  });
}

function resolveImposterRound(room) {
  const prevScores = { ...(room.gameState._roundStartScores || {}) };
  const result = ge.resolveImposterRound(room);
  io.to(room.id).emit("imposter_revealed", {
    imposterId: result.imposterId,
    imposterName: rm.getPlayerById(room, result.imposterId)?.name,
    normalWord: room.gameState.imposter.normalWord,
    imposterWord: room.gameState.imposter.imposterWord,
    votes: result.votes,
  });
  // Use roundWinnerId from gameEngine (score-delta winner), not all-time leaderboard
  const roundWinnerId = result.roundWinnerId;
  const w = rm.getPlayerById(room, roundWinnerId);
  // Build imposter scoreboard metadata
  const lb = getLeaderboard(room.gameLog);
  const winnerScore = lb.find((e) => e.playerId === roundWinnerId)?.score || 0;
  const gain = winnerScore - (prevScores[roundWinnerId] || 0);
  const wasImposter = result.imposterId === roundWinnerId;
  emitRoundScoreboard(room, 3, roundWinnerId, w?.name, { gain, wasImposter });
  setTimeout(() => {
    room.gameState._winnerActionTaken = false;
    // Emit round_winner BEFORE phase_change so client has winner data when UI loads
    io.to(room.id).emit("round_winner", { round: 3, winnerId: roundWinnerId, winnerName: w?.name });
    emitPhaseChange(room, "ROUND_3_WINNER_ACTION", { winnerId: roundWinnerId });
    startTimer(io, room.id, 20, () => handleWinnerAction(room, roundWinnerId, "keep", null));
  }, 8000);
}

function startRound4(room) {
  const questions = ge.initMostLikelyTo(room);
  // Snapshot scores at round start
  const lb = getLeaderboard(room.gameLog);
  room.gameState._roundStartScores = {};
  lb.forEach((e) => { room.gameState._roundStartScores[e.playerId] = e.score; });
  emitPhaseChange(room, "RULES_4", {
    rulesText: "Vote for who fits each question most. The player voted most likely to have the prize on the final question wins.",
  });
  startTimer(io, room.id, 10, () => runMostLikelyQuestion(room, 0));
}

function finishMostLikelyQuestion(room, idx) {
  const mlt = room.gameState.mostLikelyTo;
  const votes = mlt.votes[idx] || {};
  io.to(room.id).emit("most_likely_result", { questionIndex: idx, votes });
  setTimeout(() => runMostLikelyQuestion(room, idx + 1), 2000);
}

function runMostLikelyQuestion(room, idx) {
  const mlt = room.gameState.mostLikelyTo;
  if (idx >= mlt.questions.length) { resolveMostLikelyTo(room); return; }
  emitPhaseChange(room, "ROUND_4_VOTING", { questionIndex: idx, question: mlt.questions[idx] });
  startTimer(io, room.id, 20, () => finishMostLikelyQuestion(room, idx));
}

function resolveMostLikelyTo(room) {
  const winners = ge.getMostLikelyWinner(room);
  if (winners.length === 1) {
    const w = rm.getPlayerById(room, winners[0]);
    // Count votes on final question for win reason
    const mlt = room.gameState.mostLikelyTo;
    const lockedVotes = mlt?.votes?.[mlt.questions.length - 1] || {};
    const voteCount = Object.values(lockedVotes).filter((vid) => vid === winners[0]).length;
    emitRoundScoreboard(room, 4, winners[0], w?.name, { votes: voteCount });
    setTimeout(() => {
      room.gameState._winnerActionTaken = false;
      io.to(room.id).emit("round_winner", { round: 4, winnerId: winners[0], winnerName: w?.name });
      emitPhaseChange(room, "ROUND_4_WINNER_ACTION", { winnerId: winners[0] });
      startTimer(io, room.id, 20, () => handleWinnerAction(room, winners[0], "keep", null));
    }, 8000);
  } else {
    // tie_detected is emitted inside startTiebreak (new system)
    startTiebreak(room, winners, () => resolveMostLikelyTo(room), "ROUND_4_WINNER_ACTION");
  }
}

function finishFinalAccusation(room) {
  const result = ge.resolveFinalAccusation(room);
  io.to(room.id).emit("accusation_result", {
    mostAccusedId: result.mostAccusedId,
    mostAccusedName: rm.getPlayerById(room, result.mostAccusedId)?.name,
    votes: result.votes,
  });
  setTimeout(() => startRound6(room), 4000);
}

function startRound5(room) {
  ge.initFinalAccusation(room);
  emitPhaseChange(room, "RULES_5", {
    rulesText: "One last vote. Who has the prize right now? Most accused picks first in the Position Draft.",
  });
  startTimer(io, room.id, 10, () => {
    emitPhaseChange(room, "ROUND_5_VOTING");
    startTimer(io, room.id, 25, () => finishFinalAccusation(room));
  });
}

function startRound6(room) {
  const { order, slots } = ge.initPositionDraft(room);
  emitPhaseChange(room, "RULES_6", {
    rulesText: "Choose your action position for the final card phase. Choose wisely.",
  });
  startTimer(io, room.id, 10, () => {
    io.to(room.id).emit("draft_order", { order, slots });
    emitPhaseChange(room, "ROUND_6_DRAFT", { order, slots });
    runDraftPick(room, 0);
  });
}

function runDraftPick(room, idx) {
  const d = room.gameState.draft;
  if (idx >= d.order.length) { startRound7(room); return; }
  const pid = d.order[idx];
  io.to(room.id).emit("draft_your_turn", { playerId: pid });
  startTimer(io, room.id, 15, () => {
    if (!d.picks[pid]) {
      const result = ge.autoAssignDraftSlot(room);
      if (result) io.to(room.id).emit("draft_auto_assigned", result);
    }
    runDraftPick(room, idx + 1);
  });
}

function startRound7(room) {
  const { assignments, actionOrder } = ge.initCardPhase(room);
  emitPhaseChange(room, "RULES_7", {
    rulesText: "You've been dealt a secret card. Everyone must use theirs. Actions happen in draft order.",
  });
  startTimer(io, room.id, 10, () => {
    room.players.forEach((p) => {
      io.to(p.socketId).emit("card_assigned", { card: assignments[p.id] });
    });
    emitPhaseChange(room, "ROUND_7_ACTING", { actionOrder });
    io.to(room.id).emit("card_action_turn", { playerId: actionOrder[0] });
    // Start 30s timeout for first player's action
    startTimer(io, room.id, 30, () => advanceCardPhase(room));
  });
}

function advanceCardPhase(room) {
  const cp = room.gameState.cardPhase;
  clearTimer(room.id); // Clear any running per-action timeout
  ge.advanceCardPhaseAction(cp);
  if (cp.currentActionIdx >= cp.actionOrder.length) {
    startFinalReveal(room);
  } else {
    const nextPid = cp.actionOrder[cp.currentActionIdx];
    setTimeout(() => {
      io.to(room.id).emit("card_action_turn", { playerId: nextPid });
      // Auto-skip if player doesn't act within 30s
      startTimer(io, room.id, 30, () => advanceCardPhase(room));
    }, 2000);
  }
}

function startFinalReveal(room) {
  room.phase = "REVEAL";
  const { reveals, badges, gameLog } = ge.buildFinalReveal(room);
  // NOTE: game_state_log is NOT sent here — it contains full prize history.
  // It is sent only after the reveal animation finishes (when FinalReveal emits phase RECAP).
  // Store gameLog on room so it can be sent on demand.
  room._pendingGameLog = gameLog;
  io.to(room.id).emit("final_reveal", { reveals, badges });
  emitPhaseChange(room, "FINAL_REVEAL", { reveals, badges });
}

// ── WINNER ACTION HANDLER ─────────────────────────────────────────────────────

function handleWinnerAction(room, winnerId, choice, targetId) {
  // Double-fire guard — prevents winner clicking twice or timeout+click race
  if (room.gameState._winnerActionTaken) return;
  room.gameState._winnerActionTaken = true;
  clearTimer(room.id); // Cancel the auto-keep timeout

  const round = room.gameState.round;

  if (choice === "swap" && targetId) {
    ge.executeSwap(room, winnerId, targetId);
    const a = rm.getPlayerById(room, winnerId);
    const b = rm.getPlayerById(room, targetId);
    io.to(room.id).emit("swap_executed", {
      playerA: { id: a.id, name: a.name, boxNumber: a.boxNumber },
      playerB: { id: b.id, name: b.name, boxNumber: b.boxNumber },
    });
    // Seal both players after winner-action swap
    sealPlayers(room, winnerId, targetId);
    // Feature 3: Swap notification banner (bug-proof 3: NOT emitted for card-phase swaps)
    io.to(room.id).emit("swap_notification", {
      type: "swap",
      playerA: a.name,
      playerB: b.name,
      boxA: a.boxNumber,
      boxB: b.boxNumber,
    });
    // Bug-proof 6: next round starts after full banner display time (4s)
    setTimeout(() => {
      if (round === 1) startRound2(room);
      else if (round === 2) startRound3(room);
      else if (round === 3) startRound4(room);
      else if (round === 4) startRound5(room);
    }, 4000);
  } else {
    const w = rm.getPlayerById(room, winnerId);
    io.to(room.id).emit("keep_broadcast", { playerName: w?.name });
    logEvent(room.gameLog, "keep", round, { playerId: winnerId });
    // Feature 3: Keep notification banner
    io.to(room.id).emit("swap_notification", {
      type: "keep",
      keepPlayer: w?.name,
    });
    // Bug-proof 6: next round starts after banner display time (3s)
    setTimeout(() => {
      if (round === 1) startRound2(room);
      else if (round === 2) startRound3(room);
      else if (round === 3) startRound4(room);
      else if (round === 4) startRound5(room);
    }, 3000);
  }
}

// ── SOCKET EVENTS ─────────────────────────────────────────────────────────────

io.on("connection", (socket) => {

  socket.on("create_room", ({ displayName }) => {
    const room = rm.createRoom(socket.id, displayName);
    socket.join(room.id);
    socket.emit("room_created", { roomCode: room.id, playerId: socket.id });
    broadcastRoomState(room);
  });

  socket.on("join_room", ({ roomCode, displayName }) => {
    // Check for reconnect first
    const existingRoom = rm.getRoom(roomCode);
    if (existingRoom && existingRoom.phase !== "LOBBY") {
      const reconnected = rm.reconnectPlayer(existingRoom, socket.id, displayName);
      if (reconnected) {
        socket.join(existingRoom.id);
        clearTimeout(existingRoom.disconnectTimers.get(reconnected.id));
        existingRoom.disconnectTimers.delete(reconnected.id);
        socket.emit("reconnected", { roomCode: existingRoom.id, playerId: reconnected.id, gameState: rm.getPublicRoomState(existingRoom) });
        // Bug-proof 1: re-send current box assignment so box strip shows correct number immediately
        // Do NOT include hasPrize — player is already sealed at this point
        if (reconnected.boxNumber !== null && reconnected.boxNumber !== undefined) {
          socket.emit("box_assigned", { myBox: reconnected.boxNumber });
          // Re-seal immediately if they were already sealed before disconnect
          if (existingRoom.gameState?.sealedBoxes?.has(reconnected.id)) {
            socket.emit("box_sealed");
          }
        }
        broadcastRoomState(existingRoom);
        return;
      }
    }
    const result = rm.joinRoom(roomCode, socket.id, displayName);
    if (result.error) { socket.emit("join_error", { message: result.error }); return; }
    socket.join(result.room.id);
    socket.emit("room_joined", { roomCode: result.room.id, playerId: socket.id });
    broadcastRoomState(result.room);
  });

  socket.on("start_game", () => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || room.hostId !== socket.id) return;
    if (room.players.length < 3) { socket.emit("start_error", { message: "Need at least 3 players" }); return; }
    const prizeBox = ge.assignBoxes(room);
    emitPhaseChange(room, "BOX_ASSIGNMENT");
    // Send each player their box + hasPrize (visible for 5s only before box_sealed fires)
    room.players.forEach((p) => {
      io.to(p.socketId).emit("box_assigned", {
        myBox: p.boxNumber,
        hasPrize: p.boxNumber === room.gameState.prizeBox,
      });
      // Seal each player's box after 5-second reveal window
      setTimeout(() => {
        if (!room.gameState?.sealedBoxes) return;
        sealPlayers(room, p.id);
      }, 5000);
    });
    io.to(room.id).emit("all_boxes", { players: rm.getPublicRoomState(room).players });
    setTimeout(() => startStartingSwap(room), 3000);
  });

  function startStartingSwap(room) {
    emitPhaseChange(room, "STARTING_SWAP");
    room.gameState.phase = "STARTING_SWAP";
    startTimer(io, room.id, 18, () => {
      room.gameState.pendingSwaps.clear();
      // Feature 3: emit no_swap banner if no swaps happened during starting phase
      // (If swaps happened they already emitted swap_notification individually)
      io.to(room.id).emit("swap_notification", { type: "no_swap" });
      setTimeout(() => startRound1(room), 2000);
    });
  }

  socket.on("swap_request", ({ to }) => {
    const { room } = getRoomAndPlayer(socket);
    if (!room) return;
    ge.handleSwapRequest(io, room, socket, to);
  });

  socket.on("swap_response", ({ accepted }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return;
    // Find the requester before the swap executes so we can reference names
    const gs = room.gameState;
    let requesterId = null;
    for (const [rId, req] of gs.pendingSwaps.entries()) {
      if (req.to === player.id) { requesterId = rId; break; }
    }
    ge.handleSwapResponse(io, room, socket, accepted);
    // Feature 3 / starting swap: emit swap_notification for accepted swaps
    if (accepted && requesterId) {
      const reqPlayer = room.players.find((p) => p.id === requesterId);
      io.to(room.id).emit("swap_notification", {
        type: "swap",
        playerA: reqPlayer?.name || "A player",
        playerB: player.name,
        boxA: reqPlayer?.boxNumber,
        boxB: player.boxNumber,
      });
      // Fix 1: Give both players 3 s to memorise their new box number before sealing.
      // swap_preview carries the new box number + countdown duration for the client UI.
      // Only Starting Swap uses this delay — winner-action & card-phase seal instantly.
      const reqSock = reqPlayer?.socketId;
      const respSock = player?.socketId;
      if (reqSock)  io.to(reqSock).emit("swap_preview",  { newBox: reqPlayer?.boxNumber, sealInMs: 3000 });
      if (respSock) io.to(respSock).emit("swap_preview", { newBox: player?.boxNumber,   sealInMs: 3000 });
      setTimeout(() => {
        if (room.gameState?.sealedBoxes) sealPlayers(room, requesterId, player.id);
      }, 3000);
    }
  });

  socket.on("hot_take_answer", ({ questionIndex, answer }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return;
    const ok = ge.submitHotTakeAnswer(room, player.id, questionIndex, answer);
    if (ok) {
      const ht = room.gameState.hotTake;
      const answered = Object.keys(ht.answers[questionIndex] || {}).length;
      if (answered >= room.players.length) {
        clearTimer(room.id);
        transitionHotTakeToVoting(room, questionIndex);
      }
    }
  });

  socket.on("hot_take_vote", ({ questionIndex, votedPlayerId }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return;
    const ok = ge.submitHotTakeVote(room, player.id, questionIndex, votedPlayerId);
    if (ok) {
      const votes = room.gameState.hotTake.votes[questionIndex] || {};
      if (Object.keys(votes).length >= room.players.length) {
        clearTimer(room.id);
        advanceHotTakeVote(room, questionIndex);
      }
    }
  });

  socket.on("keep_choice", () => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return;
    handleWinnerAction(room, player.id, "keep", null);
  });

  socket.on("swap_choice", ({ targetPlayer }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return;
    handleWinnerAction(room, player.id, "swap", targetPlayer);
  });

  socket.on("reaction_answer", ({ promptIndex, answerIndex }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return;
    ge.submitReactionAnswer(room, player.id, promptIndex, answerIndex);
  });

  socket.on("imposter_clue", ({ clue }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return;
    const ig = room.gameState.imposter;
    if (!ig || ig.clueOrder[ig.currentClueIndex] !== player.id) return;
    ge.submitImposterClue(room, player.id, clue);
    io.to(room.id).emit("imposter_clue_submitted", { playerId: player.id, clue });
    clearTimer(room.id);
    runImposterClues(room, ig.currentClueIndex);
  });

  socket.on("imposter_vote", ({ votedPlayer }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return;
    const ok = ge.submitImposterVote(room, player.id, votedPlayer);
    if (ok) {
      const votes = room.gameState.imposter.votes || {};
      if (Object.keys(votes).length >= room.players.length) {
        clearTimer(room.id);
        finishImposterVoting(room);
      }
    }
  });

  socket.on("most_likely_vote", ({ questionIndex, votedPlayer }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return;
    const ok = ge.submitMostLikelyVote(room, player.id, questionIndex, votedPlayer);
    if (ok) {
      const votes = room.gameState.mostLikelyTo.votes[questionIndex] || {};
      if (Object.keys(votes).length >= room.players.length) {
        clearTimer(room.id);
        finishMostLikelyQuestion(room, questionIndex);
      }
    }
  });

  socket.on("final_accusation_vote", ({ accusedId }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return;
    const ok = ge.submitFinalAccusation(room, player.id, accusedId);
    if (ok) {
      const votes = room.gameState.finalAccusation.votes || {};
      if (Object.keys(votes).length >= room.players.length) {
        clearTimer(room.id);
        finishFinalAccusation(room);
      }
    }
  });

  socket.on("draft_pick", ({ slot }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return;
    const ok = ge.submitDraftPick(room, player.id, slot);
    if (ok) {
      io.to(room.id).emit("draft_slot_taken", { playerId: player.id, slot, remaining: room.gameState.draft.slots });
      clearTimer(room.id);
      runDraftPick(room, room.gameState.draft.currentIdx);
    }
  });

  socket.on("blind_swap_played", ({ targetPlayer }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return;
    const result = ge.handleBlindSwap(io, room, player.id, targetPlayer);
    if (result.ok || result.blocked) advanceCardPhase(room);
  });

  socket.on("view_request", ({ targetBox }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return;
    const target = room.players.find((p) => p.boxNumber === targetBox);
    if (!target) return;
    ge.handleViewCard(io, room, player.id, target.id);
    advanceCardPhase(room);
  });

  socket.on("see_swap_played", ({ targetPlayer, swapDecision }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return;
    const cp = room.gameState.cardPhase;
    if (!cp.pendingSeeSwap) {
      // First call: view the target
      ge.handleViewCard(io, room, player.id, targetPlayer, true);
    } else if (cp.pendingSeeSwap.viewed === true) {
      // Second call: make decision — only valid after view completed
      ge.handleSeeSwapDecision(io, room, player.id, swapDecision);
      advanceCardPhase(room);
    }
    // Duplicate first-call attempts are ignored (pendingSeeSwap exists but viewed not yet true)
  });

  socket.on("block_played", ({ targetPlayer }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return;
    ge.handleBlockCard(io, room, player.id, targetPlayer);
    advanceCardPhase(room);
  });

  socket.on("tiebreak_answer", ({ answer }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player || !room.gameState?._tiebreak) return;
    const tb = room.gameState._tiebreak;
    if (!tb.activeTied?.includes(player.id)) return;
    if (tb.firstAnswers[player.id] !== undefined) return; // already answered

    if (answer.trim().toUpperCase() === tb.word) {
      tb.firstAnswers[player.id] = Date.now(); // server-authoritative time

      const isFirst = Object.keys(tb.firstAnswers).length === 1;

      // On first correct answer, open a 50ms window for simultaneous submissions
      if (isFirst && !tb.resolveTimer) {
        tb.resolveTimer = setTimeout(() => {
          if (!room.gameState?._tiebreak) return;
          const snap = room.gameState._tiebreak;
          room.gameState._tiebreak = null;
          clearTimer(room.id);
          resolveTiebreakerAnswers(room, snap);
        }, 50);
      }

      // If every active tied player has answered, resolve immediately
      const allIn = tb.activeTied.every((id) => tb.firstAnswers[id] !== undefined);
      if (allIn) {
        if (tb.resolveTimer) { clearTimeout(tb.resolveTimer); tb.resolveTimer = null; }
        if (!room.gameState?._tiebreak) return;
        const snap = { ...room.gameState._tiebreak };
        room.gameState._tiebreak = null;
        clearTimer(room.id);
        resolveTiebreakerAnswers(room, snap);
      }
    }
  });

  socket.on("disconnect_vote", ({ choice }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player || !room.gameState) return;
    room.gameState.disconnectVotes.set(player.id, choice);
    const connected = room.players.filter((p) => p.connected && p.id !== player.id);
    const votes = [...room.gameState.disconnectVotes.values()];
    if (votes.length >= connected.length) {
      const continueCount = votes.filter((v) => v === "continue").length;
      const result = continueCount >= Math.ceil(votes.length / 2) ? "continue" : "collapse";
      io.to(room.id).emit("disconnect_vote_result", { result });
      if (result === "collapse") {
        emitPhaseChange(room, "LOBBY");
        room.gameState = null;
      }
      room.gameState && (room.gameState.disconnectVotes = new Map());
    }
  });

  socket.on("rematch_vote", ({ choice }) => {
    const { room, player } = getRoomAndPlayer(socket);
    if (!room || !player) return;
    if (!room._rematchVotes) room._rematchVotes = {};
    room._rematchVotes[player.id] = choice;
    const yesCount = Object.values(room._rematchVotes).filter(Boolean).length;
    if (yesCount > room.players.length / 2) {
      room._rematchVotes = {};
      room.players.forEach((p) => { p.boxNumber = null; p.connected = true; });
      room.phase = "LOBBY";
      room.gameState = null;
      room.gameLog = null;
      broadcastRoomState(room);
      emitPhaseChange(room, "LOBBY");
    }
  });


  // ── RECAP UNLOCK — release game_state_log only AFTER reveal animation ends ──
  socket.on("recap_ready", () => {
    const { room } = getRoomAndPlayer(socket);
    if (!room || !room._pendingGameLog) return;
    // Send full game log (prizeBox, all historical box states) only now reveal is done
    io.to(room.id).emit("game_state_log", room._pendingGameLog);
    room._pendingGameLog = null;
  });

  // ── DISCONNECT ──────────────────────────────────────────────────────────────


  socket.on("disconnect", () => {
    const room = rm.getRoomBySocketId(socket.id);
    if (!room) return;
    const player = rm.getPlayer(room, socket.id);
    if (!player) return;
    player.connected = false;

    if (room.phase === "LOBBY") {
      rm.removePlayerFromRoom(room, socket.id);
      if (room.players.length === 0) { rm.deleteRoom(room.id); return; }
      if (room.hostId === socket.id) rm.promoteNextHost(room);
      broadcastRoomState(room);
      return;
    }

    io.to(room.id).emit("disconnect_notice", { playerName: player.name, timeoutSeconds: 60 });
    if (room.hostId === socket.id) {
      const newHost = rm.promoteNextHost(room);
      if (newHost) io.to(room.id).emit("host_changed", { newHostId: newHost.id, newHostName: newHost.name });
    }

    const timer = setTimeout(() => {
      room.gameState?.disconnectVotes?.clear();
      io.to(room.id).emit("disconnect_vote_needed", { playerName: player.name });
    }, 60000);
    room.disconnectTimers.set(player.id, timer);
  });
});

app.get("/health", (_, res) => res.json({ ok: true }));

server.listen(PORT, () => console.log(`MysteryBox server running on port ${PORT}`));
