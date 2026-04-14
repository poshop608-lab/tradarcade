import { notFound } from "next/navigation";
import { getMentor } from "@/lib/mentors";
import { GameShell } from "@/components/game-shell";
import CEMatchingGame from "@/games/ce-matching";

export default async function CEMatchingPage({
  params,
}: {
  params: Promise<{ mentorId: string }>;
}) {
  const { mentorId } = await params;
  const mentor = getMentor(mentorId);
  if (!mentor) notFound();

  return (
    <GameShell mentor={mentor} gameName="CE Matching" gameIcon="🎯" gameId="ce-matching">
      <CEMatchingGame config={mentor} />
    </GameShell>
  );
}
