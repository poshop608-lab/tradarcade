import { MentorConfig } from "./types";

/**
 * Placeholder mentor config with generic trading content.
 * Replace with real mentor data when onboarding clients.
 */
export const sampleMentor: MentorConfig = {
  id: "sample-mentor",
  displayName: "Sample Mentor",
  branding: {
    primaryColor: "#2dd98f",
    accentColor: "#f0a500",
  },

  terms: [
    { term: "SUPPORT", definition: "A price level where buying pressure prevents further decline", category: "Technical Analysis" },
    { term: "RESISTANCE", definition: "A price level where selling pressure prevents further rise", category: "Technical Analysis" },
    { term: "BREAKOUT", definition: "Price moving beyond a defined support or resistance level", category: "Technical Analysis" },
    { term: "PULLBACK", definition: "A temporary reversal in the direction of a prevailing trend", category: "Price Action" },
    { term: "LIQUIDITY", definition: "The ease with which an asset can be bought or sold without affecting its price", category: "Market Structure" },
    { term: "SPREAD", definition: "The difference between the bid and ask price", category: "Order Flow" },
    { term: "LEVERAGE", definition: "Using borrowed capital to increase the potential return of an investment", category: "Risk Management" },
    { term: "DRAWDOWN", definition: "The peak-to-trough decline during a specific period of an investment", category: "Risk Management" },
    { term: "CONFLUENCE", definition: "Multiple technical factors aligning at the same price level", category: "Technical Analysis" },
    { term: "DIVERGENCE", definition: "When price and an indicator move in opposite directions", category: "Technical Analysis" },
    { term: "VOLUME", definition: "The number of shares or contracts traded in a given period", category: "Market Data" },
    { term: "ENGULFING", definition: "A candlestick pattern where the body fully covers the previous candle", category: "Candlestick Patterns" },
    { term: "PINBAR", definition: "A candle with a long wick showing rejection of a price level", category: "Candlestick Patterns" },
    { term: "STOPRUN", definition: "A move designed to trigger stop losses before reversing", category: "Market Structure" },
    { term: "FIBONACCI", definition: "Retracement levels based on key ratios used to identify potential reversals", category: "Technical Analysis" },
  ],

  concepts: [
    { label: "Trade with the trend", isValid: true, explanation: "Always align trades with the higher timeframe direction" },
    { label: "Risk 50% per trade", isValid: false, explanation: "Risking 50% per trade is reckless — standard is 1-2%" },
    { label: "Wait for confirmation", isValid: true, explanation: "Enter only after a confirmation candle validates the setup" },
    { label: "Chase extended moves", isValid: false, explanation: "Entering late after a big move increases risk of reversal" },
    { label: "Use a stop loss", isValid: true, explanation: "Every trade must have a predefined stop loss for risk management" },
    { label: "Average down on losers", isValid: false, explanation: "Adding to losing positions compounds risk exposure" },
    { label: "Check higher timeframe", isValid: true, explanation: "Always confirm the higher timeframe trend before entering" },
    { label: "Trade during news", isValid: false, explanation: "News events create unpredictable volatility — avoid unless planned" },
    { label: "Minimum 1:2 risk reward", isValid: true, explanation: "Only take trades with at least 2x the reward vs risk" },
    { label: "Revenge trade after loss", isValid: false, explanation: "Emotional trading after a loss leads to compounding losses" },
    { label: "Journal every trade", isValid: true, explanation: "Recording trades builds accountability and reveals patterns" },
    { label: "Ignore the spread", isValid: false, explanation: "The spread directly impacts entry and profitability" },
    { label: "Wait for key levels", isValid: true, explanation: "Trade at significant support/resistance, not in no-mans land" },
    { label: "Overtrade for volume", isValid: false, explanation: "Quality setups over quantity — overtrading erodes edge" },
    { label: "Follow your plan", isValid: true, explanation: "Stick to the system. Deviation leads to inconsistency" },
    { label: "Trade every session", isValid: false, explanation: "Not every session has valid setups — patience is key" },
  ],

  rules: [
    { rule: "Always identify the higher timeframe trend first", description: "The HTF trend determines trade direction", isTrue: true },
    { rule: "It is okay to enter without a stop loss", description: "Stop losses are optional for experienced traders", isTrue: false },
    { rule: "Price must be at a key level before entry", description: "Key levels provide the highest probability entries", isTrue: true },
    { rule: "A confirmation candle is needed before entry", description: "The confirmation validates that the level is holding", isTrue: true },
    { rule: "You should risk more on high-conviction trades", description: "Increasing size on conviction trades boosts returns", isTrue: false },
    { rule: "Risk no more than 1-2% per trade", description: "Consistent position sizing protects your capital", isTrue: true },
    { rule: "Multiple timeframe confluence improves probability", description: "When levels align across timeframes, probability increases", isTrue: true },
    { rule: "Market structure breaks signal trend changes", description: "A break of structure indicates a potential reversal", isTrue: true },
    { rule: "You can ignore volume in forex", description: "Volume is irrelevant in decentralized markets", isTrue: false },
    { rule: "Move stop to breakeven after 1R profit", description: "Protecting capital after the trade moves in your favor", isTrue: true },
  ],

  gbQuizItems: [
    { value: "11", category: "gb",      hint: ":11 is a primary GB number — appears in both Algo 1 and Algo 2" },
    { value: "17", category: "gb",      hint: ":17 is a primary GB number — Algo 1 delivery point, has CE at :23" },
    { value: "23", category: "ce",      hint: ":23 is a CE extension of the :17 GB number" },
    { value: "29", category: "gb",      hint: ":29 is a primary GB number — shared anchor for both algorithms, has CE at :35" },
    { value: "35", category: "ce",      hint: ":35 is a CE extension of the :29 GB number" },
    { value: "41", category: "gb",      hint: ":41 is a primary GB number — Algo 1 exclusive, no CE pair" },
    { value: "47", category: "gb",      hint: ":47 is a primary GB number — Algo 2 delivery point, has CE at :53" },
    { value: "53", category: "ce",      hint: ":53 is a CE extension of the :47 GB number" },
    { value: "59", category: "gb",      hint: ":59 is a primary GB number — appears in both algos, no CE pair" },
    { value: "71", category: "gb",      hint: ":71 is a primary GB number — Algo 1 terminal, has CE at :77" },
    { value: "77", category: "ce",      hint: ":77 is a CE extension of the :71 GB number" },
    { value: "03", category: "neither", hint: ":03 is a reference endpoint in the algo path, not a GB or CE number" },
    { value: "65", category: "neither", hint: ":65 is not a recognised GB or CE value" },
    { value: "83", category: "neither", hint: ":83 is not a recognised GB or CE value" },
  ],

  cePairings: [
    { gbNumber: "17", ceNumber: "23",  explanation: ":17 pairs with :23 — CE extension in Algo 1" },
    { gbNumber: "29", ceNumber: "35",  explanation: ":29 pairs with :35 — CE extension off the shared anchor" },
    { gbNumber: "47", ceNumber: "53",  explanation: ":47 pairs with :53 — CE extension in Algo 2" },
    { gbNumber: "71", ceNumber: "77",  explanation: ":71 pairs with :77 — CE extension at the Algo 1 terminal" },
  ],

  algoItems: [
    { number: "03", algo: "both",  note: ":03 is a reference endpoint — Algo 1 origin and Algo 2 terminal" },
    { number: "11", algo: "both",  note: ":11 appears in both Algo 1 and Algo 2 paths" },
    { number: "17", algo: "algo1", note: ":17 is an Algo 1 exclusive delivery point" },
    { number: "29", algo: "both",  note: ":29 is the shared anchor — both algorithms pass through here" },
    { number: "41", algo: "algo1", note: ":41 is an Algo 1 exclusive terminal" },
    { number: "47", algo: "algo2", note: ":47 is an Algo 2 exclusive delivery point" },
    { number: "53", algo: "algo2", note: ":53 is an Algo 2 exclusive CE delivery point" },
    { number: "59", algo: "both",  note: ":59 appears in both Algo 1 and Algo 2 paths" },
    { number: "71", algo: "algo1", note: ":71 is the Algo 1 terminal — end of the sequence" },
  ],

  clockwisePaths: [
    { from: "03", to: ["11"],       note: "From :03 the path flows to :11 — start of both algo sequences" },
    { from: "11", to: ["17", "29"], note: "From :11 you flow to :17 (Algo 1 next) or skip to :29 (shared anchor)" },
    { from: "17", to: ["23", "29"], note: "From :17 you flow to :23 (CE extension) or :29 (next GB anchor)" },
    { from: "23", to: ["29"],       note: "From CE :23 the next anchor is :29" },
    { from: "29", to: ["35", "41"], note: "From :29 you flow to :35 (CE extension) or :41 (Algo 1 next)" },
    { from: "35", to: ["47"],       note: "From CE :35 the Algo 2 path continues to :47" },
    { from: "41", to: ["59"],       note: "From :41 Algo 1 continues to :59" },
    { from: "47", to: ["53"],       note: "From :47 you flow to :53 (CE extension)" },
    { from: "53", to: ["59"],       note: "From CE :53 the path continues to :59" },
    { from: "59", to: ["71", "03"], note: "From :59 — Algo 1 ends at :71, Algo 2 cycles back to :03" },
    { from: "71", to: ["77"],       note: "From :71 you flow to :77 (CE extension) — end of Algo 1" },
  ],
};
