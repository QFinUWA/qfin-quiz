"use client";

import { useState, useEffect } from "react";
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
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  createSession,
  getSessionByCode,
  getActiveSessions,
  deleteExpiredSessions,
} from "@/lib/actions/sessions";

type ActiveSession = {
  id: string;
  name: string;
  joinCode: string;
  status: string;
  createdAt: Date;
};

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);

  useEffect(() => {
    deleteExpiredSessions();
    getActiveSessions().then(setActiveSessions);
  }, []);

  async function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setLoading(true);
    try {
      const session = await getSessionByCode(joinCode.trim());
      if (!session) {
        toast.error("Session not found");
        return;
      }
      router.push(`/join/${session.joinCode}`);
    } catch {
      toast.error("Failed to find session");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sessionName.trim() || !adminPassword.trim()) return;
    setLoading(true);
    try {
      const result = await createSession(
        sessionName.trim(),
        adminPassword.trim()
      );
      localStorage.setItem(`admin-${result.id}`, adminPassword);
      router.push(`/admin/${result.id}`);
    } catch {
      toast.error("Failed to create session");
    } finally {
      setLoading(false);
    }
  }

  function formatTimeAgo(date: Date) {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  const statusColor: Record<string, string> = {
    lobby: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    active: "bg-green-500/20 text-green-400 border-green-500/30",
    finished: "bg-muted text-muted-foreground",
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">QFin Quiz</h1>
          <p className="mt-2 text-muted-foreground">
            Estimation games and quizzes
          </p>
        </div>

        <Tabs defaultValue="join" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="join">Join Session</TabsTrigger>
            <TabsTrigger value="create">Create Session</TabsTrigger>
          </TabsList>

          <TabsContent value="join">
            <Card>
              <CardHeader>
                <CardTitle>Join a Session</CardTitle>
                <CardDescription>
                  Enter the session code to join
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleJoin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="joinCode">Session Code</Label>
                    <Input
                      id="joinCode"
                      placeholder="e.g. ABC123"
                      value={joinCode}
                      onChange={(e) =>
                        setJoinCode(e.target.value.toUpperCase())
                      }
                      maxLength={6}
                      className="text-center text-2xl tracking-widest font-mono"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || !joinCode.trim()}
                  >
                    Join
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Create a Session</CardTitle>
                <CardDescription>
                  Set up a new quiz session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sessionName">Session Name</Label>
                    <Input
                      id="sessionName"
                      placeholder="e.g. Week 5 Estimation Game"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">Admin Password</Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      placeholder="Password to manage this session"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      loading ||
                      !sessionName.trim() ||
                      !adminPassword.trim()
                    }
                  >
                    Create Session
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {activeSessions.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Active Sessions
            </h2>
            <div className="space-y-2">
              {activeSessions.map((session) => (
                <Card
                  key={session.id}
                  className="cursor-pointer transition-colors hover:bg-accent/50"
                  onClick={() => router.push(`/join/${session.joinCode}`)}
                >
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="space-y-1">
                      <p className="font-medium leading-none">
                        {session.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimeAgo(session.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/admin/${session.id}`);
                        }}
                      >
                        Admin
                      </Button>
                      <Badge
                        variant="outline"
                        className={statusColor[session.status] ?? ""}
                      >
                        {session.status}
                      </Badge>
                      <span className="font-mono text-sm text-muted-foreground">
                        {session.joinCode}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
