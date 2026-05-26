// Timer.jsx — displays server-authoritative timer with urgent pulse
import { useGame } from "../context/GameContext";

export default function Timer({ color = "var(--neon-cyan)", showBar = true }) {
  const { state } = useGame();
  const t = Math.max(0, state.timer ?? 0);
  const urgent = t <= 5;
  const displayColor = urgent ? "var(--neon-pink)" : color;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "0.35rem",
    }}>
      {/* Number */}
      <span style={{
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-4xl)",
        color: displayColor,
        transition: "color 0.3s ease",
        animation: urgent ? "pulse-ring 0.9s ease-out infinite" : "none",
        lineHeight: 1,
        minWidth: "2ch",
        textAlign: "center",
        display: "block",
      }}>
        {t}
      </span>

      {/* Progress bar */}
      {showBar && (
        <div style={{
          width: 100,
          height: 5,
          background: "rgba(255,255,255,0.1)",
          borderRadius: 3,
          overflow: "hidden",
        }}>
          <div
            className="timer-bar"
            style={{
              background: displayColor,
              height: "100%",
              borderRadius: 3,
              transition: "background 0.3s ease",
            }}
          />
        </div>
      )}
    </div>
  );
}
