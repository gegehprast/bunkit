import { createRoute } from "@bunkit/server"
import { z } from "zod"
import { filterRuleRepository } from "@/db/repositories/filter-rule-repository"
import { webhookEndpointRepository } from "@/db/repositories/webhook-endpoint-repository"
import {
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  type FilterCondition,
  type FilterRule,
  LOGIC_OPERATORS,
} from "@/db/schemas"
import { apiKeyMiddleware } from "@/middlewares/api-key.middleware"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ConditionSchema = z
  .object({
    id: z.string().uuid(),
    ruleId: z.string().uuid(),
    field: z.enum(CONDITION_FIELDS),
    fieldKey: z.string().nullable(),
    operator: z.enum(CONDITION_OPERATORS),
    value: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: "FilterCondition" })

const RuleSchema = z
  .object({
    id: z.string().uuid(),
    endpointId: z.string().uuid(),
    name: z.string(),
    logicOperator: z.enum(LOGIC_OPERATORS),
    priority: z.number().int(),
    dropOnMatch: z.boolean(),
    enabled: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: "FilterRule" })

const RuleWithConditionsSchema = RuleSchema.extend({
  conditions: z.array(ConditionSchema),
}).meta({ id: "FilterRuleWithConditions" })

const CreateRuleSchema = z.object({
  name: z.string().min(1).max(100),
  logicOperator: z.enum(LOGIC_OPERATORS).default("AND"),
  priority: z.number().int().default(0),
  dropOnMatch: z.boolean().default(false),
  enabled: z.boolean().default(true),
})

const UpdateRuleSchema = CreateRuleSchema.partial()

const CreateConditionSchema = z.object({
  field: z.enum(CONDITION_FIELDS),
  fieldKey: z.string().optional(),
  operator: z.enum(CONDITION_OPERATORS),
  value: z.string().optional(),
})

const UpdateConditionSchema = CreateConditionSchema.partial()

function formatCondition(c: FilterCondition) {
  return {
    id: c.id,
    ruleId: c.ruleId,
    field: c.field,
    fieldKey: c.fieldKey ?? null,
    operator: c.operator,
    value: c.value ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

function formatRule(r: FilterRule) {
  return {
    id: r.id,
    endpointId: r.endpointId,
    name: r.name,
    logicOperator: r.logicOperator,
    priority: r.priority,
    dropOnMatch: r.dropOnMatch,
    enabled: r.enabled,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Rules — CRUD
// ---------------------------------------------------------------------------

createRoute("GET", "/api/endpoints/:endpointId/rules")
  .openapi({
    operationId: "listRules",
    summary: "List filter rules",
    tags: ["Rules"],
  })
  .middlewares(apiKeyMiddleware())
  .response(z.array(RuleWithConditionsSchema))
  .handler(({ params, res }) => {
    const endpoint = webhookEndpointRepository.findById(params.endpointId)
    if (!endpoint.isOk())
      return res.internalError(endpoint.error.message, endpoint.error.code)
    if (!endpoint.value) return res.notFound("Endpoint not found")

    const result = filterRuleRepository.listEnabledWithConditions(
      params.endpointId,
    )
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)

    return res.ok(
      result.value.map((r) => ({
        ...formatRule(r),
        conditions: r.conditions.map(formatCondition),
      })),
    )
  })

createRoute("POST", "/api/endpoints/:endpointId/rules")
  .openapi({
    operationId: "createRule",
    summary: "Create filter rule",
    tags: ["Rules"],
  })
  .middlewares(apiKeyMiddleware())
  .body(CreateRuleSchema)
  .response(RuleSchema)
  .handler(({ params, body, res }) => {
    const endpoint = webhookEndpointRepository.findById(params.endpointId)
    if (!endpoint.isOk())
      return res.internalError(endpoint.error.message, endpoint.error.code)
    if (!endpoint.value) return res.notFound("Endpoint not found")

    const result = filterRuleRepository.createRule({
      endpointId: params.endpointId,
      name: body.name,
      logicOperator: body.logicOperator,
      priority: body.priority,
      dropOnMatch: body.dropOnMatch,
      enabled: body.enabled,
    })
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    return res.created(formatRule(result.value))
  })

createRoute("GET", "/api/endpoints/:endpointId/rules/:ruleId")
  .openapi({
    operationId: "getRule",
    summary: "Get filter rule",
    tags: ["Rules"],
  })
  .middlewares(apiKeyMiddleware())
  .response(RuleWithConditionsSchema)
  .handler(({ params, res }) => {
    const rule = filterRuleRepository.findRuleById(params.ruleId)
    if (!rule.isOk())
      return res.internalError(rule.error.message, rule.error.code)
    if (!rule.value) return res.notFound("Rule not found")

    const conditions = filterRuleRepository.listConditionsByRule(params.ruleId)
    if (!conditions.isOk())
      return res.internalError(conditions.error.message, conditions.error.code)

    return res.ok({
      ...formatRule(rule.value),
      conditions: conditions.value.map(formatCondition),
    })
  })

createRoute("PATCH", "/api/endpoints/:endpointId/rules/:ruleId")
  .openapi({
    operationId: "updateRule",
    summary: "Update filter rule",
    tags: ["Rules"],
  })
  .middlewares(apiKeyMiddleware())
  .body(UpdateRuleSchema)
  .response(RuleSchema)
  .handler(({ params, body, res }) => {
    const existing = filterRuleRepository.findRuleById(params.ruleId)
    if (!existing.isOk())
      return res.internalError(existing.error.message, existing.error.code)
    if (!existing.value) return res.notFound("Rule not found")

    const result = filterRuleRepository.updateRule(params.ruleId, body)
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    if (!result.value) return res.notFound("Rule not found")
    return res.ok(formatRule(result.value))
  })

createRoute("DELETE", "/api/endpoints/:endpointId/rules/:ruleId")
  .openapi({
    operationId: "deleteRule",
    summary: "Delete filter rule",
    tags: ["Rules"],
  })
  .middlewares(apiKeyMiddleware())
  .handler(({ params, res }) => {
    const existing = filterRuleRepository.findRuleById(params.ruleId)
    if (!existing.isOk())
      return res.internalError(existing.error.message, existing.error.code)
    if (!existing.value) return res.notFound("Rule not found")

    const result = filterRuleRepository.deleteRule(params.ruleId)
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    return res.noContent()
  })

// ---------------------------------------------------------------------------
// Conditions — CRUD
// ---------------------------------------------------------------------------

createRoute("GET", "/api/endpoints/:endpointId/rules/:ruleId/conditions")
  .openapi({
    operationId: "listConditions",
    summary: "List rule conditions",
    tags: ["Rules"],
  })
  .middlewares(apiKeyMiddleware())
  .response(z.array(ConditionSchema))
  .handler(({ params, res }) => {
    const rule = filterRuleRepository.findRuleById(params.ruleId)
    if (!rule.isOk())
      return res.internalError(rule.error.message, rule.error.code)
    if (!rule.value) return res.notFound("Rule not found")

    const result = filterRuleRepository.listConditionsByRule(params.ruleId)
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    return res.ok(result.value.map(formatCondition))
  })

createRoute("POST", "/api/endpoints/:endpointId/rules/:ruleId/conditions")
  .openapi({
    operationId: "createCondition",
    summary: "Add condition to rule",
    tags: ["Rules"],
  })
  .middlewares(apiKeyMiddleware())
  .body(CreateConditionSchema)
  .response(ConditionSchema)
  .handler(({ params, body, res }) => {
    const rule = filterRuleRepository.findRuleById(params.ruleId)
    if (!rule.isOk())
      return res.internalError(rule.error.message, rule.error.code)
    if (!rule.value) return res.notFound("Rule not found")

    const result = filterRuleRepository.createCondition({
      ruleId: params.ruleId,
      field: body.field,
      fieldKey: body.fieldKey ?? null,
      operator: body.operator,
      value: body.value ?? null,
    })
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    return res.created(formatCondition(result.value))
  })

createRoute(
  "PATCH",
  "/api/endpoints/:endpointId/rules/:ruleId/conditions/:conditionId",
)
  .openapi({
    operationId: "updateCondition",
    summary: "Update condition",
    tags: ["Rules"],
  })
  .middlewares(apiKeyMiddleware())
  .body(UpdateConditionSchema)
  .response(ConditionSchema)
  .handler(({ params, body, res }) => {
    const existing = filterRuleRepository.findConditionById(params.conditionId)
    if (!existing.isOk())
      return res.internalError(existing.error.message, existing.error.code)
    if (!existing.value) return res.notFound("Condition not found")

    const result = filterRuleRepository.updateCondition(
      params.conditionId,
      body,
    )
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    if (!result.value) return res.notFound("Condition not found")
    return res.ok(formatCondition(result.value))
  })

createRoute(
  "DELETE",
  "/api/endpoints/:endpointId/rules/:ruleId/conditions/:conditionId",
)
  .openapi({
    operationId: "deleteCondition",
    summary: "Delete condition",
    tags: ["Rules"],
  })
  .middlewares(apiKeyMiddleware())
  .handler(({ params, res }) => {
    const existing = filterRuleRepository.findConditionById(params.conditionId)
    if (!existing.isOk())
      return res.internalError(existing.error.message, existing.error.code)
    if (!existing.value) return res.notFound("Condition not found")

    const result = filterRuleRepository.deleteCondition(params.conditionId)
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    return res.noContent()
  })
