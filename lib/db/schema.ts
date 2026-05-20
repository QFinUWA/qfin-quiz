import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  adminPassword: text("admin_password").notNull(),
  joinCode: text("join_code").notNull().unique(),
  status: text("status", { enum: ["lobby", "active", "finished"] })
    .notNull()
    .default("lobby"),
  scheduledStartAt: integer("scheduled_start_at", { mode: "timestamp" }),
  scheduledEndAt: integer("scheduled_end_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const teams = sqliteTable(
  "teams",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [uniqueIndex("team_session_name").on(table.sessionId, table.name)]
);

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  username: text("username").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  title: text("title").notNull(),
  description: text("description"),
  answer: real("answer").notNull(),
  answerType: text("answer_type", {
    enum: ["exact", "range_absolute", "range_percent"],
  })
    .notNull()
    .default("exact"),
  answerSource: text("answer_source", {
    enum: ["point", "simulation"],
  })
    .notNull()
    .default("point"),
  rangeTolerance: real("range_tolerance"),
  simulationScript: text("simulation_script"),
  simulationN: integer("simulation_n"),
  simulationResults: text("simulation_results"),
  maxPoints: integer("max_points").notNull().default(100),
  maxAttempts: integer("max_attempts").notNull().default(3),
  pointsDropOff: text("points_drop_off").notNull().default("[100,50,25]"),
  status: text("status", {
    enum: ["hidden", "active", "closed", "revealed"],
  })
    .notNull()
    .default("hidden"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(),
  questionId: text("question_id")
    .notNull()
    .references(() => questions.id),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  attemptNumber: integer("attempt_number").notNull(),
  submissionType: text("submission_type", {
    enum: ["number", "range"],
  }).notNull(),
  answerValue: real("answer_value"),
  rangeMin: real("range_min"),
  rangeMax: real("range_max"),
  isCorrect: integer("is_correct", { mode: "boolean" })
    .notNull()
    .default(false),
  pointsAwarded: integer("points_awarded").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
