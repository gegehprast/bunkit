import { sqliteTable, text } from "drizzle-orm/sqlite-core"
import { foreignId, primaryId, timestamps } from "./_helpers"
import { filterRules } from "./filter-rules.schema"

/**
 * Fields that can be inspected by a filter condition.
 */
export const CONDITION_FIELDS = [
  "header",
  "body",
  "query",
  "method",
  "source_ip",
] as const

export type ConditionField = (typeof CONDITION_FIELDS)[number]

/**
 * Comparison operators for filter conditions.
 *
 * - `eq` / `neq` — exact string match / not-match
 * - `contains` / `not_contains` — substring check
 * - `starts_with` / `ends_with` — prefix / suffix check
 * - `regex` — ECMA regex match
 * - `exists` / `not_exists` — field presence check (value ignored)
 */
export const CONDITION_OPERATORS = [
  "eq",
  "neq",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "regex",
  "exists",
  "not_exists",
] as const

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number]

/**
 * A single condition within a filter rule.
 *
 * `fieldKey` provides the header name or JSON pointer for `body` fields.
 * e.g. for field=`header`, fieldKey=`x-github-event`
 *      for field=`body`,   fieldKey=`$.action`
 */
export const filterConditions = sqliteTable("filter_conditions", {
  id: primaryId(),
  ruleId: foreignId("rule_id", () => filterRules.id, {
    onDelete: "cascade",
  }).notNull(),
  field: text("field").$type<ConditionField>().notNull(),
  fieldKey: text("field_key"),
  operator: text("operator").$type<ConditionOperator>().notNull(),
  value: text("value"),
  ...timestamps(),
})

export type FilterCondition = typeof filterConditions.$inferSelect
export type NewFilterCondition = typeof filterConditions.$inferInsert
