"use client";

import { createContext, useContext, ReactNode } from "react";
import { MentorConfig } from "./types";

const MentorContext = createContext<MentorConfig | null>(null);

export function MentorProvider({ config, children }: { config: MentorConfig; children: ReactNode }) {
  return <MentorContext.Provider value={config}>{children}</MentorContext.Provider>;
}

export function useMentor(): MentorConfig {
  const ctx = useContext(MentorContext);
  if (!ctx) throw new Error("useMentor must be used within MentorProvider");
  return ctx;
}
