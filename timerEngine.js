// timerEngine.js — Server-authoritative timers
// Clients display only. They receive timer_sync every second.

const activeTimers = new Map(); // roomId -> { interval, remaining }

function startTimer(io, roomId, durationSeconds, onExpiry) {
  // Clear any existing timer for this room
  clearTimer(roomId);

  let remaining = durationSeconds;

  // Emit immediately so clients sync right away
  io.to(roomId).emit("timer_sync", { remaining });

  const interval = setInterval(() => {
    remaining -= 1;
    io.to(roomId).emit("timer_sync", { remaining });

    if (remaining <= 0) {
      clearTimer(roomId);
      if (typeof onExpiry === "function") onExpiry();
    }
  }, 1000);

  activeTimers.set(roomId, { interval, remaining });
}

function clearTimer(roomId) {
  if (activeTimers.has(roomId)) {
    clearInterval(activeTimers.get(roomId).interval);
    activeTimers.delete(roomId);
  }
}

function getRemainingTime(roomId) {
  const t = activeTimers.get(roomId);
  return t ? t.remaining : 0;
}

module.exports = { startTimer, clearTimer, getRemainingTime };
