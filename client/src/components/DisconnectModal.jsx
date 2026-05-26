// DisconnectModal.jsx
import socket from "../socket";
import { useGame } from "../context/GameContext";

export default function DisconnectModal() {
  const { state } = useGame();
  const { disconnectVoteNeeded, disconnectNotice } = state;

  if (!disconnectVoteNeeded && !disconnectNotice) return null;

  function vote(choice) {
    socket.emit("disconnect_vote", { choice });
  }

  if (disconnectVoteNeeded) {
    return (
      <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem" }}>
        <div className="glass" style={{ maxWidth:400,width:"100%",padding:"2rem",textAlign:"center" }}>
          <div style={{ fontSize:"2rem",marginBottom:"0.5rem" }}>⚠️</div>
          <h2 style={{ fontSize:"1.4rem",fontWeight:800,marginBottom:"0.5rem" }}>{disconnectVoteNeeded.playerName} disconnected</h2>
          <p style={{ color:"rgba(255,255,255,0.6)",marginBottom:"1.5rem" }}>60 seconds passed. What should happen?</p>
          <div className="stack gap-3">
            <button className="btn btn-cyan full" onClick={() => vote("continue")}>▶ Continue Game</button>
            <button className="btn btn-ghost full" onClick={() => vote("collapse")}>💀 End Game</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position:"fixed",bottom:"1rem",left:"50%",transform:"translateX(-50%)",zIndex:400 }}>
      <div className="glass" style={{ padding:"0.75rem 1.5rem",borderColor:"var(--neon-yellow)",display:"flex",gap:"0.75rem",alignItems:"center" }}>
        <span>⏳</span>
        <span style={{ fontWeight:700 }}>{disconnectNotice.playerName} disconnected — {disconnectNotice.timeoutSeconds}s to reconnect</span>
      </div>
    </div>
  );
}
