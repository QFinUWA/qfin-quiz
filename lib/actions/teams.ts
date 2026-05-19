"use server";

import { db } from "@/lib/db";
import { teams, players } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { eq, and } from "drizzle-orm";

export async function createTeam(sessionId: string, teamName: string) {
  const existing = db
    .select()
    .from(teams)
    .where(and(eq(teams.sessionId, sessionId), eq(teams.name, teamName)))
    .get();

  if (existing) {
    return { error: "Team name already taken" };
  }

  const id = generateId();
  db.insert(teams)
    .values({
      id,
      sessionId,
      name: teamName,
      createdAt: new Date(),
    })
    .run();

  return { id };
}

export async function joinTeam(teamId: string, username: string) {
  const team = db.select().from(teams).where(eq(teams.id, teamId)).get();
  if (!team) return { error: "Team not found" };

  const id = generateId();
  db.insert(players)
    .values({
      id,
      teamId,
      username,
      createdAt: new Date(),
    })
    .run();

  return { playerId: id, teamId: team.id, sessionId: team.sessionId };
}

export async function getTeamsForSession(sessionId: string) {
  const sessionTeams = db
    .select()
    .from(teams)
    .where(eq(teams.sessionId, sessionId))
    .all();

  const result = [];
  for (const team of sessionTeams) {
    const teamPlayers = db
      .select()
      .from(players)
      .where(eq(players.teamId, team.id))
      .all();
    result.push({ ...team, players: teamPlayers });
  }
  return result;
}
