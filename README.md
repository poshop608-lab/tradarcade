# TradesArcade

A gamified trading education platform. Mentors onboard their trading model — rules, terms, concepts — into a JSON config. That single config powers 10 different browser games. Students play the games to drill pattern recognition.

## Games

| Game | Mechanic |
|------|----------|
| Wordle | Guess the hidden trading term in 6 tries |
| Hangman | Guess a trading rule letter by letter |
| Memory Pairs | Match term cards to definition cards |
| Whack-a-Mole | Tap valid trading concepts, avoid invalid ones |
| Wheel of Fortune | Spin and guess letters in a trading rule |
| Asteroids | Shoot invalid concepts, let valid ones pass |
| Flappy Bird | Fly through the correct TRUE/FALSE gap |
| Doodle Jump | Bounce on valid concept platforms, avoid invalid |
| Fruit Ninja | Slash valid concepts, avoid invalid bombs |
| Crossy Road | Cross lanes of scrolling concepts safely |

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Games:** HTML5 Canvas + React DOM

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the mentor selector.

## Adding a Mentor

1. Create a config object in `src/lib/` (use `sample-config.ts` as a template)
2. Register it in `src/lib/mentors.ts`
3. Client's games are live at `/{mentorId}`

No changes to game engines needed — all content is driven by config.

## Routing

```
/                   → Mentor selector
/[mentorId]         → Game hub (all 10 games)
/[mentorId]/[game]  → Individual game
```
