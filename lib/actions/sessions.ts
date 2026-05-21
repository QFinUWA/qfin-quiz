"use server";

import { db } from "@/lib/db";
import { sessions, teams, players, questions, submissions } from "@/lib/db/schema";
import { generateId, generateJoinCode } from "@/lib/utils";
import { eq, gt, lt, inArray, desc } from "drizzle-orm";

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

  if (!session) return false;
  if (session.adminPassword !== password) return false;
  return true;
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
  const updates: Record<string, unknown> = { status };
  if (status === "active") {
    updates.scheduledStartAt = null;
    updates.scheduledEndAt = null;
  }
  if (status === "finished") {
    updates.scheduledEndAt = null;
  }
  if (status === "lobby") {
    updates.scheduledStartAt = null;
    updates.scheduledEndAt = null;
  }
  db.update(sessions)
    .set(updates)
    .where(eq(sessions.id, sessionId))
    .run();
}

export async function setScheduledStart(sessionId: string, time: Date | null) {
  db.update(sessions)
    .set({ scheduledStartAt: time })
    .where(eq(sessions.id, sessionId))
    .run();
}

export async function setScheduledEnd(sessionId: string, time: Date | null) {
  db.update(sessions)
    .set({ scheduledEndAt: time })
    .where(eq(sessions.id, sessionId))
    .run();
}

export async function checkScheduledTransitions(sessionId: string) {
  const session = db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();

  if (!session) return null;

  const now = new Date();

  if (
    session.status === "lobby" &&
    session.scheduledStartAt &&
    now >= session.scheduledStartAt
  ) {
    db.update(sessions)
      .set({ status: "active", scheduledStartAt: null })
      .where(eq(sessions.id, sessionId))
      .run();
    return { ...session, status: "active" as const, scheduledStartAt: null };
  }

  if (
    session.status === "active" &&
    session.scheduledEndAt &&
    now >= session.scheduledEndAt
  ) {
    db.update(sessions)
      .set({ status: "finished", scheduledEndAt: null })
      .where(eq(sessions.id, sessionId))
      .run();
    return { ...session, status: "finished" as const, scheduledEndAt: null };
  }

  if (
    session.status === "finished" &&
    session.scheduledStartAt &&
    now >= session.scheduledStartAt
  ) {
    db.update(sessions)
      .set({ status: "active", scheduledStartAt: null })
      .where(eq(sessions.id, sessionId))
      .run();
    return { ...session, status: "active" as const, scheduledStartAt: null };
  }

  return session;
}

export async function getSessionData(sessionId: string) {
  const session = await checkScheduledTransitions(sessionId);
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

export async function getActiveSessions() {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return db
    .select({
      id: sessions.id,
      name: sessions.name,
      joinCode: sessions.joinCode,
      status: sessions.status,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(gt(sessions.createdAt, oneWeekAgo))
    .orderBy(desc(sessions.createdAt))
    .all();
}

export async function deleteExpiredSessions() {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const expired = db
    .select({ id: sessions.id })
    .from(sessions)
    .where(lt(sessions.createdAt, oneWeekAgo))
    .all();

  if (expired.length === 0) return 0;

  const sessionIds = expired.map((s) => s.id);

  const questionIds = db
    .select({ id: questions.id })
    .from(questions)
    .where(inArray(questions.sessionId, sessionIds))
    .all()
    .map((q) => q.id);

  const teamIds = db
    .select({ id: teams.id })
    .from(teams)
    .where(inArray(teams.sessionId, sessionIds))
    .all()
    .map((t) => t.id);

  if (questionIds.length > 0) {
    db.delete(submissions)
      .where(inArray(submissions.questionId, questionIds))
      .run();
  }

  if (teamIds.length > 0) {
    db.delete(players)
      .where(inArray(players.teamId, teamIds))
      .run();
  }

  if (questionIds.length > 0) {
    db.delete(questions)
      .where(inArray(questions.id, questionIds))
      .run();
  }

  if (teamIds.length > 0) {
    db.delete(teams)
      .where(inArray(teams.id, teamIds))
      .run();
  }

  db.delete(sessions)
    .where(inArray(sessions.id, sessionIds))
    .run();

  return expired.length;
}
