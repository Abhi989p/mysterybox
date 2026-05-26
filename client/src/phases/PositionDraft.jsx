import socket from "../socket";
import { useGame } from "../context/GameContext";
import Timer from "../components/Timer";

export default function PositionDraft() {
  const { state } = useGame();
  const { playerId, players, draft } = state;
  const { order = [], slots = [], picks = {}, currentPicker } = draft;
  const isMyTurn = currentPicker === playerId;
  const myPick = picks[playerId];

  function pick(slot) {
    socket.emit("draft_pick", { slot });
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
          Round 6
        </div>
        <h1 className="font-display" style={{ fontSize: "clamp(2.2rem, 9vw, 3rem)", lineHeight: 1 }}>
          Position Draft 🎯
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: "0.4rem", fontWeight: 600 }}>
          Earlier = act first. Later = react to everything.
        </p>
      </div>

      {/* Timer */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Timer color="var(--neon-cyan)" />
      </div>

      {/* Current picker banner */}
      <div className="glass" style={{
        padding: "1rem 1.25rem",
        textAlign: "center",
        borderColor: isMyTurn ? "rgba(255,215,0,0.5)" : "var(--border)",
        boxShadow: isMyTurn ? "0 0 28px rgba(255,215,0,0.2)" : "none",
        transition: "all 0.3s ease",
      }}>
        {isMyTurn ? (
          <span style={{ fontWeight: 900, fontSize: "var(--text-lg)", color: "var(--neon-yellow)" }}>
            🎯 Your turn — pick your slot!
          </span>
        ) : (
          <span style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text-secondary)" }}>
            ⏳ {players.find((p) => p.id === currentPicker)?.name ?? "…"} is picking…
          </span>
        )}
      </div>

      {/* My current pick */}
      {myPick && (
        <div style={{
          textAlign: "center",
          padding: "0.75rem 1rem",
          background: "rgba(0,212,255,0.08)",
          border: "1.5px solid rgba(0,212,255,0.3)",
          borderRadius: "var(--radius-md)",
          fontWeight: 800,
          color: "var(--neon-cyan)",
          fontSize: "var(--text-sm)",
        }}>
          ✓ You picked slot <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)" }}>{myPick}</span>
        </div>
      )}

      {/* Slot grid — only shown when my turn and not yet picked */}
      {isMyTurn && !myPick && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
          gap: "0.75rem",
        }}>
          {slots.map((slot) => (
            <button
              key={slot}
              id={`slot-${slot}`}
              className="btn btn-yellow"
              style={{
                flexDirection: "column",
                minHeight: 96,
                borderRadius: "var(--radius-lg)",
                gap: "0.25rem",
              }}
              onClick={() => pick(slot)}
            >
              <span className="font-display" style={{ fontSize: "var(--text-3xl)", color: "#000", lineHeight: 1 }}>
                {slot}
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: "rgba(0,0,0,0.6)", fontWeight: 700 }}>
                {slot === 1 ? "First" : slot === Math.max(...slots) ? "Last" : `Pos ${slot}`}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Draft order list */}
      <div className="stack gap-2">
        <div style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: "0.25rem",
        }}>
          Draft Order
        </div>
        {order.map((pid, i) => {
          const p = players.find((pl) => pl.id === pid);
          const picked = picks[pid];
          const isCurrent = pid === currentPicker;
          const isDone = !!picked;
          return (
            <div key={pid} style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              background: isCurrent
                ? "rgba(255,215,0,0.08)"
                : isDone
                  ? "rgba(0,255,136,0.04)"
                  : "rgba(255,255,255,0.04)",
              border: `1.5px solid ${isCurrent ? "rgba(255,215,0,0.4)" : isDone ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.07)"}`,
              borderRadius: "var(--radius-md)",
              opacity: isDone && !isCurrent ? 0.65 : 1,
              transition: "all 0.2s ease",
            }}>
              <span style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-xl)",
                color: isCurrent ? "var(--neon-yellow)" : "rgba(255,255,255,0.2)",
                width: 28,
                textAlign: "center",
                flexShrink: 0,
              }}>
                {i + 1}
              </span>
              <span style={{
                fontWeight: 800,
                flex: 1,
                fontSize: "var(--text-base)",
                color: isCurrent ? "var(--neon-yellow)" : pid === playerId ? "var(--neon-cyan)" : "#fff",
              }}>
                {p?.name}{pid === playerId ? " (you)" : ""}
              </span>
              {picked ? (
                <span style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-xl)",
                  color: "var(--neon-cyan)",
                  fontWeight: 700,
                }}>
                  Slot {picked}
                </span>
              ) : isCurrent ? (
                <span style={{ fontSize: "var(--text-xs)", color: "var(--neon-yellow)", fontWeight: 800 }}>Picking…</span>
              ) : (
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Waiting</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
