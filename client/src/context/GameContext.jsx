import { createContext, useContext, useReducer, useEffect, useRef } from "react";
import socket from "../socket";
import sfx from "../audio";

const GameContext = createContext(null);

const init = {
  roomCode: null, playerId: null, playerName: null, isHost: false,
  phase: "HOME", players: [], myBox: null, myCard: null,
  isSealed: false,   // true once the 5s reveal window closes or a swap occurs
  hasPrize: null,    // set only during the initial 5s reveal window; null after sealed
  timer: null, gameLog: null, roundWinner: null,
  hotTake: { questions: [], currentQuestion: null, questionIndex: 0, answers: [], phase: "answering" },
  reaction: { prompts: [], currentPrompt: null, promptIndex: 0, phase: "waiting", promptResult: null },
  imposter: { category: null, myWord: null, clueOrder: [], clues: [], phase: "clues", currentClueTurn: null, revealed: null },
  mostLikelyTo: { questions: [], questionIndex: 0, votes: {} },
  draft: { order: [], slots: [], picks: {} },
  cardPhase: { actionOrder: [], currentActorId: null },
  reveals: [], badges: {},
  swapRequest: null, disconnectNotice: null, blockState: {},
  accusationResult: null, allBoxes: [],
};

function reducer(state, { type, payload }) {
  switch (type) {
    case "SET": return { ...state, ...payload };
    case "PHASE": return { ...state, phase: payload.phase };
    case "TIMER": return { ...state, timer: payload.remaining };
    case "HOT_TAKE_PATCH": return { ...state, hotTake: { ...state.hotTake, ...payload } };
    case "REACTION_PATCH": return { ...state, reaction: { ...state.reaction, ...payload } };
    case "IMPOSTER_PATCH": return { ...state, imposter: { ...state.imposter, ...payload } };
    case "MLT_PATCH": return { ...state, mostLikelyTo: { ...state.mostLikelyTo, ...payload } };
    case "DRAFT_PATCH": return { ...state, draft: { ...state.draft, ...payload } };
    case "CARD_PATCH": return { ...state, cardPhase: { ...state.cardPhase, ...payload } };
    default: return state;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, init);
  const stateRef = useRef(state);
  stateRef.current = state;

  const set = (payload) => dispatch({ type: "SET", payload });

  useEffect(() => {
    socket.on("room_state", ({ id, phase, hostId, players }) => {
      set({ roomCode: id, phase: phase === "LOBBY" ? "LOBBY" : stateRef.current.phase, players, isHost: hostId === stateRef.current.playerId, hostId });
    });
    socket.on("room_created", ({ roomCode, playerId }) => set({ roomCode, playerId, phase: "LOBBY", hostId: playerId, isHost: true }));
    socket.on("room_joined",  ({ roomCode, playerId }) => set({ roomCode, playerId, phase: "LOBBY" }));
    socket.on("join_error",   ({ message }) => set({ joinError: message }));
    socket.on("reconnected",  ({ roomCode, playerId, gameState }) => set({ roomCode, playerId, phase: gameState.phase, players: gameState.players }));

    socket.on("phase_change", ({ phase, ...rest }) => {
      sfx.play("transition", 0.4);
      // Clear round scoreboard when winner action phase begins
      const isWinnerActionPhase = phase.endsWith("_WINNER_ACTION");
      dispatch({
        type: "SET",
        payload: {
          phase, ...rest,
          // Clear transient per-phase overlay state so it doesn't bleed into next phase
          lastSwap: null,
          swapRequest: null,
          swapBlockedMsg: null,
          blockEvent: null,
          viewEvent: null,
          viewResult: null,
          keepEvent: null,
          timer: null,  // reset stale timer display
          // Clear scoreboard when winner action starts (scoreboard served its 8s)
          ...(isWinnerActionPhase ? { roundScoreboard: null } : {}),
          // NOTE: roundWinner and accusationResult intentionally NOT cleared here
          // — they are emitted right before their WINNER_ACTION phase_change
        },
      });
    });
    socket.on("timer_sync", ({ remaining }) => dispatch({ type: "TIMER", payload: { remaining } }));

    // box_assigned: reset seal state and capture hasPrize (only present in initial assignment)
    socket.on("box_assigned", ({ myBox, hasPrize }) => {
      set({ myBox, isSealed: false, hasPrize: hasPrize ?? null });
    });
    socket.on("all_boxes",    ({ players }) => set({ allBoxes: players }));

    // box_sealed: player's box is now locked — clear hasPrize from state
    socket.on("box_sealed", () => set({ isSealed: true, hasPrize: null }));

    socket.on("swap_request_incoming", (data) => set({ swapRequest: data }));
    socket.on("swap_request_blocked",  ({ message }) => set({ swapBlockedMsg: message }));
    socket.on("swap_executed", (data) => {
      sfx.play("swap");
      // Update players array with new box assignments
      const cur = stateRef.current;
      const updatedPlayers = cur.players.map((p) => {
        if (p.id === data.playerA?.id) return { ...p, boxNumber: data.playerA.boxNumber };
        if (p.id === data.playerB?.id) return { ...p, boxNumber: data.playerB.boxNumber };
        return p;
      });
      // Update myBox if we are in the swap
      let myBox = cur.myBox;
      if (data.playerA?.id === cur.playerId) myBox = data.playerA.boxNumber;
      if (data.playerB?.id === cur.playerId) myBox = data.playerB.boxNumber;
      set({ lastSwap: data, players: updatedPlayers, myBox });
      setTimeout(() => set({ lastSwap: null }), 2000);
    });
    // Fix 1: swap_preview — arriving ONLY for the two players involved in a Starting Swap.
    // Tells the client the new box number and how long until box_sealed fires.
    socket.on("swap_preview", ({ newBox, sealInMs }) => {
      set({ swapPreview: { newBox, sealInMs, arrivedAt: Date.now() } });
      // Auto-clear after sealInMs + a small buffer so it doesn't linger
      setTimeout(() => set({ swapPreview: null }), sealInMs + 500);
    });
    socket.on("swap_blocked_by_card",  (data) => { sfx.play("block"); set({ blockEvent: data }); });
    socket.on("keep_broadcast", (data) => set({ keepEvent: data }));
    socket.on("block_broadcast", (data) => { sfx.play("block"); set({ blockEvent: data }); });
    socket.on("view_broadcast", (data) => set({ viewEvent: data }));
    socket.on("view_result",    (data) => set({ viewResult: data }));

    socket.on("round_winner", (data) => { sfx.play("winnerJingle"); set({ roundWinner: data }); });

    // Feature 2: Post-round scoreboard — also clears all tiebreaker state
    socket.on("round_scoreboard", (data) => set({
      roundScoreboard: data,
      tieDetected: null,
      tiebreakerChallenge: null,
      tiebreakerWinner: null,
      wheelSpin: null,
      wheelResult: null,
    }));

    // Feature 3: Swap/Keep notification banner
    socket.on("swap_notification", (data) => set({ swapNotification: data }));

    // —— Tiebreaker system ——
    socket.on("tie_detected",        (data) => set({ tieDetected: data }));
    socket.on("tiebreaker_challenge",(data) => set({ tiebreakerChallenge: data }));
    socket.on("tiebreaker_winner",   (data) => set({ tiebreakerWinner: data }));
    socket.on("wheel_spin_start",    (data) => set({ wheelSpin: data }));
    socket.on("wheel_spin_result",   (data) => set({ wheelResult: data }));
    // Round 1
    socket.on("hot_take_answers", ({ questionIndex, answers }) =>
      dispatch({ type: "HOT_TAKE_PATCH", payload: { answers, questionIndex, phase: "voting" } }));

    // Round 2
    socket.on("reaction_prompt_result", ({ promptIndex, correctIndex }) =>
      dispatch({ type: "REACTION_PATCH", payload: { promptResult: { promptIndex, correctIndex }, phase: "result" } }));

    // Round 3
    socket.on("secret_word", ({ word, category, isImposter }) =>
      dispatch({ type: "IMPOSTER_PATCH", payload: { myWord: word, category, isImposter } }));
    socket.on("imposter_clue_turn", ({ playerId }) =>
      dispatch({ type: "IMPOSTER_PATCH", payload: { currentClueTurn: playerId } }));
    socket.on("imposter_clue_submitted", ({ playerId, clue }) =>
      dispatch({ type: "IMPOSTER_PATCH", payload: { clues: [...stateRef.current.imposter.clues, { playerId, clue }] } }));
    socket.on("imposter_revealed", (data) =>
      dispatch({ type: "IMPOSTER_PATCH", payload: { revealed: data } }));

    // Round 4
    socket.on("most_likely_result", (data) =>
      dispatch({ type: "MLT_PATCH", payload: { lastResult: data } }));

    // Round 5
    socket.on("accusation_result", (data) => { sfx.play("reveal"); set({ accusationResult: data }); });

    // Round 6
    socket.on("draft_order",      ({ order, slots }) => dispatch({ type: "DRAFT_PATCH", payload: { order, slots } }));
    socket.on("draft_slot_taken", ({ playerId, slot, remaining }) =>
      dispatch({ type: "DRAFT_PATCH", payload: { slots: remaining, picks: { ...stateRef.current.draft.picks, [playerId]: slot } } }));
    socket.on("draft_auto_assigned", ({ playerId, slot }) =>
      dispatch({ type: "DRAFT_PATCH", payload: { picks: { ...stateRef.current.draft.picks, [playerId]: slot } } }));
    socket.on("draft_your_turn", ({ playerId }) =>
      dispatch({ type: "DRAFT_PATCH", payload: { currentPicker: playerId } }));

    // Round 7
    socket.on("card_assigned",    ({ card }) => set({ myCard: card }));
    socket.on("card_action_turn", ({ playerId }) =>
      dispatch({ type: "CARD_PATCH", payload: { currentActorId: playerId } }));

    // Round 8
    socket.on("final_reveal", ({ reveals, badges }) => { sfx.play("drumroll"); set({ reveals, badges }); });
    socket.on("game_state_log", (log) => set({ gameLog: log }));

    socket.on("disconnect_notice", (data) => set({ disconnectNotice: data }));
    socket.on("disconnect_vote_needed", (data) => set({ disconnectVoteNeeded: data }));
    socket.on("disconnect_vote_result", (data) => set({ disconnectVoteResult: data }));
    socket.on("host_changed", (data) => set({ hostChanged: data }));
    // Legacy tiebreak events kept for backward compatibility (no-ops — replaced by tie_detected etc.)
    socket.on("tiebreak_start",  (data) => {});
    socket.on("tiebreak_prompt", ()     => {});

    return () => socket.removeAllListeners();
  }, []);

  return <GameContext.Provider value={{ state, set, dispatch }}>{children}</GameContext.Provider>;
}

export const useGame = () => useContext(GameContext);
