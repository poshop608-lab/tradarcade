import { notFound } from "next/navigation";
import { getMentor } from "@/lib/mentors";
import { GameShell } from "@/components/game-shell";
import Memory from "@/games/memory";

export default async function MemoryPage({
  params,
}: {
  params: Promise<{ mentorId: string }>;
}) {
  const { mentorId } = await params;
  const mentor = getMentor(mentorId);
  if (!mentor) notFound();

  return (
    <GameShell mentor={mentor} gameName="Memory Pairs" gameIcon="🃏" gameId="memory">
      <Memory config={mentor} />
    </GameShell>
  );
}
