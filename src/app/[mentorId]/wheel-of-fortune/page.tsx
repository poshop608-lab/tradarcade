import { notFound } from "next/navigation";
import { getMentor } from "@/lib/mentors";
import { GameShell } from "@/components/game-shell";
import WheelOfFortuneGame from "@/games/wheel-of-fortune";

export default async function WheelOfFortunePage({ params }: { params: Promise<{ mentorId: string }> }) {
  const { mentorId } = await params;
  const mentor = getMentor(mentorId);
  if (!mentor) notFound();

  return (
    <GameShell mentor={mentor} gameName="Wheel of Fortune" gameIcon="🎰" gameId="wheel-of-fortune">
      <WheelOfFortuneGame config={mentor} />
    </GameShell>
  );
}
