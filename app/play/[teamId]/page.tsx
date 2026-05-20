"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
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
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

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
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (sessionId) router.push(`/leaderboard/${sessionId}`);
          }}
        >
          Leaderboard
        </Button>
      </header>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-4">
        {questions.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <div className="text-center space-y-2">
              <p className="text-xl font-medium">Waiting for questions...</p>
              <p className="text-muted-foreground">
                The admin will activate questions soon
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
}: {
  question: Question;
  onSubmit: (
    id: string,
    type: "number" | "range",
    values: { answer?: number; min?: number; max?: number }
  ) => void;
  submitting: boolean;
}) {
  const isExact = question.answerType === "exact";
  const isSimulation = question.answerSource === "simulation";
  const showRange = !isExact;
  const [answer, setAnswer] = useState("");
  const [rangeMin, setRangeMin] = useState("");
  const [rangeMax, setRangeMax] = useState("");
  const minTouched = useRef(false);
  const maxTouched = useRef(false);
  const autoFillMax = useRef(true);
  const autoFillMin = useRef(true);

  function handleMinFocus() {
    minTouched.current = true;
    autoFillMax.current = !maxTouched.current;
  }

  function handleMaxFocus() {
    maxTouched.current = true;
    autoFillMin.current = !minTouched.current;
  }

  function handleMinChange(val: string) {
    setRangeMin(val);
    if (!autoFillMax.current) return;
    const num = parseFloat(val);
    if (isNaN(num) || question.rangeTolerance === null) return;
    if (question.answerType === "range_percent") {
      setRangeMax(String(+(num * (1 + question.rangeTolerance / 100)).toFixed(2)));
    } else {
      setRangeMax(String(+(num + question.rangeTolerance).toFixed(2)));
    }
  }

  function handleMaxChange(val: string) {
    setRangeMax(val);
    if (!autoFillMin.current) return;
    const num = parseFloat(val);
    if (isNaN(num) || question.rangeTolerance === null) return;
    if (question.answerType === "range_percent") {
      setRangeMin(String(+(num / (1 + question.rangeTolerance / 100)).toFixed(2)));
    } else {
      setRangeMin(String(+(num - question.rangeTolerance).toFixed(2)));
    }
  }

  const min = parseFloat(rangeMin);
  const max = parseFloat(rangeMax);
  let rangeError: string | null = null;
  if (showRange && rangeMin && rangeMax && !isNaN(min) && !isNaN(max)) {
    if (min > max) {
      rangeError = "Min must be less than max";
    } else if (question.rangeTolerance !== null) {
      if (
        question.answerType === "range_absolute" &&
        max - min > question.rangeTolerance
      ) {
        rangeError = `Range too wide. Max width: ${question.rangeTolerance}`;
      } else if (
        question.answerType === "range_percent" &&
        max > min * (1 + question.rangeTolerance / 100)
      ) {
        rangeError = `Range too wide. Upper bound can be at most ${question.rangeTolerance}% above lower bound`;
      }
    }
  }

  const attemptsLeft = question.maxAttempts - question.attemptsUsed;
  const canSubmit =
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
      const min = parseFloat(rangeMin);
      const max = parseFloat(rangeMax);
      if (isNaN(min) || isNaN(max)) {
        toast.error("Enter valid range values");
        return;
      }
      if (rangeError) return;
      onSubmit(question.id, "range", { min, max });
    }
    setAnswer("");
    setRangeMin("");
    setRangeMax("");
    minTouched.current = false;
    maxTouched.current = false;
    autoFillMax.current = true;
    autoFillMin.current = true;
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
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{question.title}</CardTitle>
            {question.description && (
              <CardDescription className="mt-1">
                {question.description}
              </CardDescription>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {answerTypeLabel}
            </p>
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

      {canSubmit && (
        <CardContent>
          <form onSubmit={handleFormSubmit} className="space-y-3">
            {showRange ? <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Min</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Lower bound"
                    value={rangeMin}
                    onFocus={handleMinFocus}
                    onChange={(e) => handleMinChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Upper bound"
                    value={rangeMax}
                    onFocus={handleMaxFocus}
                    onChange={(e) => handleMaxChange(e.target.value)}
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

      {question.submissions.length > 0 && (
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
