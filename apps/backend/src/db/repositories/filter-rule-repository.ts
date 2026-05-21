import type { Result } from "@bunkit/result"
import { asc, eq } from "drizzle-orm"
import type { DatabaseError } from "@/core/errors"
import {
  type FilterCondition,
  type FilterRule,
  filterConditions,
  filterRules,
  type NewFilterCondition,
  type NewFilterRule,
} from "@/db/schemas"
import { BaseRepository } from "./base-repository"

export type FilterRuleWithConditions = FilterRule & {
  conditions: FilterCondition[]
}

export class FilterRuleRepository extends BaseRepository {
  // ---------------------------------------------------------------------------
  // Rules
  // ---------------------------------------------------------------------------

  public createRule(data: NewFilterRule): Result<FilterRule, DatabaseError> {
    return this.wrapQuerySync(
      () => this.db.insert(filterRules).values(data).returning().get(),
      "Failed to create filter rule",
    )
  }

  public findRuleById(id: string): Result<FilterRule | null, DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(filterRules)
          .where(eq(filterRules.id, id))
          .get() ?? null,
      "Failed to find filter rule by ID",
    )
  }

  /** List rules for an endpoint ordered by priority ascending. */
  public listRulesByEndpoint(
    endpointId: string,
  ): Result<FilterRule[], DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(filterRules)
          .where(eq(filterRules.endpointId, endpointId))
          .orderBy(asc(filterRules.priority))
          .all(),
      "Failed to list filter rules for endpoint",
    )
  }

  /**
   * List enabled rules for an endpoint with their conditions.
   * Used by the filter engine during event evaluation.
   */
  public listEnabledWithConditions(
    endpointId: string,
  ): Result<FilterRuleWithConditions[], DatabaseError> {
    return this.wrapQuerySync(() => {
      const rules = this.db
        .select()
        .from(filterRules)
        .where(eq(filterRules.endpointId, endpointId))
        .orderBy(asc(filterRules.priority))
        .all()
        .filter((r) => r.enabled)

      return rules.map((rule) => {
        const conditions = this.db
          .select()
          .from(filterConditions)
          .where(eq(filterConditions.ruleId, rule.id))
          .all()
        return { ...rule, conditions }
      })
    }, "Failed to list enabled filter rules with conditions")
  }

  public updateRule(
    id: string,
    data: Partial<Omit<FilterRule, "id" | "endpointId" | "createdAt">>,
  ): Result<FilterRule | null, DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .update(filterRules)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(filterRules.id, id))
          .returning()
          .get() ?? null,
      "Failed to update filter rule",
    )
  }

  public deleteRule(id: string): Result<void, DatabaseError> {
    return this.wrapQuerySync(() => {
      this.db.delete(filterRules).where(eq(filterRules.id, id)).run()
    }, "Failed to delete filter rule")
  }

  // ---------------------------------------------------------------------------
  // Conditions
  // ---------------------------------------------------------------------------

  public createCondition(
    data: NewFilterCondition,
  ): Result<FilterCondition, DatabaseError> {
    return this.wrapQuerySync(
      () => this.db.insert(filterConditions).values(data).returning().get(),
      "Failed to create filter condition",
    )
  }

  public findConditionById(
    id: string,
  ): Result<FilterCondition | null, DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(filterConditions)
          .where(eq(filterConditions.id, id))
          .get() ?? null,
      "Failed to find filter condition by ID",
    )
  }

  public listConditionsByRule(
    ruleId: string,
  ): Result<FilterCondition[], DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(filterConditions)
          .where(eq(filterConditions.ruleId, ruleId))
          .all(),
      "Failed to list filter conditions for rule",
    )
  }

  public updateCondition(
    id: string,
    data: Partial<Omit<FilterCondition, "id" | "ruleId" | "createdAt">>,
  ): Result<FilterCondition | null, DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .update(filterConditions)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(filterConditions.id, id))
          .returning()
          .get() ?? null,
      "Failed to update filter condition",
    )
  }

  public deleteCondition(id: string): Result<void, DatabaseError> {
    return this.wrapQuerySync(() => {
      this.db.delete(filterConditions).where(eq(filterConditions.id, id)).run()
    }, "Failed to delete filter condition")
  }
}

export const filterRuleRepository = new FilterRuleRepository()
