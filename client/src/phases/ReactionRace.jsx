import { useState } from "react";
import socket from "../socket";
import { useGame } from "../context/GameContext";
import Timer from "../components/Timer";

const TYPE_STYLES = {
  emoji: { fontSize: "5.5rem", lineHeight: 1 },
  math:  { fontFamily: "var(--font-display)", fontSize: "4rem", color: "var(--neon-cyan)" },
  color: { width: 100, height: 100, borderRadius: 16, display: "inline-block", border: "3px solid rgba(255,255,255,0.3)" },
  text:  { fontFamily: "var(--font-display)", fontSize: "2.2rem", lineHeight: 1.25, textAlign: "center" },
};

export default function ReactionRace() {
  const { state, set } = useGame();
  const { phase, reaction, playerId, players, roundWinner, prompt, promptIndex } = state;
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState(null);
  const [swapTarget, setSwapTarget] = useState(null);
  const isWinner = roundWinner?.winnerId === playerId;

  const currentPromptIndex = promptIndex ?? 0;
  const result = (reaction?.promptResult?.promptIndex === currentPromptIndex) ? reaction.promptResult : null;

  function submitAnswer(idx) {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    socket.emit("reaction_answer", { promptIndex: currentPromptIndex, answerIndex: idx });
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
          background: "rgba(0,212,255,0.1)",
          border: "1.5px solid rgba(0,212,255,0.3)",
          borderRadius: 999,
          fontSize: "var(--text-xs)",
          fontWeight: 800,
          color: "var(--neon-cyan)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: "0.5rem",
        }}>
          Round 2 · Prompt {currentPromptIndex + 1}/4
        </div>
        <h1 className="font-display" style={{ fontSize: "clamp(2.5rem, 10vw, 3.5rem)", lineHeight: 1 }}>
          Reaction Race ⚡
        </h1>
      </div>

      {/* Timer */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Timer color="var(--neon-cyan)" />
      </div>

      {/* Prompt phase */}
      {phase === "ROUND_2_PROMPT" && prompt && (
        <div className="stack gap-4">
          {/* Stimulus */}
          <div className="glass" style={{
            padding: "2rem",
            textAlign: "center",
            minHeight: 150,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderColor: "rgba(0,212,255,0.25)",
            boxShadow: "0 0 32px rgba(0,212,255,0.08)",
          }}>
            {prompt.stimulusType === "color"
              ? <div style={{ ...TYPE_STYLES.color, background: prompt.stimulus }} />
              : <div style={TYPE_STYLES[prompt.stimulusType] || TYPE_STYLES.text}>{prompt.stimulus}</div>
            }
          </div>

          {/* Options — 2×2 grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem",
          }}>
            {prompt.options?.map((opt, i) => {
              const isCorrect = result && i === result.correctIndex;
              const isWrong = result && selected === i && i !== result.correctIndex;
              const isSelected = selected === i;
              return (
                <button
                  key={i}
                  id={`reaction-option-${i}`}
                  className="btn"
                  disabled={answered}
                  onClick={() => submitAnswer(i)}
                  style={{
                    minHeight: 76,
                    fontSize: "var(--text-base)",
                    fontWeight: 800,
                    borderRadius: "var(--radius-lg)",
                    background: isCorrect
                      ? "var(--neon-green)"
                      : isWrong
                        ? "var(--neon-pink)"
                        : isSelected
                          ? "var(--neon-purple)"
                          : "rgba(255,255,255,0.07)",
                    border: `2px solid ${isCorrect ? "var(--neon-green)" : isWrong ? "var(--neon-pink)" : isSelected ? "var(--neon-purple)" : "rgba(255,255,255,0.1)"}`,
                    color: (isCorrect || isWrong || isSelected) ? "#000" : "#fff",
                    boxShadow: isCorrect ? "0 0 24px rgba(0,255,136,0.5)" : isWrong ? "0 0 16px rgba(255,61,154,0.4)" : "none",
                    transition: "all 0.18s ease",
                    lineHeight: 1.3,
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {answered && !result && (
            <div style={{
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "var(--text-sm)",
              fontWeight: 700,
            }}>
              ⏳ Waiting for others…
            </div>
          )}
        </div>
      )}

      {/* Winner action */}
      {phase === "ROUND_2_WINNER_ACTION" && (
        <div className="stack gap-4" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3.5rem", lineHeight: 1 }}>⚡</div>
          <div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 700, marginBottom: 4 }}>
              Reaction Race Winner
            </div>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 900, color: "var(--neon-yellow)" }}>
              {roundWinner?.winnerName || players.find((p) => p.id === roundWinner?.winnerId)?.name}
            </div>
          </div>

          {isWinner ? (
            !swapTarget ? (
              <div className="stack gap-3">
                <button id="btn-winner-swap" className="btn btn-pink full" onClick={() => setSwapTarget("choosing")}>
                  🔀 Swap Boxes
                </button>
                <button id="btn-winner-keep" className="btn btn-ghost full" onClick={() => doWinnerAction("keep")}>
                  😏 Stay Confident
                </button>
              </div>
            ) : (
              <div className="stack gap-3">
                <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", fontWeight: 700 }}>Swap with who?</div>
                {players.filter((p) => p.id !== playerId).map((p) => (
                  <button key={p.id} className="btn btn-purple full" onClick={() => doWinnerAction("swap", p.id)}>
                    Swap with {p.name}
                  </button>
                ))}
                <button className="btn btn-ghost full" onClick={() => setSwapTarget(null)}>← Back</button>
              </div>
            )
          ) : (
            <div className="glass" style={{ padding: "1rem", color: "var(--text-secondary)", fontSize: "var(--text-sm)", fontWeight: 600 }}>
              ⏳ Waiting for winner…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
