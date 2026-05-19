"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LeaderboardEntry = {
  teamId: string;
  teamName: string;
  totalPoints: number;
  questionsAnswered: number;
};

export default function LeaderboardPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/leaderboard`);
      const data = await res.json();
      setLeaderboard(data.leaderboard);
      setTotalQuestions(data.totalQuestions);
    } catch {
      // silent retry
    }
  }, [sessionId]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 3000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  return (
    <div className="flex flex-col min-h-full">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">
            {totalQuestions} question{totalQuestions !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
        >
          Back
        </Button>
      </header>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <Card>
          <CardHeader>
            <CardTitle>Team Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No teams yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((entry, i) => (
                    <TableRow key={entry.teamId}>
                      <TableCell className="font-bold text-lg">
                        {i === 0
                          ? "1st"
                          : i === 1
                            ? "2nd"
                            : i === 2
                              ? "3rd"
                              : `${i + 1}th`}
                      </TableCell>
                      <TableCell className="font-medium">
                        {entry.teamName}
                      </TableCell>
                      <TableCell className="text-right font-mono text-lg">
                        {entry.totalPoints}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
