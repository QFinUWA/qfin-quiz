"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  verifyAdmin,
  getSessionData,
  updateSessionStatus,
} from "@/lib/actions/sessions";
import {
  addQuestion,
  updateQuestionStatus,
  deleteQuestion,
  realizeSimulation,
} from "@/lib/actions/questions";

type SessionData = NonNullable<Awaited<ReturnType<typeof getSessionData>>>;

export default function AdminPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [data, setData] = useState<SessionData | null>(null);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [realizing, setRealizing] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<{
    type: "close" | "reveal" | "reveal-all";
    questionId?: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(`admin-${sessionId}`);
    if (stored) {
      verifyAdmin(sessionId, stored).then((result) => {
        if (result) {
          setAuthenticated(true);
          setPassword(stored);
        }
      });
    }
  }, [sessionId]);

  const fetchData = useCallback(async () => {
    if (!authenticated) return;
    const d = await getSessionData(sessionId);
    if (d) setData(d);
  }, [sessionId, authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [authenticated, fetchData]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const result = await verifyAdmin(sessionId, password);
    if (result) {
      setAuthenticated(true);
      localStorage.setItem(`admin-${sessionId}`, password);
    } else {
      toast.error("Wrong password");
    }
  }

  async function handleRealize(questionId: string) {
    setRealizing(questionId);
    try {
      const result = await realizeSimulation(questionId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(
          `Realized! ${result.resultCount} results (range: ${result.min} - ${result.max})`
        );
        fetchData();
      }
    } catch {
      toast.error("Failed to realize simulation");
    } finally {
      setRealizing(null);
    }
  }

  if (!authenticated) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
            <CardDescription>Enter the session admin password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" className="w-full">
                Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const teamScores = data.teams.map((team) => {
    const teamSubs = data.submissions.filter((s) => s.teamId === team.id);
    const total = teamSubs.reduce((sum, s) => sum + s.pointsAwarded, 0);
    return { ...team, totalPoints: total, submissions: teamSubs };
  });

  return (
    <div className="flex flex-col min-h-full">
      <header className="border-b px-6 py-5">
        <div className="flex items-start justify-between max-w-4xl mx-auto w-full">
          <div>
            <h1 className="font-bold text-2xl">{data.session.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-lg">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Join Code</span>
                <span className="font-mono text-xl font-bold tracking-widest">
                  {data.session.joinCode}
                </span>
              </div>
              <Badge
                className="text-sm px-3 py-1"
                variant={
                  data.session.status === "active"
                    ? "default"
                    : data.session.status === "finished"
                      ? "secondary"
                      : "outline"
                }
              >
                {data.session.status}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/leaderboard/${sessionId}`)}
            >
              Leaderboard
            </Button>
          {data.session.status === "lobby" && (
            <Button
              size="sm"
              onClick={async () => {
                await updateSessionStatus(sessionId, "active");
                fetchData();
                toast.success("Session started");
              }}
            >
              Start Session
            </Button>
          )}
          {data.session.status === "active" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                await updateSessionStatus(sessionId, "finished");
                fetchData();
                toast.success("Session ended");
              }}
            >
              End Session
            </Button>
          )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-4xl mx-auto w-full space-y-6">
        {/* Teams */}
        <Card>
          <CardHeader>
            <CardTitle>Teams ({data.teams.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.teams.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No teams have joined yet. Share the join code:{" "}
                <span className="font-mono font-bold">
                  {data.session.joinCode}
                </span>
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamScores
                    .sort((a, b) => b.totalPoints - a.totalPoints)
                    .map((team) => (
                      <TableRow key={team.id}>
                        <TableCell className="font-medium">
                          {team.name}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {team.totalPoints}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Confirm Dialog */}
        <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {confirmAction?.type === "close" ? "Close Question" : "Reveal Answer"}
              </DialogTitle>
              <DialogDescription>
                {confirmAction?.type === "reveal-all"
                  ? "This will reveal answers for ALL questions. This cannot be undone."
                  : confirmAction?.type === "reveal"
                    ? `Reveal the answer for "${confirmAction.title}"? This cannot be undone.`
                    : `Close "${confirmAction?.title}"? Players will no longer be able to submit answers.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button
                variant={confirmAction?.type === "close" ? "default" : "destructive"}
                onClick={async () => {
                  if (!confirmAction) return;
                  if (confirmAction.type === "reveal-all") {
                    for (const q of data.questions) {
                      if (q.status !== "revealed") {
                        await updateQuestionStatus(q.id, "revealed");
                      }
                    }
                  } else if (confirmAction.type === "reveal" && confirmAction.questionId) {
                    await updateQuestionStatus(confirmAction.questionId, "revealed");
                  } else if (confirmAction.type === "close" && confirmAction.questionId) {
                    await updateQuestionStatus(confirmAction.questionId, "closed");
                  }
                  setConfirmAction(null);
                  fetchData();
                }}
              >
                {confirmAction?.type === "close" ? "Close" : "Reveal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Questions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Questions ({data.questions.length})</CardTitle>
              {data.questions.some((q) => q.status !== "revealed") && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    setConfirmAction({ type: "reveal-all", title: "" })
                  }
                >
                  Reveal All
                </Button>
              )}
            </div>
            <Dialog open={addingQuestion} onOpenChange={setAddingQuestion}>
              <DialogTrigger
                render={<Button size="sm" />}
              >
                Add Question
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Question</DialogTitle>
                </DialogHeader>
                <AddQuestionForm
                  sessionId={sessionId}
                  onDone={() => {
                    setAddingQuestion(false);
                    fetchData();
                  }}
                />
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.questions.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No questions yet. Add one to get started.
              </p>
            ) : (
              data.questions.map((q) => {
                const qSubs = data.submissions.filter(
                  (s) => s.questionId === q.id
                );
                const teamsAttempted = new Set(qSubs.map((s) => s.teamId)).size;
                const teamsCorrect = new Set(
                  qSubs.filter((s) => s.isCorrect).map((s) => s.teamId)
                ).size;
                const isSim = q.answerSource === "simulation";
                const simResults: number[] | null =
                  isSim && q.simulationResults
                    ? JSON.parse(q.simulationResults)
                    : null;
                const answerVisible = showAnswer.has(q.id);

                const responseLabel =
                  q.answerType === "exact"
                    ? "Exact"
                    : q.answerType === "range_percent"
                      ? `Range (${q.rangeTolerance}% wide)`
                      : `Range (${q.rangeTolerance} wide)`;

                return (
                  <div key={q.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{q.title}</h3>
                        {q.description && (
                          <p className="text-sm text-muted-foreground">
                            {q.description}
                          </p>
                        )}
                        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                          <p>
                            {isSim ? "Simulation" : "Point"} | {responseLabel}{" "}
                            {!isSim && (
                              answerVisible
                                ? <>| Answer: <span className="font-mono">{q.answer}</span>{" "}
                                    <button
                                      type="button"
                                      className="text-xs underline text-muted-foreground hover:text-foreground"
                                      onClick={() => setShowAnswer((prev) => { const next = new Set(prev); next.delete(q.id); return next; })}
                                    >hide</button>
                                  </>
                                : <>| <button
                                      type="button"
                                      className="text-xs underline text-muted-foreground hover:text-foreground"
                                      onClick={() => setShowAnswer((prev) => new Set(prev).add(q.id))}
                                    >Show answer</button>
                                  </>
                            )}{" "}
                            | Max: {q.maxPoints}pts | Attempts: {q.maxAttempts}{" "}
                            | Drop-off: {q.pointsDropOff}
                          </p>
                          {isSim && (
                            <p>
                              n={q.simulationN}
                              {simResults && <> | {simResults.length} results [{Math.min(...simResults)}, {Math.max(...simResults)}]</>}
                            </p>
                          )}
                          <p>
                            {teamsAttempted} teams attempted
                            {!isSim && <>, {teamsCorrect} correct</>}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          q.status === "active"
                            ? "default"
                            : q.status === "revealed"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {q.status}
                      </Badge>
                    </div>
                    <Separator />
                    <div className="flex gap-2 flex-wrap">
                      {q.status === "hidden" && isSim && (
                        <Button
                          size="sm"
                          onClick={() => handleRealize(q.id)}
                          disabled={realizing === q.id}
                        >
                          {realizing === q.id
                            ? "Running simulation..."
                            : "Realize & Activate"}
                        </Button>
                      )}
                      {q.status === "hidden" && !isSim && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            await updateQuestionStatus(q.id, "active");
                            fetchData();
                          }}
                        >
                          Activate
                        </Button>
                      )}
                      {q.status === "active" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setConfirmAction({ type: "close", questionId: q.id, title: q.title })
                            }
                          >
                            Close
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              setConfirmAction({ type: "reveal", questionId: q.id, title: q.title })
                            }
                          >
                            Reveal Answer
                          </Button>
                        </>
                      )}
                      {q.status === "closed" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setConfirmAction({ type: "reveal", questionId: q.id, title: q.title })
                          }
                        >
                          Reveal Answer
                        </Button>
                      )}
                      {q.status === "hidden" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            await deleteQuestion(q.id);
                            fetchData();
                          }}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function AddQuestionForm({
  sessionId,
  onDone,
}: {
  sessionId: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerSource, setAnswerSource] = useState<"point" | "simulation">("point");
  const [answerType, setAnswerType] = useState<
    "exact" | "range_absolute" | "range_percent"
  >("exact");
  const [rangeWidth, setRangeWidth] = useState("");
  const [maxPoints, setMaxPoints] = useState("100");
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [dropOff, setDropOff] = useState("100, 50, 25");
  const [loading, setLoading] = useState(false);

  const [simulationScript, setSimulationScript] = useState("");
  const [simulationN, setSimulationN] = useState("10000");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSimulation = answerSource === "simulation";
  const isRange = answerType !== "exact";

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSimulationScript(ev.target?.result as string);
      toast.success(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isSimulation) {
      const answerNum = parseFloat(answer);
      if (isNaN(answerNum)) {
        toast.error("Answer must be a number");
        return;
      }
    }

    if (isSimulation) {
      if (!simulationScript.trim()) {
        toast.error("Upload or paste a simulation script");
        return;
      }
      const n = parseInt(simulationN);
      if (isNaN(n) || n < 1) {
        toast.error("Enter a valid number of simulations");
        return;
      }
    }

    if (isRange && !rangeWidth) {
      toast.error("Enter a range width");
      return;
    }

    const points = dropOff
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n));

    if (points.length === 0) {
      toast.error("Enter at least one point value for drop-off");
      return;
    }

    setLoading(true);
    try {
      await addQuestion(sessionId, {
        title,
        description: description || undefined,
        answer: isSimulation ? 0 : parseFloat(answer),
        answerType,
        answerSource,
        rangeTolerance: isRange ? parseFloat(rangeWidth) : undefined,
        maxPoints: parseInt(maxPoints) || 100,
        maxAttempts: parseInt(maxAttempts) || 3,
        pointsDropOff: points,
        simulationScript: isSimulation ? simulationScript : undefined,
        simulationN: isSimulation ? parseInt(simulationN) : undefined,
      });
      toast.success(
        isSimulation
          ? "Simulation question added (click Realize & Activate to run it)"
          : "Question added"
      );
      onDone();
    } catch {
      toast.error("Failed to add question");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Question Title</Label>
        <Input
          placeholder="e.g. How many golf balls fit in a school bus?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Description (optional)</Label>
        <Textarea
          placeholder="Additional context..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Answer Source */}
      <div className="space-y-2">
        <Label>Answer Source</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={answerSource === "point" ? "default" : "outline"}
            onClick={() => setAnswerSource("point")}
          >
            Point
          </Button>
          <Button
            type="button"
            size="sm"
            variant={answerSource === "simulation" ? "default" : "outline"}
            onClick={() => {
              setAnswerSource("simulation");
              if (answerType === "exact") setAnswerType("range_absolute");
            }}
          >
            Simulation
          </Button>
        </div>
      </div>

      {/* Simulation config */}
      {isSimulation && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Python Script</Label>
              <a
                href="/simulation_template.py"
                download
                className="text-xs text-blue-500 hover:underline"
              >
                Download template
              </a>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload .py file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".py"
                className="hidden"
                onChange={handleFileUpload}
              />
              {simulationScript && (
                <span className="text-xs text-muted-foreground self-center">
                  Script loaded ({simulationScript.length} chars)
                </span>
              )}
            </div>
            <Textarea
              placeholder="def simulate() -> int:&#10;    return random.randint(1, 100)"
              value={simulationScript}
              onChange={(e) => setSimulationScript(e.target.value)}
              className="font-mono text-sm min-h-[120px] max-h-[40vh]"
            />
          </div>

          <div className="space-y-2">
            <Label>Number of simulations (n)</Label>
            <Input
              type="number"
              value={simulationN}
              onChange={(e) => setSimulationN(e.target.value)}
            />
          </div>
        </>
      )}

      {/* Point answer */}
      {!isSimulation && (
        <div className="space-y-2">
          <Label>Correct Answer</Label>
          <Input
            type="number"
            step="any"
            placeholder="e.g. 500000"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            required
          />
        </div>
      )}

      {/* Response Type */}
      <div className="space-y-2">
        <Label>Response Type</Label>
        <div className="flex gap-2 flex-wrap">
          {!isSimulation && (
            <Button
              type="button"
              size="sm"
              variant={answerType === "exact" ? "default" : "outline"}
              onClick={() => setAnswerType("exact")}
            >
              Exact Number
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={answerType === "range_absolute" ? "default" : "outline"}
            onClick={() => setAnswerType("range_absolute")}
          >
            Range (Absolute)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={answerType === "range_percent" ? "default" : "outline"}
            onClick={() => setAnswerType("range_percent")}
          >
            Range (%)
          </Button>
        </div>
      </div>

      {/* Range Width */}
      {isRange && (
        <div className="space-y-2">
          <Label>
            {answerType === "range_percent"
              ? "Range Width (%)"
              : "Range Width"}
          </Label>
          <Input
            type="number"
            step="any"
            placeholder={
              answerType === "range_percent"
                ? "e.g. 20 means upper is 20% above lower"
                : "e.g. 50 means range is 50 units wide"
            }
            value={rangeWidth}
            onChange={(e) => setRangeWidth(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {answerType === "range_percent"
              ? "Players submit a range where the upper bound is at most this % above the lower bound."
              : "Players submit a range that is at most this many units wide."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Max Points</Label>
          <Input
            type="number"
            value={maxPoints}
            onChange={(e) => setMaxPoints(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Max Attempts</Label>
          <Input
            type="number"
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Points Drop-off</Label>
          <Input
            placeholder="100, 50, 25"
            value={dropOff}
            onChange={(e) => setDropOff(e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {isSimulation
          ? "Score = proportion of simulation hits * drop-off value for that attempt."
          : "Points drop-off: 1st attempt gets the first value, 2nd attempt gets the second, etc."}
      </p>
      <Button
        type="submit"
        className="w-full"
        disabled={
          loading ||
          !title ||
          (isSimulation ? !simulationScript : !answer) ||
          (isRange && !rangeWidth)
        }
      >
        {loading ? "Adding..." : "Add Question"}
      </Button>
    </form>
  );
}
