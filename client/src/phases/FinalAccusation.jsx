import { useState } from "react";
import socket from "../socket";
import { useGame } from "../context/GameContext";
import Timer from "../components/Timer";
import VoteGrid from "../components/VoteGrid";
import AccusationArrows from "../components/AccusationArrows";

export default function FinalAccusation() {
  const { state } = useGame();
  const { playerId, players, accusationResult } = state;
  const [voted, setVoted] = useState(null);
  const [liveVotes, setLiveVotes] = useState({});

  function submitVote(vid) {
    if (voted || vid === playerId) return;
    setVoted(vid);
    setLiveVotes((v) => ({ ...v, [playerId]: vid }));
    socket.emit("final_accusation_vote", { accusedId: vid });
  }

  return (
    <div className="grad-bg page stack gap-5" style={{
      maxWidth: 480,
      margin: "0 auto",
      minHeight: "100vh",
      justifyContent: "center",
    }}>
      {/* Cinematic header */}
      <div style={{
        textAlign: "center",
        background: "radial-gradient(ellipse at 50% 0%, rgba(255,61,154,0.3) 0%, transparent 65%)",
        padding: "2rem 1rem 1.5rem",
        margin: "0 -1.25rem",
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "0.3rem 0.9rem",
          background: "rgba(255,61,154,0.15)",
          border: "1.5px solid rgba(255,61,154,0.4)",
          borderRadius: 999,
          fontSize: "var(--text-xs)",
          fontWeight: 800,
          color: "var(--neon-pink)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          marginBottom: "0.75rem",
        }}>
          Round 5
        </div>
        <h1 className="font-display" style={{
          fontSize: "clamp(2.8rem, 12vw, 5rem)",
          lineHeight: 1,
          textShadow: "0 0 40px rgba(255,61,154,0.4)",
        }}>
          Final Accusation
        </h1>
        <p style={{
          color: "var(--text-secondary)",
          fontSize: "var(--text-base)",
          marginTop: "0.5rem",
          fontWeight: 700,
        }}>
          👈 Point your finger. No takebacks.
        </p>
      </div>

      {/* Timer */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Timer color="var(--neon-pink)" />
      </div>

      {/* Voting state */}
      {!accusationResult && (
        <>
          <AccusationArrows votes={liveVotes} players={players} />
          <VoteGrid
            players={players}
            myId={playerId}
            onVote={submitVote}
            voted={voted}
            canVoteSelf={false}
            label="Accuse — who has the prize?"
          />
          {voted && (
            <div className="glass" style={{
              padding: "1rem 1.25rem",
              textAlign: "center",
              borderColor: "rgba(255,61,154,0.3)",
            }}>
              <div style={{ fontSize: "1.6rem", marginBottom: "0.25rem" }}>🤫</div>
              <div style={{ color: "var(--neon-pink)", fontWeight: 800, fontSize: "var(--text-sm)" }}>
                Accusation locked. Silence.
              </div>
            </div>
          )}
        </>
      )}

      {/* Result */}
      {accusationResult && (
        <div className="glass anim-fade-up" style={{
          padding: "2rem 1.5rem",
          textAlign: "center",
          borderColor: "rgba(255,61,154,0.4)",
          boxShadow: "0 0 48px rgba(255,61,154,0.2)",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>😬</div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "0.5rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Most Accused
          </div>
          <div className="font-display" style={{
            fontSize: "clamp(2.5rem, 10vw, 4rem)",
            color: "var(--neon-pink)",
            textShadow: "0 0 24px rgba(255,61,154,0.5)",
            lineHeight: 1,
            marginBottom: "0.75rem",
          }}>
            {players.find((p) => p.id === accusationResult.mostAccusedId)?.name}
          </div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 600 }}>
            They pick first in the Position Draft
          </div>
          <AccusationArrows votes={accusationResult.votes} players={players} />
        </div>
      )}
    </div>
  );
}
