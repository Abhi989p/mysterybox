// content/hotTakeBank.js
// 20 hot take questions from the spec
const HOT_TAKE_BANK = [
  "You get a biopic. What's it called and who plays you?",
  "Describe your ideal situationship in one sentence without sounding desperate. Go.",
  "Your crush texts 'we need to talk' at 11pm. What did you do?",
  "You're delusional about someone right now. Describe the delusion.",
  "What's the most unhinged thing you've done to get someone's attention?",
  "Rate your rizz 1–10 and give one piece of evidence.",
  "Your search history from last night gets read out loud. First result?",
  "You have 60 seconds to shoot your shot with your crush. Exactly what do you say?",
  "What's something you do alone at 2am that would concern your family?",
  "Describe your flirting style but make it sound like a crime report.",
  "Your villain origin story in this friend group — go.",
  "What's the most chaotic decision you made because of a feeling?",
  "You wake up and your body count is everyone's contact name. Your reaction?",
  "Someone finds your phone unlocked. Which app causes the most damage?",
  "What's your most delusional thought about your crush this week?",
  "Be honest — what is actually wrong with you?",
  "You can only text one person forever. Who and what's the first text?",
  "Describe your last almost-relationship using a weather report.",
  "What's the pettiest thing you've ever done and felt zero guilt about?",
  "Your roman empire — the thing you think about constantly. Go.",
];

function getRandomQuestions(count = 3) {
  const shuffled = [...HOT_TAKE_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

module.exports = { HOT_TAKE_BANK, getRandomQuestions };
