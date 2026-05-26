// RulesCard.jsx — 10s rules screen shown before every round
import Timer from "./Timer";

const ROUND_COLORS = {
  1: "var(--neon-pink)",
  2: "var(--neon-cyan)",
  3: "var(--neon-purple)",
  4: "var(--neon-green)",
  5: "var(--neon-pink)",
  6: "var(--neon-cyan)",
  7: "var(--neon-purple)",
};

const ROUND_EMOJIS = { 1:"🔥", 2:"⚡", 3:"🕵️", 4:"🎭", 5:"👈", 6:"🎯", 7:"🃏" };

export default function RulesCard({ roundNumber, title, rulesText }) {
  const accentColor = ROUND_COLORS[roundNumber] || "var(--neon-cyan)";
  const emoji = ROUND_EMOJIS[roundNumber] || "🎮";

  return (
    <div className="grad-bg center" style={{
      flexDirection: "column",
      minHeight: "100vh",
      padding: "2rem 1.5rem",
      gap: "1.75rem",
      textAlign: "center",
    }}>
      {/* Round badge */}
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.35rem 1rem",
        background: `${accentColor}18`,
        border: `1.5px solid ${accentColor}44`,
        borderRadius: 999,
        fontSize: "var(--text-xs)",
        fontWeight: 800,
        color: accentColor,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
      }}>
        ROUND {roundNumber}
      </div>

      {/* Title */}
      <div>
        <div style={{ fontSize: "3.5rem", marginBottom: "0.5rem", lineHeight: 1 }}>{emoji}</div>
        <h1 className="font-display" style={{
          fontSize: "clamp(2.8rem, 12vw, 5.5rem)",
          lineHeight: 1,
          color: "#fff",
          textShadow: `0 0 40px ${accentColor}55`,
        }}>
          {title}
        </h1>
      </div>

      {/* Rules text */}
      <div className="glass" style={{
        maxWidth: 480,
        width: "100%",
        padding: "1.5rem 1.75rem",
        borderColor: `${accentColor}33`,
        boxShadow: `0 0 32px ${accentColor}15`,
      }}>
        <p style={{
          fontSize: "var(--text-lg)",
          lineHeight: 1.65,
          color: "rgba(255,255,255,0.88)",
          fontWeight: 600,
        }}>
          {rulesText}
        </p>
      </div>

      {/* Countdown */}
      <div className="stack" style={{ alignItems: "center", gap: "0.4rem" }}>
        <div style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}>
          Starting in
        </div>
        <Timer color={accentColor} />
      </div>
    </div>
  );
}
