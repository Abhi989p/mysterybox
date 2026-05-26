// TiebreakerOverlay.jsx — Full tiebreaker system: announce → challenge/spectate → wheel → winner
// All 4 screens managed here as a single state-machine overlay.
import { useEffect, useRef, useState } from "react";
import socket from "../socket";
import { useGame } from "../context/GameContext";
import Confetti from "./Confetti";

const SECTION_COLORS = ["#FF2D78", "#00F5FF", "#FFE600", "#BF5AF2", "#39FF14", "#FF6B2B"];

// ── Wheel SVG ─────────────────────────────────────────────────────────────────
function WheelSVG({ players, rotationDeg }) {
  const N = players.length;
  const cx = 130, cy = 130, r = 108;

  function polar(deg) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  function sectionPath(startDeg, endDeg) {
    const [sx, sy] = polar(startDeg);
    const [ex, ey] = polar(endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)} Z`;
  }

  return (
    <svg
      width={260} height={260}
      style={{
        transform: `rotate(${rotationDeg}deg)`,
        transformOrigin: "50% 50%",
        filter: "drop-shadow(0 0 20px rgba(0,0,0,0.7))",
        display: "block",
        willChange: "transform",
      }}
    >
      {players.map((p, i) => {
        const startDeg = (i / N) * 360;
        const endDeg   = ((i + 1) / N) * 360;
        const midDeg   = (startDeg + endDeg) / 2;
        const color    = SECTION_COLORS[i % SECTION_COLORS.length];
        const tRad     = ((midDeg - 90) * Math.PI) / 180;
        const dist     = r * 0.60;
        const tx       = cx + dist * Math.cos(tRad);
        const ty       = cy + dist * Math.sin(tRad);

        return (
          <g key={p.id}>
            <path
              d={sectionPath(startDeg, endDeg)}
              fill={color}
              stroke="rgba(0,0,0,0.18)"
              strokeWidth={2}
            />
            {/* Divider line */}
            <line
              x1={cx} y1={cy}
              x2={polar(startDeg)[0].toFixed(2)} y2={polar(startDeg)[1].toFixed(2)}
              stroke="rgba(0,0,0,0.2)" strokeWidth={2}
            />
            <text
              x={tx.toFixed(2)} y={ty.toFixed(2)}
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${midDeg}, ${tx.toFixed(2)}, ${ty.toFixed(2)})`}
              fill="rgba(0,0,0,0.72)"
              fontWeight="900"
              fontSize={N <= 2 ? 15 : 12}
              style={{ fontFamily: "sans-serif", userSelect: "none" }}
            >
              {p.name.length > 9 ? p.name.slice(0, 8) + "…" : p.name}
            </text>
          </g>
        );
      })}
      {/* Center hub */}
      <circle cx={cx} cy={cy} r={20} fill="rgba(13,13,15,0.92)" stroke="rgba(255,255,255,0.18)" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={5}  fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}

// ── Main Overlay ───────────────────────────────────────────────────────────────
export default function TiebreakerOverlay() {
  const { state } = useGame();
  const {
    tieDetected, tiebreakerChallenge, tiebreakerWinner,
    wheelSpin, wheelResult, playerId, timer,
  } = state;

  // Which screen to show
  const [screen, setScreen] = useState(null);
  // challenge screen
  const [answer, setAnswer]       = useState("");
  const [submitted, setSubmitted] = useState(false);
  // wheel animation
  const [rotation, setRotation]         = useState(0);
  const [spinPhase, setSpinPhase]       = useState("idle");
  const [showConfetti, setShowConfetti] = useState(false);
  const [wheelWinner, setWheelWinner]   = useState(null);

  const rotRef            = useRef(0);
  const rafRef            = useRef(null);
  const lastTsRef         = useRef(null);
  const landingStartTs    = useRef(null);
  const landingStartRot   = useRef(null);
  const landingTarget     = useRef(null);
  const spinPhaseRef      = useRef("idle");

  // ── Screen transitions ────────────────────────────────────────────────────

  // Tie announced → show Screen 1; after 3.1s auto-move to spectate if no challenge
  useEffect(() => {
    if (!tieDetected) return;
    setScreen("announce");
    const t = setTimeout(() => {
      setScreen((cur) => (cur === "announce" ? "spectate" : cur));
    }, 3100);
    return () => clearTimeout(t);
  }, [tieDetected]);

  // Got a challenge → show Screen 2a
  useEffect(() => {
    if (!tiebreakerChallenge) return;
    setScreen("challenge");
    setAnswer("");
    setSubmitted(false);
  }, [tiebreakerChallenge]);

  // Wheel starts → init rAF spin
  useEffect(() => {
    if (!wheelSpin) return;
    setScreen("wheel");
    setSpinPhase("spinning");
    spinPhaseRef.current = "spinning";
    rotRef.current       = 0;
    lastTsRef.current    = null;
    landingStartTs.current  = null;
    landingStartRot.current = null;
    setRotation(0);
    setShowConfetti(false);
    setWheelWinner(null);

    function frame(ts) {
      if (spinPhaseRef.current !== "spinning") return;
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;
      rotRef.current += dt * 0.44; // ~440 °/s
      setRotation(rotRef.current);
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [wheelSpin]);

  // Wheel result received → decelerate to winner section
  useEffect(() => {
    if (!wheelResult || !wheelSpin) return;

    const players = wheelSpin.tiedPlayers;
    const N = players.length;
    const winnerIdx = players.findIndex((p) => p.id === wheelResult.winnerId);
    const sectionSize    = 360 / N;
    const winnerCenter   = winnerIdx * sectionSize + sectionSize / 2;

    // Target rotation: winner section faces upward (pointer at top)
    const targetMod  = ((360 - winnerCenter) % 360 + 360) % 360;
    const currentMod = rotRef.current % 360;
    let diff = targetMod - currentMod;
    if (diff < 0) diff += 360;
    landingTarget.current = rotRef.current + diff + 3 * 360; // 3 extra full rotations

    // Switch phase → landing
    spinPhaseRef.current    = "landing";
    landingStartTs.current  = null;
    landingStartRot.current = null;
    setSpinPhase("landing");

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    function landFrame(ts) {
      if (!landingStartTs.current) {
        landingStartTs.current  = ts;
        landingStartRot.current = rotRef.current;
      }
      const elapsed  = ts - landingStartTs.current;
      const duration = 2500; // ms
      const t   = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
      rotRef.current = landingStartRot.current + (landingTarget.current - landingStartRot.current) * ease;
      setRotation(rotRef.current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(landFrame);
      } else {
        spinPhaseRef.current = "landed";
        setSpinPhase("landed");
        setWheelWinner(wheelResult);
        setShowConfetti(true);
      }
    }
    rafRef.current = requestAnimationFrame(landFrame);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [wheelResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // Challenge winner (not wheel) → show Screen 4
  useEffect(() => {
    if (tiebreakerWinner) setScreen("winner");
  }, [tiebreakerWinner]);

  // Clear everything when GameContext clears tiebreaker state (on round_scoreboard)
  useEffect(() => {
    if (!tieDetected && !tiebreakerChallenge && !tiebreakerWinner && !wheelSpin && !wheelResult) {
      setScreen(null);
      setShowConfetti(false);
      setWheelWinner(null);
      spinPhaseRef.current = "idle";
      setSpinPhase("idle");
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
  }, [tieDetected, tiebreakerChallenge, tiebreakerWinner, wheelSpin, wheelResult]);

  // ── Submit handler ────────────────────────────────────────────────────────
  function submitAnswer() {
    if (submitted || !answer.trim()) return;
    setSubmitted(true);
    socket.emit("tiebreak_answer", { answer: answer.trim(), clientTimestamp: Date.now() });
  }

  if (!screen) return null;

  // Derived display values
  const tiedNames   = tieDetected?.tiedPlayers?.map((p) => p.name).join(" & ") ?? "";
  const elecColor   = "var(--neon-yellow)";

  const overlayBase = {
    position: "fixed", inset: 0, zIndex: 8500,
    backdropFilter: "blur(14px)",
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: "1.5rem", textAlign: "center", padding: "2rem",
  };

  // ── SCREEN 1: Tie Announcement (all players, 3 s) ────────────────────────
  if (screen === "announce") {
    return (
      <div style={{ ...overlayBase, background: "radial-gradient(ellipse at 50% 30%, rgba(255,230,0,0.18) 0%, transparent 70%), rgba(13,13,15,0.97)" }}>
        <div style={{ fontSize: "4rem", lineHeight: 1, animation: "spin 3s linear infinite" }}>⚡</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: elecColor, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 6 }}>
            It's a Tie!
          </div>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(3rem,12vw,6rem)",
            lineHeight: 1, color: "#fff",
            textShadow: `0 0 40px ${elecColor}88`,
          }}>DEADLOCK</div>
        </div>

        <div className="glass" style={{
          padding: "1.25rem 2rem", maxWidth: 420,
          borderColor: elecColor,
          boxShadow: `0 0 32px rgba(255,230,0,0.2)`,
        }}>
          <div style={{ fontWeight: 800, fontSize: "1.2rem", color: "#fff", marginBottom: 6 }}>
            {tiedNames}
          </div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 14 }}>
            {tieDetected?.tiedPlayers?.length > 2 ? "are all perfectly deadlocked" : "are perfectly deadlocked"}
          </div>
        </div>

        <div style={{
          fontWeight: 800, fontSize: "1rem", color: elecColor,
          animation: "pulse-ring 1s ease-out infinite",
        }}>
          ⚡ Tiebreaker starting…
        </div>
      </div>
    );
  }

  // ── SCREEN 2b: Spectator (non-tied players) ───────────────────────────────
  if (screen === "spectate") {
    return (
      <div style={{ ...overlayBase, background: "radial-gradient(ellipse at 50% 30%, rgba(255,45,120,0.15) 0%, transparent 70%), rgba(13,13,15,0.95)" }}>
        <div style={{ fontSize: "3.5rem" }}>🔥</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--neon-pink)", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 6 }}>
            Tiebreaker Live
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem,8vw,3.5rem)", color: "#fff" }}>
            BATTLE MODE
          </div>
        </div>

        <div className="glass" style={{ padding: "1.25rem 2rem", maxWidth: 420 }}>
          <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--neon-pink)" }}>
            {tiedNames}
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 6 }}>
            are battling it out — who's faster? 👀
          </div>
        </div>

        {timer != null && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{
              fontFamily: "var(--font-display)",
              fontSize: "3.5rem",
              color: timer <= 3 ? "var(--neon-pink)" : "var(--neon-cyan)",
              transition: "color 0.3s",
            }}>
              {timer}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
              seconds remaining
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── SCREEN 2a: Challenge Input (tied players only) ────────────────────────
  if (screen === "challenge") {
    const rawPrompt   = tiebreakerChallenge?.prompt || "";
    const displayWord = rawPrompt.replace("TYPE: ", "");

    return (
      <div style={{ ...overlayBase, background: "radial-gradient(ellipse at 50% 20%, rgba(255,230,0,0.14) 0%, transparent 70%), rgba(13,13,15,0.97)" }}>
        <div style={{ fontSize: "2.5rem" }}>⚡</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: elecColor, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 4 }}>
            Tiebreaker!
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem,8vw,3.5rem)", color: "#fff" }}>
            TYPE IT FIRST
          </div>
        </div>

        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
          Type this <em>exactly</em>, as fast as you can:
        </div>

        {/* The prompt word */}
        <div className="glass" style={{
          padding: "1.25rem 3rem",
          borderColor: elecColor,
          boxShadow: `0 0 40px rgba(255,230,0,0.25)`,
        }}>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.5rem,10vw,4.5rem)",
            color: elecColor,
            letterSpacing: "0.1em",
          }}>
            {displayWord}
          </div>
        </div>

        {/* Countdown */}
        {timer != null && (
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: "2.5rem",
            color: timer <= 3 ? "var(--neon-pink)" : elecColor,
            transition: "color 0.3s",
          }}>
            {timer}s
          </div>
        )}

        {/* Input */}
        {!submitted ? (
          <div style={{ display: "flex", gap: "0.75rem", width: "100%", maxWidth: 400 }}>
            <input
              id="tiebreak-input"
              className="input"
              style={{ flex: 1, fontSize: "1.15rem", textTransform: "uppercase", letterSpacing: "0.05em" }}
              placeholder={displayWord}
              value={answer}
              onChange={(e) => setAnswer(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") submitAnswer(); }}
              autoFocus
              autoComplete="off"
              maxLength={32}
            />
            <button
              id="btn-tiebreak-submit"
              className="btn btn-yellow"
              onClick={submitAnswer}
              disabled={!answer.trim()}
              style={{ flexShrink: 0, fontSize: "1rem", padding: "0 1.25rem" }}
            >
              GO!
            </button>
          </div>
        ) : (
          <div className="glass" style={{
            padding: "1rem 2rem",
            borderColor: "var(--neon-green)",
            color: "var(--neon-green)",
            fontWeight: 800, fontSize: "1rem",
          }}>
            ✓ Answer submitted — waiting for result…
          </div>
        )}

        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>
          First correct answer wins the round
        </div>
      </div>
    );
  }

  // ── SCREEN 3: Wheel Spin (all players) ───────────────────────────────────
  if (screen === "wheel") {
    const players = wheelSpin?.tiedPlayers || [];
    const landed  = spinPhase === "landed";
    const winner  = wheelWinner;

    return (
      <div style={{ ...overlayBase, background: "radial-gradient(ellipse at 50% 30%, rgba(191,90,242,0.2) 0%, transparent 70%), rgba(13,13,15,0.97)" }}>
        <Confetti active={showConfetti} />

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--neon-purple)", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 6 }}>
            {landed ? "We Have a Winner!" : "Still Tied!"}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem,7vw,3rem)", color: "#fff" }}>
            {landed ? (winner?.winnerName || "") : "Spinning the Wheel…"}
          </div>
        </div>

        {/* Wheel + pointer */}
        <div style={{ position: "relative", display: "inline-block" }}>
          {/* Pointer at top — fixed, doesn't spin */}
          <div style={{
            position: "absolute", top: -22, left: "50%",
            transform: "translateX(-50%)",
            fontSize: "1.6rem", zIndex: 2,
            filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.8))",
            lineHeight: 1,
          }}>
            ▼
          </div>

          <WheelSVG players={players} rotationDeg={rotation} />

          {/* Glow halo when landed */}
          {landed && (
            <div style={{
              position: "absolute", inset: -6,
              borderRadius: "50%",
              boxShadow: "0 0 50px rgba(255,230,0,0.7)",
              pointerEvents: "none",
              animation: "pulse-ring 1s ease-out infinite",
            }} />
          )}
        </div>

        {/* Player name pills */}
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", justifyContent: "center" }}>
          {players.map((p, i) => {
            const isWinner = landed && winner?.winnerId === p.id;
            const col = SECTION_COLORS[i % SECTION_COLORS.length];
            return (
              <div key={p.id} style={{
                padding: "0.4rem 1rem",
                borderRadius: "999px",
                background: `${col}22`,
                border: `2px solid ${col}`,
                fontWeight: 800, fontSize: 13,
                color: isWinner ? "#fff" : "rgba(255,255,255,0.65)",
                boxShadow: isWinner ? `0 0 20px ${col}99` : "none",
                transform: isWinner ? "scale(1.18)" : "scale(1)",
                transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
              }}>
                {isWinner ? "🏆 " : ""}{p.name}
              </div>
            );
          })}
        </div>

        {landed && (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>
            🎡 Decided by the wheel · Scoreboard incoming…
          </div>
        )}
      </div>
    );
  }

  // ── SCREEN 4: Tiebreaker Winner (challenge wins only) ────────────────────
  if (screen === "winner") {
    const w      = tiebreakerWinner;
    const isMe   = w?.winnerId === playerId;
    const method = w?.method === "wheel" ? "🎡 via the wheel" : "⚡ via challenge";

    return (
      <div style={{ ...overlayBase, background: "radial-gradient(ellipse at 50% 25%, rgba(255,230,0,0.2) 0%, transparent 70%), rgba(13,13,15,0.97)" }}>
        <Confetti active={isMe} />

        <div style={{ fontSize: "4.5rem", lineHeight: 1, animation: "pulse-ring 1s ease-out infinite" }}>
          🏆
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--neon-yellow)", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 6 }}>
            Tiebreaker Winner
          </div>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.5rem,12vw,5.5rem)",
            color: "var(--neon-yellow)", lineHeight: 1,
            textShadow: "0 0 40px rgba(255,230,0,0.6)",
          }}>
            {w?.winnerName}
          </div>
          {isMe && (
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginTop: 10 }}>
              That's you! 🎉
            </div>
          )}
        </div>

        <div className="glass" style={{ padding: "0.7rem 1.5rem", borderColor: "rgba(255,230,0,0.25)" }}>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>
            {method}
          </div>
        </div>

        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>
          Scoreboard incoming…
        </div>
      </div>
    );
  }

  return null;
}
