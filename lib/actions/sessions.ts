"use server";

import { db } from "@/lib/db";
import { sessions, teams, questions, submissions } from "@/lib/db/schema";
import { generateId, generateJoinCode } from "@/lib/utils";
import { eq } from "drizzle-orm";

export async function createSession(name: string, adminPassword: string) {
  const id = generateId();
  const joinCode = generateJoinCode();

  db.insert(sessions)
    .values({
      id,
      name,
      adminPassword,
      joinCode,
      status: "lobby",
      createdAt: new Date(),
    })
    .run();

  return { id, joinCode };
}

export async function verifyAdmin(sessionId: string, password: string) {
  const session = db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();

  if (!session) return null;
  if (session.adminPassword !== password) return null;
  return session;
}

export async function getSession(sessionId: string) {
  return db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();
}

export async function getSessionByCode(code: string) {
  return db
    .select()
    .from(sessions)
    .where(eq(sessions.joinCode, code.toUpperCase()))
    .get();
}

export async function updateSessionStatus(
  sessionId: string,
  status: "lobby" | "active" | "finished"
) {
  db.update(sessions)
    .set({ status })
    .where(eq(sessions.id, sessionId))
    .run();
}

export async function getSessionData(sessionId: string) {
  const session = db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();

  if (!session) return null;

  const sessionTeams = db
    .select()
    .from(teams)
    .where(eq(teams.sessionId, sessionId))
    .all();

  const sessionQuestions = db
    .select()
    .from(questions)
    .where(eq(questions.sessionId, sessionId))
    .orderBy(questions.sortOrder)
    .all();

  const allSubmissions = db
    .select()
    .from(submissions)
    .all()
    .filter((s) =>
      sessionQuestions.some((q) => q.id === s.questionId)
    );

  return {
    session,
    teams: sessionTeams,
    questions: sessionQuestions,
    submissions: allSubmissions,
  };
}
