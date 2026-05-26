// MysteryBox.jsx — animated box component
import { useState } from "react";

const BOX_COLORS = ["#FF2D78","#00F5FF","#FFE600","#BF5AF2","#39FF14","#FF6B2B"];

export default function MysteryBox({ number, size = 80, animate = "float", color, onClick, label }) {
  const [shaking, setShaking] = useState(false);
  const bg = color || BOX_COLORS[(number - 1) % BOX_COLORS.length];

  function handleClick() {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
    onClick?.();
  }

  const cls = shaking ? "box-shake" : animate === "float" ? "box-float" : "";

  return (
    <div className={`stack items-center gap-1 cursor-pointer select-none ${onClick ? "" : "pointer-events-none"}`} onClick={handleClick}>
      <div className={cls} style={{ width: size, height: size, position: "relative" }}>
        {/* Box body */}
        <div style={{
          width: size, height: size * 0.75,
          background: bg, borderRadius: 12,
          position: "absolute", bottom: 0,
          boxShadow: `0 0 ${size * 0.3}px ${bg}66`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: size * 0.35, fontFamily: "var(--font-display)", color: "rgba(0,0,0,0.4)" }}>
            #{number}
          </span>
        </div>
        {/* Lid */}
        <div style={{
          width: size * 1.1, height: size * 0.22,
          background: `color-mix(in srgb, ${bg} 70%, white)`,
          borderRadius: "8px 8px 4px 4px",
          position: "absolute", top: 0, left: -size * 0.05,
          boxShadow: `0 -4px 12px ${bg}44`,
        }} />
        {/* Ribbon */}
        <div style={{
          width: size * 0.15, height: size,
          background: "rgba(0,0,0,0.2)",
          position: "absolute", left: "50%", transform: "translateX(-50%)",
          borderRadius: 4,
        }} />
      </div>
      {label && <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{label}</span>}
    </div>
  );
}
