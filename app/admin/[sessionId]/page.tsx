"use client";

import { useState, useEffect, useCallback, use } from "react";
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
  DialogContent,
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

        {/* Questions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Questions ({data.questions.length})</CardTitle>
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
                        <p className="text-sm text-muted-foreground mt-1">
                          Answer: <span className="font-mono">{q.answer}</span>{" "}
                          | Type: {q.answerType === "exact" ? "Exact" : q.answerType === "range_percent" ? `Range (+/-${q.rangeTolerance}%)` : `Range (+/-${q.rangeTolerance})`}{" "}
                          | Max: {q.maxPoints}pts | Attempts: {q.maxAttempts} |
                          Drop-off: {q.pointsDropOff}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {teamsAttempted} teams attempted, {teamsCorrect}{" "}
                          correct
                        </p>
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
                      {q.status === "hidden" && (
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
                            onClick={async () => {
                              await updateQuestionStatus(q.id, "closed");
                              fetchData();
                            }}
                          >
                            Close
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              await updateQuestionStatus(q.id, "revealed");
                              fetchData();
                            }}
                          >
                            Reveal Answer
                          </Button>
                        </>
                      )}
                      {q.status === "closed" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            await updateQuestionStatus(q.id, "revealed");
                            fetchData();
                          }}
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
  const [answerType, setAnswerType] = useState<
    "exact" | "range_absolute" | "range_percent"
  >("exact");
  const [rangeTolerance, setRangeTolerance] = useState("");
  const [maxPoints, setMaxPoints] = useState("100");
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [dropOff, setDropOff] = useState("100, 50, 25");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const answerNum = parseFloat(answer);
    if (isNaN(answerNum)) {
      toast.error("Answer must be a number");
      return;
    }

    if (answerType !== "exact" && !rangeTolerance) {
      toast.error("Enter a tolerance value for range answers");
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
        answer: answerNum,
        answerType,
        rangeTolerance: rangeTolerance ? parseFloat(rangeTolerance) : undefined,
        maxPoints: parseInt(maxPoints) || 100,
        maxAttempts: parseInt(maxAttempts) || 3,
        pointsDropOff: points,
      });
      toast.success("Question added");
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
      <div className="grid grid-cols-2 gap-4">
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
        <div className="space-y-2">
          <Label>Max Points</Label>
          <Input
            type="number"
            value={maxPoints}
            onChange={(e) => setMaxPoints(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Answer Type</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={answerType === "exact" ? "default" : "outline"}
            onClick={() => setAnswerType("exact")}
          >
            Exact Number
          </Button>
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

      {answerType !== "exact" && (
        <div className="space-y-2">
          <Label>
            {answerType === "range_percent"
              ? "Tolerance (%)"
              : "Tolerance (absolute +/-)"}
          </Label>
          <Input
            type="number"
            step="any"
            placeholder={
              answerType === "range_percent" ? "e.g. 10 for +/-10%" : "e.g. 50"
            }
            value={rangeTolerance}
            onChange={(e) => setRangeTolerance(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {answerType === "range_percent"
              ? `Teams must submit a range that contains the answer.`
              : `Teams must submit a range that contains the answer.`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
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
        Points drop-off is a comma-separated list. 1st attempt gets the first
        value, 2nd attempt gets the second, etc.
      </p>
      <Button type="submit" className="w-full" disabled={loading || !title || !answer}>
        {loading ? "Adding..." : "Add Question"}
      </Button>
    </form>
  );
}
