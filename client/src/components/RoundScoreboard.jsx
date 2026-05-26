// RoundScoreboard.jsx — Feature 2: Post-round scoreboard overlay
// Shows for 8 seconds after every round ends (Rounds 1-4), before winner action.
// Displays all player scores, this-round points delta, and win reason.
import { useEffect, useState } from "react";
import { useGame } from "../context/GameContext";

export default function RoundScoreboard() {
  const { state, set } = useGame();
  const { roundScoreboard, playerId } = state;
  const [countdown, setCountdown] = useState(8);

  useEffect(() => {
    if (!roundScoreboard) return;
    setCountdown(8);

    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [roundScoreboard]);

  if (!roundScoreboard) return null;

  const { scores = [], winnerName, winReason } = roundScoreboard;

  const rankColors = ["var(--neon-yellow)", "rgba(255,255,255,0.7)", "rgba(255,255,255,0.5)"];
  const rankEmojis = ["🥇", "🥈", "🥉"];

  // SVG countdown ring params
  const r = 20;
  const circ = 2 * Math.PI * r; // ≈ 125.7
  const pct = countdown / 8;
  const dashOffset = circ * (1 - pct);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 7000,
      background: "rgba(13,13,15,0.92)",
      backdropFilter: "blur(16px)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "1.5rem 1rem",
      gap: "1.5rem",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: "var(--neon-cyan)", letterSpacing: "0.18em",
          textTransform: "uppercase", marginBottom: 6,
        }}>
          Round Complete
        </div>
        <h2 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2.5rem,8vw,4rem)",
          lineHeight: 1,
          background: "linear-gradient(135deg, var(--neon-yellow), var(--neon-pink))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          Scoreboard
        </h2>
      </div>

      {/* Scores list */}
      <div style={{ width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {scores.map((s, i) => {
          const isMe = s.playerId === playerId;
          const isWinner = s.isRoundWinner;
          const rankColor = rankColors[i] || "rgba(255,255,255,0.4)";
          return (
            <div
              key={s.playerId}
              className="score-row glass"
              style={{
                animationDelay: `${i * 0.08}s`,
                padding: "0.75rem 1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                borderColor: isWinner ? "var(--neon-yellow)" : isMe ? "var(--neon-cyan)" : "rgba(255,255,255,0.08)",
                boxShadow: isWinner ? "0 0 16px rgba(255,230,0,0.3)" : isMe ? "0 0 10px rgba(0,245,255,0.15)" : "none",
              }}
            >
              {/* Rank */}
              <div style={{
                width: 28, textAlign: "center",
                fontSize: i < 3 ? "1.3rem" : "0.9rem",
                fontWeight: 800, color: rankColor, flexShrink: 0,
              }}>
                {i < 3 ? rankEmojis[i] : `#${i + 1}`}
              </div>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 800, fontSize: "0.95rem",
                  color: isMe ? "var(--neon-cyan)" : "#fff",
                  display: "flex", alignItems: "center", gap: 6,
                  overflow: "hidden", whiteSpace: "nowrap",
                }}>
                  {isWinner && <span style={{ fontSize: "0.95rem" }}>👑</span>}
                  {s.name}
                  {isMe && <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 600 }}>(you)</span>}
                </div>
              </div>

              {/* Points this round */}
              {s.pointsThisRound !== 0 && (
                <div style={{
                  fontSize: "0.8rem", fontWeight: 800,
                  color: s.pointsThisRound > 0 ? "var(--neon-green)" : "var(--neon-pink)",
                  background: s.pointsThisRound > 0 ? "rgba(57,255,20,0.12)" : "rgba(255,45,120,0.12)",
                  border: `1px solid ${s.pointsThisRound > 0 ? "var(--neon-green)" : "var(--neon-pink)"}`,
                  borderRadius: "999px",
                  padding: "0.15rem 0.5rem",
                  flexShrink: 0,
                }}>
                  {s.pointsThisRound > 0 ? "+" : ""}{s.pointsThisRound}
                </div>
              )}

              {/* Total */}
              <div style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.3rem",
                color: rankColor,
                minWidth: 36,
                textAlign: "right",
                flexShrink: 0,
              }}>
                {s.totalPoints}
              </div>
            </div>
          );
        })}
      </div>

      {/* Win reason */}
      {winReason && (
        <div style={{
          textAlign: "center",
          maxWidth: 460,
          padding: "0.75rem 1rem",
          background: "rgba(255,230,0,0.08)",
          border: "1px solid rgba(255,230,0,0.2)",
          borderRadius: "1rem",
          fontSize: "0.9rem",
          fontWeight: 700,
          color: "rgba(255,255,255,0.85)",
          lineHeight: 1.5,
        }}>
          {winReason}
        </div>
      )}

      {/* Countdown ring */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <svg width={52} height={52} viewBox="0 0 52 52">
          {/* Track */}
          <circle
            cx={26} cy={26} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={4}
          />
          {/* Countdown arc */}
          <circle
            cx={26} cy={26} r={r}
            fill="none"
            stroke="var(--neon-cyan)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 26 26)"
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
          {/* Number */}
          <text
            x={26} y={30}
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontSize={16}
            fill={countdown <= 3 ? "var(--neon-pink)" : "var(--neon-cyan)"}
          >
            {countdown}
          </text>
        </svg>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
          winner action in…
        </div>
      </div>
    </div>
  );
}
