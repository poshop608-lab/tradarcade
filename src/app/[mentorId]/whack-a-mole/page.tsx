import { notFound } from "next/navigation";
import { getMentor } from "@/lib/mentors";
import { GameShell } from "@/components/game-shell";
import WhackAMoleGame from "@/games/whack-a-mole";

export default async function WhackAMolePage({ params }: { params: Promise<{ mentorId: string }> }) {
  const { mentorId } = await params;
  const mentor = getMentor(mentorId);
  if (!mentor) notFound();

  return (
    <GameShell mentor={mentor} gameName="Whack-a-Mole" gameIcon="🔨" gameId="whack-a-mole">
      <WhackAMoleGame config={mentor} />
    </GameShell>
  );
}
