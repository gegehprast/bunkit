import { err, ok, type Result } from "@bunkit/result"
import { FilterError } from "@/core/errors"
import type { FilterRuleWithConditions } from "@/db/repositories/filter-rule-repository"
import type { FilterCondition, FilterRule } from "@/db/schemas"

export interface FilterContext {
  headers: Record<string, string>
  /** Raw request body text */
  body: string
  query: Record<string, string>
  method: string
  sourceIp: string | null
}

export interface FilterResult {
  /** The first rule that matched, or null if no rule matched (default pass-through). */
  matchedRule: FilterRule | null
  /**
   * Whether the event should be dropped.
   * True only when a rule matched and that rule has `dropOnMatch = true`.
   */
  drop: boolean
}

/**
 * Resolve the raw string value for a condition's field from the request context.
 *
 * For `body` fields, `fieldKey` is treated as a dot-separated JSON pointer
 * with an optional leading `$.` (e.g. `$.action` → `action`,
 * `$.repository.name` → `repository.name`).
 */
function resolveFieldValue(
  ctx: FilterContext,
  field: FilterCondition["field"],
  fieldKey: string | null,
): string | null {
  switch (field) {
    case "header":
      return fieldKey ? (ctx.headers[fieldKey.toLowerCase()] ?? null) : null

    case "body": {
      if (!fieldKey) return ctx.body
      try {
        const parsed: unknown = JSON.parse(ctx.body)
        const segments = fieldKey.replace(/^\$\./, "").split(".")
        let current: unknown = parsed
        for (const seg of segments) {
          if (current === null || typeof current !== "object") return null
          current = (current as Record<string, unknown>)[seg]
        }
        return current === undefined || current === null
          ? null
          : String(current)
      } catch {
        return null
      }
    }

    case "query":
      return fieldKey ? (ctx.query[fieldKey] ?? null) : null

    case "method":
      return ctx.method.toUpperCase()

    case "source_ip":
      return ctx.sourceIp
  }
}

function testCondition(ctx: FilterContext, cond: FilterCondition): boolean {
  const { field, fieldKey, operator, value } = cond
  const fieldValue = resolveFieldValue(ctx, field, fieldKey)

  switch (operator) {
    case "exists":
      return fieldValue !== null

    case "not_exists":
      return fieldValue === null

    case "eq":
      return fieldValue !== null && fieldValue === value

    case "neq":
      return fieldValue !== value

    case "contains":
      return fieldValue !== null && value !== null && fieldValue.includes(value)

    case "not_contains":
      return (
        fieldValue === null || value === null || !fieldValue.includes(value)
      )

    case "starts_with":
      return (
        fieldValue !== null && value !== null && fieldValue.startsWith(value)
      )

    case "ends_with":
      return fieldValue !== null && value !== null && fieldValue.endsWith(value)

    case "regex": {
      if (!fieldValue || !value) return false
      try {
        return new RegExp(value).test(fieldValue)
      } catch {
        return false
      }
    }
  }
}

function evaluateRule(
  ctx: FilterContext,
  rule: FilterRuleWithConditions,
): boolean {
  const { conditions, logicOperator } = rule
  // A rule with no conditions always matches
  if (conditions.length === 0) return true
  return logicOperator === "AND"
    ? conditions.every((c) => testCondition(ctx, c))
    : conditions.some((c) => testCondition(ctx, c))
}

/**
 * Evaluate filter rules against a request context.
 *
 * Rules are evaluated in priority order (lowest number first — already
 * sorted by the repository).  The first matching rule determines the
 * outcome.  If no rule matches, the event is allowed through
 * (`matchedRule = null`, `drop = false`).
 */
export function evaluateFilters(
  ctx: FilterContext,
  rules: FilterRuleWithConditions[],
): Result<FilterResult, FilterError> {
  try {
    for (const rule of rules) {
      if (evaluateRule(ctx, rule)) {
        return ok({ matchedRule: rule, drop: rule.dropOnMatch })
      }
    }
    return ok({ matchedRule: null, drop: false })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return err(new FilterError(`Filter evaluation failed: ${message}`))
  }
}
