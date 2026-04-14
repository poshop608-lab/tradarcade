import { notFound } from "next/navigation";
import { getMentor } from "@/lib/mentors";
import { GameShell } from "@/components/game-shell";
import AlgoSorterGame from "@/games/algo-sorter";

export default async function AlgoSorterPage({
  params,
}: {
  params: Promise<{ mentorId: string }>;
}) {
  const { mentorId } = await params;
  const mentor = getMentor(mentorId);
  if (!mentor) notFound();

  return (
    <GameShell mentor={mentor} gameName="Algo Sorter" gameIcon="📊" gameId="algo-sorter">
      <AlgoSorterGame config={mentor} />
    </GameShell>
  );
}
