"use server";

import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { eq } from "drizzle-orm";

export async function addQuestion(
  sessionId: string,
  data: {
    title: string;
    description?: string;
    answer: number;
    answerType: "exact" | "range_absolute" | "range_percent";
    rangeTolerance?: number;
    maxPoints: number;
    maxAttempts: number;
    pointsDropOff: number[];
  }
) {
  const existing = db
    .select()
    .from(questions)
    .where(eq(questions.sessionId, sessionId))
    .all();

  const id = generateId();
  db.insert(questions)
    .values({
      id,
      sessionId,
      title: data.title,
      description: data.description || null,
      answer: data.answer,
      answerType: data.answerType,
      rangeTolerance: data.rangeTolerance ?? null,
      maxPoints: data.maxPoints,
      maxAttempts: data.maxAttempts,
      pointsDropOff: JSON.stringify(data.pointsDropOff),
      status: "hidden",
      sortOrder: existing.length,
      createdAt: new Date(),
    })
    .run();

  return { id };
}

export async function updateQuestionStatus(
  questionId: string,
  status: "hidden" | "active" | "closed" | "revealed"
) {
  db.update(questions)
    .set({ status })
    .where(eq(questions.id, questionId))
    .run();
}

export async function deleteQuestion(questionId: string) {
  db.delete(questions).where(eq(questions.id, questionId)).run();
}

export async function getQuestionsForSession(sessionId: string) {
  return db
    .select()
    .from(questions)
    .where(eq(questions.sessionId, sessionId))
    .orderBy(questions.sortOrder)
    .all();
}
