import { db } from "@/lib/db";
import { questions, submissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { checkScheduledTransitions } from "@/lib/actions/sessions";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId");

  const session = await checkScheduledTransitions(sessionId);
  if (!session) {
    return Response.json({ questions: [], sessionStatus: "lobby" });
  }
  if (session.status === "lobby") {
    return Response.json({
      questions: [],
      sessionStatus: "lobby",
      scheduledStartAt: session.scheduledStartAt?.getTime() ?? null,
      scheduledEndAt: session.scheduledEndAt?.getTime() ?? null,
      teamTotalPoints: 0,
    });
  }

  const sessionQuestions = db
    .select()
    .from(questions)
    .where(eq(questions.sessionId, sessionId))
    .orderBy(questions.title)
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

      const isSimulation = q.answerSource === "simulation";
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
        answerSource: q.answerSource,
        rangeTolerance: q.rangeTolerance,
        maxPoints: q.maxPoints,
        maxAttempts: q.maxAttempts,
        pointsDropOff: JSON.parse(q.pointsDropOff),
        status: q.status,
        answer: q.status === "revealed" ? q.answer : undefined,
        answerText: q.status === "revealed" ? q.answerText : undefined,
        attemptsUsed: teamSubmissions.length,
        hasCorrect,
        submissions: teamSubmissions,
        simulationResultCount,
        simulationMin,
        simulationMax,
      };
    });

  let teamTotalPoints = 0;
  if (teamId) {
    const questionIds = sessionQuestions.map((q) => q.id);
    const teamSubs = db
      .select()
      .from(submissions)
      .where(eq(submissions.teamId, teamId))
      .all()
      .filter((s) => questionIds.includes(s.questionId));
    teamTotalPoints = teamSubs.reduce((sum, s) => sum + s.pointsAwarded, 0);
  }

  return Response.json({
    questions: activeQuestions,
    sessionStatus: session.status,
    scheduledStartAt: session.scheduledStartAt?.getTime() ?? null,
    scheduledEndAt: session.scheduledEndAt?.getTime() ?? null,
    teamTotalPoints,
  });
}
