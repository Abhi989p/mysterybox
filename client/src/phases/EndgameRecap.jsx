import { useState } from "react";
import socket from "../socket";
import { useGame } from "../context/GameContext";

const BADGE_CONFIG = [
  { key: "winner",      emoji: "🏆", label: "Winner",       color: "var(--neon-yellow)" },
  { key: "sharpestEye", emoji: "👁️",  label: "Sharpest Eye", color: "var(--neon-cyan)"   },
  { key: "bestPlayer",  emoji: "🎯",  label: "Best Player",  color: "var(--neon-purple)" },
];

export default function EndgameRecap() {
  const { state } = useGame();
  const { gameLog, badges, players, playerId, reveals = [] } = state;
  const [rematchVoted, setRematchVoted] = useState(false);

  const winner = players.find((p) => p.id === badges.winner);
  const bestPlayer = players.find((p) => p.id === badges.bestPlayer);
  const sharpEyes = (badges.sharpestEye || []).map((id) => players.find((p) => p.id === id)?.name).filter(Boolean);

  function vote(choice) {
    setRematchVoted(true);
    socket.emit("rematch_vote", { choice });
  }

  const swapEvents = gameLog?.events?.filter((e) => e.type === "swap") || [];
  const viewEvents = gameLog?.events?.filter((e) => e.type === "card_used" && e.data.card === "view") || [];
  const blockEvents = gameLog?.events?.filter((e) => e.type === "card_used" && e.data.card === "block") || [];

  const badgeNames = [
    winner?.name,
    sharpEyes.join(", ") || "—",
    bestPlayer?.name,
  ];

  return (
    <div className="grad-bg page stack gap-6" style={{ maxWidth: 520, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ textAlign: "center", paddingTop: "0.5rem" }}>
        <div style={{
          fontSize: "var(--text-xs)",
          fontWeight: 800,
          color: "var(--neon-cyan)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          marginBottom: "0.4rem",
        }}>
          Game Over
        </div>
        <h1 className="font-display" style={{ fontSize: "clamp(2.5rem, 10vw, 3.5rem)", lineHeight: 1 }}>
          Endgame Recap 📜
        </h1>
      </div>

      {/* Badge cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.65rem" }}>
        {BADGE_CONFIG.map((b, i) => (
          <div key={b.key} className="glass" style={{
            padding: "1rem 0.65rem",
            textAlign: "center",
            borderColor: `${b.color}33`,
            boxShadow: `0 0 20px ${b.color}12`,
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.4rem", lineHeight: 1 }}>{b.emoji}</div>
            <div style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
              fontWeight: 800,
              marginBottom: "0.35rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}>
              {b.label}
            </div>
            <div style={{
              fontWeight: 900,
              fontSize: "var(--text-sm)",
              color: b.color,
              wordBreak: "break-word",
              lineHeight: 1.3,
            }}>
              {badgeNames[i] || "—"}
            </div>
          </div>
        ))}
      </div>

      {/* Final standings */}
      <div>
        <div style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: "0.6rem",
        }}>
          Final Standings
        </div>
        <div className="stack gap-2">
          {reveals.map((r, i) => (
            <div key={r.playerId} style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              background: r.isWinner
                ? "rgba(255,215,0,0.08)"
                : r.playerId === playerId
                  ? "rgba(0,212,255,0.05)"
                  : "rgba(255,255,255,0.04)",
              border: `1.5px solid ${r.isWinner ? "rgba(255,215,0,0.3)" : r.playerId === playerId ? "rgba(0,212,255,0.25)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: "var(--radius-md)",
            }}>
              <span className="font-display" style={{
                fontSize: "var(--text-2xl)",
                color: r.isWinner ? "var(--neon-yellow)" : "rgba(255,255,255,0.2)",
                width: 32,
                textAlign: "center",
                flexShrink: 0,
              }}>
                {i + 1}
              </span>
              <span style={{
                flex: 1,
                fontWeight: 800,
                fontSize: "var(--text-base)",
                color: r.isWinner ? "var(--neon-yellow)" : r.playerId === playerId ? "var(--neon-cyan)" : "#fff",
              }}>
                {r.name}{r.playerId === playerId ? " (you)" : ""}
              </span>
              <span style={{ fontSize: "1.4rem" }}>{r.isWinner ? "🏆" : "💀"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline / what happened */}
      {gameLog && (swapEvents.length + viewEvents.length + blockEvents.length) > 0 && (
        <div>
          <div style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: "0.6rem",
          }}>
            What Happened
          </div>
          <div className="stack gap-2">
            {swapEvents.map((e, i) => {
              const a = players.find((p) => p.id === e.data.playerA);
              const b = players.find((p) => p.id === e.data.playerB);
              return (
                <div key={`swap-${i}`} className="glass" style={{
                  padding: "0.65rem 1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  fontSize: "var(--text-sm)",
                }}>
                  <span>🔀</span>
                  <span>
                    <strong style={{ color: "var(--neon-pink)" }}>{a?.name}</strong>
                    {" ⇄ "}
                    <strong style={{ color: "var(--neon-cyan)" }}>{b?.name}</strong>
                    <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>R{e.round}</span>
                  </span>
                </div>
              );
            })}
            {viewEvents.map((e, i) => {
              const viewer = players.find((p) => p.id === e.data.playerId);
              const target = players.find((p) => p.id === e.data.targetId);
              return (
                <div key={`view-${i}`} className="glass" style={{
                  padding: "0.65rem 1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  fontSize: "var(--text-sm)",
                }}>
                  <span>👁️</span>
                  <span>
                    <strong style={{ color: "var(--neon-cyan)" }}>{viewer?.name}</strong>
                    {" viewed "}
                    <strong>{target?.name}</strong>
                    {"'s box — "}
                    <span style={{ color: e.data.hasPrize ? "var(--neon-yellow)" : "var(--text-muted)" }}>
                      {e.data.hasPrize ? "🏆 prize inside!" : "empty"}
                    </span>
                  </span>
                </div>
              );
            })}
            {blockEvents.map((e, i) => {
              const blocker = players.find((p) => p.id === e.data.blockerId);
              const blocked = players.find((p) => p.id === e.data.targetId);
              return (
                <div key={`block-${i}`} className="glass" style={{
                  padding: "0.65rem 1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  fontSize: "var(--text-sm)",
                }}>
                  <span>🛡️</span>
                  <span>
                    <strong style={{ color: "var(--neon-purple)" }}>{blocker?.name}</strong>
                    {" blocked "}
                    <strong>{blocked?.name}</strong>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rematch / Quit */}
      <div className="stack gap-3" style={{ paddingBottom: "2rem" }}>
        {!rematchVoted ? (
          <>
            <button
              id="btn-rematch"
              className="btn btn-pink full"
              style={{ fontSize: "var(--text-lg)", minHeight: 56 }}
              onClick={() => vote(true)}
            >
              🔄 Rematch!
            </button>
            <button
              id="btn-quit"
              className="btn btn-ghost full"
              onClick={() => vote(false)}
            >
              Quit
            </button>
          </>
        ) : (
          <div className="glass" style={{
            padding: "1.25rem",
            textAlign: "center",
            color: "var(--text-secondary)",
            fontWeight: 700,
            fontSize: "var(--text-sm)",
          }}>
            ✓ Vote cast — waiting for others…
          </div>
        )}
      </div>
    </div>
  );
}
