import { notFound } from "next/navigation";
import { getMentor } from "@/lib/mentors";
import { GameShell } from "@/components/game-shell";
import AsteroidsGame from "@/games/asteroids";

export default async function AsteroidsPage({ params }: { params: Promise<{ mentorId: string }> }) {
  const { mentorId } = await params;
  const mentor = getMentor(mentorId);
  if (!mentor) notFound();

  return (
    <GameShell mentor={mentor} gameName="Asteroids" gameIcon="🚀" gameId="asteroids">
      <AsteroidsGame config={mentor} />
    </GameShell>
  );
}
