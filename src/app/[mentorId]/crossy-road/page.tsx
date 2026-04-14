import { notFound } from "next/navigation";
import { getMentor } from "@/lib/mentors";
import { GameShell } from "@/components/game-shell";
import CrossyRoadGame from "@/games/crossy-road";

export default async function CrossyRoadPage({ params }: { params: Promise<{ mentorId: string }> }) {
  const { mentorId } = await params;
  const mentor = getMentor(mentorId);
  if (!mentor) notFound();

  return (
    <GameShell mentor={mentor} gameName="Crossy Road" gameIcon="🚘" gameId="crossy-road">
      <CrossyRoadGame config={mentor} />
    </GameShell>
  );
}
