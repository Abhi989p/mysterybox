import { useState } from "react";
import socket from "../socket";
import { useGame } from "../context/GameContext";
import MysteryBox from "../components/MysteryBox";

export default function Home() {
  const { state, set } = useGame();
  const [mode, setMode] = useState(null); // "create" | "join"
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  function connect(cb) {
    if (!socket.connected) {
      socket.connect();
      socket.once("connect", cb);
    } else cb();
  }

  function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    set({ playerName: name.trim(), joinError: null });
    setLoading(true);
    connect(() => socket.emit("create_room", { displayName: name.trim() }));
  }

  function handleJoin(e) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    set({ playerName: name.trim(), joinError: null });
    setLoading(true);
    connect(() => socket.emit("join_room", { roomCode: code.trim().toUpperCase(), displayName: name.trim() }));
  }

  const floatBoxes = [1, 2, 3, 4, 5, 6];

  return (
    <div className="grad-bg" style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "1.5rem 1.25rem",
      gap: "1.75rem",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Ambient floating boxes */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {floatBoxes.map((n) => (
          <div key={n} style={{
            position: "absolute",
            left: `${10 + (n * 14)}%`,
            top: `${5 + (n * 12) % 70}%`,
            opacity: 0.08,
            animationDelay: `${n * 0.4}s`,
          }}>
            <MysteryBox number={n} size={56} animate="float" />
          </div>
        ))}
      </div>

      {/* Logo / Hero */}
      <div style={{ textAlign: "center", position: "relative", zIndex: 1 }} className="anim-fade-up">
        <div style={{ fontSize: "4rem", marginBottom: "0.25rem", lineHeight: 1 }}>🎁</div>
        <h1 className="font-display" style={{
          fontSize: "clamp(3.5rem, 14vw, 6.5rem)",
          lineHeight: 1,
          background: "linear-gradient(135deg, var(--neon-pink), var(--neon-cyan))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          textShadow: "none",
          filter: "drop-shadow(0 0 30px rgba(255,61,154,0.4))",
        }}>
          MYSTERYBOX
        </h1>
        <p style={{
          color: "var(--text-secondary)",
          fontSize: "var(--text-base)",
          fontWeight: 700,
          marginTop: "0.4rem",
          letterSpacing: "0.05em",
        }}>
          Bluff. Swap. Survive. 🎉
        </p>
      </div>

      {/* Glass card */}
      <div className="glass anim-fade-up" style={{
        width: "100%",
        maxWidth: 400,
        padding: "1.75rem 1.5rem",
        position: "relative",
        zIndex: 1,
        animationDelay: "0.06s",
      }}>
        {/* Mode selection */}
        {!mode && (
          <div className="stack gap-3">
            <button
              id="btn-create"
              className="btn btn-pink full"
              style={{ fontSize: "var(--text-lg)", letterSpacing: "0.02em" }}
              onClick={() => setMode("create")}
            >
              🎲 Create Room
            </button>
            <button
              id="btn-join"
              className="btn btn-cyan full"
              style={{ fontSize: "var(--text-lg)", letterSpacing: "0.02em" }}
              onClick={() => setMode("join")}
            >
              🔑 Join Room
            </button>
          </div>
        )}

        {/* Create Room form */}
        {mode === "create" && (
          <form onSubmit={handleCreate} className="stack gap-3">
            <h2 style={{ fontWeight: 900, fontSize: "var(--text-xl)", marginBottom: "0.25rem" }}>
              Create a Room
            </h2>
            <input
              id="input-name-create"
              className="input"
              placeholder="Your display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoFocus
              autoComplete="off"
            />
            {state.joinError && (
              <p style={{ color: "var(--neon-pink)", fontSize: "var(--text-sm)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                ⚠️ {state.joinError}
              </p>
            )}
            <button
              id="btn-create-submit"
              type="submit"
              className="btn btn-pink full"
              disabled={loading || !name.trim()}
              style={{ fontSize: "var(--text-base)" }}
            >
              {loading ? "Creating…" : "Create & Enter Lobby →"}
            </button>
            <button
              type="button"
              className="btn btn-ghost full"
              onClick={() => { setMode(null); setLoading(false); }}
            >
              ← Back
            </button>
          </form>
        )}

        {/* Join Room form */}
        {mode === "join" && (
          <form onSubmit={handleJoin} className="stack gap-3">
            <h2 style={{ fontWeight: 900, fontSize: "var(--text-xl)", marginBottom: "0.25rem" }}>
              Join a Room
            </h2>
            <input
              id="input-code"
              className="input"
              placeholder="Room Code (e.g. AB3X9Z)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoFocus
              autoComplete="off"
              style={{
                textAlign: "center",
                letterSpacing: "0.25em",
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-2xl)",
                color: "var(--neon-yellow)",
              }}
            />
            <input
              id="input-name-join"
              className="input"
              placeholder="Your display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoComplete="off"
            />
            {state.joinError && (
              <p style={{ color: "var(--neon-pink)", fontSize: "var(--text-sm)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                ⚠️ {state.joinError}
              </p>
            )}
            <button
              id="btn-join-submit"
              type="submit"
              className="btn btn-cyan full"
              disabled={loading || !name.trim() || code.length < 6}
              style={{ fontSize: "var(--text-base)" }}
            >
              {loading ? "Joining…" : "Enter Room →"}
            </button>
            <button
              type="button"
              className="btn btn-ghost full"
              onClick={() => { setMode(null); setLoading(false); }}
            >
              ← Back
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <p style={{
        fontSize: "var(--text-xs)",
        color: "var(--text-muted)",
        position: "relative",
        zIndex: 1,
        letterSpacing: "0.05em",
      }}>
        3–6 players · ~20 min
      </p>
    </div>
  );
}
