"use client";

import { useState, useEffect, use } from "react";
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
import { toast } from "sonner";
import { getSessionByCode } from "@/lib/actions/sessions";
import { createTeam, joinTeam, getTeamsForSession } from "@/lib/actions/teams";

type SessionInfo = {
  id: string;
  name: string;
  status: string;
};

type TeamInfo = {
  id: string;
  name: string;
  players: { id: string; username: string }[];
};

export default function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [username, setUsername] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"select" | "create">("select");

  useEffect(() => {
    async function load() {
      const s = await getSessionByCode(code);
      if (!s) {
        toast.error("Session not found");
        return;
      }
      setSession(s);
      const t = await getTeamsForSession(s.id);
      setTeams(t);
      setLoading(false);
    }
    load();
  }, [code]);

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !newTeamName.trim() || !username.trim()) return;
    setLoading(true);
    try {
      const teamResult = await createTeam(session.id, newTeamName.trim());
      if ("error" in teamResult) {
        toast.error(teamResult.error);
        setLoading(false);
        return;
      }
      const joinResult = await joinTeam(teamResult.id, username.trim());
      if ("error" in joinResult) {
        toast.error(joinResult.error);
        setLoading(false);
        return;
      }
      localStorage.setItem("playerId", joinResult.playerId);
      localStorage.setItem("teamId", joinResult.teamId);
      localStorage.setItem("sessionId", joinResult.sessionId);
      localStorage.setItem("username", username.trim());
      router.push(`/play/${joinResult.teamId}`);
    } catch {
      toast.error("Failed to create team");
      setLoading(false);
    }
  }

  async function handleJoinTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeam || !username.trim()) return;
    setLoading(true);
    try {
      const joinResult = await joinTeam(selectedTeam, username.trim());
      if ("error" in joinResult) {
        toast.error(joinResult.error);
        setLoading(false);
        return;
      }
      localStorage.setItem("playerId", joinResult.playerId);
      localStorage.setItem("teamId", joinResult.teamId);
      localStorage.setItem("sessionId", joinResult.sessionId);
      localStorage.setItem("username", username.trim());
      router.push(`/play/${joinResult.teamId}`);
    } catch {
      toast.error("Failed to join team");
      setLoading(false);
    }
  }

  if (loading && !session) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Session not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{session.name}</h1>
          <p className="text-muted-foreground">Code: {code}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Your Name</Label>
          <Input
            id="username"
            placeholder="Enter your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant={mode === "select" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setMode("select")}
          >
            Join Team
          </Button>
          <Button
            variant={mode === "create" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setMode("create")}
          >
            Create Team
          </Button>
        </div>

        {mode === "select" ? (
          <Card>
            <CardHeader>
              <CardTitle>Pick a Team</CardTitle>
              <CardDescription>
                {teams.length === 0
                  ? "No teams yet - create one!"
                  : `${teams.length} team${teams.length === 1 ? "" : "s"} available`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teams.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No teams created yet. Be the first!
                </p>
              ) : (
                <form onSubmit={handleJoinTeam} className="space-y-3">
                  <div className="space-y-2">
                    {teams.map((team) => (
                      <button
                        type="button"
                        key={team.id}
                        onClick={() => setSelectedTeam(team.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedTeam === team.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="font-medium">{team.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {team.players.length} member
                          {team.players.length !== 1 ? "s" : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!selectedTeam || !username.trim() || loading}
                  >
                    Join Team
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Create a Team</CardTitle>
              <CardDescription>Start a new team</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="teamName">Team Name</Label>
                  <Input
                    id="teamName"
                    placeholder="e.g. The Estimators"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    !newTeamName.trim() || !username.trim() || loading
                  }
                >
                  Create & Join
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
