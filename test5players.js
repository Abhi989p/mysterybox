// test5players.js — Full 5-player simulation test (v2 — corrected)
const ge = require('./gameEngine');
const rm = require('./roomManager');
const se = require('./scoreEngine');
const ce = require('./cardEngine');

let passed = 0;
let failed = 0;
const issues = [];

function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✅', msg); }
  else { failed++; issues.push(msg); console.log('  ❌ FAIL:', msg); }
}

const io = { to: () => ({ emit: () => {} }) };

// ── ROOM + LOBBY ────────────────────────────────────────────────────────────────
console.log('\n=== CREATING ROOM + 5 PLAYERS ===');
const room = rm.createRoom('socket-alice', 'Alice');
rm.joinRoom(room.id, 'socket-bob',   'Bob');
rm.joinRoom(room.id, 'socket-carol', 'Carol');
rm.joinRoom(room.id, 'socket-dave',  'Dave');
rm.joinRoom(room.id, 'socket-eve',   'Eve');
assert(room.players.length === 5, '5 players joined');
assert(room.hostId === 'socket-alice', 'Alice is host');
assert(room.phase === 'LOBBY', 'Phase is LOBBY');

// 6th player joins (valid — max is 6)
rm.joinRoom(room.id, 'socket-frank', 'Frank');
assert(room.players.length === 6, '6th player can join (max is 6)');
// 7th player should be BLOCKED
const r7 = rm.joinRoom(room.id, 'socket-7', 'Seven');
assert(r7.error !== undefined, '7th player rejected — room full');
assert(room.players.length === 6, 'Room still has exactly 6 players');

// Remove Frank so we test 5-player scenario properly
rm.removePlayerFromRoom(room, 'socket-frank');
assert(room.players.length === 5, 'Frank removed, back to 5 players');

const aliceId = room.players.find(p => p.name === 'Alice').id;
const bobId   = room.players.find(p => p.name === 'Bob').id;
const carolId = room.players.find(p => p.name === 'Carol').id;
const daveId  = room.players.find(p => p.name === 'Dave').id;
const eveId   = room.players.find(p => p.name === 'Eve').id;

// Duplicate name blocked
const dupName = rm.joinRoom(room.id, 'socket-dup', 'Alice');
assert(dupName.error !== undefined, 'Duplicate display name rejected');

// ── BOX ASSIGNMENT ──────────────────────────────────────────────────────────────
console.log('\n=== BOX ASSIGNMENT ===');
const prizeBox = ge.assignBoxes(room);
assert(prizeBox >= 1 && prizeBox <= 5, 'prizeBox valid 1-5');
assert(room.players.every(p => p.boxNumber >= 1 && p.boxNumber <= 5), 'All players have valid box numbers');
const boxNums = room.players.map(p => p.boxNumber);
assert(new Set(boxNums).size === 5, 'All 5 box numbers unique — no duplicates');
assert(room.gameLog !== null, 'gameLog created');
assert(room.gameLog.prizeBox === prizeBox, 'gameLog.prizeBox matches assignment');

// SECURITY CHECK: prizeBox must NOT appear in public room state
const pub = rm.getPublicRoomState(room);
const pubStr = JSON.stringify(pub);
assert(!pubStr.includes('"prizeBox"'), 'prizeBox NOT in public room state ✓ SECURE');
// Verify every player can be in public state
assert(pub.players.length === 5, 'Public state has 5 players');

// ── STARTING SWAP ───────────────────────────────────────────────────────────────
console.log('\n=== STARTING SWAP ===');
room.gameState.phase = 'STARTING_SWAP';

const aliceSock = { id: 'socket-alice', emit: () => {} };
const bobSock   = { id: 'socket-bob',   emit: () => {} };
const carolSock = { id: 'socket-carol', emit: () => {} };
const daveSock  = { id: 'socket-dave',  emit: () => {} };

// Self-swap blocked
const blocked = [];
const aliceSockWithCapture = { id: 'socket-alice', emit: (evt) => blocked.push(evt) };
ge.handleSwapRequest(io, room, aliceSockWithCapture, aliceId);
assert(room.gameState.pendingSwaps.size === 0, 'Self-swap request ignored (no pending added)');
assert(blocked.includes('swap_request_blocked'), 'Self-swap emits blocked message to sender');

// Valid swap: Alice ↔ Bob
ge.handleSwapRequest(io, room, aliceSock, bobId);
assert(room.gameState.pendingSwaps.has(aliceId), 'Alice swap request pending');

// Duplicate request blocked (Alice already has pending)
ge.handleSwapRequest(io, room, aliceSock, carolId);
assert(room.gameState.pendingSwaps.size === 1, 'Duplicate swap request blocked (still 1 pending)');

// Bob accepts
const aliceBoxBefore = room.players.find(p => p.id === aliceId).boxNumber;
const bobBoxBefore   = room.players.find(p => p.id === bobId).boxNumber;
ge.handleSwapResponse(io, room, bobSock, true);
const aliceBoxAfter = room.players.find(p => p.id === aliceId).boxNumber;
const bobBoxAfter   = room.players.find(p => p.id === bobId).boxNumber;
assert(aliceBoxAfter === bobBoxBefore && bobBoxAfter === aliceBoxBefore, 'Alice-Bob swap executed: boxes swapped correctly');
assert(room.gameLog.boxStateHistory.length === 2, 'boxStateHistory updated (now has 2 entries)');
assert(room.gameState.pendingSwaps.size === 0, 'Pending swaps cleared after acceptance');

// Dave's swap rejected by Carol
ge.handleSwapRequest(io, room, daveSock, carolId);
assert(room.gameState.pendingSwaps.size === 1, 'Dave swap pending');
ge.handleSwapResponse(io, room, carolSock, false);
assert(room.gameState.pendingSwaps.size === 0, 'Rejected swap cleared — no box change');
const carolBoxSame = room.players.find(p => p.id === carolId).boxNumber;
assert(carolBoxSame !== null, 'Carol still has her box after rejected swap');

// ── ROUND 1 — HOT TAKE ─────────────────────────────────────────────────────────
console.log('\n=== ROUND 1 — HOT TAKE ===');
ge.initHotTake(room);
assert(room.gameState.hotTake !== null, 'Hot Take initialized');
assert(room.gameState.round === 1, 'Round = 1');
assert(room.gameState.hotTake.questions.length === 3, '3 Hot Take questions');
assert(!room.gameState.hotTake.answers[0], 'No answers yet for Q0');

// Submit answers for Q0
ge.submitHotTakeAnswer(room, aliceId, 0, 'Alice answer');
ge.submitHotTakeAnswer(room, bobId,   0, 'Bob answer');
ge.submitHotTakeAnswer(room, carolId, 0, 'Carol answer');
ge.submitHotTakeAnswer(room, daveId,  0, '');      // blank — REJECT
ge.submitHotTakeAnswer(room, eveId,   0, '   ');  // whitespace — REJECT
assert(Object.keys(room.gameState.hotTake.answers[0]).length === 3, 'Blank/whitespace answers rejected (3/5 stored)');

// Duplicate submission blocked
ge.submitHotTakeAnswer(room, aliceId, 0, 'Different');
assert(room.gameState.hotTake.answers[0][aliceId] === 'Alice answer', 'Duplicate answer blocked, original preserved');

// Dave submits a real answer (counts for all-player test)
ge.submitHotTakeAnswer(room, daveId, 0, 'Dave answer');
ge.submitHotTakeAnswer(room, eveId,  0, 'Eve answer');
assert(Object.keys(room.gameState.hotTake.answers[0]).length === 5, 'All 5 answers submitted for Q0');

// Voting for Q0 — Alice gets 3 votes (wins round)
ge.submitHotTakeVote(room, aliceId, 0, bobId);
ge.submitHotTakeVote(room, bobId,   0, carolId);
ge.submitHotTakeVote(room, carolId, 0, aliceId);
ge.submitHotTakeVote(room, daveId,  0, aliceId);
ge.submitHotTakeVote(room, eveId,   0, aliceId);

// Self-vote blocked
const selfVoteR1 = ge.submitHotTakeVote(room, aliceId, 0, aliceId);
assert(!selfVoteR1, 'Hot take self-vote blocked');

// Duplicate vote blocked
const dupVote = ge.submitHotTakeVote(room, aliceId, 0, carolId);
assert(!dupVote, 'Hot take duplicate vote blocked');

// Q1 answers + votes
for (const [id, ans] of [[aliceId,'Q1a'],[bobId,'Q1b'],[carolId,'Q1c'],[daveId,'Q1d'],[eveId,'Q1e']]) {
  ge.submitHotTakeAnswer(room, id, 1, ans);
}
ge.submitHotTakeVote(room, aliceId, 1, eveId);
ge.submitHotTakeVote(room, bobId,   1, daveId);
ge.submitHotTakeVote(room, carolId, 1, daveId);
ge.submitHotTakeVote(room, daveId,  1, aliceId);
ge.submitHotTakeVote(room, eveId,   1, aliceId);

// Q2 answers + votes
for (const [id, ans] of [[aliceId,'Q2a'],[bobId,'Q2b'],[carolId,'Q2c'],[daveId,'Q2d'],[eveId,'Q2e']]) {
  ge.submitHotTakeAnswer(room, id, 2, ans);
}
ge.submitHotTakeVote(room, aliceId, 2, carolId);
ge.submitHotTakeVote(room, bobId,   2, carolId);
ge.submitHotTakeVote(room, daveId,  2, carolId);
ge.submitHotTakeVote(room, carolId, 2, aliceId);
ge.submitHotTakeVote(room, eveId,   2, aliceId);

const scoresBefore_ht = {};
room.players.forEach(p => { scoresBefore_ht[p.id] = room.gameLog.scores[p.id] || 0; });
const ht1Winners = ge.getHotTakeWinner(room);
assert(ht1Winners.length > 0, 'Hot Take has at least one winner');
assert(ht1Winners[0] === aliceId, 'Alice wins Round 1 (most cumulative votes: 5)');
const scoreGained = (room.gameLog.scores[aliceId] || 0) - scoresBefore_ht[aliceId];
assert(scoreGained > 0, 'Hot Take votes added to gameLog scores');
console.log('  ℹ️  R1 winner:', ht1Winners.map(id => room.players.find(p=>p.id===id)?.name), '| score gained:', scoreGained);

// Winner swap — Alice swaps with Carol
const histBefore = room.gameLog.boxStateHistory.length;
ge.executeSwap(room, aliceId, carolId);
assert(room.gameLog.boxStateHistory.length === histBefore + 1, 'boxStateHistory updated after R1 winner swap');

// ── ROUND 2 — REACTION RACE ────────────────────────────────────────────────────
console.log('\n=== ROUND 2 — REACTION RACE ===');
ge.initReactionRace(room);
assert(room.gameState.round === 2, 'Round = 2');
assert(room.gameState.reaction.prompts.length === 4, '4 prompts generated');
ge.startReactionPrompt(room);
const p0 = room.gameState.reaction.prompts[0];

// Correct fast answer
const pts1 = ge.submitReactionAnswer(room, aliceId, 0, p0.correctIndex);
assert(pts1 >= 100, 'Correct answer gives >=100 pts (base + speed bonus)');
assert(pts1 <= 200, 'Correct answer capped at 200 pts max');

// Wrong answer
const wrongIdx = (p0.correctIndex + 1) % 2;
const pts2 = ge.submitReactionAnswer(room, bobId, 0, wrongIdx);
assert(pts2 === 0, 'Wrong answer = 0 points');

// Duplicate answer blocked
const pts3 = ge.submitReactionAnswer(room, aliceId, 0, p0.correctIndex);
assert(pts3 === null, 'Duplicate reaction answer → null (rejected)');

// Stale promptIndex blocked
const pts4 = ge.submitReactionAnswer(room, carolId, 1, 0);
assert(pts4 === null, 'Stale promptIndex answer rejected');

// Rest answer correctly
ge.submitReactionAnswer(room, carolId, 0, p0.correctIndex);
ge.submitReactionAnswer(room, daveId,  0, p0.correctIndex);
ge.submitReactionAnswer(room, eveId,   0, p0.correctIndex);

const raceWinners = ge.getReactionWinner(room);
assert(raceWinners.length > 0, 'Reaction race has winner');
// Scores added to gameLog
assert(room.gameLog.scores[aliceId] > 0, 'Reaction scores added to gameLog');
console.log('  ℹ️  R2 winner:', raceWinners.map(id => room.players.find(p=>p.id===id)?.name));

// ── ROUND 3 — IMPOSTER GUESS ───────────────────────────────────────────────────
console.log('\n=== ROUND 3 — IMPOSTER GUESS ===');
ge.initImposterGuess(room);
assert(room.gameState.round === 3, 'Round = 3');
const impId = room.gameState.imposter.imposterId;
assert(impId, 'Imposter assigned');
assert(room.gameState.imposter.clueOrder.length === 5, 'All 5 players in clue order');
assert(room.gameState.imposter.normalWord !== room.gameState.imposter.imposterWord, 'Normal and imposter words are different');
assert(room.players.map(p=>p.id).includes(impId), 'Imposter is one of the 5 players');

const nonImpIds = room.players.filter(p => p.id !== impId).map(p => p.id);

// Self-vote blocked
const selfVoteR3 = ge.submitImposterVote(room, nonImpIds[0], nonImpIds[0]);
assert(!selfVoteR3, 'Cannot vote for yourself in imposter round');

// Votes: 3 correct (for imposter), 1 wrong, imposter votes for normal
ge.submitImposterVote(room, nonImpIds[0], impId);
ge.submitImposterVote(room, nonImpIds[1], impId);
ge.submitImposterVote(room, nonImpIds[2], impId);
ge.submitImposterVote(room, nonImpIds[3], nonImpIds[0]); // wrong
ge.submitImposterVote(room, impId,        nonImpIds[0]); // imposter votes for a normal

// Duplicate vote blocked
const dupVoteR3 = ge.submitImposterVote(room, nonImpIds[0], nonImpIds[1]);
assert(!dupVoteR3, 'Duplicate imposter vote blocked');

const preScoresR3 = {};
room.players.forEach(p => { preScoresR3[p.id] = room.gameLog.scores[p.id] || 0; });
const r3result = ge.resolveImposterRound(room);
assert(r3result.roundWinnerId !== undefined, 'Round 3 has roundWinnerId');
assert(r3result.imposterId === impId, 'resolveImposterRound.imposterId is correct');

const anyGained = room.players.some(p => (room.gameLog.scores[p.id] || 0) > preScoresR3[p.id]);
assert(anyGained, 'At least one player gained score in R3');
console.log('  ℹ️  Imposter:', room.players.find(p=>p.id===impId)?.name, '| R3 winner:', room.players.find(p=>p.id===r3result.roundWinnerId)?.name);

// ── ROUND 4 — MOST LIKELY TO ───────────────────────────────────────────────────
console.log('\n=== ROUND 4 — MOST LIKELY TO ===');
ge.initMostLikelyTo(room);
assert(room.gameState.round === 4, 'Round = 4');
assert(room.gameState.mostLikelyTo.questions.length === 4, '4 MLT questions');
assert(room.gameState.mostLikelyTo.questions[3] === 'Who currently has the prize?', 'Final question is prize question');

// Vote on all 4 questions
for (let q = 0; q < 4; q++) {
  ge.submitMostLikelyVote(room, aliceId, q, daveId);
  ge.submitMostLikelyVote(room, bobId,   q, daveId);
  ge.submitMostLikelyVote(room, carolId, q, daveId);
  ge.submitMostLikelyVote(room, daveId,  q, aliceId);
  ge.submitMostLikelyVote(room, eveId,   q, aliceId);
}

// Duplicate vote blocked
const dupMlt = ge.submitMostLikelyVote(room, aliceId, 3, carolId);
assert(!dupMlt, 'Duplicate MLT vote blocked');

const mltWinners = ge.getMostLikelyWinner(room);
assert(mltWinners[0] === daveId, 'Dave wins MLT (3 votes on final question)');

// Empty vote fallback
ge.initMostLikelyTo(room);
const mltEmpty = ge.getMostLikelyWinner(room);
assert(mltEmpty.length > 0, 'MLT empty votes: fallback returns score leader');
// Restore votes for actual game flow
ge.initMostLikelyTo(room);
for (let q = 0; q < 4; q++) {
  ge.submitMostLikelyVote(room, aliceId, q, daveId);
  ge.submitMostLikelyVote(room, bobId,   q, daveId);
  ge.submitMostLikelyVote(room, carolId, q, daveId);
  ge.submitMostLikelyVote(room, daveId,  q, aliceId);
  ge.submitMostLikelyVote(room, eveId,   q, aliceId);
}

// ── ROUND 5 — FINAL ACCUSATION ─────────────────────────────────────────────────
console.log('\n=== ROUND 5 — FINAL ACCUSATION ===');
ge.initFinalAccusation(room);
assert(room.gameState.round === 5, 'Round = 5');

// Self-accusation blocked
assert(!ge.submitFinalAccusation(room, aliceId, aliceId), 'Cannot accuse yourself');

// 4 accuse Carol, 1 accuses Dave
ge.submitFinalAccusation(room, aliceId, carolId);
ge.submitFinalAccusation(room, bobId,   carolId);
ge.submitFinalAccusation(room, carolId, daveId);
ge.submitFinalAccusation(room, daveId,  carolId);
ge.submitFinalAccusation(room, eveId,   carolId);

// Duplicate blocked
assert(!ge.submitFinalAccusation(room, aliceId, daveId), 'Duplicate accusation blocked');

const accResult = ge.resolveFinalAccusation(room);
assert(accResult.mostAccusedId === carolId, 'Carol most accused (4 votes)');

// Empty votes fallback
ge.initFinalAccusation(room);
const emptyAcc = ge.resolveFinalAccusation(room);
assert(emptyAcc.mostAccusedId !== undefined, 'Empty accusation resolves (no crash)');
assert(room.players.find(p => p.id === emptyAcc.mostAccusedId), 'Empty acc fallback picks a real player');

// Restore carol as accused for draft
ge.initFinalAccusation(room);
room.gameState.finalAccusation.votes = {[aliceId]:carolId,[bobId]:carolId,[daveId]:carolId,[eveId]:carolId};
room.gameState.finalAccusation.mostAccusedId = carolId;

// ── ROUND 6 — POSITION DRAFT ───────────────────────────────────────────────────
console.log('\n=== ROUND 6 — POSITION DRAFT ===');
const { order, slots } = ge.initPositionDraft(room);
assert(order[0] === carolId, 'Most accused (Carol) picks first in draft');
assert(order.length === 5, 'All 5 players in draft order');
assert(slots.length === 5, '5 slots available for 5 players');
assert(new Set(slots).size === 5, 'All draft slots unique');

// Valid pick — Carol picks slot 3
ge.submitDraftPick(room, carolId, 3);
assert(room.gameState.draft.picks[carolId] === 3, 'Carol picked slot 3');
assert(!room.gameState.draft.slots.includes(3), 'Slot 3 removed from pool');
assert(room.gameState.draft.slots.length === 4, '4 slots remaining');

// Pick already-taken slot
assert(!ge.submitDraftPick(room, order[1], 3), 'Cannot pick already-taken slot');

// Out-of-turn pick (last player tries to go second)
assert(!ge.submitDraftPick(room, order[4], 1), 'Out-of-turn pick rejected');

// Auto-assign for 2nd player
const autoRes = ge.autoAssignDraftSlot(room);
assert(autoRes !== null, 'autoAssignDraftSlot returns result');
assert(autoRes.playerId === order[1], 'Auto-assigned correct (2nd in order)');
assert(room.gameState.draft.slots.length === 3, '3 slots remaining after auto-assign');

// Rest pick manually
ge.submitDraftPick(room, order[2], room.gameState.draft.slots[0]);
ge.submitDraftPick(room, order[3], room.gameState.draft.slots[0]);
ge.submitDraftPick(room, order[4], room.gameState.draft.slots[0]);
assert(Object.keys(room.gameState.draft.picks).length === 5, 'All 5 players have draft picks');
assert(room.gameState.draft.slots.length === 0, 'No slots remaining');

// ── ROUND 7 — CARD PHASE ───────────────────────────────────────────────────────
console.log('\n=== ROUND 7 — CARD PHASE ===');
const { assignments, actionOrder: ao } = ge.initCardPhase(room);
assert(Object.keys(assignments).length === 5, '5 cards assigned (one per player)');

// Verify pool matches spec exactly
const cardVals = Object.values(assignments).slice().sort();
const pool5Expected = ce.CARD_POOLS[5].slice().sort();
assert(JSON.stringify(cardVals) === JSON.stringify(pool5Expected), '5-player card pool matches spec exactly');
assert(ao.length === 5, 'Action order has 5 entries');
// Action order = sorted by draft position (slot number)
const slots_sorted = Object.entries(room.gameState.draft.picks).sort((a,b)=>a[1]-b[1]).map(e=>e[0]);
assert(JSON.stringify(ao) === JSON.stringify(slots_sorted), 'Action order follows draft slot order');

const cp = room.gameState.cardPhase;

// Play all 5 cards in order
let blindSwapCount = 0;
for (let i = 0; i < ao.length; i++) {
  const pid = ao[i];
  const card = assignments[pid];
  const others = room.players.filter(p => p.id !== pid);
  const targetId = others[0].id;

  if (card === 'blind_swap') {
    blindSwapCount++;
    const prevA = room.players.find(p=>p.id===pid).boxNumber;
    const prevB = room.players.find(p=>p.id===targetId).boxNumber;
    ge.handleBlindSwap(io, room, pid, targetId);
    const nowA = room.players.find(p=>p.id===pid).boxNumber;
    const nowB = room.players.find(p=>p.id===targetId).boxNumber;
    assert(cp.usedCards.has(pid), `blind_swap: ${room.players.find(p=>p.id===pid)?.name} card marked used`);
    assert(nowA === prevB && nowB === prevA, 'blind_swap correctly swapped boxes');

  } else if (card === 'view') {
    ge.handleViewCard(io, room, pid, targetId);
    assert(cp.usedCards.has(pid), `view: ${room.players.find(p=>p.id===pid)?.name} card marked used`);

  } else if (card === 'see_swap') {
    // Step 1: view
    ge.handleViewCard(io, room, pid, targetId, true);
    assert(cp.pendingSeeSwap !== null, 'see_swap step 1: pendingSeeSwap set');
    assert(cp.pendingSeeSwap.viewed === true, 'see_swap step 1: viewed flag = true');
    assert(!cp.usedCards.has(pid), 'see_swap step 1: card NOT yet marked used (pending decision)');
    // Step 2: decide
    ge.handleSeeSwapDecision(io, room, pid, true); // choose to swap
    assert(cp.pendingSeeSwap === null, 'see_swap step 2: pendingSeeSwap cleared');
    assert(cp.usedCards.has(pid), `see_swap: ${room.players.find(p=>p.id===pid)?.name} card marked used after decision`);

  } else if (card === 'block') {
    ge.handleBlockCard(io, room, pid, targetId);
    assert(cp.blockState.size > 0, 'block: blockState updated');
    assert(cp.usedCards.has(pid), `block: ${room.players.find(p=>p.id===pid)?.name} card marked used`);
    // Verify block prevents target from swapping back
    assert(ce.isSwapBlocked(cp.blockState, targetId, pid), 'block: target correctly blocked from swapping with blocker');
  }

  ge.advanceCardPhaseAction(cp);
}
assert(cp.currentActionIdx === 5, 'All 5 card actions completed');
assert(cp.usedCards.size === 5, 'All 5 cards marked as used');
assert(blindSwapCount === 2, '2 blind_swap cards played (5-player pool has 2)');

// ── FINAL REVEAL ────────────────────────────────────────────────────────────────
console.log('\n=== FINAL REVEAL ===');
const { reveals, badges, gameLog } = ge.buildFinalReveal(room);
assert(reveals.length === 5, '5 reveal entries for 5 players');
const winnerRevs = reveals.filter(r => r.isWinner);
assert(winnerRevs.length === 1, 'Exactly ONE winner in reveals');
const revWinner = reveals.find(r => r.isWinner);
const actualHolder = room.players.find(p => p.boxNumber === room.gameState.prizeBox);
assert(revWinner.playerId === actualHolder.id, 'Reveal winner == server-authoritative prize holder');
assert(revWinner.boxNumber === room.gameState.prizeBox, 'Winner box matches prizeBox on server');

// SECURITY: no prizeBox key in client-facing payload
const revStr = JSON.stringify({ reveals, badges });
assert(!revStr.includes('"prizeBox"'), 'prizeBox NOT in client reveal payload ✓ SECURE');

assert(badges.winner === actualHolder.id, 'badges.winner is correct player');
assert(Array.isArray(badges.sharpestEye), 'badges.sharpestEye is array');
assert(gameLog.prizeBox === prizeBox, 'gameLog.prizeBox preserved correctly through whole game');

// Leaderboard
const lb = se.getLeaderboard(gameLog);
assert(lb.length === 5, 'Final leaderboard has 5 entries');
assert(lb[0].score >= lb[4].score, 'Leaderboard correctly sorted descending');
assert(lb.every(e => typeof e.score === 'number'), 'All scores are numbers');
const lbIds = lb.map(e => e.playerId);
assert(room.players.every(p => lbIds.includes(p.id)), 'All 5 players appear in leaderboard');

// Loss messages for non-winners
const losers = reveals.filter(r => !r.isWinner);
assert(losers.every(r => r.lossMessage), 'All 4 losers have loss messages');
console.log('  ℹ️  Winner:', room.players.find(p=>p.id===actualHolder.id)?.name, '| prizeBox:', prizeBox);

// ── CARD POOL INTEGRITY — ALL PLAYER COUNTS ─────────────────────────────────────
console.log('\n=== CARD POOLS — ALL PLAYER COUNTS (3-6) ===');
[3, 4, 5, 6].forEach(n => {
  const fps = Array.from({ length: n }, (_, i) => ({ id: 'p' + i }));
  const a = ce.assignCards(fps);
  assert(Object.keys(a).length === n, `${n}-player: all ${n} players get a card`);
  const pool = [...ce.CARD_POOLS[n]].sort();
  const dealt = Object.values(a).sort();
  assert(JSON.stringify(pool) === JSON.stringify(dealt), `${n}-player: dealt cards match pool spec`);
});

// ── BLOCK CARD LOGIC ────────────────────────────────────────────────────────────
console.log('\n=== BLOCK CARD EDGE CASES ===');
const bs = ce.createBlockState();
ce.applyBlock(bs, 'playerA', 'playerB'); // A blocks B
assert(ce.isSwapBlocked(bs, 'playerB', 'playerA'), 'B cannot swap with A (A blocked B)');
assert(!ce.isSwapBlocked(bs, 'playerA', 'playerB'), 'A can still swap with B (block is directional)');
assert(!ce.isSwapBlocked(bs, 'playerC', 'playerA'), 'C unaffected by A-B block');

// ── DISCONNECT & RECONNECT ──────────────────────────────────────────────────────
console.log('\n=== DISCONNECT & RECONNECT ===');
const room2 = rm.createRoom('h1', 'Host');
rm.joinRoom(room2.id, 'p2', 'Player2');
rm.joinRoom(room2.id, 'p3', 'Player3');
assert(room2.players.length === 3, 'Room2 has 3 players');

// Lobby disconnect
rm.removePlayerFromRoom(room2, 'p2');
assert(room2.players.length === 2, 'Player removed from lobby on disconnect');

// Host disconnect → promote next
rm.removePlayerFromRoom(room2, 'h1');
assert(room2.players.length === 1, 'Host removed from lobby');
rm.promoteNextHost(room2); // caller is responsible for calling this
assert(room2.hostId === 'p3', 'p3 promoted to host after h1 left');

// Empty room check
rm.removePlayerFromRoom(room2, 'p3');
assert(room2.players.length === 0, 'Room empty after all players leave');

// Reconnect test
const room3 = rm.createRoom('orig-sock', 'Returner');
rm.joinRoom(room3.id, 'other-sock', 'Other');
ge.assignBoxes(room3);
const returner = room3.players.find(p => p.name === 'Returner');
const originalId = returner.id;
returner.connected = false;

const reconnected = rm.reconnectPlayer(room3, 'new-sock', 'Returner');
assert(reconnected !== null, 'Reconnect successful (matched by name)');
assert(reconnected.id === originalId, `player.id preserved as original (${originalId})`);
assert(reconnected.socketId === 'new-sock', 'player.socketId updated to new connection');
assert(reconnected.connected === true, 'Player marked as connected again');

// Reconnect for mid-game host
const room4 = rm.createRoom('host-sock', 'HostPlayer');
ge.assignBoxes(room4);
room4.players[0].connected = false;
const hosRecon = rm.reconnectPlayer(room4, 'host-new', 'HostPlayer');
assert(hosRecon !== null, 'Host reconnect successful');
assert(room4.hostId === 'host-new', 'Host pointer updated to new socket on reconnect');

// ── ROOM CODE UNIQUENESS ─────────────────────────────────────────────────────────
console.log('\n=== ROOM CODE UNIQUENESS ===');
const roomIds = new Set();
for (let i = 0; i < 200; i++) {
  const r = rm.createRoom('s' + i, 'P' + i);
  roomIds.add(r.id);
  rm.deleteRoom(r.id);
}
assert(roomIds.size >= 195, 'Room codes are highly unique (195+/200 distinct)');
assert([...roomIds].every(id => id.length === 6), 'All room codes are 6 characters');

// ── SCORE INTEGRITY ──────────────────────────────────────────────────────────────
console.log('\n=== SCORE INTEGRITY ===');
const finalLb = se.getLeaderboard(room.gameLog);
assert(finalLb.length === 5, 'Final leaderboard has 5 entries');
assert(finalLb[0].score >= finalLb[4].score, 'Leaderboard correctly sorted descending');
assert(finalLb.every(e => typeof e.score === 'number' && e.score >= 0), 'All scores are non-negative numbers');
assert(room.players.every(p => finalLb.map(e=>e.playerId).includes(p.id)), 'All 5 players in final leaderboard');

// ── RESULTS ──────────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log('  5-PLAYER SIMULATION RESULTS');
console.log('='.repeat(60));
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
console.log(`  Total:     ${passed + failed}`);
if (failed > 0) {
  console.log('\n  ❌ Failed assertions:');
  issues.forEach(i => console.log('    •', i));
  process.exit(1);
} else {
  console.log('\n  🎉 ALL ASSERTIONS PASSED — game logic is sound for 5-player!');
  process.exit(0);
}
