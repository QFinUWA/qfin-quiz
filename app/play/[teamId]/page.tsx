"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { submitAnswer } from "@/lib/actions/submissions";

type Question = {
  id: string;
  title: string;
  description: string | null;
  answerType: "exact" | "range_absolute" | "range_percent";
  answerSource: "point" | "simulation";
  rangeTolerance: number | null;
  maxPoints: number;
  maxAttempts: number;
  pointsDropOff: number[];
  status: string;
  answer?: number;
  attemptsUsed: number;
  hasCorrect: boolean;
  submissions: {
    attemptNumber: number;
    submissionType: string;
    answerValue: number | null;
    rangeMin: number | null;
    rangeMax: number | null;
    isCorrect: boolean;
    pointsAwarded: number;
  }[];
  simulationResultCount?: number;
  simulationMin?: number;
  simulationMax?: number;
};

export default function PlayPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [teamTotalPoints, setTeamTotalPoints] = useState(0);
  const [scheduledEndAt, setScheduledEndAt] = useState<number | null>(null);
  const [scheduledStartAt, setScheduledStartAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<{ teamId: string; teamName: string; totalPoints: number }[]>([]);

  useEffect(() => {
    const storedSession = localStorage.getItem("sessionId");
    const storedName = localStorage.getItem("username");
    setUsername(storedName);
    if (!storedSession) {
      router.push("/");
      return;
    }
    setSessionId(storedSession);
  }, [router]);

  const fetchQuestions = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/questions?teamId=${teamId}`
      );
      const data = await res.json();
      setQuestions(data.questions);
      setSessionStatus(data.sessionStatus);
      setTeamTotalPoints(data.teamTotalPoints ?? 0);
      setScheduledEndAt(data.scheduledEndAt ?? null);
      setScheduledStartAt(data.scheduledStartAt ?? null);

      const lbRes = await fetch(`/api/sessions/${sessionId}/leaderboard`);
      const lbData = await lbRes.json();
      setLeaderboard(lbData.leaderboard ?? []);
    } catch {
      // silent retry
    }
  }, [sessionId, teamId]);

  useEffect(() => {
    if (!sessionId) return;
    fetchQuestions();
    const interval = setInterval(fetchQuestions, 3000);
    return () => clearInterval(interval);
  }, [sessionId, fetchQuestions]);

  useEffect(() => {
    const target = sessionStatus === "lobby" ? scheduledStartAt : scheduledEndAt;
    if (!target) {
      setCountdown(null);
      return;
    }
    function tick() {
      const diff = target! - Date.now();
      if (diff <= 0) {
        setCountdown(null);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`);
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [scheduledEndAt, scheduledStartAt, sessionStatus]);

  async function handleSubmit(
    questionId: string,
    type: "number" | "range",
    values: { answer?: number; min?: number; max?: number }
  ) {
    setSubmitting(questionId);
    try {
      const result = await submitAnswer({
        questionId,
        teamId,
        submissionType: type,
        answerValue: values.answer,
        rangeMin: values.min,
        rangeMax: values.max,
      });

      if ("error" in result) {
        toast.error(result.error as string);
        return;
      }

      const q = questions.find((q) => q.id === questionId);
      if (q?.answerSource === "simulation") {
        toast.success(`+${result.pointsAwarded} points`);
      } else if (result.isCorrect) {
        toast.success(`Correct! +${result.pointsAwarded} points`);
      } else {
        toast.error(
          `Incorrect. ${result.attemptsRemaining} attempt${result.attemptsRemaining !== 1 ? "s" : ""} remaining`
        );
      }
      fetchQuestions();
    } catch {
      toast.error("Failed to submit");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg">QFin Quiz</h1>
          <p className="text-sm text-muted-foreground">
            Playing as {username || "Anonymous"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {countdown && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                {sessionStatus === "lobby" ? "Starts in" : "Time left"}
              </p>
              <p className="font-mono text-lg font-bold tabular-nums">{countdown}</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Points</p>
            <p className="font-mono text-lg font-bold">{teamTotalPoints}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (sessionId) router.push(`/leaderboard/${sessionId}`);
            }}
          >
            Leaderboard
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-4">
        {sessionStatus === "finished" && questions.length > 0 && (
          <div className="bg-muted rounded-lg px-4 py-3 text-center">
            <p className="font-medium">Session ended</p>
            <p className="text-sm text-muted-foreground">Final score: {teamTotalPoints} points</p>
          </div>
        )}
        {leaderboard.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">Leaderboard</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="space-y-1">
                {leaderboard.map((entry, i) => (
                  <div
                    key={entry.teamId}
                    className={`flex items-center justify-between text-sm py-1 px-2 rounded ${
                      entry.teamId === teamId ? "bg-muted font-medium" : ""
                    }`}
                  >
                    <span>
                      <span className="text-muted-foreground w-5 inline-block">{i + 1}.</span>{" "}
                      {entry.teamName}
                      {entry.teamId === teamId && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
                    </span>
                    <span className="font-mono tabular-nums">{entry.totalPoints}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {questions.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <div className="text-center space-y-2">
              <p className="text-xl font-medium">
                {sessionStatus === "lobby"
                  ? "Waiting for session to start..."
                  : "Waiting for questions..."}
              </p>
              <p className="text-muted-foreground">
                {sessionStatus === "lobby"
                  ? countdown
                    ? `Starting in ${countdown}`
                    : "The session hasn't started yet. Hang tight!"
                  : "The admin will activate questions soon"}
              </p>
            </div>
          </div>
        ) : (
          questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              onSubmit={handleSubmit}
              submitting={submitting === q.id}
              sessionActive={sessionStatus === "active"}
            />
          ))
        )}
      </main>
    </div>
  );
}

function QuestionCard({
  question,
  onSubmit,
  submitting,
  sessionActive,
}: {
  question: Question;
  onSubmit: (
    id: string,
    type: "number" | "range",
    values: { answer?: number; min?: number; max?: number }
  ) => void;
  submitting: boolean;
  sessionActive: boolean;
}) {
  const isExact = question.answerType === "exact";
  const isSimulation = question.answerSource === "simulation";
  const showRange = !isExact;
  const [collapsed, setCollapsed] = useState(false);
  const [answer, setAnswer] = useState("");
  const [rangeMin, setRangeMin] = useState("");
  const [rangeMax, setRangeMax] = useState("");

  const tol = question.rangeTolerance;
  const minNum = parseFloat(rangeMin);
  const maxNum = parseFloat(rangeMax);
  const maxHint = showRange && !isNaN(minNum) && tol !== null
    ? question.answerType === "range_percent"
      ? +(minNum * (1 + tol / 100)).toFixed(2)
      : +(minNum + tol).toFixed(2)
    : null;
  const minHint = showRange && !isNaN(maxNum) && tol !== null
    ? question.answerType === "range_percent"
      ? +(maxNum / (1 + tol / 100)).toFixed(2)
      : +(maxNum - tol).toFixed(2)
    : null;

  let rangeError: string | null = null;
  if (showRange && rangeMin && rangeMax && !isNaN(minNum) && !isNaN(maxNum)) {
    if (minNum > maxNum) {
      rangeError = "Min must be less than max";
    } else if (tol !== null) {
      if (question.answerType === "range_absolute" && maxNum - minNum > tol) {
        rangeError = `Range too wide (max width: ${tol})`;
      } else if (question.answerType === "range_percent" && maxNum > minNum * (1 + tol / 100)) {
        rangeError = `Range too wide (upper at most ${tol}% above lower)`;
      }
    }
  }

  const attemptsLeft = question.maxAttempts - question.attemptsUsed;
  const canSubmit =
    sessionActive &&
    (isSimulation || !question.hasCorrect) &&
    attemptsLeft > 0 &&
    question.status === "active";
  const nextPoints =
    question.pointsDropOff[question.attemptsUsed] ??
    question.pointsDropOff[question.pointsDropOff.length - 1] ??
    0;

  const totalSimPoints = isSimulation
    ? question.submissions.reduce((sum, s) => sum + s.pointsAwarded, 0)
    : 0;

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isExact) {
      const val = parseFloat(answer);
      if (isNaN(val)) {
        toast.error("Enter a valid number");
        return;
      }
      onSubmit(question.id, "number", { answer: val });
    } else {
      if (isNaN(minNum) || isNaN(maxNum)) {
        toast.error("Enter valid range values");
        return;
      }
      if (rangeError) return;
      onSubmit(question.id, "range", { min: minNum, max: maxNum });
    }
    setAnswer("");
    setRangeMin("");
    setRangeMax("");
  }

  const answerTypeLabel = isSimulation
    ? question.answerType === "exact"
      ? "Simulation - submit an exact number"
      : question.answerType === "range_percent"
        ? `Simulation - submit a range (upper at most ${question.rangeTolerance}% above lower)`
        : `Simulation - submit a range (${question.rangeTolerance} units wide)`
    : question.answerType === "exact"
      ? "Exact answer"
      : question.answerType === "range_percent"
        ? `Range answer - upper bound at most ${question.rangeTolerance}% above lower bound`
        : `Range answer - ${question.rangeTolerance} units wide`;

  return (
    <Card
      className={
        !isSimulation && question.hasCorrect
          ? "border-green-500/50"
          : !isSimulation && attemptsLeft === 0
            ? "border-red-500/50 opacity-75"
            : isSimulation && question.attemptsUsed > 0
              ? "border-blue-500/50"
              : ""
      }
    >
      <CardHeader className="cursor-pointer select-none" onClick={() => setCollapsed((c) => !c)}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{collapsed ? "+" : "-"}</span>
              {question.title}
            </CardTitle>
            {!collapsed && question.description && (
              <CardDescription className="mt-1">
                {question.description}
              </CardDescription>
            )}
            {!collapsed && (
              <p className="text-xs text-muted-foreground mt-1">
                {answerTypeLabel}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {isSimulation ? (
              question.attemptsUsed > 0 ? (
                <Badge className="bg-blue-600">
                  {totalSimPoints} pts
                </Badge>
              ) : (
                <Badge variant="outline">up to {nextPoints} pts</Badge>
              )
            ) : question.hasCorrect ? (
              <Badge className="bg-green-600">
                +
                {question.submissions.find((s) => s.isCorrect)
                  ?.pointsAwarded ?? 0}{" "}
                pts
              </Badge>
            ) : question.status === "revealed" ? (
              <Badge variant="secondary">
                Answer: {question.answer}
              </Badge>
            ) : (
              <Badge variant="outline">{nextPoints} pts</Badge>
            )}
            {canSubmit && (
              <>
                <span className="text-xs text-muted-foreground">
                  {attemptsLeft}/{question.maxAttempts} attempts left
                </span>
                <span className="text-xs text-muted-foreground/70">
                  {question.pointsDropOff.map((p, i) => (
                    <span key={i} className={i === question.attemptsUsed ? "text-foreground font-medium" : ""}>
                      {i > 0 && " / "}{p}
                    </span>
                  ))} pts
                </span>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {!collapsed && canSubmit && (
        <CardContent>
          <form onSubmit={handleFormSubmit} className="space-y-3">
            {showRange ? <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <Label>Min</Label>
                    {minHint !== null && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setRangeMin(String(minHint)); }} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                        min {minHint} &larr;
                      </button>
                    )}
                  </div>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Lower bound"
                    value={rangeMin}
                    onChange={(e) => setRangeMin(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <Label>Max</Label>
                    {maxHint !== null && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setRangeMax(String(maxHint)); }} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                        max {maxHint} &larr;
                      </button>
                    )}
                  </div>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Upper bound"
                    value={rangeMax}
                    onChange={(e) => setRangeMax(e.target.value)}
                  />
                </div>
              </div>
              {rangeError && (
                <p className="text-sm text-red-500">{rangeError}</p>
              )}
            </> : (
              <div className="space-y-2">
                <Label>Your Answer</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="Enter a number"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting || !!rangeError}>
              {submitting ? "Submitting..." : "Submit Answer"}
            </Button>
          </form>
        </CardContent>
      )}

      {!collapsed && question.submissions.length > 0 && (
        <CardFooter className="flex-col items-start gap-1">
          <p className="text-sm font-medium">Previous attempts:</p>
          {question.submissions.map((s, i) => (
            <div
              key={i}
              className={`text-sm ${
                isSimulation
                  ? s.pointsAwarded > 0
                    ? "text-blue-500"
                    : "text-muted-foreground"
                  : s.isCorrect
                    ? "text-green-500"
                    : "text-red-400"
              }`}
            >
              #{s.attemptNumber}:{" "}
              {s.submissionType === "number"
                ? s.answerValue
                : `[${s.rangeMin}, ${s.rangeMax}]`}{" "}
              -{" "}
              {isSimulation
                ? `+${s.pointsAwarded} pts`
                : s.isCorrect
                  ? `+${s.pointsAwarded}`
                  : "incorrect"}
            </div>
          ))}
        </CardFooter>
      )}
    </Card>
  );
}
