import { notFound } from "next/navigation";
import { getMentor } from "@/lib/mentors";
import { GameShell } from "@/components/game-shell";
import GBNumberQuizGame from "@/games/gb-number-quiz";

export default async function GBNumberQuizPage({
  params,
}: {
  params: Promise<{ mentorId: string }>;
}) {
  const { mentorId } = await params;
  const mentor = getMentor(mentorId);
  if (!mentor) notFound();

  return (
    <GameShell mentor={mentor} gameName="GB Number Quiz" gameIcon="🔢" gameId="gb-number-quiz">
      <GBNumberQuizGame config={mentor} />
    </GameShell>
  );
}
