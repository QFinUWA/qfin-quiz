import { db } from "@/lib/db";
import { teams, questions, submissions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  const sessionTeams = db
    .select()
    .from(teams)
    .where(eq(teams.sessionId, sessionId))
    .all();

  const sessionQuestions = db
    .select()
    .from(questions)
    .where(eq(questions.sessionId, sessionId))
    .all();

  const questionIds = new Set(sessionQuestions.map((q) => q.id));

  const leaderboard = sessionTeams
    .map((team) => {
      const teamSubmissions = db
        .select()
        .from(submissions)
        .where(eq(submissions.teamId, team.id))
        .all()
        .filter((s) => questionIds.has(s.questionId));

      const totalPoints = teamSubmissions.reduce(
        (sum, s) => sum + s.pointsAwarded,
        0
      );

      const questionsAnswered = new Set(
        teamSubmissions.filter((s) => s.isCorrect).map((s) => s.questionId)
      ).size;

      return {
        teamId: team.id,
        teamName: team.name,
        totalPoints,
        questionsAnswered,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  return Response.json({
    leaderboard,
    totalQuestions: sessionQuestions.length,
  });
}
