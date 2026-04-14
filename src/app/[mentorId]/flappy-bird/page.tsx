import { notFound } from "next/navigation";
import { getMentor } from "@/lib/mentors";
import { GameShell } from "@/components/game-shell";
import FlappyBird from "@/games/flappy-bird";

export default async function FlappyBirdPage({
  params,
}: {
  params: Promise<{ mentorId: string }>;
}) {
  const { mentorId } = await params;
  const mentor = getMentor(mentorId);

  if (!mentor) {
    notFound();
  }

  return (
    <GameShell mentor={mentor} gameName="Flappy Bird" gameIcon="🐦" gameId="flappy-bird">
      <FlappyBird config={mentor} />
    </GameShell>
  );
}
