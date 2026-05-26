// SwapKeepBanner.jsx — Feature 3: Swap/Keep notification banner
// Shows a full-width banner to all players after every winner action (and starting swap).
// Types: 'swap' (4s), 'keep' (3s), 'no_swap' (2s)
import { useEffect, useRef, useState } from "react";
import { useGame } from "../context/GameContext";

export default function SwapKeepBanner() {
  const { state } = useGame();
  const { swapNotification } = state;
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!swapNotification) return;

    // Clear any existing timer
    if (timerRef.current) clearTimeout(timerRef.current);
    setExiting(false);
    setVisible(true);

    const displayMs = swapNotification.type === "swap" ? 3600
      : swapNotification.type === "keep" ? 2600
      : 1800; // no_swap

    timerRef.current = setTimeout(() => {
      setExiting(true);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setExiting(false);
      }, 400);
    }, displayMs);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [swapNotification]);

  if (!visible || !swapNotification) return null;

  const { type, playerA, playerB, boxA, boxB, keepPlayer } = swapNotification;

  let icon, headline, sub;
  if (type === "swap") {
    icon = "🔄";
    headline = `${playerA} swapped boxes with ${playerB}!`;
    sub = boxA != null && boxB != null ? `Box #${boxA}  ←→  Box #${boxB}` : null;
  } else if (type === "keep") {
    icon = "😏";
    headline = `${keepPlayer} is staying confident — no swap.`;
    sub = null;
  } else {
    icon = "🎲";
    headline = "No swaps were made. Let the games begin.";
    sub = null;
  }

  const borderColor = type === "swap" ? "var(--neon-cyan)"
    : type === "keep" ? "var(--neon-purple)"
    : "var(--neon-orange)";

  const bgColor = type === "swap" ? "rgba(0,245,255,0.08)"
    : type === "keep" ? "rgba(191,90,242,0.08)"
    : "rgba(255,107,43,0.08)";

  return (
    <div
      className={exiting ? "banner-exit" : "banner-enter"}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 8000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.35rem",
        padding: "1rem 1.5rem",
        background: bgColor,
        backdropFilter: "blur(20px)",
        borderBottom: `2px solid ${borderColor}`,
        boxShadow: `0 4px 32px ${borderColor}33`,
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <span style={{ fontSize: "1.6rem" }}>{icon}</span>
        <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#fff" }}>{headline}</span>
      </div>
      {sub && (
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.1rem",
          color: borderColor,
          letterSpacing: "0.08em",
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}
