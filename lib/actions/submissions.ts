"use server";

import { db } from "@/lib/db";
import { sessions, submissions, questions } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { eq, and } from "drizzle-orm";

export async function submitAnswer(data: {
  questionId: string;
  teamId: string;
  submissionType: "number" | "range" | "text";
  answerValue?: number;
  rangeMin?: number;
  rangeMax?: number;
  answerText?: string;
}) {
  const question = db
    .select()
    .from(questions)
    .where(eq(questions.id, data.questionId))
    .get();

  if (!question) return { error: "Question not found" };
  if (question.status !== "active") return { error: "Question is not active" };

  const session = db.select().from(sessions).where(eq(sessions.id, question.sessionId)).get();
  if (!session || session.status !== "active") return { error: "Session is not active" };

  const existing = db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.questionId, data.questionId),
        eq(submissions.teamId, data.teamId)
      )
    )
    .all();

  const attemptNumber = existing.length + 1;
  if (attemptNumber > question.maxAttempts) {
    return { error: "No attempts remaining" };
  }

  const dropOff: number[] = JSON.parse(question.pointsDropOff);
  const pointsForAttempt =
    dropOff[attemptNumber - 1] ?? dropOff[dropOff.length - 1] ?? 0;

  let isCorrect = false;
  let pointsAwarded = 0;
  const answerType = question.answerType || "exact";
  const isSimulation = question.answerSource === "simulation";

  if (answerType === "text") {
    if (!data.answerText || !data.answerText.trim()) {
      return { error: "Text answer required" };
    }
    const expected = (question.answerText || "").trim().toLowerCase();
    const given = data.answerText.trim().toLowerCase();
    isCorrect = given === expected;
    pointsAwarded = isCorrect ? pointsForAttempt : 0;
  } else if (isSimulation) {
    const results: number[] = JSON.parse(question.simulationResults || "[]");
    if (results.length === 0) {
      return { error: "Simulation not yet realized" };
    }

    let hits: number;
    if (answerType === "exact") {
      if (data.answerValue === undefined) {
        return { error: "Answer value required" };
      }
      hits = results.filter((r) => r === data.answerValue).length;
    } else {
      if (data.rangeMin === undefined || data.rangeMax === undefined) {
        return { error: "Range values required" };
      }
      const spread = data.rangeMax - data.rangeMin;
      const tolerance = question.rangeTolerance ?? Infinity;
      if (answerType === "range_absolute" && spread > tolerance) {
        return { error: `Range too wide. Max width: ${tolerance}` };
      }
      if (answerType === "range_percent") {
        const maxAllowed = data.rangeMin * (1 + tolerance / 100);
        if (data.rangeMax > maxAllowed) {
          return {
            error: `Range too wide. Upper bound can be at most ${tolerance}% above lower bound`,
          };
        }
      }
      hits = results.filter(
        (r) => r >= data.rangeMin! && r <= data.rangeMax!
      ).length;
    }

    const proportion = hits / results.length;
    pointsAwarded = Math.round(proportion * pointsForAttempt);
    isCorrect = false;
  } else if (answerType === "exact") {
    isCorrect = data.answerValue === question.answer;
    pointsAwarded = isCorrect ? pointsForAttempt : 0;
  } else {
    if (data.rangeMin === undefined || data.rangeMax === undefined) {
      return { error: "Range values required" };
    }

    const spread = data.rangeMax - data.rangeMin;
    const tolerance = question.rangeTolerance ?? Infinity;

    if (answerType === "range_absolute" && spread > tolerance) {
      return { error: `Range too wide. Max width: ${tolerance}` };
    }
    if (answerType === "range_percent") {
      const maxAllowed = data.rangeMin * (1 + tolerance / 100);
      if (data.rangeMax > maxAllowed) {
        return {
          error: `Range too wide. Upper bound can be at most ${tolerance}% above lower bound`,
        };
      }
    }

    isCorrect =
      data.rangeMin <= question.answer && data.rangeMax >= question.answer;
    pointsAwarded = isCorrect ? pointsForAttempt : 0;
  }

  const id = generateId();
  db.insert(submissions)
    .values({
      id,
      questionId: data.questionId,
      teamId: data.teamId,
      attemptNumber,
      submissionType: data.submissionType,
      answerValue: data.answerValue ?? null,
      answerText: data.answerText ?? null,
      rangeMin: data.rangeMin ?? null,
      rangeMax: data.rangeMax ?? null,
      isCorrect,
      pointsAwarded,
      createdAt: new Date(),
    })
    .run();

  return {
    id,
    attemptNumber,
    isCorrect,
    pointsAwarded,
    attemptsRemaining: question.maxAttempts - attemptNumber,
  };
}

export async function getSubmissionsForTeam(
  teamId: string,
  questionId: string
) {
  return db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.teamId, teamId),
        eq(submissions.questionId, questionId)
      )
    )
    .orderBy(submissions.attemptNumber)
    .all();
}
