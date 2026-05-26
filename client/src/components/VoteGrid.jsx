// VoteGrid.jsx — reusable tap-to-vote player grid
const COLORS = ["#ff3d9a", "#00d4ff", "#ffd700", "#9b59ff", "#00ff88", "#ff6b35"];

export default function VoteGrid({ players = [], myId, onVote, voted, canVoteSelf = true, label = "Vote for:" }) {
  return (
    <div className="stack gap-3">
      {label && (
        <div style={{
          fontSize: "var(--text-xs)",
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}>
          {label}
        </div>
      )}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: "0.75rem",
      }}>
        {players.map((p, i) => {
          const isMe = p.id === myId;
          const isDisabled = !!voted || (!canVoteSelf && isMe);
          const isVoted = voted === p.id;
          const color = COLORS[i % COLORS.length];
          return (
            <button
              key={p.id}
              id={`vote-${p.id}`}
              className="btn"
              disabled={isDisabled}
              onClick={() => onVote(p.id)}
              style={{
                flexDirection: "column",
                gap: "0.5rem",
                padding: "1rem 0.75rem",
                minHeight: 96,
                borderRadius: "var(--radius-lg)",
                background: isVoted ? color : "rgba(255,255,255,0.05)",
                border: `2px solid ${isVoted ? color : "rgba(255,255,255,0.1)"}`,
                color: isVoted ? "#000" : "#fff",
                boxShadow: isVoted ? `0 0 24px ${color}66` : "none",
                transition: "all 0.2s ease",
                opacity: (!canVoteSelf && isMe) ? 0.35 : 1,
              }}
            >
              {/* Avatar circle */}
              <div style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: isVoted ? "rgba(0,0,0,0.25)" : color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 20,
                color: isVoted ? "#000" : "#000",
                flexShrink: 0,
                border: isVoted ? "2px solid rgba(0,0,0,0.2)" : "none",
              }}>
                {p.name[0].toUpperCase()}
              </div>

              {/* Name */}
              <span style={{
                fontSize: "var(--text-sm)",
                fontWeight: 800,
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textAlign: "center",
                color: isVoted ? "#000" : "#fff",
              }}>
                {p.name}{isMe ? " (you)" : ""}
              </span>

              {/* Can't vote self label */}
              {!canVoteSelf && isMe && (
                <span style={{ fontSize: 10, opacity: 0.6, color: "#fff" }}>can't vote self</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
