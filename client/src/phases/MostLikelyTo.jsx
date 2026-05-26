import { useState } from "react";
import socket from "../socket";
import { useGame } from "../context/GameContext";
import Timer from "../components/Timer";
import VoteGrid from "../components/VoteGrid";

const QUESTIONS = [
  "Who has been the most suspiciously quiet this game?",
  "Who would you least trust with your box right now?",
  "Who do you think will win this whole game?",
  "Who currently has the prize?",
];

export default function MostLikelyTo() {
  const { state, set } = useGame();
  const { phase, mostLikelyTo, playerId, players, roundWinner, questionIndex } = state;
  const [voted, setVoted] = useState(null);
  const [swapTarget, setSwapTarget] = useState(null);
  const isWinner = roundWinner?.winnerId === playerId;
  const qIdx = questionIndex ?? 0;
  const isLocked = qIdx === QUESTIONS.length - 1;

  function submitVote(vid) {
    if (voted) return;
    setVoted(vid);
    socket.emit("most_likely_vote", { questionIndex: qIdx, votedPlayer: vid });
  }

  function doWinnerAction(choice, targetId) {
    if (choice === "swap") socket.emit("swap_choice", { targetPlayer: targetId });
    else socket.emit("keep_choice");
    set({ roundWinner: null });
  }

  return (
    <div className="grad-bg page stack gap-5" style={{ maxWidth: 480, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ textAlign: "center", paddingTop: "0.5rem" }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.3rem 0.9rem",
          background: "rgba(0,255,136,0.1)",
          border: "1.5px solid rgba(0,255,136,0.3)",
          borderRadius: 999,
          fontSize: "var(--text-xs)",
          fontWeight: 800,
          color: "var(--neon-green)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: "0.5rem",
        }}>
          Round 4 · Q{qIdx + 1}/{QUESTIONS.length}
        </div>
        <h1 className="font-display" style={{ fontSize: "clamp(2rem, 8vw, 3rem)", lineHeight: 1 }}>
          Most Likely To 🎭
        </h1>
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
        {QUESTIONS.map((_, i) => (
          <div key={i} style={{
            width: i === qIdx ? 20 : 8,
            height: 8,
            borderRadius: 999,
            background: i <= qIdx
              ? (i === QUESTIONS.length - 1 ? "var(--neon-yellow)" : "var(--neon-green)")
              : "rgba(255,255,255,0.15)",
            transition: "all 0.3s ease",
          }} />
        ))}
      </div>

      {/* Timer */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Timer color={isLocked ? "var(--neon-yellow)" : "var(--neon-green)"} />
      </div>

      {/* Voting */}
      {phase === "ROUND_4_VOTING" && (
        <div className="stack gap-4">
          {/* Question card */}
          <div className="glass" style={{
            padding: "1.25rem 1.5rem",
            textAlign: "center",
            fontSize: "var(--text-lg)",
            fontWeight: 800,
            lineHeight: 1.5,
            borderColor: isLocked ? "rgba(255,215,0,0.45)" : "rgba(0,255,136,0.25)",
            boxShadow: isLocked ? "0 0 32px rgba(255,215,0,0.2)" : "none",
          }}>
            {isLocked && (
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                padding: "0.2rem 0.7rem",
                background: "rgba(255,215,0,0.15)",
                border: "1px solid rgba(255,215,0,0.4)",
                borderRadius: 999,
                fontSize: "var(--text-xs)",
                fontWeight: 800,
                color: "var(--neon-yellow)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "0.75rem",
              }}>
                🔒 Final Question
              </div>
            )}
            <div>{QUESTIONS[qIdx]}</div>

            {/* Fix 2: per-question hint so players know only Q4 is mechanical */}
            {isLocked ? (
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                padding: "0.2rem 0.65rem",
                marginTop: "0.7rem",
                background: "rgba(255,215,0,0.12)",
                border: "1px solid rgba(255,215,0,0.35)",
                borderRadius: 999,
                fontSize: "var(--text-xs)",
                fontWeight: 800,
                color: "var(--neon-yellow)",
                letterSpacing: "0.06em",
              }}>
                ⚡ This one counts — winner gets swap or keep
              </div>
            ) : (
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                padding: "0.2rem 0.65rem",
                marginTop: "0.7rem",
                background: "rgba(0,255,136,0.06)",
                border: "1px solid rgba(0,255,136,0.2)",
                borderRadius: 999,
                fontSize: "var(--text-xs)",
                fontWeight: 700,
                color: "var(--text-muted)",
                letterSpacing: "0.04em",
              }}>
                Just for fun — Q4 decides the winner
              </div>
            )}
          </div>

          <VoteGrid
            players={players}
            myId={playerId}
            onVote={submitVote}
            voted={voted}
            canVoteSelf
            label="Vote:"
          />

          {voted && (
            <div style={{
              textAlign: "center",
              color: "var(--neon-green)",
              fontWeight: 800,
              fontSize: "var(--text-sm)",
            }}>
              ✓ Voted!
            </div>
          )}
        </div>
      )}

      {/* Winner action */}
      {phase === "ROUND_4_WINNER_ACTION" && (
        <div className="stack gap-4" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3.5rem", lineHeight: 1 }}>🏆</div>
          <div style={{ fontWeight: 900, fontSize: "var(--text-xl)", color: "var(--neon-yellow)" }}>
            {roundWinner?.winnerName || players.find((p) => p.id === roundWinner?.winnerId)?.name} wins Round 4!
          </div>
          {isWinner && !swapTarget && (
            <div className="stack gap-3">
              <button className="btn btn-pink full" onClick={() => setSwapTarget("choosing")}>🔀 Swap Boxes</button>
              <button className="btn btn-ghost full" onClick={() => doWinnerAction("keep")}>😏 Stay Confident</button>
            </div>
          )}
          {isWinner && swapTarget && (
            <div className="stack gap-3">
              {players.filter((p) => p.id !== playerId).map((p) => (
                <button key={p.id} className="btn btn-purple full" onClick={() => doWinnerAction("swap", p.id)}>
                  Swap with {p.name}
                </button>
              ))}
              <button className="btn btn-ghost full" onClick={() => setSwapTarget(null)}>← Back</button>
            </div>
          )}
          {!isWinner && (
            <div className="glass" style={{ padding: "1rem", color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
              ⏳ Waiting for winner…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
