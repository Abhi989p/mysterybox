// CardFlip.jsx — 3D CSS card reveal
const CARD_META = {
  blind_swap: { emoji: "🔀", color: "#FF2D78", label: "Blind Swap", desc: "Swap your box with anyone — no peeking." },
  view:       { emoji: "👁️", color: "#00F5FF", label: "View",       desc: "Secretly see one box's contents." },
  see_swap:   { emoji: "🔍", color: "#BF5AF2", label: "See & Swap", desc: "View a box, then decide to swap." },
  block:      { emoji: "🛡️", color: "#FFE600", label: "Block",      desc: "Prevent one player from swapping with you." },
};

export default function CardFlip({ card, flipped }) {
  const meta = CARD_META[card] || {};
  return (
    <div className="card-3d" style={{ width: 180, height: 240 }}>
      <div className={`card-inner ${flipped ? "flipped" : ""}`} style={{ width: "100%", height: "100%" }}>
        {/* Front — face down */}
        <div className="card-face glass" style={{ background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "4rem" }}>🎁</span>
        </div>
        {/* Back — card revealed */}
        <div className="card-face card-back" style={{
          background: `linear-gradient(135deg, ${meta.color}22, ${meta.color}44)`,
          border: `2px solid ${meta.color}`,
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: "0.75rem", padding: "1rem", borderRadius: "1rem",
          boxShadow: `0 0 30px ${meta.color}44`,
        }}>
          <span style={{ fontSize: "3rem" }}>{meta.emoji}</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", color: meta.color }}>{meta.label}</span>
          <span style={{ fontSize: "0.8rem", textAlign: "center", color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>{meta.desc}</span>
        </div>
      </div>
    </div>
  );
}

export { CARD_META };
