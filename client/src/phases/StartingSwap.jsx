import { useState, useEffect, useRef } from "react";
import socket from "../socket";
import { useGame } from "../context/GameContext";
import MysteryBox from "../components/MysteryBox";
import Timer from "../components/Timer";
import SwapAnimation from "../components/SwapAnimation";

export default function StartingSwap() {
  const { state, set } = useGame();
  const { players, playerId, myBox, swapRequest, lastSwap, swapBlockedMsg, isSealed, swapPreview } = state;
  const [pendingTarget, setPendingTarget] = useState(null);
  const [sealToast, setSealToast] = useState(false);
  const [previewCountdown, setPreviewCountdown] = useState(null);
  const countdownRef = useRef(null);

  // Show a brief toast when our box seals
  useEffect(() => {
    if (!isSealed) return;
    setSealToast(true);
    setPreviewCountdown(null); // clear preview banner when seal fires
    if (countdownRef.current) clearInterval(countdownRef.current);
    const t = setTimeout(() => setSealToast(false), 3500);
    return () => clearTimeout(t);
  }, [isSealed]);

  // Drive the 3-2-1 countdown when server sends swap_preview
  useEffect(() => {
    if (!swapPreview) { setPreviewCountdown(null); return; }
    const totalMs = swapPreview.sealInMs;
    const startedAt = swapPreview.arrivedAt;
    const elapsed = Date.now() - startedAt;
    const startSec = Math.ceil((totalMs - elapsed) / 1000);
    setPreviewCountdown(Math.max(startSec, 1));
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setPreviewCountdown((s) => {
        if (s <= 1) { clearInterval(countdownRef.current); return null; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [swapPreview]);

  const others = players.filter((p) => p.id !== playerId);

  function sendRequest(targetId) {
    if (pendingTarget) return;
    setPendingTarget(targetId);
    socket.emit("swap_request", { to: targetId });
    setTimeout(() => setPendingTarget(null), 8000);
  }

  function respond(accepted) {
    socket.emit("swap_response", { accepted });
    set({ swapRequest: null });
  }

  return (
    <div className="grad-bg page stack gap-5" style={{ maxWidth: 480, margin: "0 auto" }}>
      {lastSwap && <SwapAnimation swap={lastSwap} players={players} />}

      {/* Header */}
      <div style={{ textAlign: "center", paddingTop: "0.5rem" }}>
        <div style={{
          display: "inline-flex",
          padding: "0.3rem 0.9rem",
          background: "rgba(255,107,53,0.12)",
          border: "1.5px solid rgba(255,107,53,0.3)",
          borderRadius: 999,
          fontSize: "var(--text-xs)",
          fontWeight: 800,
          color: "var(--neon-orange)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: "0.5rem",
        }}>
          Starting Swap Phase
        </div>
        <h1 className="font-display" style={{ fontSize: "clamp(2.2rem, 9vw, 3rem)", lineHeight: 1 }}>
          Make Your Move 🔀
        </h1>
        <p style={{
          color: "var(--text-muted)",
          fontSize: "var(--text-sm)",
          marginTop: "0.4rem",
          fontWeight: 600,
        }}>
          Request a swap with any player — they must agree.
        </p>
      </div>

      {/* Timer */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Timer color="var(--neon-orange)" />
      </div>

      {/* Fix 1: swap_preview countdown — visible only to the 2 players who just swapped */}
      {swapPreview && previewCountdown !== null && (
        <div className="glass banner-enter" style={{
          padding: "1.25rem 1.5rem",
          borderColor: "rgba(255,107,53,0.55)",
          boxShadow: "0 0 28px rgba(255,107,53,0.25)",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: "var(--text-xs)",
            fontWeight: 800,
            color: "var(--neon-orange)",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            marginBottom: "0.45rem",
          }}>
            📦 New box incoming — memorise it!
          </div>
          <div className="font-display" style={{
            fontSize: "var(--text-3xl)",
            color: "var(--neon-yellow)",
            lineHeight: 1,
            marginBottom: "0.65rem",
            textShadow: "0 0 24px rgba(255,215,0,0.5)",
          }}>
            BOX #{swapPreview.newBox}
          </div>
          {/* Draining countdown bar */}
          <div style={{
            width: "100%",
            height: 6,
            background: "rgba(255,255,255,0.1)",
            borderRadius: 999,
            overflow: "hidden",
            marginBottom: "0.4rem",
          }}>
            <div style={{
              height: "100%",
              width: `${(previewCountdown / Math.ceil(swapPreview.sealInMs / 1000)) * 100}%`,
              background: previewCountdown <= 1 ? "var(--neon-pink)" : "var(--neon-orange)",
              borderRadius: 999,
              transition: "width 0.9s linear, background 0.3s ease",
            }} />
          </div>
          <div style={{
            fontSize: "var(--text-xs)",
            fontWeight: 800,
            color: previewCountdown <= 1 ? "var(--neon-pink)" : "var(--text-muted)",
            transition: "color 0.3s ease",
          }}>
            🔒 Sealing in {previewCountdown}…
          </div>
        </div>
      )}

      {/* Seal toast */}
      {sealToast && (
        <div className="glass banner-enter" style={{
          padding: "0.875rem 1.25rem",
          borderColor: "rgba(255,255,255,0.2)",
          textAlign: "center",
          fontSize: "var(--text-sm)",
          fontWeight: 700,
          color: "rgba(255,255,255,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
        }}>
          🔒 Box sealed — you no longer know what you hold
        </div>
      )}

      {/* Incoming swap request */}
      {swapRequest && (
        <div className="glass glow-pink" style={{
          padding: "1.5rem",
          textAlign: "center",
          borderColor: "rgba(255,61,154,0.5)",
        }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🔀</div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 900, marginBottom: "1rem" }}>
            {swapRequest.fromName} wants to swap!
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              id="btn-accept-swap"
              className="btn btn-green full"
              style={{ fontSize: "var(--text-base)" }}
              onClick={() => respond(true)}
            >
              ✓ Accept
            </button>
            <button
              id="btn-decline-swap"
              className="btn btn-ghost full"
              style={{ fontSize: "var(--text-base)" }}
              onClick={() => respond(false)}
            >
              ✗ Decline
            </button>
          </div>
        </div>
      )}

      {/* Swap blocked message */}
      {swapBlockedMsg && (
        <div style={{
          textAlign: "center",
          color: "var(--neon-pink)",
          fontSize: "var(--text-sm)",
          fontWeight: 700,
          padding: "0.5rem",
          background: "rgba(255,61,154,0.08)",
          borderRadius: "var(--radius-md)",
          border: "1.5px solid rgba(255,61,154,0.25)",
        }}>
          {swapBlockedMsg}
        </div>
      )}

      {/* My box */}
      {myBox && (
        <div style={{ textAlign: "center" }}>
          <MysteryBox number={myBox} size={80} animate="float" label="Your Box" />
        </div>
      )}

      {/* Other players */}
      <div>
        <div style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: "0.65rem",
        }}>
          Swap with:
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
          gap: "0.75rem",
        }}>
          {others.map((p) => {
            const isPending = pendingTarget === p.id;
            return (
              <button
                key={p.id}
                id={`swap-target-${p.id}`}
                className="btn"
                style={{
                  flexDirection: "column",
                  gap: "0.6rem",
                  padding: "1rem 0.75rem",
                  minHeight: 100,
                  borderRadius: "var(--radius-lg)",
                  background: isPending
                    ? "rgba(255,61,154,0.1)"
                    : "rgba(255,255,255,0.05)",
                  border: `2px solid ${isPending ? "var(--neon-pink)" : "rgba(255,255,255,0.1)"}`,
                  boxShadow: isPending ? "0 0 20px rgba(255,61,154,0.3)" : "none",
                  transition: "all 0.2s ease",
                }}
                disabled={!!pendingTarget}
                onClick={() => sendRequest(p.id)}
              >
                <MysteryBox number={p.boxNumber} size={44} animate="none" />
                <span style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: 800,
                  color: isPending ? "var(--neon-pink)" : "#fff",
                }}>
                  {isPending ? "Pending…" : p.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pending request status */}
      {pendingTarget && !swapRequest && (
        <div style={{
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "var(--text-sm)",
          fontWeight: 700,
        }}>
          ⏳ Waiting for their response…
        </div>
      )}
    </div>
  );
}
