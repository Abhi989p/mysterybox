import { useState, useEffect } from "react";
import { useGame } from "../context/GameContext";
import MysteryBox from "../components/MysteryBox";
import Confetti from "../components/Confetti";
import sfx from "../audio";
import socket from "../socket";

export default function FinalReveal() {
  const { state, set } = useGame();
  const { reveals = [], badges = {}, playerId } = state;
  const [shown, setShown] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (reveals.length === 0) return;
    sfx.play("drumroll");
    const timers = reveals.map((_, i) =>
      setTimeout(() => {
        setShown(i + 1);
        if (reveals[i].isWinner) {
          sfx.play("confetti");
          setShowConfetti(true);
        }
      }, (i + 1) * 2200)
    );
    const end = setTimeout(() => {
      socket.emit("recap_ready");
      set({ phase: "RECAP" });
    }, (reveals.length + 2) * 2200);
    return () => { timers.forEach(clearTimeout); clearTimeout(end); };
  }, [reveals.length]);

  return (
    <div style={{
      background: `radial-gradient(ellipse at 50% 0%, rgba(255,61,154,0.25) 0%, transparent 55%),
                   radial-gradient(ellipse at 50% 100%, rgba(155,89,255,0.15) 0%, transparent 55%),
                   var(--bg-primary)`,
      minHeight: "100vh",
      padding: "2rem 1.25rem",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "1.5rem",
    }}>
      <Confetti active={showConfetti} />

      {/* Header */}
      <div style={{ textAlign: "center", paddingTop: "0.5rem" }}>
        <div style={{
          display: "inline-flex",
          padding: "0.3rem 0.9rem",
          background: "rgba(255,61,154,0.15)",
          border: "1.5px solid rgba(255,61,154,0.4)",
          borderRadius: 999,
          fontSize: "var(--text-xs)",
          fontWeight: 800,
          color: "var(--neon-pink)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          marginBottom: "0.75rem",
        }}>
          Final Reveal
        </div>
        <h1 className="font-display" style={{
          fontSize: "clamp(2.8rem, 12vw, 5rem)",
          lineHeight: 1,
          textShadow: "0 0 40px rgba(255,61,154,0.4)",
        }}>
          Opening Boxes 🎁
        </h1>
        <p style={{
          color: "var(--text-muted)",
          fontSize: "var(--text-sm)",
          marginTop: "0.5rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
        }}>
          The truth is about to come out…
        </p>
      </div>

      {/* Revealed entries */}
      <div className="stack gap-3" style={{ width: "100%", maxWidth: 480 }}>
        {reveals.slice(0, shown).map((r, i) => (
          <div
            key={r.playerId}
            className="box-pop"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: r.isWinner ? "1.5rem 1.25rem" : "1rem 1.25rem",
              background: r.isWinner
                ? "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,215,0,0.05))"
                : "rgba(255,255,255,0.04)",
              border: `2px solid ${r.isWinner ? "var(--neon-yellow)" : r.playerId === playerId ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: "var(--radius-lg)",
              boxShadow: r.isWinner
                ? "0 0 48px rgba(255,215,0,0.3)"
                : r.playerId === playerId
                  ? "0 0 16px rgba(0,212,255,0.15)"
                  : "none",
              animationDelay: `${i * 0.08}s`,
            }}
          >
            <MysteryBox number={r.boxNumber} size={r.isWinner ? 64 : 52} animate="none" />

            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <div style={{
                fontWeight: 900,
                fontSize: r.isWinner ? "var(--text-lg)" : "var(--text-base)",
                color: r.isWinner ? "var(--neon-yellow)" : r.playerId === playerId ? "var(--neon-cyan)" : "#fff",
              }}>
                {r.name}{r.playerId === playerId ? " (you)" : ""}
              </div>
              {r.isWinner ? (
                <div className="font-display" style={{
                  fontSize: "var(--text-2xl)",
                  color: "var(--neon-yellow)",
                  textShadow: "0 0 20px rgba(255,215,0,0.5)",
                  lineHeight: 1,
                }}>
                  🏆 WINNER!
                </div>
              ) : (
                <div style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--text-muted)",
                  fontStyle: "italic",
                  lineHeight: 1.4,
                }}>
                  {r.lossMessage}
                </div>
              )}
            </div>

            <div style={{ fontSize: r.isWinner ? "2.5rem" : "1.8rem", flexShrink: 0 }}>
              {r.isWinner ? "🏆" : "💀"}
            </div>
          </div>
        ))}

        {/* Waiting for next */}
        {shown < reveals.length && (
          <div className="glass" style={{
            padding: "2rem",
            textAlign: "center",
            borderColor: "rgba(255,215,0,0.2)",
          }}>
            <div className="box-shake" style={{ display: "inline-block", fontSize: "3.5rem", marginBottom: "0.75rem" }}>
              🎁
            </div>
            <div style={{
              color: "var(--text-secondary)",
              fontWeight: 800,
              fontSize: "var(--text-sm)",
              letterSpacing: "0.05em",
            }}>
              Opening next box…
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
