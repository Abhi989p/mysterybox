// PlayerList.jsx
const COLORS = ["#ff3d9a", "#00d4ff", "#ffd700", "#9b59ff", "#00ff88", "#ff6b35"];

export default function PlayerList({ players = [], myId, hostId, showBox = false }) {
  return (
    <div className="stack gap-2">
      {players.map((p, i) => {
        const isMe = p.id === myId;
        const isHost = p.id === hostId;
        const color = COLORS[i % COLORS.length];
        return (
          <div key={p.id} style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            background: isMe ? `${color}12` : "rgba(255,255,255,0.04)",
            border: `1.5px solid ${isMe ? color : "rgba(255,255,255,0.08)"}`,
            borderRadius: "var(--radius-md)",
            opacity: p.connected === false ? 0.45 : 1,
            transition: "all 0.2s ease",
          }}>
            {/* Avatar */}
            <div style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 18,
              color: "#000",
              flexShrink: 0,
            }}>
              {p.name[0].toUpperCase()}
            </div>

            {/* Name + badges */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                flexWrap: "wrap",
              }}>
                <span style={{
                  fontWeight: 800,
                  fontSize: "var(--text-base)",
                  color: isMe ? color : "var(--text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                }}>
                  {isHost && <span style={{ marginRight: 4 }}>👑</span>}
                  {p.name}
                </span>
                {isMe && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: color,
                    background: `${color}20`,
                    border: `1px solid ${color}`,
                    borderRadius: 999,
                    padding: "1px 6px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}>
                    YOU
                  </span>
                )}
                {isHost && !isMe && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "var(--neon-yellow)",
                    background: "rgba(255,215,0,0.12)",
                    border: "1px solid rgba(255,215,0,0.3)",
                    borderRadius: 999,
                    padding: "1px 6px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}>
                    HOST
                  </span>
                )}
              </div>
              {p.connected === false && (
                <span style={{ fontSize: 11, color: "var(--neon-pink)", fontWeight: 700 }}>
                  ⚠ disconnected
                </span>
              )}
            </div>

            {showBox && p.boxNumber && (
              <span style={{
                fontSize: "var(--text-sm)",
                fontWeight: 800,
                color: color,
                background: `${color}15`,
                border: `1px solid ${color}33`,
                borderRadius: "var(--radius-sm)",
                padding: "4px 10px",
                flexShrink: 0,
              }}>
                #{p.boxNumber}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
