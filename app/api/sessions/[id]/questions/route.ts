import { db } from "@/lib/db";
import { questions, submissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId");

  const sessionQuestions = db
    .select()
    .from(questions)
    .where(eq(questions.sessionId, sessionId))
    .orderBy(questions.sortOrder)
    .all();

  const activeQuestions = sessionQuestions
    .filter((q) => q.status === "active" || q.status === "closed" || q.status === "revealed")
    .map((q) => {
      let teamSubmissions: typeof submissions.$inferSelect[] = [];
      if (teamId) {
        teamSubmissions = db
          .select()
          .from(submissions)
          .where(
            and(
              eq(submissions.questionId, q.id),
              eq(submissions.teamId, teamId)
            )
          )
          .orderBy(submissions.attemptNumber)
          .all();
      }

      const hasCorrect = teamSubmissions.some((s) => s.isCorrect);

      const isSimulation = q.answerType === "simulation";
      let simulationResultCount: number | undefined;
      let simulationMin: number | undefined;
      let simulationMax: number | undefined;

      if (isSimulation && q.simulationResults) {
        const results: number[] = JSON.parse(q.simulationResults);
        simulationResultCount = results.length;
        simulationMin = Math.min(...results);
        simulationMax = Math.max(...results);
      }

      return {
        id: q.id,
        title: q.title,
        description: q.description,
        answerType: q.answerType,
        rangeTolerance: q.rangeTolerance,
        maxPoints: q.maxPoints,
        maxAttempts: q.maxAttempts,
        pointsDropOff: JSON.parse(q.pointsDropOff),
        status: q.status,
        answer: q.status === "revealed" ? q.answer : undefined,
        attemptsUsed: teamSubmissions.length,
        hasCorrect,
        submissions: teamSubmissions,
        simulationResultCount,
        simulationMin,
        simulationMax,
      };
    });

  return Response.json({ questions: activeQuestions });
}
