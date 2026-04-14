import { notFound } from "next/navigation";
import { getMentor } from "@/lib/mentors";
import { GameShell } from "@/components/game-shell";
import FruitNinjaGame from "@/games/fruit-ninja";

export default async function FruitNinjaPage({ params }: { params: Promise<{ mentorId: string }> }) {
  const { mentorId } = await params;
  const mentor = getMentor(mentorId);
  if (!mentor) notFound();

  return (
    <GameShell mentor={mentor} gameName="Fruit Ninja" gameIcon="🍎" gameId="fruit-ninja">
      <FruitNinjaGame config={mentor} />
    </GameShell>
  );
}
