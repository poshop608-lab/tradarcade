import { notFound } from "next/navigation";
import { getMentor } from "@/lib/mentors";
import { GameShell } from "@/components/game-shell";
import DoodleJumpGame from "@/games/doodle-jump";

export default async function DoodleJumpPage({ params }: { params: Promise<{ mentorId: string }> }) {
  const { mentorId } = await params;
  const mentor = getMentor(mentorId);
  if (!mentor) notFound();

  return (
    <GameShell mentor={mentor} gameName="Doodle Jump" gameIcon="⭐" gameId="doodle-jump">
      <DoodleJumpGame config={mentor} />
    </GameShell>
  );
}
