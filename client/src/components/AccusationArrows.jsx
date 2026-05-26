// AccusationArrows.jsx
// Desktop (>768px): SVG arrow ring diagram (original behaviour)
// Mobile (≤768px): animated list layout — each accuser row slides in staggered,
//   then most-accused row gets a glowing highlight
import { useEffect, useState } from "react";

const BOX_COLORS = [
  "var(--neon-pink)",
  "var(--neon-cyan)",
  "var(--neon-yellow)",
  "var(--neon-purple)",
  "var(--neon-green)",
  "var(--neon-orange)",
];

function getColor(index) {
  return BOX_COLORS[index % BOX_COLORS.length];
}

// ─── Mobile list layout ──────────────────────────────────────────────────────
function MobileList({ votes, players }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showHighlight, setShowHighlight] = useState(false);

  const entries = Object.entries(votes).map(([voterId, accusedId]) => {
    const voter   = players.find((p) => p.id === voterId);
    const accused = players.find((p) => p.id === accusedId);
    return { voterId, accusedId, voterName: voter?.name || "?", accusedName: accused?.name || "?" };
  });

  // Count how many accusations each player received
  const accuseCount = {};
  players.forEach((p) => { accuseCount[p.id] = 0; });
  Object.values(votes).forEach((id) => { accuseCount[id] = (accuseCount[id] || 0) + 1; });
  const maxAcc = Math.max(...Object.values(accuseCount), 0);
  const mostAccusedIds = Object.entries(accuseCount)
    .filter(([, c]) => c === maxAcc && maxAcc > 0)
    .map(([id]) => id);

  // Stagger row reveal — one row per 100 ms
  useEffect(() => {
    if (entries.length === 0) return;
    let idx = 0;
    const id = setInterval(() => {
      idx++;
      setVisibleCount(idx);
      if (idx >= entries.length) {
        clearInterval(id);
        // After all rows visible, wait 300 ms then glow the most-accused
        setTimeout(() => setShowHighlight(true), 300);
      }
    }, 120);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length]);

  if (entries.length === 0) return null;

  // Group by accused — which accuseds are most-accused
  const accusedGroups = {};
  entries.forEach((e) => {
    if (!accusedGroups[e.accusedId]) accusedGroups[e.accusedId] = [];
    accusedGroups[e.accusedId].push(e);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%" }}>
      {entries.map((e, i) => {
        const voterIdx   = players.findIndex((p) => p.id === e.voterId);
        const color      = getColor(voterIdx);
        const isMostAcc  = mostAccusedIds.includes(e.accusedId);
        const isVisible  = i < visibleCount;

        return (
          <div
            key={`${e.voterId}-${e.accusedId}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.65rem 1rem",
              borderRadius: "var(--radius-md)",
              background: isVisible
                ? (showHighlight && isMostAcc
                  ? "rgba(255,61,154,0.1)"
                  : "rgba(255,255,255,0.04)")
                : "transparent",
              border: `1.5px solid ${
                isVisible
                  ? showHighlight && isMostAcc
                    ? "rgba(255,61,154,0.45)"
                    : color + "44"
                  : "transparent"
              }`,
              boxShadow: showHighlight && isMostAcc && isVisible
                ? "0 0 20px rgba(255,61,154,0.25)"
                : "none",
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateX(0)" : "translateX(-16px)",
              transition: "opacity 0.25s ease, transform 0.25s ease, border-color 0.4s ease, box-shadow 0.4s ease, background 0.4s ease",
            }}
          >
            {/* Accuser avatar */}
            <div style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: color + "22",
              border: `2px solid ${color}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "var(--text-sm)",
              fontWeight: 900,
              color,
              flexShrink: 0,
            }}>
              {e.voterName[0].toUpperCase()}
            </div>

            {/* Voter name */}
            <span style={{
              fontSize: "var(--text-sm)",
              fontWeight: 800,
              color,
              minWidth: 52,
              whiteSpace: "nowrap",
            }}>
              {e.voterName}
            </span>

            {/* Arrow */}
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>→</span>

            {/* Accused name */}
            <span style={{
              fontSize: "var(--text-sm)",
              fontWeight: 800,
              color: showHighlight && isMostAcc ? "var(--neon-pink)" : "#fff",
              flex: 1,
              transition: "color 0.4s ease",
            }}>
              {e.accusedName}
            </span>

            {/* Most accused badge — appears with highlight */}
            {showHighlight && isMostAcc && (
              <span style={{
                fontSize: "var(--text-xs)",
                fontWeight: 800,
                color: "var(--neon-pink)",
                background: "rgba(255,61,154,0.12)",
                border: "1px solid rgba(255,61,154,0.35)",
                borderRadius: 999,
                padding: "0.1rem 0.45rem",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}>
                Most accused 👆
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Desktop SVG ring (original, unchanged) ──────────────────────────────────
function DesktopRing({ votes, players }) {
  const positions = {};
  players.forEach((p, i) => {
    const angle = (i / players.length) * 2 * Math.PI - Math.PI / 2;
    const cx = 150 + Math.cos(angle) * 110;
    const cy = 150 + Math.sin(angle) * 110;
    positions[p.id] = { cx, cy, name: p.name };
  });

  const arrows = Object.entries(votes).map(([voterId, accusedId]) => {
    const from = positions[voterId];
    const to   = positions[accusedId];
    if (!from || !to) return null;
    return { from, to, key: `${voterId}-${accusedId}` };
  }).filter(Boolean);

  return (
    <div style={{ position: "relative", width: 300, height: 300, margin: "0 auto" }}>
      <svg width="300" height="300" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#FF2D78" />
          </marker>
        </defs>
        {arrows.map(({ from, to, key }) => (
          <line key={key}
            x1={from.cx} y1={from.cy} x2={to.cx} y2={to.cy}
            stroke="#FF2D78" strokeWidth="2" strokeOpacity="0.7"
            markerEnd="url(#arrowhead)"
            className="arrow-path"
          />
        ))}
      </svg>
      {players.map((p, i) => {
        const pos   = positions[p.id];
        if (!pos) return null;
        const count = Object.values(votes).filter((v) => v === p.id).length;
        return (
          <div key={p.id} style={{
            position: "absolute",
            left: pos.cx - 24, top: pos.cy - 24,
            width: 48, height: 48, borderRadius: "50%",
            background: count > 0 ? "var(--neon-pink)" : "var(--surface)",
            border: "2px solid rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", fontSize: 11, fontWeight: 800,
            boxShadow: count > 0 ? "0 0 16px var(--neon-pink)" : "none",
            transition: "all 0.3s",
          }}>
            <span style={{ fontSize: 16 }}>{p.name[0].toUpperCase()}</span>
            {count > 0 && <span style={{ fontSize: 10, color: "#fff" }}>{count}×</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Responsive wrapper ───────────────────────────────────────────────────────
export default function AccusationArrows({ votes = {}, players = [] }) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : true
  );

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth <= 768); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (Object.keys(votes).length === 0) return null;

  return isMobile
    ? <MobileList votes={votes} players={players} />
    : <DesktopRing votes={votes} players={players} />;
}
