import { useGame } from "./context/GameContext";
import Home from "./pages/Home";
import Lobby from "./pages/Lobby";
import BoxAssignment from "./phases/BoxAssignment";
import StartingSwap from "./phases/StartingSwap";
import HotTakeRound from "./phases/HotTakeRound";
import ReactionRace from "./phases/ReactionRace";
import ImposterGuess from "./phases/ImposterGuess";
import MostLikelyTo from "./phases/MostLikelyTo";
import FinalAccusation from "./phases/FinalAccusation";
import PositionDraft from "./phases/PositionDraft";
import FinalCardPhase from "./phases/FinalCardPhase";
import FinalReveal from "./phases/FinalReveal";
import EndgameRecap from "./phases/EndgameRecap";
import RulesCard from "./components/RulesCard";
import DisconnectModal from "./components/DisconnectModal";
import BoxStrip from "./components/BoxStrip";
import SwapKeepBanner from "./components/SwapKeepBanner";
import RoundScoreboard from "./components/RoundScoreboard";
import TiebreakerOverlay from "./components/TiebreakerOverlay";

const ROUND_RULES = {
  RULES_1: { roundNumber: 1, title: "Hot Take", rulesText: "Everyone answers the question anonymously. Vote for the funniest answer — not your own. Most votes across 3 questions wins." },
  RULES_2: { roundNumber: 2, title: "Reaction Race", rulesText: "4 rapid-fire prompts. Tap the correct answer as fast as you can. Speed + accuracy = points. Highest total wins." },
  RULES_3: { roundNumber: 3, title: "Imposter Guess", rulesText: "Most players share a secret word. One imposter has a different but related word. Give subtle clues. Vote out the imposter." },
  RULES_4: { roundNumber: 4, title: "Most Likely To", rulesText: "Vote for who fits each question most. The player voted most likely to have the prize on the final question wins this round." },
  RULES_5: { roundNumber: 5, title: "Final Accusation", rulesText: "One last vote. Who has the prize right now? Most accused player picks first in the Position Draft." },
  RULES_6: { roundNumber: 6, title: "Position Draft", rulesText: "Choose your action position for the final card phase. Going first means acting before others. Choose wisely." },
  RULES_7: { roundNumber: 7, title: "Final Card Phase", rulesText: "You've been dealt a secret card. Everyone must use theirs. Actions happen in the order you drafted. Chaos incoming." },
};

export default function App() {
  const { state } = useGame();
  const { phase } = state;

  function renderPhase() {
    if (ROUND_RULES[phase]) return <RulesCard {...ROUND_RULES[phase]} />;
    switch (phase) {
      case "HOME":           return <Home />;
      case "LOBBY":          return <Lobby />;
      case "BOX_ASSIGNMENT": return <BoxAssignment />;
      case "STARTING_SWAP":  return <StartingSwap />;
      case "ROUND_1_ANSWERING":
      case "ROUND_1_VOTING":
      case "ROUND_1_WINNER_ACTION": return <HotTakeRound key={state.questionIndex ?? 0} />;
      case "ROUND_2_PROMPT":
      case "ROUND_2_WINNER_ACTION": return <ReactionRace key={state.promptIndex ?? 0} />;
      case "ROUND_3_CLUES":
      case "ROUND_3_DISCUSSION":
      case "ROUND_3_VOTING":
      case "ROUND_3_WINNER_ACTION": return <ImposterGuess />;
      case "ROUND_4_VOTING":
      case "ROUND_4_WINNER_ACTION": return <MostLikelyTo key={state.questionIndex ?? 0} />;
      case "ROUND_5_VOTING": return <FinalAccusation />;
      case "ROUND_6_DRAFT":  return <PositionDraft />;
      case "ROUND_7_ACTING": return <FinalCardPhase />;
      case "FINAL_REVEAL":   return <FinalReveal />;
      case "RECAP":          return <EndgameRecap />;
      default:               return <Home />;
    }
  }

  return (
    <>
      {renderPhase()}
      <DisconnectModal />
      {/* Feature 1: Persistent box number strip — always shown except during hidden phases */}
      <BoxStrip />
      {/* Feature 3: Swap/Keep banner — shown after every winner decision */}
      <SwapKeepBanner />
      {/* Feature 2: Round scoreboard — shown for 8s after each round ends */}
      <RoundScoreboard />
      {/* Tiebreaker system — tie announce / challenge / wheel / winner */}
      <TiebreakerOverlay />
    </>
  );
}
