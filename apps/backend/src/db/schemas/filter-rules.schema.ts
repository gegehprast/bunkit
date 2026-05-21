import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { foreignId, primaryId, timestamps } from "./_helpers"
import { webhookEndpoints } from "./webhook-endpoints.schema"

/**
 * Logic operators for combining conditions within a filter rule.
 */
export const LOGIC_OPERATORS = ["AND", "OR"] as const
export type LogicOperator = (typeof LOGIC_OPERATORS)[number]

/**
 * A filter rule decides whether an incoming webhook event should be forwarded.
 *
 * Rules belong to one endpoint and are evaluated in order of `priority`.
 * The `logicOperator` controls how multiple conditions are combined.
 * If a rule matches, the event is forwarded to all enabled delivery targets
 * for that endpoint (unless `dropOnMatch` is true, used for blocklisting).
 */
export const filterRules = sqliteTable("filter_rules", {
  id: primaryId(),
  endpointId: foreignId("endpoint_id", () => webhookEndpoints.id, {
    onDelete: "cascade",
  }).notNull(),
  name: text("name").notNull(),
  logicOperator: text("logic_operator")
    .$type<LogicOperator>()
    .notNull()
    .default("AND"),
  priority: integer("priority").notNull().default(0),
  dropOnMatch: integer("drop_on_match", { mode: "boolean" })
    .notNull()
    .default(false),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  ...timestamps(),
})

export type FilterRule = typeof filterRules.$inferSelect
export type NewFilterRule = typeof filterRules.$inferInsert
