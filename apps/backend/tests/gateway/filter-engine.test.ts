import { describe, expect, test } from "bun:test"
import type { FilterRuleWithConditions } from "@/db/repositories/filter-rule-repository"
import type { FilterCondition, FilterRule } from "@/db/schemas"
import { evaluateFilters, type FilterContext } from "@/gateway/filter-engine"

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeRule(
  overrides: Partial<FilterRule> & { conditions?: Partial<FilterCondition>[] },
): FilterRuleWithConditions {
  const { conditions = [], ...ruleOverrides } = overrides
  const rule: FilterRule = {
    id: crypto.randomUUID(),
    endpointId: crypto.randomUUID(),
    name: "test-rule",
    priority: 0,
    logicOperator: "AND",
    dropOnMatch: false,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...ruleOverrides,
  }
  const fullConditions: FilterCondition[] = conditions.map((c) => ({
    id: crypto.randomUUID(),
    ruleId: rule.id,
    field: "header",
    fieldKey: null,
    operator: "exists",
    value: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...c,
  }))
  return { ...rule, conditions: fullConditions }
}

const baseCtx: FilterContext = {
  headers: { "x-event-type": "push", "content-type": "application/json" },
  body: '{"action":"opened","number":42}',
  query: { ref: "main" },
  method: "POST",
  sourceIp: "1.2.3.4",
}

// ─── no rules ────────────────────────────────────────────────────────────────

describe("evaluateFilters — no rules", () => {
  test("passes through with matchedRule=null and drop=false", () => {
    const result = evaluateFilters(baseCtx, [])
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().matchedRule).toBeNull()
    expect(result.unwrap().drop).toBe(false)
  })
})

// ─── header conditions ───────────────────────────────────────────────────────

describe("evaluateFilters — header conditions", () => {
  test("exists: matches when header is present", () => {
    const rule = makeRule({
      conditions: [
        { field: "header", fieldKey: "x-event-type", operator: "exists" },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().matchedRule?.id).toBe(rule.id)
  })

  test("not_exists: matches when header is absent", () => {
    const rule = makeRule({
      conditions: [
        { field: "header", fieldKey: "x-missing", operator: "not_exists" },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().matchedRule?.id).toBe(rule.id)
  })

  test("eq: matches exact header value", () => {
    const rule = makeRule({
      conditions: [
        {
          field: "header",
          fieldKey: "x-event-type",
          operator: "eq",
          value: "push",
        },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().matchedRule?.id).toBe(rule.id)
  })

  test("eq: does not match wrong value", () => {
    const rule = makeRule({
      conditions: [
        {
          field: "header",
          fieldKey: "x-event-type",
          operator: "eq",
          value: "pull_request",
        },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().matchedRule).toBeNull()
  })

  test("neq: matches when value differs", () => {
    const rule = makeRule({
      conditions: [
        {
          field: "header",
          fieldKey: "x-event-type",
          operator: "neq",
          value: "other",
        },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.unwrap().matchedRule?.id).toBe(rule.id)
  })

  test("contains: matches substring", () => {
    const rule = makeRule({
      conditions: [
        {
          field: "header",
          fieldKey: "x-event-type",
          operator: "contains",
          value: "pus",
        },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.unwrap().matchedRule?.id).toBe(rule.id)
  })

  test("starts_with: matches prefix", () => {
    const rule = makeRule({
      conditions: [
        {
          field: "header",
          fieldKey: "x-event-type",
          operator: "starts_with",
          value: "pu",
        },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.unwrap().matchedRule?.id).toBe(rule.id)
  })

  test("ends_with: matches suffix", () => {
    const rule = makeRule({
      conditions: [
        {
          field: "header",
          fieldKey: "x-event-type",
          operator: "ends_with",
          value: "sh",
        },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.unwrap().matchedRule?.id).toBe(rule.id)
  })

  test("regex: matches pattern", () => {
    const rule = makeRule({
      conditions: [
        {
          field: "header",
          fieldKey: "x-event-type",
          operator: "regex",
          value: "^push$",
        },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.unwrap().matchedRule?.id).toBe(rule.id)
  })

  test("regex: does not match non-matching pattern", () => {
    const rule = makeRule({
      conditions: [
        {
          field: "header",
          fieldKey: "x-event-type",
          operator: "regex",
          value: "^delete$",
        },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.unwrap().matchedRule).toBeNull()
  })
})

// ─── body (JSON path) conditions ─────────────────────────────────────────────

describe("evaluateFilters — body conditions", () => {
  test("extracts top-level JSON field with eq", () => {
    const rule = makeRule({
      conditions: [
        {
          field: "body",
          fieldKey: "$.action",
          operator: "eq",
          value: "opened",
        },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.unwrap().matchedRule?.id).toBe(rule.id)
  })

  test("extracts nested JSON field", () => {
    const ctx: FilterContext = {
      ...baseCtx,
      body: '{"repo":{"name":"my-repo"}}',
    }
    const rule = makeRule({
      conditions: [
        {
          field: "body",
          fieldKey: "$.repo.name",
          operator: "eq",
          value: "my-repo",
        },
      ],
    })
    const result = evaluateFilters(ctx, [rule])
    expect(result.unwrap().matchedRule?.id).toBe(rule.id)
  })

  test("returns null field for non-existent path", () => {
    const rule = makeRule({
      conditions: [
        { field: "body", fieldKey: "$.missing", operator: "exists" },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.unwrap().matchedRule).toBeNull()
  })

  test("handles invalid JSON gracefully", () => {
    const ctx: FilterContext = { ...baseCtx, body: "not-json" }
    const rule = makeRule({
      conditions: [
        {
          field: "body",
          fieldKey: "$.action",
          operator: "eq",
          value: "opened",
        },
      ],
    })
    const result = evaluateFilters(ctx, [rule])
    expect(result.unwrap().matchedRule).toBeNull()
  })
})

// ─── query conditions ────────────────────────────────────────────────────────

describe("evaluateFilters — query conditions", () => {
  test("eq: matches query param", () => {
    const rule = makeRule({
      conditions: [
        { field: "query", fieldKey: "ref", operator: "eq", value: "main" },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.unwrap().matchedRule?.id).toBe(rule.id)
  })

  test("not_exists: matches missing param", () => {
    const rule = makeRule({
      conditions: [
        { field: "query", fieldKey: "missing", operator: "not_exists" },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.unwrap().matchedRule?.id).toBe(rule.id)
  })
})

// ─── method conditions ───────────────────────────────────────────────────────

describe("evaluateFilters — method conditions", () => {
  test("eq: matches HTTP method (case-insensitive)", () => {
    const rule = makeRule({
      conditions: [
        { field: "method", fieldKey: null, operator: "eq", value: "POST" },
      ],
    })
    const ctxLower: FilterContext = { ...baseCtx, method: "post" }
    const result = evaluateFilters(ctxLower, [rule])
    expect(result.unwrap().matchedRule?.id).toBe(rule.id)
  })
})

// ─── source_ip conditions ────────────────────────────────────────────────────

describe("evaluateFilters — source_ip conditions", () => {
  test("eq: matches source IP", () => {
    const rule = makeRule({
      conditions: [
        {
          field: "source_ip",
          fieldKey: null,
          operator: "eq",
          value: "1.2.3.4",
        },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.unwrap().matchedRule?.id).toBe(rule.id)
  })

  test("not_exists: matches null source IP", () => {
    const ctx: FilterContext = { ...baseCtx, sourceIp: null }
    const rule = makeRule({
      conditions: [
        { field: "source_ip", fieldKey: null, operator: "not_exists" },
      ],
    })
    const result = evaluateFilters(ctx, [rule])
    expect(result.unwrap().matchedRule?.id).toBe(rule.id)
  })
})

// ─── AND / OR logic ──────────────────────────────────────────────────────────

describe("evaluateFilters — AND/OR logic", () => {
  test("AND: both conditions must match", () => {
    const rule = makeRule({
      logicOperator: "AND",
      conditions: [
        {
          field: "header",
          fieldKey: "x-event-type",
          operator: "eq",
          value: "push",
        },
        { field: "method", fieldKey: null, operator: "eq", value: "POST" },
      ],
    })
    expect(evaluateFilters(baseCtx, [rule]).unwrap().matchedRule?.id).toBe(
      rule.id,
    )
  })

  test("AND: fails when one condition doesn't match", () => {
    const rule = makeRule({
      logicOperator: "AND",
      conditions: [
        {
          field: "header",
          fieldKey: "x-event-type",
          operator: "eq",
          value: "push",
        },
        { field: "method", fieldKey: null, operator: "eq", value: "GET" },
      ],
    })
    expect(evaluateFilters(baseCtx, [rule]).unwrap().matchedRule).toBeNull()
  })

  test("OR: matches when at least one condition matches", () => {
    const rule = makeRule({
      logicOperator: "OR",
      conditions: [
        {
          field: "header",
          fieldKey: "x-event-type",
          operator: "eq",
          value: "delete",
        },
        { field: "method", fieldKey: null, operator: "eq", value: "POST" },
      ],
    })
    expect(evaluateFilters(baseCtx, [rule]).unwrap().matchedRule?.id).toBe(
      rule.id,
    )
  })

  test("OR: fails when no condition matches", () => {
    const rule = makeRule({
      logicOperator: "OR",
      conditions: [
        {
          field: "header",
          fieldKey: "x-event-type",
          operator: "eq",
          value: "delete",
        },
        { field: "method", fieldKey: null, operator: "eq", value: "GET" },
      ],
    })
    expect(evaluateFilters(baseCtx, [rule]).unwrap().matchedRule).toBeNull()
  })
})

// ─── priority ordering ────────────────────────────────────────────────────────

describe("evaluateFilters — priority ordering", () => {
  test("first matching rule wins", () => {
    const rule1 = makeRule({
      priority: 0,
      name: "first",
      conditions: [
        { field: "method", fieldKey: null, operator: "eq", value: "POST" },
      ],
    })
    const rule2 = makeRule({
      priority: 1,
      name: "second",
      conditions: [
        { field: "method", fieldKey: null, operator: "eq", value: "POST" },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule1, rule2])
    expect(result.unwrap().matchedRule?.id).toBe(rule1.id)
  })
})

// ─── drop on match ────────────────────────────────────────────────────────────

describe("evaluateFilters — dropOnMatch", () => {
  test("drop=true when matching rule has dropOnMatch=true", () => {
    const rule = makeRule({
      dropOnMatch: true,
      conditions: [
        { field: "method", fieldKey: null, operator: "eq", value: "POST" },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.unwrap().drop).toBe(true)
    expect(result.unwrap().matchedRule?.id).toBe(rule.id)
  })

  test("drop=false when matching rule has dropOnMatch=false", () => {
    const rule = makeRule({
      dropOnMatch: false,
      conditions: [
        { field: "method", fieldKey: null, operator: "eq", value: "POST" },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.unwrap().drop).toBe(false)
  })

  test("drop=false when no rule matches", () => {
    const rule = makeRule({
      dropOnMatch: true,
      conditions: [
        { field: "method", fieldKey: null, operator: "eq", value: "GET" },
      ],
    })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.unwrap().drop).toBe(false)
    expect(result.unwrap().matchedRule).toBeNull()
  })
})

// ─── no conditions ───────────────────────────────────────────────────────────

describe("evaluateFilters — rule with no conditions", () => {
  test("rule with no conditions always matches", () => {
    const rule = makeRule({ conditions: [] })
    const result = evaluateFilters(baseCtx, [rule])
    expect(result.unwrap().matchedRule?.id).toBe(rule.id)
  })
})
