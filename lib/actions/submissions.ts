"use server";

import { db } from "@/lib/db";
import { submissions, questions } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { eq, and } from "drizzle-orm";

export async function submitAnswer(data: {
  questionId: string;
  teamId: string;
  submissionType: "number" | "range";
  answerValue?: number;
  rangeMin?: number;
  rangeMax?: number;
}) {
  const question = db
    .select()
    .from(questions)
    .where(eq(questions.id, data.questionId))
    .get();

  if (!question) return { error: "Question not found" };
  if (question.status !== "active") return { error: "Question is not active" };

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
  const answerType = question.answerType || "exact";

  if (answerType === "exact") {
    isCorrect = data.answerValue === question.answer;
  } else {
    if (data.rangeMin === undefined || data.rangeMax === undefined) {
      return { error: "Range values required" };
    }

    const spread = data.rangeMax - data.rangeMin;
    const tolerance = question.rangeTolerance ?? Infinity;

    if (answerType === "range_absolute" && spread > tolerance) {
      return { error: `Range too wide. Max spread: ${tolerance}` };
    }
    if (answerType === "range_percent") {
      const maxAllowed = data.rangeMin * (1 + tolerance / 100);
      if (data.rangeMax > maxAllowed) {
        return { error: `Range too wide. Upper bound can be at most ${tolerance}% above lower bound` };
      }
    }

    isCorrect =
      data.rangeMin <= question.answer &&
      data.rangeMax >= question.answer;
  }

  const pointsAwarded = isCorrect ? pointsForAttempt : 0;

  const id = generateId();
  db.insert(submissions)
    .values({
      id,
      questionId: data.questionId,
      teamId: data.teamId,
      attemptNumber,
      submissionType: data.submissionType,
      answerValue: data.answerValue ?? null,
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
