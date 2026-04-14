import { GameMeta } from "./types";

export const GAMES: GameMeta[] = [
  { id: "asteroids",       name: "Asteroids",         icon: "🚀", description: "Shoot invalid concepts, let valid ones pass",         path: "asteroids",        color: "#3B82F6" },
  { id: "crossy-road",     name: "Crossy Road",       icon: "🚗", description: "Hop across lanes — only cross on valid concepts",     path: "crossy-road",      color: "#22c55e" },
  { id: "flappy-bird",      name: "Flappy Bird",        icon: "🐦", description: "Fly through the correct answer gaps",                 path: "flappy-bird",      color: "#F59E0B" },
  { id: "whack-a-mole",    name: "Whack-a-Mole",       icon: "🔨", description: "Tap valid setups, avoid the invalid ones",             path: "whack-a-mole",     color: "#EF4444" },
  { id: "wordle",          name: "Wordle",              icon: "🟩", description: "Guess the hidden trading term in 6 tries",             path: "wordle",           color: "#22c55e" },
  { id: "memory",          name: "Memory Pairs",        icon: "🃏", description: "Match trading terms with their definitions",           path: "memory",           color: "#7C3AED" },
  { id: "doodle-jump",     name: "Doodle Jump",         icon: "⭐", description: "Bounce on valid platforms, avoid invalid ones",        path: "doodle-jump",      color: "#3B82F6" },
  { id: "fruit-ninja",     name: "Fruit Ninja",         icon: "🍎", description: "Slash valid setups, dodge the bombs",                  path: "fruit-ninja",      color: "#EF4444" },
  { id: "hangman",         name: "Hangman",             icon: "☠️", description: "Guess the hidden trading rule letter by letter",       path: "hangman",          color: "#F59E0B" },
  { id: "wheel-of-fortune", name: "Wheel of Fortune",  icon: "🎰", description: "Spin to reveal letters of a hidden trading rule",      path: "wheel-of-fortune", color: "#7C3AED" },
  { id: "gb-number-quiz",  name: "GB Number Quiz",      icon: "🔢", description: "Classify minute values as GB, CE, or trap numbers",    path: "gb-number-quiz",   color: "#22d3ee" },
  { id: "ce-matching",     name: "CE Matching",         icon: "🎯", description: "Match each GB number to its Close Extension pair",     path: "ce-matching",      color: "#a855f7" },
  { id: "algo-sorter",     name: "Algo Sorter",         icon: "📊", description: "Classify minute values into Algo 1, Algo 2, or Both",  path: "algo-sorter",      color: "#f59e0b" },
  { id: "clockwise",       name: "Clockwise",           icon: "🕐", description: "Given a number, pick the next stop in the algo path",  path: "clockwise",        color: "#22d3ee" },
];
