import { db } from "@/lib/db";
import { sessions, teams, players } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = db
    .select({
      id: sessions.id,
      name: sessions.name,
      joinCode: sessions.joinCode,
      status: sessions.status,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(eq(sessions.id, id))
    .get();

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const sessionTeams = db
    .select()
    .from(teams)
    .where(eq(teams.sessionId, id))
    .all();

  const teamsWithPlayers = sessionTeams.map((team) => {
    const teamPlayers = db
      .select()
      .from(players)
      .where(eq(players.teamId, team.id))
      .all();
    return { ...team, players: teamPlayers };
  });

  return Response.json({ ...session, teams: teamsWithPlayers });
}
