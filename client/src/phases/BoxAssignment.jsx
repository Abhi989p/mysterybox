import { useEffect, useState } from "react";
import { useGame } from "../context/GameContext";
import MysteryBox from "../components/MysteryBox";

export default function BoxAssignment() {
  const { state } = useGame();
  const { myBox, hasPrize, isSealed, allBoxes, players } = state;

  // Countdown: 5 → 0 (matches server-side 5s seal timer)
  const [secsLeft, setSecsLeft] = useState(5);
  const [sealAnimating, setSealAnimating] = useState(false);

  // Tick the countdown only while not yet sealed
  useEffect(() => {
    if (isSealed || !myBox) return;
    setSecsLeft(5);
    const id = setInterval(() => {
      setSecsLeft((s) => {
        if (s <= 1) { clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [myBox]);

  // Trigger lock animation when server fires box_sealed
  useEffect(() => {
    if (!isSealed) return;
    setSealAnimating(true);
    const t = setTimeout(() => setSealAnimating(false), 900);
    return () => clearTimeout(t);
  }, [isSealed]);

  const prizeColor  = "var(--neon-yellow)";
  const emptyColor  = "var(--neon-cyan)";
  const contentColor = hasPrize ? prizeColor : emptyColor;

  return (
    <div className="grad-bg" style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem 1.25rem",
      gap: "2rem",
      textAlign: "center",
      background: `radial-gradient(ellipse at 50% 0%, rgba(155,89,255,0.2) 0%, transparent 60%),
                   var(--bg-primary)`,
    }}>
      {/* Header */}
      <div>
        <div style={{
          display: "inline-flex",
          padding: "0.3rem 0.9rem",
          background: "rgba(0,212,255,0.1)",
          border: "1.5px solid rgba(0,212,255,0.3)",
          borderRadius: 999,
          fontSize: "var(--text-xs)",
          fontWeight: 800,
          color: "var(--neon-cyan)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          marginBottom: "0.75rem",
        }}>
          Box Assignment
        </div>
        <h1 className="font-display" style={{
          fontSize: "clamp(2.2rem, 8vw, 3.5rem)",
          lineHeight: 1,
          textShadow: "0 0 30px rgba(155,89,255,0.3)",
        }}>
          Your Mystery Box
        </h1>
      </div>

      {myBox && (
        <div className="box-pop" style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
        }}>
          {/* The box */}
          <MysteryBox number={myBox} size={130} animate="float" />

          {/* Prize / Empty reveal — only shown during 5s window */}
          {!isSealed && hasPrize !== null && (
            <div className="glass" style={{
              padding: "1.5rem 2rem",
              borderColor: contentColor,
              boxShadow: `0 0 40px ${contentColor}50`,
              transition: "all 0.4s ease",
              minWidth: 240,
            }}>
              <div style={{ fontSize: "3rem", marginBottom: "0.5rem", lineHeight: 1 }}>
                {hasPrize ? "🎁" : "📦"}
              </div>
              <div className="font-display" style={{
                fontSize: "var(--text-2xl)",
                color: contentColor,
                textShadow: `0 0 20px ${contentColor}66`,
                marginBottom: "0.5rem",
              }}>
                {hasPrize ? "IT'S THE PRIZE!" : "Empty Box"}
              </div>
              <div style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
                fontWeight: 600,
                lineHeight: 1.5,
              }}>
                {hasPrize
                  ? "🔥 You hold the prize! Guard it well."
                  : "📭 Empty — but that can change…"}
              </div>
            </div>
          )}

          {/* Box number badge */}
          <div className="glass glow-yellow" style={{ padding: "0.75rem 2rem" }}>
            <span className="font-display" style={{
              fontSize: "var(--text-2xl)",
              color: "var(--neon-yellow)",
            }}>
              BOX #{myBox} — YOURS
            </span>
          </div>

          {/* Countdown or sealed state */}
          {!isSealed ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
              <div style={{
                width: 220,
                height: 8,
                background: "rgba(255,255,255,0.1)",
                borderRadius: 999,
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${(secsLeft / 5) * 100}%`,
                  background: secsLeft <= 2 ? "var(--neon-pink)" : contentColor,
                  borderRadius: 999,
                  transition: "width 0.9s linear, background 0.3s ease",
                }} />
              </div>
              <div style={{
                fontSize: "var(--text-sm)",
                fontWeight: 800,
                color: secsLeft <= 2 ? "var(--neon-pink)" : "var(--text-muted)",
                transition: "color 0.3s ease",
                letterSpacing: "0.05em",
              }}>
                {secsLeft > 0 ? `🔓 Sealing in ${secsLeft}s…` : "Sealing now…"}
              </div>
            </div>
          ) : (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
              animation: sealAnimating ? "seal-pop 0.5s cubic-bezier(0.34,1.56,0.64,1)" : undefined,
            }}>
              <div style={{ fontSize: "3rem" }}>🔒</div>
              <div className="glass" style={{
                padding: "1rem 1.75rem",
                borderColor: "rgba(255,255,255,0.2)",
                maxWidth: 320,
              }}>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 800, color: "rgba(255,255,255,0.75)", marginBottom: "0.35rem" }}>
                  Box sealed.
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 600, lineHeight: 1.5 }}>
                  You won't see inside again until the Final Reveal — unless you use a View card.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* All boxes in play */}
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
          marginBottom: "0.75rem",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}>
          All boxes in play
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center" }}>
          {(allBoxes.length ? allBoxes : players).map((p, i) => (
            <div key={p.id} style={{ textAlign: "center" }}>
              <MysteryBox number={p.boxNumber || i + 1} size={56} animate="float" label={p.name} />
            </div>
          ))}
        </div>
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", fontWeight: 700 }}>
        🔀 Starting swap phase begins in a moment…
      </p>
    </div>
  );
}
