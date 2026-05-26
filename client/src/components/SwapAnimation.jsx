// SwapAnimation.jsx — two boxes visually cross positions
import { motion, AnimatePresence } from "framer-motion";
import MysteryBox from "./MysteryBox";

export default function SwapAnimation({ swap, players }) {
  if (!swap) return null;
  const a = players.find((p) => p.id === swap.playerA?.id);
  const b = players.find((p) => p.id === swap.playerB?.id);
  if (!a || !b) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", gap: "2rem" }}>
      <motion.div initial={{ x: 0 }} animate={{ x: 120 }} transition={{ duration: 0.6, type: "spring" }}>
        <MysteryBox number={swap.playerA.boxNumber} size={70} animate="none" />
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 13, fontWeight: 700 }}>{a.name}</div>
      </motion.div>
      <div style={{ fontSize: "2rem" }}>⇄</div>
      <motion.div initial={{ x: 0 }} animate={{ x: -120 }} transition={{ duration: 0.6, type: "spring" }}>
        <MysteryBox number={swap.playerB.boxNumber} size={70} animate="none" />
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 13, fontWeight: 700 }}>{b.name}</div>
      </motion.div>
    </div>
  );
}
