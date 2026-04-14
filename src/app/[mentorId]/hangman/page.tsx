import { notFound } from "next/navigation";
import { getMentor } from "@/lib/mentors";
import { GameShell } from "@/components/game-shell";
import Hangman from "@/games/hangman";

export default async function HangmanPage({
  params,
}: {
  params: Promise<{ mentorId: string }>;
}) {
  const { mentorId } = await params;
  const mentor = getMentor(mentorId);
  if (!mentor) notFound();

  return (
    <GameShell mentor={mentor} gameName="Hangman" gameIcon="☠️" gameId="hangman">
      <Hangman config={mentor} />
    </GameShell>
  );
}
