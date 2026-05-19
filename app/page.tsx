"use client";

import { useState } from "react";
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
import { toast } from "sonner";
import { createSession, getSessionByCode } from "@/lib/actions/sessions";

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoin(e: React.FormEvent) {
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

  async function handleCreate(e: React.FormEvent) {
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
      </div>
    </div>
  );
}
