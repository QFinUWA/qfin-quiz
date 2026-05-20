@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Tech Stack

- **App:** Next.js (App Router, Turbopack) with `output: 'standalone'` for Docker
- **Database:** SQLite via better-sqlite3 (Drizzle ORM), stored at `data/quiz.db`
- **UI:** Shadcn UI + Tailwind CSS v4
- **Deployment:** Docker + VPS (`qfin-new` / 66.226.147.134)

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml` which:
1. Builds a Docker image and pushes to `ghcr.io/qfinuwa/qfin-quiz:latest`
2. SSHs into the VPS and runs `docker compose pull quiz && docker compose up -d quiz` under `/opt/infra`

The SQLite database is persisted via a Docker volume mounted at `/app/data` (configured via `DB_DIR` env var).

No build-time secrets needed - this app has no external services. The database is self-contained.

### Post-Push: Always Verify

After pushing to any remote, you MUST verify the CI/deploy run succeeded. Do not push and move on.

- Spawn a background sub-agent to watch the GitHub Actions run - do NOT block the main conversation
- If it succeeds, report back briefly
- If it fails, report the failure logs and prioritize fixing it
- Retry up to 3 times. If it keeps failing, ask the user for help
- Only report the task as done once the run is green

## Git Conventions

All branches, commits, and PRs follow Conventional Commits.

- **Branches:** `<type>/<description>` (e.g. `feat/session-list`, `fix/font-fallback`)
- **Commits:** `<type>(<scope>): <description>` (e.g. `feat(ui): add active sessions list`)
- **PR titles:** same as commits
- **Types:** `feat`, `fix`, `refactor`, `chore`, `docs`, `hotfix`, `test`, `ci`
- **Scopes:** `ui`, `db`, `api`, `admin`, `quiz`

## Issue Tracking

We use **GitHub Issues** on this repo for all issue tracking. Do not use Linear or any other tool. Keep issues concise and to the point.
