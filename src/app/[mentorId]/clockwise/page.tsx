import { notFound } from "next/navigation";
import { getMentor } from "@/lib/mentors";
import { GameShell } from "@/components/game-shell";
import ClockwiseGame from "@/games/clockwise";

export default async function ClockwisePage({
  params,
}: {
  params: Promise<{ mentorId: string }>;
}) {
  const { mentorId } = await params;
  const mentor = getMentor(mentorId);
  if (!mentor) notFound();

  return (
    <GameShell mentor={mentor} gameName="Clockwise" gameIcon="🕐" gameId="clockwise">
      <ClockwiseGame config={mentor} />
    </GameShell>
  );
}
