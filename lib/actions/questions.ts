"use server";

import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import path from "path";

export async function addQuestion(
  sessionId: string,
  data: {
    title: string;
    description?: string;
    answer: number;
    answerType: "exact" | "range_absolute" | "range_percent" | "text";
    answerSource: "point" | "simulation";
    answerText?: string;
    rangeTolerance?: number;
    maxPoints: number;
    maxAttempts: number;
    pointsDropOff: number[];
    simulationScript?: string;
    simulationN?: number;
  }
) {
  const existing = db
    .select()
    .from(questions)
    .where(eq(questions.sessionId, sessionId))
    .all();

  const id = generateId();
  const isSimulation = data.answerSource === "simulation";

  db.insert(questions)
    .values({
      id,
      sessionId,
      title: data.title,
      description: data.description || null,
      answer: isSimulation || data.answerType === "text" ? 0 : data.answer,
      answerType: data.answerType,
      answerSource: data.answerSource,
      answerText: data.answerType === "text" ? (data.answerText || null) : null,
      rangeTolerance: data.rangeTolerance ?? null,
      maxPoints: data.maxPoints,
      maxAttempts: data.maxAttempts,
      pointsDropOff: JSON.stringify(data.pointsDropOff),
      status: isSimulation ? "hidden" : "active",
      sortOrder: existing.length,
      simulationScript: isSimulation ? (data.simulationScript || null) : null,
      simulationN: isSimulation ? (data.simulationN || null) : null,
      simulationResults: null,
      createdAt: new Date(),
    })
    .run();

  return { id };
}

export async function realizeSimulation(questionId: string) {
  const question = db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .get();

  if (!question) return { error: "Question not found" };
  if (question.answerSource !== "simulation")
    return { error: "Not a simulation question" };
  if (!question.simulationScript || !question.simulationN)
    return { error: "Missing simulation script or n" };

  const tmpFile = path.join(tmpdir(), `sim_${questionId}_${Date.now()}.py`);

  const runnerScript = `import json
import sys

${question.simulationScript}

n = ${question.simulationN}
results = []
for i in range(n):
    results.append(int(simulate()))
print(json.dumps(results))
`;

  try {
    writeFileSync(tmpFile, runnerScript);
    const output = execSync(`python3 "${tmpFile}"`, {
      timeout: 60000,
      encoding: "utf-8",
    });
    const results: number[] = JSON.parse(output.trim());

    db.update(questions)
      .set({
        simulationResults: JSON.stringify(results),
        status: "active",
      })
      .where(eq(questions.id, questionId))
      .run();

    return {
      success: true,
      resultCount: results.length,
      min: Math.min(...results),
      max: Math.max(...results),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Simulation failed: ${message}` };
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {}
  }
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

export async function updateQuestion(
  questionId: string,
  data: {
    title?: string;
    description?: string;
    answer?: number;
    answerType?: "exact" | "range_absolute" | "range_percent" | "text";
    answerText?: string | null;
    rangeTolerance?: number | null;
    maxPoints?: number;
    maxAttempts?: number;
    pointsDropOff?: number[];
  }
) {
  const updates: Record<string, unknown> = {};
  if (data.title !== undefined) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description || null;
  if (data.answer !== undefined) updates.answer = data.answer;
  if (data.answerType !== undefined) updates.answerType = data.answerType;
  if (data.answerText !== undefined) updates.answerText = data.answerText;
  if (data.rangeTolerance !== undefined) updates.rangeTolerance = data.rangeTolerance;
  if (data.maxPoints !== undefined) updates.maxPoints = data.maxPoints;
  if (data.maxAttempts !== undefined) updates.maxAttempts = data.maxAttempts;
  if (data.pointsDropOff !== undefined) updates.pointsDropOff = JSON.stringify(data.pointsDropOff);

  db.update(questions)
    .set(updates)
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
    .orderBy(questions.title)
    .all();
}
