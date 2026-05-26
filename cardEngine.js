// cardEngine.js — Card pool assignment and card action validation

// Card pool by player count (from spec)
const CARD_POOLS = {
  3: ["blind_swap", "view", "see_swap"],
  4: ["blind_swap", "view", "see_swap", "block"],
  5: ["blind_swap", "blind_swap", "view", "see_swap", "block"],
  6: ["blind_swap", "blind_swap", "view", "view", "see_swap", "block"],
};

// Assign one card per player, shuffle pool
function assignCards(players) {
  const count = players.length;
  const pool = [...(CARD_POOLS[count] || CARD_POOLS[3])];
  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const assignments = {};
  players.forEach((p, idx) => {
    assignments[p.id] = pool[idx];
  });
  return assignments;
}

// Returns the block state map: { blockedPlayerId: Set<blockerPlayerId> }
// A player is blocked if any blocker has blocked them
function createBlockState() {
  return new Map(); // targetPlayerId -> Set of blockerPlayerIds
}

function applyBlock(blockState, blockerPlayerId, targetPlayerId) {
  if (!blockState.has(targetPlayerId)) {
    blockState.set(targetPlayerId, new Set());
  }
  blockState.get(targetPlayerId).add(blockerPlayerId);
}

// Check if a swap is blocked: the requester trying to swap with target
// Block card prevents the BLOCKER from being swapped WITH by the blocked player
// Per spec: "Prevent one specific player from swapping with you this phase"
// So if playerA blocks playerB → playerB cannot swap with playerA
function isSwapBlocked(blockState, requesterId, targetId) {
  // Check if requester is blocked from swapping with target
  // i.e. target has blocked requester
  const blockedBy = blockState.get(requesterId);
  if (blockedBy && blockedBy.has(targetId)) return true;
  return false;
}

function getCardName(cardType) {
  const names = {
    blind_swap: "Blind Swap",
    view: "View",
    see_swap: "See & Swap",
    block: "Block",
  };
  return names[cardType] || cardType;
}

module.exports = {
  assignCards,
  createBlockState,
  applyBlock,
  isSwapBlocked,
  getCardName,
  CARD_POOLS,
};
