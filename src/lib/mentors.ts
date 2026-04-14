import { MentorConfig } from "./types";
import { sampleMentor } from "./sample-config";

/**
 * Registry of all mentor configs.
 * Add new mentors here as they onboard.
 */
const mentors: Record<string, MentorConfig> = {
  "sample-mentor": sampleMentor,
};

export function getMentor(mentorId: string): MentorConfig | undefined {
  return mentors[mentorId];
}

export function getAllMentorIds(): string[] {
  return Object.keys(mentors);
}

export function getAllMentors(): MentorConfig[] {
  return Object.values(mentors);
}
