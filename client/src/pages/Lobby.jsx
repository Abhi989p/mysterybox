import { useState } from "react";
import socket from "../socket";
import { useGame } from "../context/GameContext";
import PlayerList from "../components/PlayerList";
import MysteryBox from "../components/MysteryBox";

export default function Lobby() {
  const { state } = useGame();
  const { roomCode, players, playerId, isHost } = state;
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function startGame() {
    socket.emit("start_game");
  }

  const canStart = isHost && players.length >= 3;
  const needMore = Math.max(0, 3 - players.length);

  return (
    <div className="grad-bg page stack gap-5" style={{ maxWidth: 480, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ textAlign: "center", paddingTop: "0.5rem" }} className="anim-fade-up">
        <span style={{
          fontSize: "var(--text-xs)",
          fontWeight: 800,
          color: "var(--neon-cyan)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}>
          Waiting Room
        </span>
        <h1 className="font-display" style={{
          fontSize: "clamp(2.5rem, 10vw, 3.5rem)",
          marginTop: "0.2rem",
          lineHeight: 1,
        }}>
          MysteryBox 🎁
        </h1>
      </div>

      {/* Room code — the most important thing in this screen */}
      <div className="glass anim-fade-up" style={{
        padding: "1.5rem",
        textAlign: "center",
        borderColor: "rgba(255,215,0,0.25)",
        boxShadow: "0 0 32px rgba(255,215,0,0.08)",
        animationDelay: "0.05s",
      }}>
        <div style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
          marginBottom: "0.5rem",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.15em",
        }}>
          Share this code
        </div>
        <button
          id="btn-copy-code"
          onClick={copyCode}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.8rem, 12vw, 4rem)",
            letterSpacing: "0.3em",
            color: "var(--neon-yellow)",
            background: "none",
            border: "none",
            cursor: "pointer",
            textShadow: "0 0 24px rgba(255,215,0,0.6)",
            lineHeight: 1,
            display: "block",
            width: "100%",
            padding: "0.25rem 0",
          }}
          title="Tap to copy"
        >
          {roomCode}
        </button>
        <div style={{
          fontSize: "var(--text-sm)",
          fontWeight: 700,
          color: copied ? "var(--neon-green)" : "var(--text-muted)",
          marginTop: "0.5rem",
          transition: "color 0.3s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.3rem",
        }}>
          {copied ? "✓ Copied to clipboard!" : "📋 Tap to copy"}
        </div>
      </div>

      {/* Floating idle boxes — one per player, dashes for empty */}
      <div style={{
        display: "flex",
        gap: "0.75rem",
        justifyContent: "center",
        flexWrap: "wrap",
        alignItems: "flex-end",
      }}>
        {players.map((p, i) => (
          <div key={p.id} className="anim-fade-up" style={{
            textAlign: "center",
            animationDelay: `${i * 0.07}s`,
          }}>
            <MysteryBox number={i + 1} size={52} animate="float" />
          </div>
        ))}
        {Array.from({ length: Math.max(0, 3 - players.length) }).map((_, i) => (
          <div key={`empty-${i}`} style={{
            width: 52,
            height: 68,
            borderRadius: "var(--radius-md)",
            border: "2px dashed rgba(255,255,255,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <span style={{ fontSize: 22, opacity: 0.25 }}>?</span>
          </div>
        ))}
      </div>

      {/* Player list */}
      <div className="anim-fade-up" style={{ animationDelay: "0.1s" }}>
        <div style={{
          fontSize: "var(--text-xs)",
          fontWeight: 800,
          color: "var(--text-muted)",
          marginBottom: "0.6rem",
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>Players</span>
          <span style={{ color: players.length >= 3 ? "var(--neon-green)" : "var(--text-muted)" }}>
            {players.length}/6
          </span>
        </div>
        <PlayerList players={players} myId={playerId} hostId={state.hostId} />
      </div>

      {/* Status / Start */}
      <div className="stack gap-3" style={{ marginTop: "auto", paddingBottom: "1.5rem" }}>
        {!isHost && (
          <div className="glass" style={{
            padding: "1rem 1.25rem",
            textAlign: "center",
            color: "var(--text-secondary)",
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}>
            <span style={{ opacity: 0.7 }}>⏳</span>
            Waiting for host to start the game…
          </div>
        )}

        {isHost && (
          <>
            {needMore > 0 && (
              <div style={{
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "var(--text-sm)",
                fontWeight: 700,
                padding: "0.5rem",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "var(--radius-md)",
                border: "1.5px dashed rgba(255,255,255,0.1)",
              }}>
                Need {needMore} more player{needMore !== 1 ? "s" : ""} to start
              </div>
            )}
            <button
              id="btn-start"
              className="btn btn-yellow full"
              style={{ fontSize: "var(--text-lg)", fontWeight: 900, minHeight: 56 }}
              onClick={startGame}
              disabled={!canStart}
            >
              {canStart ? "🚀 Start Game!" : `Waiting (${players.length}/3 min)`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
