import { useState } from "react";
import socket from "../socket";
import { useGame } from "../context/GameContext";
import Timer from "../components/Timer";
import VoteGrid from "../components/VoteGrid";

export default function ImposterGuess() {
  const { state, set } = useGame();
  const { phase, imposter, playerId, players, roundWinner } = state;
  const [clue, setClue] = useState("");
  const [clueSent, setClueSent] = useState(false);
  const [voted, setVoted] = useState(null);
  const [swapTarget, setSwapTarget] = useState(null);
  const isWinner = roundWinner?.winnerId === playerId;
  const isMyTurn = imposter?.currentClueTurn === playerId;
  const isImposter = imposter?.isImposter;

  function submitClue(e) {
    e.preventDefault();
    if (!clue.trim()) return;
    socket.emit("imposter_clue", { clue: clue.trim() });
    setClueSent(true);
  }

  function submitVote(vid) {
    if (voted) return;
    setVoted(vid);
    socket.emit("imposter_vote", { votedPlayer: vid });
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
          background: "rgba(155,89,255,0.12)",
          border: "1.5px solid rgba(155,89,255,0.3)",
          borderRadius: 999,
          fontSize: "var(--text-xs)",
          fontWeight: 800,
          color: "var(--neon-purple)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: "0.5rem",
        }}>
          Round 3
        </div>
        <h1 className="font-display" style={{ fontSize: "clamp(2.2rem, 9vw, 3rem)", lineHeight: 1 }}>
          Imposter Guess 🕵️
        </h1>
      </div>

      {/* Secret word / role card */}
      {imposter?.myWord && (
        <div className="glass" style={{
          padding: "1.5rem",
          textAlign: "center",
          borderColor: isImposter ? "rgba(255,61,154,0.4)" : "rgba(155,89,255,0.3)",
          boxShadow: isImposter
            ? "0 0 32px rgba(255,61,154,0.15)"
            : "0 0 24px rgba(155,89,255,0.1)",
        }}>
          {/* Role badge */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.3rem 0.85rem",
            background: isImposter ? "rgba(255,61,154,0.15)" : "rgba(155,89,255,0.15)",
            border: `1.5px solid ${isImposter ? "rgba(255,61,154,0.5)" : "rgba(155,89,255,0.5)"}`,
            borderRadius: 999,
            fontSize: "var(--text-xs)",
            fontWeight: 800,
            color: isImposter ? "var(--neon-pink)" : "var(--neon-purple)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: "0.75rem",
          }}>
            {isImposter ? "⚠️ You are the IMPOSTER" : "Your secret word"}
          </div>

          {/* Word */}
          <div className="font-display" style={{
            fontSize: "clamp(2.5rem, 10vw, 3.5rem)",
            color: isImposter ? "var(--neon-pink)" : "var(--neon-cyan)",
            lineHeight: 1,
            marginBottom: "0.5rem",
          }}>
            {imposter.myWord}
          </div>

          {/* Category */}
          <div style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}>
            Category: {imposter.category?.replace(/_/g, " ")}
          </div>
        </div>
      )}

      {/* Timer */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Timer color="var(--neon-purple)" />
      </div>

      {/* ── CLUE PHASE ── */}
      {phase === "ROUND_3_CLUES" && (
        <div className="stack gap-4">
          {/* Who's turn banner */}
          <div className="glass" style={{
            padding: "0.875rem 1.25rem",
            borderColor: isMyTurn ? "rgba(155,89,255,0.4)" : "var(--border)",
            boxShadow: isMyTurn ? "0 0 20px rgba(155,89,255,0.2)" : "none",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
          }}>
            <span style={{ fontSize: "1.4rem" }}>🎤</span>
            <span style={{ fontWeight: 800, fontSize: "var(--text-base)", color: isMyTurn ? "var(--neon-purple)" : "#fff" }}>
              {isMyTurn
                ? "Your turn — give a clue!"
                : imposter.currentClueTurn
                  ? `${players.find((p) => p.id === imposter.currentClueTurn)?.name}'s turn`
                  : "Waiting…"}
            </span>
          </div>

          {/* Clue input */}
          {isMyTurn && !clueSent && (
            <form onSubmit={submitClue} className="stack gap-3">
              <input
                id="input-clue"
                className="input"
                placeholder="Give a subtle clue…"
                value={clue}
                onChange={(e) => setClue(e.target.value)}
                maxLength={80}
                autoFocus
              />
              <button
                id="btn-submit-clue"
                type="submit"
                className="btn btn-purple full"
                disabled={!clue.trim()}
              >
                Submit Clue →
              </button>
            </form>
          )}
          {isMyTurn && clueSent && (
            <div style={{
              color: "var(--neon-green)",
              fontWeight: 800,
              fontSize: "var(--text-sm)",
              textAlign: "center",
            }}>
              ✓ Clue submitted!
            </div>
          )}

          {/* Clues so far */}
          {imposter.clues?.length > 0 && (
            <div className="stack gap-2">
              <div style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}>
                Clues given:
              </div>
              {imposter.clues.map((c, i) => (
                <div key={i} className="glass anim-fade-up" style={{
                  padding: "0.75rem 1rem",
                  display: "flex",
                  gap: "0.6rem",
                  alignItems: "baseline",
                  animationDelay: `${i * 0.06}s`,
                }}>
                  <span style={{ fontWeight: 900, color: "var(--neon-cyan)", flexShrink: 0, fontSize: "var(--text-sm)" }}>
                    {players.find((p) => p.id === c.playerId)?.name}:
                  </span>
                  <span style={{ fontSize: "var(--text-base)" }}>{c.clue}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DISCUSSION ── */}
      {phase === "ROUND_3_DISCUSSION" && (
        <div className="glass" style={{
          padding: "2rem 1.5rem",
          textAlign: "center",
          borderColor: "rgba(155,89,255,0.3)",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>💬</div>
          <div style={{ fontWeight: 900, fontSize: "var(--text-xl)", marginBottom: "0.5rem" }}>
            Discussion Time!
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-base)", lineHeight: 1.6 }}>
            Talk it out — who's giving imposter vibes?
          </p>
          <div style={{ marginTop: "1.25rem" }}>
            <Timer color="var(--neon-purple)" />
          </div>
        </div>
      )}

      {/* ── VOTING ── */}
      {phase === "ROUND_3_VOTING" && (
        <VoteGrid
          players={players}
          myId={playerId}
          onVote={submitVote}
          voted={voted}
          canVoteSelf={false}
          label="Vote for the imposter:"
        />
      )}

      {/* ── IMPOSTER REVEALED ── */}
      {imposter?.revealed && (
        <div className="glass anim-fade-up" style={{
          padding: "1.75rem",
          textAlign: "center",
          borderColor: "rgba(255,61,154,0.4)",
          boxShadow: "0 0 40px rgba(255,61,154,0.15)",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🎭</div>
          <div style={{ fontWeight: 900, fontSize: "var(--text-xl)", color: "var(--neon-pink)", marginBottom: "0.5rem" }}>
            {players.find((p) => p.id === imposter.revealed.imposterId)?.name} was the Imposter!
          </div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Everyone's word: <strong style={{ color: "#fff" }}>{imposter.revealed.normalWord}</strong>
            <br />
            Imposter's word: <strong style={{ color: "var(--neon-pink)" }}>{imposter.revealed.imposterWord}</strong>
          </div>
        </div>
      )}

      {/* ── WINNER ACTION ── */}
      {phase === "ROUND_3_WINNER_ACTION" && (
        <div className="stack gap-4" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3.5rem", lineHeight: 1 }}>🏆</div>
          <div style={{ fontWeight: 900, fontSize: "var(--text-xl)", color: "var(--neon-yellow)" }}>
            {players.find((p) => p.id === roundWinner?.winnerId)?.name} wins!
          </div>
          {isWinner && !swapTarget && (
            <div className="stack gap-3">
              <button className="btn btn-pink full" onClick={() => setSwapTarget("choosing")}>🔀 Swap</button>
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
