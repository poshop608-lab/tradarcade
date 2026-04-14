import { notFound } from "next/navigation";
import { getMentor } from "@/lib/mentors";
import { GameShell } from "@/components/game-shell";
import WordleGame from "@/games/wordle";

export default async function WordlePage({ params }: { params: Promise<{ mentorId: string }> }) {
  const { mentorId } = await params;
  const mentor = getMentor(mentorId);
  if (!mentor) notFound();

  return (
    <GameShell mentor={mentor} gameName="Wordle" gameIcon="🟩" gameId="wordle">
      <WordleGame config={mentor} />
    </GameShell>
  );
}
