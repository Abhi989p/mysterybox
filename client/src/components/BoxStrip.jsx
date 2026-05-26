// BoxStrip.jsx — Feature 1: Persistent box number strip
// Shown to each player throughout the game after box assignment.
// Hidden only during HOME, LOBBY, BOX_ASSIGNMENT, FINAL_REVEAL, RECAP.
// Shows 🔒 when box is sealed, 📦 during the initial 5s reveal window.
import { useEffect, useRef, useState } from "react";
import { useGame } from "../context/GameContext";

const HIDDEN_PHASES = new Set(["HOME", "LOBBY", "BOX_ASSIGNMENT", "FINAL_REVEAL", "RECAP"]);

export default function BoxStrip() {
  const { state } = useGame();
  const { myBox, phase, isSealed } = state;
  const [pulsing, setPulsing] = useState(false);
  const prevBox    = useRef(myBox);
  const prevSealed = useRef(isSealed);

  // Pulse when box number changes (swap happened)
  useEffect(() => {
    if (prevBox.current !== null && myBox !== null && prevBox.current !== myBox) {
      setPulsing(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPulsing(true));
      });
      const t = setTimeout(() => setPulsing(false), 700);
      prevBox.current = myBox;
      return () => clearTimeout(t);
    }
    prevBox.current = myBox;
  }, [myBox]);

  // Also pulse when seal state changes (box just got locked)
  useEffect(() => {
    if (prevSealed.current !== isSealed) {
      setPulsing(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPulsing(true));
      });
      const t = setTimeout(() => setPulsing(false), 700);
      prevSealed.current = isSealed;
      return () => clearTimeout(t);
    }
    prevSealed.current = isSealed;
  }, [isSealed]);

  if (HIDDEN_PHASES.has(phase) || !myBox) return null;

  const BOX_COLORS = ["#FF2D78", "#00F5FF", "#FFE600", "#BF5AF2", "#39FF14", "#FF6B2B"];
  const boxColor = BOX_COLORS[(myBox - 1) % BOX_COLORS.length];

  return (
    <div
      className={pulsing ? "box-strip-pulse" : ""}
      style={{
        position: "fixed",
        top: "1rem",
        right: "1rem",
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.45rem 0.85rem",
        background: "rgba(13,13,15,0.85)",
        backdropFilter: "blur(12px)",
        border: `2px solid ${isSealed ? "rgba(255,255,255,0.2)" : boxColor}`,
        borderRadius: "999px",
        boxShadow: isSealed ? "none" : `0 0 12px ${boxColor}55`,
        transition: "border-color 0.5s, box-shadow 0.5s, opacity 0.5s",
        opacity: isSealed ? 0.55 : 1,
        userSelect: "none",
        pointerEvents: "none",
      }}
    >
      {/* Sealed: lock icon; Unsealed (first 5s): open box icon */}
      <span style={{ fontSize: "1rem" }}>
        {isSealed ? "🔒" : "📦"}
      </span>
      <span style={{
        fontFamily: "var(--font-body)",
        fontWeight: 800,
        fontSize: "0.85rem",
        color: "rgba(255,255,255,0.7)",
        whiteSpace: "nowrap",
      }}>
        {isSealed ? "Sealed:" : "Your Box:"}
      </span>
      <span style={{
        fontFamily: "var(--font-display)",
        fontSize: "1.1rem",
        color: isSealed ? "rgba(255,255,255,0.5)" : boxColor,
        letterSpacing: "0.04em",
        transition: "color 0.5s",
      }}>
        #{myBox}
      </span>
    </div>
  );
}
