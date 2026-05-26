# MYSTERYBOX — FULL BUILD PROMPT
### Hand this entire file to the AI. Tell it: "Read this fully before writing a single line of code."

---

## WHAT YOU ARE BUILDING

A multiplayer online social party game called **MysteryBox**.

- Players: 3–6
- Every player owns one mystery box
- Only ONE box has the real prize
- Nobody knows where it is
- Players bluff, manipulate, and swap boxes across rounds
- Final phase uses secret cards to create chaos
- Prize revealed at the end

Total playtime: ~15–25 minutes per game.

---

## TECH STACK

| Layer | Tech |
|-------|------|
| Frontend | React + Tailwind CSS |
| Backend | Node.js + Express |
| Realtime | Socket.IO |
| Frontend host | Vercel |
| Backend host | Railway |

---

## VISUAL STYLE

- Colorful, cartoony, energetic, chaotic
- Modern party-game feel
- Mobile-first design — most players will be on phones
- Dark background with vibrant neon/pop colors for boxes and UI elements

---

## CRITICAL SERVER RULES — READ FIRST

These rules are non-negotiable and must be enforced throughout the entire codebase:

1. **Prize location NEVER sent to any frontend client until the final reveal**
2. **All swap logic processed server-side only**
3. **View card results sent ONLY to the requesting socket — never broadcast**
4. **Block card validity checked server-side before any swap executes**
5. **Full game state logged server-side from box assignment moment — this powers the endgame recap**
6. **Server is the single source of truth for all game state**

---

## PHASE BY PHASE BUILD SPEC

---

### PHASE 1 — HOME SCREEN

Two buttons:
- **Create Room** → server generates a 6-character alphanumeric room code, host enters display name, enters lobby
- **Join Room** → player enters room code + display name, enters lobby

---

### PHASE 2 — LOBBY

Display:
- Room code (large, copyable)
- List of joined players with ready indicators
- Waiting animation (floating boxes idle)
- Host sees "Start Game" button — enabled only when 3–6 players have joined
- Host has zero gameplay advantage — they are a normal player

---

### PHASE 3 — BOX ASSIGNMENT

Server:
- Assigns one numbered box per player (Box #1, Box #2, etc.)
- Randomly places prize in exactly ONE box
- Prize location stored server-side only — never emitted to any client

Players see:
- Their own box number
- All other players' boxes (as mystery boxes, no contents)

---

### PHASE 4 — STARTING SWAP (15–20 second timer)

- Any player can send a swap REQUEST to any specific other player
- Target receives an accept/decline popup
- Swap only executes if BOTH agree
- One pending request per player at a time — if two players request the same person simultaneously, first request shown, second auto-declined silently with notice: *"[Player] already has a pending request"*
- Timer expires → phase ends silently if no swaps happened
- All players see which numbered boxes swapped — NO prize info ever shown
- Immediately creates bluffing and suspicion

---

### RULES SCREEN (Before Every Round)

Before each round begins, display a rules card for that round.
- **10-second countdown timer** then auto-proceeds
- No skip button — everyone gets the same time
- Rules card content listed per round below

---

### ROUND 1 — HOT TAKE ROUND

**Rules card text:**
> Everyone answers the question anonymously. Vote for the funniest answer — not your own. Most votes across 3 questions wins.

**Structure:**
- 3 questions selected randomly from the Hot Take Bank (see below) — different 3 every game
- All players answer each question (text input, open-ended)
- Answers shown anonymously to all players
- Everyone votes for funniest answer — cannot vote own answer
- Votes tracked internally across all 3 questions
- Player with most total votes wins

**Hot Take Bank (pick 3 random each game):**
1. "You get a biopic. What's it called and who plays you?"
2. "Describe your ideal situationship in one sentence without sounding desperate. Go."
3. "Your crush texts 'we need to talk' at 11pm. What did you do?"
4. "You're delusional about someone right now. Describe the delusion."
5. "What's the most unhinged thing you've done to get someone's attention?"
6. "Rate your rizz 1–10 and give one piece of evidence."
7. "Your search history from last night gets read out loud. First result?"
8. "You have 60 seconds to shoot your shot with your crush. Exactly what do you say?"
9. "What's something you do alone at 2am that would concern your family?"
10. "Describe your flirting style but make it sound like a crime report."
11. "Your villain origin story in this friend group — go."
12. "What's the most chaotic decision you made because of a feeling?"
13. "You wake up and your body count is everyone's contact name. Your reaction?"
14. "Someone finds your phone unlocked. Which app causes the most damage?"
15. "What's your most delusional thought about your crush this week?"
16. "Be honest — what is actually wrong with you?"
17. "You can only text one person forever. Who and what's the first text?"
18. "Describe your last almost-relationship using a weather report."
19. "What's the pettiest thing you've ever done and felt zero guilt about?"
20. "Your roman empire — the thing you think about constantly. Go."

**Winner action:**
Winner chooses KEEP or SWAP.
- SWAP: select any other player to swap boxes with (no consent needed — winner's right)
- KEEP: broadcast to all as *"[Player] is staying confident"* with smug animation — this is a psychological move, not a pass

**Tiebreaker:** If tied on total votes → only tied players do a tiebreak mini-challenge (see Tiebreaker section)

---

### ROUND 2 — REACTION RACE

**Rules card text:**
> 4 rapid-fire prompts. Tap the correct answer from 4 options as fast as you can. Speed + accuracy = points. Highest total wins.

**Structure:**
- 4 prompts shown rapidly one after another
- Each prompt: show a stimulus (emoji, image, word, color) with 4 answer options on screen
- Players TAP the correct answer — no typing
- Scoring per prompt: correct answer = base points + speed bonus (faster = more points), wrong = 0
- Highest total points across all 4 prompts wins

**Example prompt types:**
- Show 🍎 → options: [Banana, Apple, Mango, Grape] → tap Apple
- Show a color swatch → options: [Red, Blue, Green, Yellow]
- Show a number equation → options: [4 answer choices]
- Show an animal sound description → options: [4 animals]

**Winner action:** KEEP or SWAP (same as Round 1)

---

### ROUND 3 — IMPOSTER GUESS

**Rules card text:**
> Most players share a secret word. One imposter has a different but related word. Give subtle clues. Vote out the imposter. Normals get points for correct ID. Imposter scores for every player they fool.

**Structure:**
- Server picks a category and word
- Always exactly 1 imposter regardless of player count
- Most players get the SAME word
- Imposter gets a RELATED but DIFFERENT word
- Example: players get *Pushpa*, imposter gets *Salaar*

**Categories (server picks randomly):**
- Tollywood actors
- Bollywood films
- Colors
- Foods
- Celebrities
- Brands
- Animals
- Sports

**Gameplay:**
1. Players receive secret word (private, shown only to them)
2. Clue-giving order randomized by server each game
3. Each player gives ONE subtle verbal/text clue
4. Discussion phase (60 second timer)
5. All players vote simultaneously using a countdown timer — NOT fastest click
6. Players cannot vote for themselves

**Scoring:**
- Normal player correctly identifies imposter: +1 point
- Imposter fools a player (per player fooled): +1 point each
- Imposter fools nobody: 0 points
- Round winner = player with highest point gain this round

**Winner action:** KEEP or SWAP

---

### ROUND 4 — MOST LIKELY TO

**Rules card text:**
> Vote for who fits each question most. The player voted most likely to have the prize on the final question wins this round.

**Structure:**
- 3–4 questions shown
- Final question is ALWAYS LOCKED: *"Who currently has the prize?"*
- All players vote simultaneously for each question
- Players CAN vote themselves
- Most voted player on the LOCKED final question wins the round

**Example questions (before the locked one):**
- "Who is bluffing hardest right now?"
- "Who panic swaps in the final phase?"
- "Who has done the most suspicious swap?"

**Winner action:** KEEP or SWAP

**Tiebreaker:** If tied on locked question votes → tied players do tiebreak mini-challenge

---

### ROUND 5 — FINAL ACCUSATION

**Transition:** Big cinematic transition — dark visuals, intense music, dramatic atmosphere shift

**Rules card text:**
> One last vote. Who has the prize right now? Most accused player picks first in the Position Draft. No one finds out if you were right... yet.

**Structure:**
- Single question: **"Who currently has the prize?"**
- All players vote simultaneously with countdown timer
- Players CANNOT vote for themselves
- Most accused player gets FIRST PICK in Round 6 Position Draft
- Does NOT reveal who actually has the prize
- Correct votes revealed ONLY in endgame recap — never live

**Tie in most accused:** Server randomly picks one of the tied players for first draft priority

---

### ROUND 6 — POSITION DRAFT

**Rules card text:**
> Choose your action position for the final card phase. Going first means acting before others. Going last means reacting to everything. Choose wisely.

**Draft order:**
1. Most accused player (from Round 5) picks first
2. Remaining players in descending total score order
3. Score ties broken by server random selection

**Mechanics:**
- Available slots shown: 1 through [player count]
- Players pick in priority order
- Each player has 15 seconds to choose a slot
- If no pick within 15 seconds → server auto-assigns the best remaining slot
- Player may choose any available slot — first or last is a valid strategic choice

---

### ROUND 7 — FINAL CARD PHASE

**Rules card text:**
> You've been dealt a secret card. Everyone must use theirs. Actions happen in the order you drafted. What happens next... nobody fully controls.

**Card pool by player count (server assigns randomly within pool):**

| Players | Blind Swap | View | See & Swap | Block |
|---------|-----------|------|------------|-------|
| 3 | 1 | 1 | 1 | 0 |
| 4 | 1 | 1 | 1 | 1 |
| 5 | 2 | 1 | 1 | 1 |
| 6 | 2 | 2 | 1 | 1 |

**Card descriptions:**

| Card | What it does |
|------|-------------|
| Blind Swap | Swap your box with any player's — without seeing contents |
| View | Secretly see contents of one other player's box (result only to you) |
| See & Swap | View one box privately, then optionally swap with that player |
| Block | Prevent one specific player from swapping with you this phase |

**Rules:**
- All cards private initially
- Every player MUST use their card — no passing
- Actions execute in drafted position order
- Block: if a Blocked player attempts to swap with Blocker → server rejects it, broadcasts *"[Player]'s swap was blocked!"*
- View result: sent to requesting socket ONLY. Others see: *"[Player] viewed a box."*
- See & Swap: player sees result privately, short timer to decide swap yes/no
- All swap animations visible to everyone (no contents shown)
- Dramatic pause + animation between each player's action

---

### ROUND 8 — FINAL REVEAL

**Sequence:**
1. Drumroll sound
2. All boxes shake simultaneously
3. Boxes open one-by-one — REVERSE suspicion order (least accused first, most accused last)
4. Prize box: confetti explosion, winner crowned
5. All others: funny randomized loss message

**Example loss messages:**
- "Not even close bestie."
- "The box was always empty, just like your strategy."
- "You played so hard for absolutely nothing."
- "Better luck next paranoia spiral."
- "Your box had vibes though. Just not prize vibes."

---

### ENDGAME RECAP

**Timeline replay shows:**
- Every swap from game start (starting swap included)
- Who held the prize at each moment in time
- Every View result (now publicly revealed)
- Every Block played
- Major turning points highlighted

**Badges awarded:**
- 🏆 Winner — player who held prize at reveal
- 👁️ Sharpest Eye — player(s) who correctly accused the winner in Round 5 (revealed here only)
- 🎯 Best Player — highest total scoreboard points

**Rematch:**
- Rematch / Quit options shown
- Majority vote → same lobby restarts
- Last game winner gets *"Reigning Champ 👑"* tag on their name in next game

---

## TIEBREAKER SYSTEM

**Triggers:** Round 1 (tied votes), Round 4 (tied accusation votes)

**Format:**
- Only tied players participate
- A random word prompt shown: e.g. *"TYPE: BANANA"* or *"TAP THE CORRECT ANSWER"*
- Fastest correct response wins
- Secondary tiebreaker: higher total scoreboard points
- Final tiebreaker: server random

---

## SCORING SUMMARY

| Source | Points |
|--------|--------|
| Correctly identify imposter (Round 3) | +1 |
| Imposter fools a player (per player) | +1 each |
| Reaction Race prompt (correct + speed) | sliding scale |

Points determine: Round 6 draft order (after most-accused player) + recap leaderboard ranking.

---

## DISCONNECTION HANDLING

1. Player disconnects → server starts 60s countdown, room notified
2. Reconnects within 60s → seamlessly rejoined, full state restored (match by socket ID + display name)
3. After 60s → room gets a vote: **Continue** or **Collapse**
4. Continue wins → disconnected player's card auto-played as random neutral server action, box stays in play
5. Collapse wins → game ends, all to lobby with rematch option
6. Host disconnects → next player in join order becomes host automatically

---

## SOCKET EVENT REFERENCE

### Client → Server

| Event | Payload |
|-------|---------|
| `swap_request` | `{ from, to }` |
| `swap_response` | `{ accepted: bool }` |
| `view_request` | `{ targetBox }` |
| `block_played` | `{ targetPlayer }` |
| `blind_swap_played` | `{ targetPlayer }` |
| `see_swap_played` | `{ targetPlayer, swapDecision: bool }` |
| `keep_choice` | `{}` |
| `swap_choice` | `{ targetPlayer }` |
| `vote_submit` | `{ round, question, votedPlayer }` |
| `draft_pick` | `{ slot }` |
| `tiebreak_answer` | `{ answer, timestamp }` |
| `disconnect_vote` | `{ choice: 'continue' \| 'collapse' }` |
| `rematch_vote` | `{ choice: bool }` |
| `hot_take_answer` | `{ questionIndex, answer }` |
| `hot_take_vote` | `{ questionIndex, votedAnswerIndex }` |
| `reaction_answer` | `{ promptIndex, answerIndex, timestamp }` |
| `imposter_clue` | `{ clue }` |
| `imposter_vote` | `{ votedPlayer }` |

### Server → Client

| Event | Recipient | Description |
|-------|-----------|-------------|
| `swap_request_incoming` | Target only | Accept/decline popup |
| `swap_request_blocked` | Requester only | Already has pending request |
| `swap_executed` | All | Boxes X and Y swapped |
| `swap_blocked_by_card` | All | Swap rejected by Block card |
| `view_result` | Requester ONLY | Prize or empty result |
| `view_broadcast` | All others | "[Player] viewed a box." |
| `block_broadcast` | All | "[Player] blocked [Player]" |
| `keep_broadcast` | All | "[Player] is staying confident" |
| `round_winner` | All | Who won this round |
| `card_assigned` | Player only | Private card |
| `draft_order` | All | Pick order for Round 6 |
| `draft_slot_taken` | All | Slot claimed update |
| `draft_auto_assigned` | All | Timed-out auto-assign |
| `accusation_result` | All | Most accused player |
| `disconnect_notice` | All | Player disconnected, 60s starting |
| `disconnect_vote_result` | All | Continue or collapse |
| `game_state_log` | All | Released ONLY at final reveal |
| `final_reveal` | All | Reveal sequence begins |
| `round_rules` | All | Rules card content for upcoming round |
| `phase_change` | All | Current game phase update |
| `timer_sync` | All | Authoritative timer from server |

---

## ANIMATIONS REQUIRED

| Animation | When |
|-----------|------|
| Floating idle boxes | Lobby + waiting states |
| Box shake | When targeted for swap or view |
| Swap animation | Two boxes visibly exchange positions |
| Round transition | Between every round — dramatic, full screen |
| Card flip reveal | When player sees their card in Round 7 |
| Accusation arrows | Round 5 — arrows pointing from voter to accused |
| Confetti explosion | Prize box at final reveal |
| Drumroll + box shake | Final reveal buildup |
| Smug idle animation | On KEEP choice broadcast |
| Block animation | Shield effect when Block played |

---

## SERVER STATE LOG SPEC
### (Required for recap — must be built from day one)

Server must log every state change:

```
gameLog = {
  roomId: string,
  players: [{ id, name, boxNumber }],
  prizeBox: number,                          // never sent to client until reveal
  events: [
    {
      type: 'swap' | 'view' | 'block' | 'keep' | 'vote' | 'card_used' | 'phase_change',
      timestamp: number,
      round: number,
      data: { ...event specific data }
    }
  ],
  boxStateHistory: [
    { timestamp, prizeHeldBy: playerId }     // derived from swaps, logged every swap
  ],
  votes: { round: { question: { playerId: votedPlayerId } } },
  scores: { playerId: number },
  cardAssignments: { playerId: cardType },   // never sent to others until recap
  finalAccusations: { playerId: accusedPlayerId },
  correctAccusers: [playerId]                // computed at reveal
}
```

This entire log is released to all clients only after the final reveal triggers.

---

## IMPORTANT NOTES FOR THE AI BUILDING THIS

1. **Build backend first** — get all socket events, room management, game state, and prize logic working before touching frontend visuals
2. **Never trust the client** — all game logic validated server-side
3. **Timer authority** — all round timers are server-authoritative, synced to clients via `timer_sync` events. Never use client-side timers as source of truth
4. **Mobile first** — tap targets minimum 44px, no hover-only interactions, reactions must work on touchscreen
5. **Room state in memory** — use a Map of roomId → gameState objects. Add Redis later for scaling
6. **Test disconnection early** — the reconnection window is critical, build and test it before finals phase
7. **Card phase is the most complex** — build it last, after all other rounds are stable
8. **See & Swap view result** — must use socket.to(playerId).emit(), never broadcast
9. **Hot Take answers** — store anonymously on server, shuffle before sending to clients so answer order doesn't reveal who answered
10. **Reaction Race timestamps** — use server-received timestamp for scoring, not client-sent timestamp (prevents cheating)

---

*End of build prompt. Read everything above before writing any code.*
