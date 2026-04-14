export interface MentorConfig {
  id: string;
  displayName: string;
  branding: {
    primaryColor: string;
    accentColor: string;
    logoUrl?: string;
  };

  /** Trading terms with definitions — used by Wordle, Hangman, Wheel of Fortune, Memory */
  terms: Array<{
    term: string;
    definition: string;
    category?: string;
  }>;

  /** Concepts labeled valid/invalid — used by Asteroids, Whack-a-Mole, Fruit Ninja, Crossy Road, Doodle Jump */
  concepts: Array<{
    label: string;
    isValid: boolean;
    explanation?: string;
  }>;

  /** Trading rules as true/false statements — used by Flappy Bird */
  rules: Array<{
    rule: string;
    description?: string;
    isTrue: boolean;
  }>;

  /** For GB Number Quiz — classify minute values as GB, CE, or neither */
  gbQuizItems?: Array<{
    value: string;
    category: "gb" | "ce" | "neither";
    hint?: string;
  }>;

  /** For CE Matching Game — pair GB numbers with their CE extensions */
  cePairings?: Array<{
    gbNumber: string;
    ceNumber: string;
    explanation?: string;
  }>;

  /** For Algo Sorter — assign minute values to Algo 1, Algo 2, or Both */
  algoItems?: Array<{
    number: string;
    algo: "algo1" | "algo2" | "both";
    note?: string;
  }>;

  /** For Clockwise Game — algo path sequences */
  clockwisePaths?: Array<{
    from: string;
    fromCE?: string;
    to: string[];
    toCEs?: string[];
    note?: string;
  }>;

  /** Game IDs shown by default on this mentor's hub. If undefined, all applicable games are shown. */
  defaultActiveGameIds?: string[];
}

export interface GameMeta {
  id: string;
  name: string;
  icon: string;
  description: string;
  path: string;
  color: string;
}
