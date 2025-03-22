import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  bigint,
  jsonb,
  boolean,
  foreignKey,
  primaryKey,
  json,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
  emailVerified: timestamp('email_verified'),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

export const cvs = pgTable("cvs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  fileName: varchar("filename", { length: 255 }).notNull(),
  filepath: text("filepath").notNull(),
  rawText: text("rawText"), // New column for extracted PDF text
  createdAt: timestamp("createdat").notNull().defaultNow(),
  metadata: text("metadata").default(""),
  optimizedDocxPath: text("optimized_docx_path"), // New column for optimized DOCX path
});

export const documents = pgTable('documents', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  filePath: text('file_path'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  status: text('status').default('uploaded'),
  metadata: jsonb('metadata'),
});

export const documentAnalyses = pgTable(
  "document_analyses",
  {
    id: serial("id").primaryKey(),
    cvId: integer("cv_id").notNull().references(() => cvs.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    analysisType: varchar("analysis_type", { length: 50 }).notNull().default("general"),
    
    // Analysis components as structured data (allows better querying)
    overallScore: integer("overall_score"),
    sentimentScore: integer("sentiment_score"),
    keywordCount: integer("keyword_count"),
    entityCount: integer("entity_count"),
    
    // Store the timestamp when the analysis was performed
    createdAt: timestamp("created_at").defaultNow().notNull(),
    
    // Store the full analysis result as JSON
    contentAnalysis: json("content_analysis").$type<{
      contentDistribution: { name: string; value: number }[];
      topKeywords: { text: string; value: number }[];
    }>(),
    
    sentimentAnalysis: json("sentiment_analysis").$type<{
      overallScore: number;
      sentimentBySection: { section: string; score: number }[];
    }>(),
    
    keyInformation: json("key_information").$type<{
      contactInfo: { type: string; value: string }[];
      keyDates: { description: string; date: string }[];
      entities: { type: string; name: string; occurrences: number }[];
    }>(),
    
    summary: json("summary").$type<{
      highlights: string[];
      suggestions: string[];
      overallScore: number;
    }>(),
    
    // Raw analysis data that might be used for future AI training
    rawAnalysisResponse: json("raw_analysis_response"),
  },
  (table) => {
    return {
      // Create an index on cvId for faster lookups of analyses for a specific CV
      cvIdIdx: uniqueIndex("document_analyses_cv_id_version_idx").on(table.cvId, table.version),
    };
  }
);

export const cvsRelations = relations(cvs, ({ one, many }) => ({
  user: one(users, {
    fields: [cvs.userId],
    references: [users.id],
  }),
  analyses: many(documentAnalyses),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const documentAnalysesRelations = relations(documentAnalyses, ({ one }) => ({
  cv: one(cvs, {
    fields: [documentAnalyses.cvId],
    references: [cvs.id],
  }),
}));

export const deletedCvMetadata = pgTable(
  "deleted_cv_metadata",
  {
    id: serial("id").primaryKey(),
    originalCvId: integer("original_cv_id").notNull(),
    userId: text("user_id").notNull(),
    fileName: text("file_name").notNull(),
    metadata: text("metadata"),
    rawText: text("raw_text"),
    createdAt: timestamp("created_at").defaultNow(),
    deletedAt: timestamp("deleted_at").notNull(),
  }
);

export const emailVerifications = pgTable('email_verifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  email: varchar('email', { length: 255 }).notNull(),
  token: text('token').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  VERIFICATION_RESENT = 'VERIFICATION_RESENT',
}

export type Document = typeof documents.$inferSelect;
export type CV = typeof cvs.$inferSelect;

export const insertDocumentAnalysisSchema = createInsertSchema(documentAnalyses);
export const selectDocumentAnalysisSchema = createSelectSchema(documentAnalyses);
export const documentAnalysisIdSchema = z.object({ id: z.number() });

export type DocumentAnalysis = typeof documentAnalyses.$inferSelect;
export type NewDocumentAnalysis = typeof documentAnalyses.$inferInsert;
export type DocumentAnalysisId = z.infer<typeof documentAnalysisIdSchema>["id"];

export type EmailVerification = typeof emailVerifications.$inferSelect;
export type NewEmailVerification = typeof emailVerifications.$inferInsert;
