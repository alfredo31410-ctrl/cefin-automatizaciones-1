import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { AUTOMATION_STATUSES, AUTOMATION_TYPES, TRIGGER_STATUSES, USER_LINE_ROLES } from "../domain/types.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const automationTypeEnum = pgEnum("automation_type", AUTOMATION_TYPES);
export const automationStatusEnum = pgEnum("automation_status", AUTOMATION_STATUSES);
export const triggerStatusEnum = pgEnum("trigger_status", TRIGGER_STATUSES);
export const userLineRoleEnum = pgEnum("user_line_role", USER_LINE_ROLES);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  ...timestamps,
}, (table) => [check("users_email_not_blank", sql`length(trim(${table.email})) > 3`)]);

export const lines = pgTable("lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  active: boolean("active").notNull().default(true),
  ...timestamps,
}, (table) => [check("lines_name_not_blank", sql`length(trim(${table.name})) > 0`)]);

export const userLines = pgTable("user_lines", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lineId: uuid("line_id").notNull().references(() => lines.id, { onDelete: "cascade" }),
  role: userLineRoleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.lineId], name: "user_lines_pk" }),
  index("user_lines_line_id_idx").on(table.lineId),
]);

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  lineId: uuid("line_id").notNull().references(() => lines.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 200 }).notNull(),
  externalId: varchar("external_id", { length: 255 }),
  memberCount: integer("member_count"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
}, (table) => [
  unique("groups_id_line_id_unique").on(table.id, table.lineId),
  index("groups_line_id_idx").on(table.lineId),
  check("groups_name_not_blank", sql`length(trim(${table.name})) > 0`),
  check("groups_member_count_non_negative", sql`${table.memberCount} is null or ${table.memberCount} >= 0`),
]);

export const automations = pgTable("automations", {
  id: uuid("id").primaryKey().defaultRandom(),
  lineId: uuid("line_id").notNull().references(() => lines.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 240 }).notNull(),
  type: automationTypeEnum("type").notNull(),
  status: automationStatusEnum("status").notNull().default("DRAFT"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  resumeStatus: automationStatusEnum("resume_status"),
  ...timestamps,
}, (table) => [
  unique("automations_id_line_id_unique").on(table.id, table.lineId),
  index("automations_line_id_idx").on(table.lineId),
  index("automations_status_idx").on(table.status),
  index("automations_line_status_idx").on(table.lineId, table.status),
  check("automations_name_not_blank", sql`length(trim(${table.name})) > 0`),
  check("automations_resume_status_valid", sql`${table.resumeStatus} is null or ${table.resumeStatus} in ('ACTIVE', 'SCHEDULED')`),
]);

export const automationGroups = pgTable("automation_groups", {
  automationId: uuid("automation_id").notNull(),
  groupId: uuid("group_id").notNull(),
  lineId: uuid("line_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.automationId, table.groupId], name: "automation_groups_pk" }),
  foreignKey({ columns: [table.automationId, table.lineId], foreignColumns: [automations.id, automations.lineId], name: "automation_groups_automation_line_fk" }).onDelete("cascade"),
  foreignKey({ columns: [table.groupId, table.lineId], foreignColumns: [groups.id, groups.lineId], name: "automation_groups_group_line_fk" }).onDelete("restrict"),
  index("automation_groups_group_id_idx").on(table.groupId),
  index("automation_groups_line_id_idx").on(table.lineId),
]);

export const triggers = pgTable("triggers", {
  id: uuid("id").primaryKey().defaultRandom(),
  automationId: uuid("automation_id").notNull().references(() => automations.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: triggerStatusEnum("status").notNull().default("PENDING"),
  attachmentMetadata: jsonb("attachment_metadata").$type<Record<string, unknown>>(),
  ...timestamps,
}, (table) => [
  index("triggers_automation_id_idx").on(table.automationId),
  index("triggers_status_idx").on(table.status),
  index("triggers_scheduled_at_idx").on(table.scheduledAt),
  index("triggers_pending_schedule_idx").on(table.status, table.scheduledAt),
  check("triggers_content_not_blank", sql`length(trim(${table.content})) > 0`),
]);

export const eventLogs = pgTable("event_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  lineId: uuid("line_id").notNull().references(() => lines.id, { onDelete: "restrict" }),
  automationId: uuid("automation_id"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  event: varchar("event", { length: 100 }).notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.automationId, table.lineId], foreignColumns: [automations.id, automations.lineId], name: "event_logs_automation_line_fk" }).onDelete("restrict"),
  index("event_logs_line_id_idx").on(table.lineId),
  index("event_logs_created_at_idx").on(table.createdAt),
  index("event_logs_line_created_at_idx").on(table.lineId, table.createdAt),
]);
