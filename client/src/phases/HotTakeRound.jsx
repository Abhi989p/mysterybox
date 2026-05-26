import { useState } from "react";
import socket from "../socket";
import { useGame } from "../context/GameContext";
import Timer from "../components/Timer";
import SwapAnimation from "../components/SwapAnimation";

export default function HotTakeRound() {
  const { state, set } = useGame();
  const { phase, hotTake, playerId, players, roundWinner, lastSwap, question, questionIndex } = state;
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [voted, setVoted] = useState(null);
  const [swapTarget, setSwapTarget] = useState(null);

  const currentQIndex = questionIndex ?? 0;
  const currentQuestion = question ?? "";
  const isWinner = roundWinner?.winnerId === playerId;

  function submitAnswer(e) {
    e.preventDefault();
    if (!answer.trim() || submitted) return;
    socket.emit("hot_take_answer", { questionIndex: currentQIndex, answer: answer.trim() });
    setSubmitted(true);
  }

  function submitVote(votedPid) {
    if (voted) return;
    setVoted(votedPid);
    socket.emit("hot_take_vote", { questionIndex: currentQIndex, votedPlayerId: votedPid });
  }

  function doWinnerAction(choice, targetId) {
    if (choice === "swap") socket.emit("swap_choice", { targetPlayer: targetId });
    else socket.emit("keep_choice");
    set({ roundWinner: null });
  }

  return (
    <div className="grad-bg page stack gap-5" style={{ maxWidth: 480, margin: "0 auto" }}>
      {lastSwap && <SwapAnimation swap={lastSwap} players={players} />}

      {/* Header */}
      <div style={{ textAlign: "center", paddingTop: "0.5rem" }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.3rem 0.9rem",
          background: "rgba(255,61,154,0.12)",
          border: "1.5px solid rgba(255,61,154,0.3)",
          borderRadius: 999,
          fontSize: "var(--text-xs)",
          fontWeight: 800,
          color: "var(--neon-pink)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: "0.5rem",
        }}>
          Round 1 · Q{currentQIndex + 1}/3
        </div>
        <h1 className="font-display" style={{ fontSize: "clamp(2.2rem, 9vw, 3rem)", lineHeight: 1 }}>
          Hot Take 🔥
        </h1>
      </div>

      {/* Timer */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Timer color="var(--neon-pink)" />
      </div>

      {/* ── ANSWERING PHASE ── */}
      {phase === "ROUND_1_ANSWERING" && (
        <div className="stack gap-4">
          {/* Question */}
          <div className="glass" style={{
            padding: "1.25rem 1.5rem",
            fontSize: "var(--text-lg)",
            fontWeight: 800,
            lineHeight: 1.55,
            textAlign: "center",
            borderColor: "rgba(255,61,154,0.35)",
            boxShadow: "0 0 24px rgba(255,61,154,0.12)",
          }}>
            {currentQuestion || <span style={{ color: "var(--text-muted)" }}>Loading question…</span>}
          </div>

          {!submitted ? (
            <form onSubmit={submitAnswer} className="stack gap-3">
              <textarea
                id="input-hot-take"
                className="input"
                rows={3}
                placeholder="Your honest answer…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                maxLength={200}
                autoFocus
              />
              <button
                id="btn-submit-answer"
                type="submit"
                className="btn btn-pink full"
                disabled={!answer.trim()}
                style={{ fontSize: "var(--text-base)" }}
              >
                Submit Answer →
              </button>
            </form>
          ) : (
            <div className="glass success-flash" style={{
              padding: "1.25rem",
              textAlign: "center",
              borderColor: "rgba(0,255,136,0.3)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.5rem",
            }}>
              <div style={{ fontSize: "2rem" }}>✅</div>
              <div style={{ color: "var(--neon-green)", fontWeight: 800, fontSize: "var(--text-base)" }}>
                Answer submitted!
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
                Waiting for others to answer…
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VOTING PHASE ── */}
      {phase === "ROUND_1_VOTING" && (
        <div className="stack gap-4">
          <div className="glass" style={{
            padding: "1rem 1.25rem",
            fontWeight: 800,
            textAlign: "center",
            fontSize: "var(--text-base)",
            lineHeight: 1.5,
            borderColor: "rgba(255,61,154,0.3)",
          }}>
            {currentQuestion}
          </div>

          <div className="stack gap-2">
            <div style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}>
              Vote for the funniest:
            </div>
            {(hotTake.answers || []).map((a, i) => {
              const isOwn = a.pid === playerId;
              const isVoted = voted === a.pid;
              return (
                <button
                  key={a.pid}
                  id={`vote-answer-${i}`}
                  className="btn btn-ghost full anim-fade-up"
                  style={{
                    flexDirection: "column",
                    alignItems: "flex-start",
                    padding: "1rem 1.1rem",
                    minHeight: 70,
                    textAlign: "left",
                    gap: "0.35rem",
                    borderColor: isVoted ? "var(--neon-pink)" : isOwn ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.1)",
                    background: isVoted ? "rgba(255,61,154,0.14)" : isOwn ? "rgba(255,255,255,0.025)" : undefined,
                    opacity: isOwn ? 0.45 : 1,
                    boxShadow: isVoted ? "0 0 16px rgba(255,61,154,0.3)" : "none",
                    animationDelay: `${i * 0.07}s`,
                  }}
                  disabled={!!voted || isOwn}
                  onClick={() => submitVote(a.pid)}
                >
                  <span style={{
                    fontSize: "var(--text-xs)",
                    color: isOwn ? "var(--text-muted)" : "var(--text-secondary)",
                    fontWeight: 700,
                  }}>
                    {isOwn ? "Your answer (can't vote)" : `Answer ${i + 1}`}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: "var(--text-base)", lineHeight: 1.4 }}>
                    {a.text}
                  </span>
                </button>
              );
            })}
          </div>

          {voted && (
            <div style={{
              textAlign: "center",
              color: "var(--neon-green)",
              fontWeight: 800,
              fontSize: "var(--text-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
            }}>
              ✓ Vote locked in!
            </div>
          )}
        </div>
      )}

      {/* ── WINNER ACTION ── */}
      {phase === "ROUND_1_WINNER_ACTION" && (
        <div className="stack gap-4" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3.5rem", lineHeight: 1 }}>🏆</div>
          <div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 700, marginBottom: 4 }}>
              Round Winner
            </div>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 900, color: "var(--neon-yellow)" }}>
              {roundWinner?.winnerName || players.find((p) => p.id === roundWinner?.winnerId)?.name}
            </div>
          </div>

          {isWinner ? (
            <div className="stack gap-3">
              <div style={{ fontWeight: 800, fontSize: "var(--text-base)", color: "var(--text-secondary)" }}>
                Your power move:
              </div>
              {!swapTarget ? (
                <div className="stack gap-3">
                  <button
                    id="btn-winner-swap"
                    className="btn btn-pink full"
                    style={{ fontSize: "var(--text-base)" }}
                    onClick={() => setSwapTarget("choosing")}
                  >
                    🔀 Swap Boxes
                  </button>
                  <button
                    id="btn-winner-keep"
                    className="btn btn-ghost full"
                    style={{ fontSize: "var(--text-base)" }}
                    onClick={() => doWinnerAction("keep")}
                  >
                    😏 Stay Confident
                  </button>
                </div>
              ) : (
                <div className="stack gap-3">
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", fontWeight: 700 }}>
                    Swap with who?
                  </div>
                  {players.filter((p) => p.id !== playerId).map((p) => (
                    <button
                      key={p.id}
                      className="btn btn-purple full"
                      onClick={() => doWinnerAction("swap", p.id)}
                    >
                      Swap with {p.name}
                    </button>
                  ))}
                  <button className="btn btn-ghost full" onClick={() => setSwapTarget(null)}>
                    ← Cancel
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="glass" style={{
              padding: "1rem 1.25rem",
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              textAlign: "center",
            }}>
              ⏳ Waiting for winner to decide…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
