import { useState, useEffect } from "react";
import socket from "../socket";
import { useGame } from "../context/GameContext";
import CardFlip, { CARD_META } from "../components/CardFlip";
import MysteryBox from "../components/MysteryBox";
import SwapAnimation from "../components/SwapAnimation";

export default function FinalCardPhase() {
  const { state, set } = useGame();
  const { playerId, players, myCard, cardPhase, myBox, lastSwap, viewResult, viewEvent, blockEvent, actionOrder: rootActionOrder } = state;
  const [flipped, setFlipped] = useState(false);
  const [actionDone, setActionDone] = useState(false);
  const [seeSwapStep, setSeeSwapStep] = useState("idle"); // idle | viewing | deciding
  const [targetId, setTargetId] = useState(null);
  const [viewResultLocal, setViewResultLocal] = useState(null);

  const isMyTurn = cardPhase?.currentActorId === playerId;
  const meta = CARD_META[myCard] || {};

  // When view_result arrives and we have VIEW card (not see_swap), capture it locally
  useEffect(() => {
    if (viewResult && myCard === "view" && actionDone) {
      setViewResultLocal(viewResult);
    }
  }, [viewResult]);

  // Auto-clear blockEvent / viewEvent banners after 3s
  useEffect(() => {
    if (!blockEvent) return;
    const t = setTimeout(() => set({ blockEvent: null }), 3000);
    return () => clearTimeout(t);
  }, [blockEvent]);

  useEffect(() => {
    if (!viewEvent) return;
    const t = setTimeout(() => set({ viewEvent: null }), 3000);
    return () => clearTimeout(t);
  }, [viewEvent]);

  function playBlindSwap(tid) {
    socket.emit("blind_swap_played", { targetPlayer: tid });
    setActionDone(true);
  }

  function playBlock(tid) {
    socket.emit("block_played", { targetPlayer: tid });
    setActionDone(true);
  }

  function playView(tid) {
    socket.emit("view_request", { targetBox: players.find((p) => p.id === tid)?.boxNumber });
    setActionDone(true);
  }

  function playSeeSwap(tid) {
    if (seeSwapStep === "idle") {
      setSeeSwapStep("viewing");
      socket.emit("see_swap_played", { targetPlayer: tid, swapDecision: null });
    }
  }

  function decideSeeSwap(doSwap) {
    socket.emit("see_swap_played", { targetPlayer: targetId, swapDecision: doSwap });
    setSeeSwapStep("idle");
    setActionDone(true);
  }

  function renderAction() {
    if (!isMyTurn || actionDone || !flipped) return null;
    const others = players.filter((p) => p.id !== playerId);
    const cardColor = meta.color || "var(--neon-purple)";

    if (myCard === "blind_swap") return (
      <div className="stack gap-3">
        <div style={{
          textAlign: "center",
          fontSize: "var(--text-sm)",
          fontWeight: 700,
          color: "var(--text-secondary)",
          padding: "0.5rem 0",
        }}>
          🔀 Swap your box with:
        </div>
        {others.map((p) => (
          <button key={p.id} className="btn btn-pink full" onClick={() => playBlindSwap(p.id)}>
            🔀 {p.name} <span style={{ opacity: 0.65, fontSize: "var(--text-sm)" }}>(Box #{p.boxNumber})</span>
          </button>
        ))}
      </div>
    );

    if (myCard === "view") return (
      <div className="stack gap-3">
        <div style={{
          textAlign: "center",
          fontSize: "var(--text-sm)",
          fontWeight: 700,
          color: "var(--text-secondary)",
        }}>
          👁️ Secretly peek inside one box:
        </div>
        {others.map((p) => (
          <button key={p.id} className="btn btn-cyan full" onClick={() => playView(p.id)}>
            👁️ View {p.name}'s box
          </button>
        ))}
      </div>
    );

    if (myCard === "see_swap") {
      if (seeSwapStep === "idle") return (
        <div className="stack gap-3">
          <div style={{ textAlign: "center", fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-secondary)" }}>
            🔍 View then optionally swap with:
          </div>
          {others.map((p) => (
            <button key={p.id} className="btn btn-purple full" onClick={() => { setTargetId(p.id); playSeeSwap(p.id); }}>
              🔍 {p.name} <span style={{ opacity: 0.65, fontSize: "var(--text-sm)" }}>(Box #{p.boxNumber})</span>
            </button>
          ))}
        </div>
      );
      if (seeSwapStep === "viewing" && viewResult) return (
        <div className="stack gap-4">
          {/* Private result */}
          <div className="glass" style={{
            padding: "1.5rem",
            textAlign: "center",
            borderColor: viewResult.hasPrize ? "rgba(255,215,0,0.5)" : "rgba(0,212,255,0.25)",
            boxShadow: viewResult.hasPrize ? "0 0 32px rgba(255,215,0,0.2)" : "none",
          }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.25rem 0.7rem",
              background: "rgba(255,255,255,0.07)",
              borderRadius: 999,
              fontSize: "var(--text-xs)",
              fontWeight: 800,
              color: "var(--text-muted)",
              marginBottom: "0.75rem",
              letterSpacing: "0.1em",
            }}>
              🔒 PRIVATE — only you see this
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
              You peeked at <strong style={{ color: "#fff" }}>{viewResult.targetName}</strong>'s box
            </div>
            <div className="font-display" style={{
              fontSize: "var(--text-3xl)",
              color: viewResult.hasPrize ? "var(--neon-yellow)" : "var(--neon-cyan)",
              lineHeight: 1,
            }}>
              {viewResult.hasPrize ? "🏆 HAS THE PRIZE!" : "📦 Empty"}
            </div>
          </div>

          <div style={{ fontWeight: 800, fontSize: "var(--text-base)", textAlign: "center" }}>
            Now swap with them?
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn-pink full" onClick={() => decideSeeSwap(true)}>
              ✅ Yes, swap!
            </button>
            <button className="btn btn-ghost full" onClick={() => decideSeeSwap(false)}>
              ❌ No, keep
            </button>
          </div>
        </div>
      );
    }

    if (myCard === "block") return (
      <div className="stack gap-3">
        <div style={{ textAlign: "center", fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-secondary)" }}>
          🛡️ Block who from swapping with you?
        </div>
        {others.map((p) => (
          <button key={p.id} className="btn btn-yellow full" onClick={() => playBlock(p.id)}>
            🛡️ Block {p.name}
          </button>
        ))}
      </div>
    );
  }

  const currentActor = players.find((p) => p.id === cardPhase?.currentActorId);
  const actionOrderList = rootActionOrder || cardPhase?.actionOrder || [];
  const currentIdx = actionOrderList.indexOf(cardPhase?.currentActorId);

  return (
    <div className="grad-bg page stack gap-5" style={{ maxWidth: 480, margin: "0 auto" }}>
      {lastSwap && <SwapAnimation swap={lastSwap} players={players} />}

      {/* Header */}
      <div style={{ textAlign: "center", paddingTop: "0.5rem" }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "0.3rem 0.9rem",
          background: "rgba(155,89,255,0.12)",
          border: "1.5px solid rgba(155,89,255,0.3)",
          borderRadius: 999,
          fontSize: "var(--text-xs)",
          fontWeight: 800,
          color: "var(--neon-purple)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: "0.5rem",
        }}>
          Round 7
        </div>
        <h1 className="font-display" style={{ fontSize: "clamp(2.2rem, 9vw, 3rem)", lineHeight: 1 }}>
          Final Card Phase 🃏
        </h1>
      </div>

      {/* My card flip */}
      {myCard && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            fontSize: "var(--text-xs)",
            fontWeight: 800,
            color: "var(--text-muted)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}>
            Your Card
          </div>
          <div onClick={() => setFlipped(true)} style={{ cursor: flipped ? "default" : "pointer" }}>
            <CardFlip card={myCard} flipped={flipped} />
          </div>
          {!flipped && (
            <div style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}>
              👆 Tap to reveal your card
            </div>
          )}
        </div>
      )}

      {/* Current actor banner */}
      <div className="glass" style={{
        padding: "1rem 1.25rem",
        textAlign: "center",
        borderColor: isMyTurn ? (meta.color || "var(--neon-purple)") : "var(--border)",
        boxShadow: isMyTurn ? `0 0 24px ${meta.color || "rgba(155,89,255,0.3)"}44` : "none",
        transition: "all 0.3s ease",
      }}>
        {isMyTurn ? (
          flipped ? (
            <span style={{ fontWeight: 900, fontSize: "var(--text-base)", color: meta.color || "var(--neon-purple)" }}>
              ⚡ Play your {meta.label} card!
            </span>
          ) : (
            <span style={{ fontWeight: 900, fontSize: "var(--text-base)", color: "var(--neon-cyan)" }}>
              ⚡ Your turn — tap your card to reveal it!
            </span>
          )
        ) : (
          <span style={{ color: "var(--text-secondary)", fontWeight: 700, fontSize: "var(--text-sm)" }}>
            ⏳ {currentActor?.name} is taking their action…
          </span>
        )}
      </div>

      {/* Broadcast: viewEvent */}
      {viewEvent && (
        <div className="glass anim-fade-up" style={{
          padding: "0.875rem 1.25rem",
          textAlign: "center",
          borderColor: "rgba(0,212,255,0.35)",
          fontSize: "var(--text-sm)",
          fontWeight: 700,
          color: "var(--neon-cyan)",
        }}>
          👁️ {viewEvent.viewerName} secretly viewed {viewEvent.targetName}'s box.
        </div>
      )}

      {/* Broadcast: blockEvent */}
      {blockEvent && (
        <div className="glass anim-fade-up" style={{
          padding: "1rem 1.25rem",
          textAlign: "center",
          borderColor: "rgba(255,215,0,0.35)",
          fontSize: "var(--text-sm)",
          fontWeight: 700,
        }}>
          🛡️ <strong style={{ color: "var(--neon-pink)" }}>{blockEvent.attackerName}'s</strong> swap was blocked by <strong style={{ color: "var(--neon-yellow)" }}>{blockEvent.defenderName}</strong>!
        </div>
      )}

      {/* Action panel */}
      {renderAction()}

      {/* VIEW card private result (after card played) */}
      {actionDone && myCard === "view" && viewResultLocal && (
        <div className="glass anim-fade-up" style={{
          padding: "1.5rem",
          textAlign: "center",
          borderColor: viewResultLocal.hasPrize ? "rgba(255,215,0,0.5)" : "rgba(0,212,255,0.25)",
          boxShadow: viewResultLocal.hasPrize ? "0 0 32px rgba(255,215,0,0.2)" : "none",
        }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.25rem 0.7rem",
            background: "rgba(255,255,255,0.07)",
            borderRadius: 999,
            fontSize: "var(--text-xs)",
            fontWeight: 800,
            color: "var(--text-muted)",
            marginBottom: "0.75rem",
            letterSpacing: "0.1em",
          }}>
            🔒 PRIVATE — only you see this · knowledge seals after this
          </div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
            You peeked at <strong style={{ color: "#fff" }}>{viewResultLocal.targetName}</strong>'s box
          </div>
          <div className="font-display" style={{
            fontSize: "var(--text-3xl)",
            color: viewResultLocal.hasPrize ? "var(--neon-yellow)" : "var(--neon-cyan)",
            lineHeight: 1,
          }}>
            {viewResultLocal.hasPrize ? "🏆 HAS THE PRIZE!" : "📦 Empty"}
          </div>
        </div>
      )}

      {/* Done state (non-view cards) */}
      {actionDone && (myCard !== "view" || !viewResultLocal) && (
        <div style={{
          textAlign: "center",
          color: "var(--neon-green)",
          fontWeight: 800,
          fontSize: "var(--text-sm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
        }}>
          ✓ Card played! Waiting for others…
        </div>
      )}

      {/* Action order list */}
      <div className="stack gap-2">
        <div style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: "0.25rem",
        }}>
          Action Order
        </div>
        {actionOrderList.map((pid, i) => {
          const p = players.find((pl) => pl.id === pid);
          const isDone = i < currentIdx;
          const isCurrent = pid === cardPhase?.currentActorId;
          return (
            <div key={pid} style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.5rem 0.75rem",
              background: isCurrent ? "rgba(155,89,255,0.08)" : "transparent",
              border: `1px solid ${isCurrent ? "rgba(155,89,255,0.3)" : "transparent"}`,
              borderRadius: "var(--radius-md)",
              opacity: isDone ? 0.4 : 1,
              transition: "all 0.2s ease",
            }}>
              <span style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
                width: 18,
                textAlign: "right",
                flexShrink: 0,
              }}>
                {i + 1}.
              </span>
              <span style={{
                fontWeight: 700,
                fontSize: "var(--text-sm)",
                flex: 1,
                color: isCurrent ? "var(--neon-purple)" : pid === playerId ? "var(--neon-cyan)" : "#fff",
              }}>
                {p?.name}{pid === playerId ? " (you)" : ""}
              </span>
              {isDone && <span style={{ fontSize: "var(--text-xs)", color: "var(--neon-green)" }}>✓</span>}
              {isCurrent && <span style={{ fontSize: "var(--text-xs)", color: "var(--neon-yellow)", fontWeight: 800 }}>← now</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
