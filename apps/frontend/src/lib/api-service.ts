import type { components, operations } from "../generated/openapi"
import { apiClient } from "./api-client"

// Schema type aliases
export type ApiKey = components["schemas"]["ApiKey"]
export type CreateApiKeyResponse = components["schemas"]["CreateApiKeyResponse"]
export type SetupStatus = components["schemas"]["SetupStatus"]
export type SetupResponse = components["schemas"]["SetupResponse"]
export type AuthMe = components["schemas"]["AuthMe"]
export type WebhookEndpoint = components["schemas"]["WebhookEndpoint"]
export type DeliveryTarget = components["schemas"]["DeliveryTarget"]
export type FilterRule = components["schemas"]["FilterRule"]
export type FilterRuleWithConditions =
  components["schemas"]["FilterRuleWithConditions"]
export type FilterCondition = components["schemas"]["FilterCondition"]
export type WebhookEvent = components["schemas"]["WebhookEvent"]
export type DeliveryAttempt = components["schemas"]["DeliveryAttempt"]
export type SendTestResult = components["schemas"]["SendTestResult"]
export type TestReceiver = components["schemas"]["TestReceiver"]
export type TestReceiverRequest = components["schemas"]["TestReceiverRequest"]

// Request body aliases
export type CreateEndpointBody =
  operations["createEndpoint"]["requestBody"]["content"]["application/json"]
export type UpdateEndpointBody =
  operations["updateEndpoint"]["requestBody"]["content"]["application/json"]
export type CreateTargetBody =
  operations["createTarget"]["requestBody"]["content"]["application/json"]
export type UpdateTargetBody =
  operations["updateTarget"]["requestBody"]["content"]["application/json"]
export type CreateRuleBody =
  operations["createRule"]["requestBody"]["content"]["application/json"]
export type UpdateRuleBody =
  operations["updateRule"]["requestBody"]["content"]["application/json"]
export type CreateConditionBody =
  operations["createCondition"]["requestBody"]["content"]["application/json"]
export type UpdateConditionBody =
  operations["updateCondition"]["requestBody"]["content"]["application/json"]
export type CreateApiKeyBody =
  operations["createApiKey"]["requestBody"]["content"]["application/json"]

export const authService = {
  async me() {
    return apiClient.GET("/api/auth/me")
  },
  async login(key: string) {
    return apiClient.POST("/api/auth/login", { body: { key } })
  },
  async logout() {
    return apiClient.POST("/api/auth/logout", {})
  },
}

export const setupService = {
  async status() {
    return apiClient.GET("/api/setup/status")
  },
  async run(name: string) {
    return apiClient.POST("/api/setup", { body: { name } })
  },
}

export const apiKeyService = {
  async list() {
    return apiClient.GET("/api/keys")
  },
  async create(body: CreateApiKeyBody) {
    return apiClient.POST("/api/keys", { body })
  },
  async delete(id: string) {
    return apiClient.DELETE("/api/keys/{id}", { params: { path: { id } } })
  },
}

export const endpointService = {
  async list() {
    return apiClient.GET("/api/endpoints")
  },
  async get(id: string) {
    return apiClient.GET("/api/endpoints/{id}", { params: { path: { id } } })
  },
  async create(body: CreateEndpointBody) {
    return apiClient.POST("/api/endpoints", { body })
  },
  async update(id: string, body: UpdateEndpointBody) {
    return apiClient.PATCH("/api/endpoints/{id}", {
      params: { path: { id } },
      body,
    })
  },
  async delete(id: string) {
    return apiClient.DELETE("/api/endpoints/{id}", { params: { path: { id } } })
  },
  async sendTest(id: string, body: SendTestBody) {
    return apiClient.POST("/api/endpoints/{endpointId}/send-test", {
      params: { path: { endpointId: id } },
      body,
    })
  },
}

export const targetService = {
  async list(endpointId: string) {
    return apiClient.GET("/api/endpoints/{endpointId}/targets", {
      params: { path: { endpointId } },
    })
  },
  async get(endpointId: string, id: string) {
    return apiClient.GET("/api/endpoints/{endpointId}/targets/{id}", {
      params: { path: { endpointId, id } },
    })
  },
  async create(endpointId: string, body: CreateTargetBody) {
    return apiClient.POST("/api/endpoints/{endpointId}/targets", {
      params: { path: { endpointId } },
      body,
    })
  },
  async update(endpointId: string, id: string, body: UpdateTargetBody) {
    return apiClient.PATCH("/api/endpoints/{endpointId}/targets/{id}", {
      params: { path: { endpointId, id } },
      body,
    })
  },
  async delete(endpointId: string, id: string) {
    return apiClient.DELETE("/api/endpoints/{endpointId}/targets/{id}", {
      params: { path: { endpointId, id } },
    })
  },
}

export const ruleService = {
  async list(endpointId: string) {
    return apiClient.GET("/api/endpoints/{endpointId}/rules", {
      params: { path: { endpointId } },
    })
  },
  async get(endpointId: string, ruleId: string) {
    return apiClient.GET("/api/endpoints/{endpointId}/rules/{ruleId}", {
      params: { path: { endpointId, ruleId } },
    })
  },
  async create(endpointId: string, body: CreateRuleBody) {
    return apiClient.POST("/api/endpoints/{endpointId}/rules", {
      params: { path: { endpointId } },
      body,
    })
  },
  async update(endpointId: string, ruleId: string, body: UpdateRuleBody) {
    return apiClient.PATCH("/api/endpoints/{endpointId}/rules/{ruleId}", {
      params: { path: { endpointId, ruleId } },
      body,
    })
  },
  async delete(endpointId: string, ruleId: string) {
    return apiClient.DELETE("/api/endpoints/{endpointId}/rules/{ruleId}", {
      params: { path: { endpointId, ruleId } },
    })
  },
  async listConditions(endpointId: string, ruleId: string) {
    return apiClient.GET(
      "/api/endpoints/{endpointId}/rules/{ruleId}/conditions",
      { params: { path: { endpointId, ruleId } } },
    )
  },
  async createCondition(
    endpointId: string,
    ruleId: string,
    body: CreateConditionBody,
  ) {
    return apiClient.POST(
      "/api/endpoints/{endpointId}/rules/{ruleId}/conditions",
      { params: { path: { endpointId, ruleId } }, body },
    )
  },
  async updateCondition(
    endpointId: string,
    ruleId: string,
    conditionId: string,
    body: UpdateConditionBody,
  ) {
    return apiClient.PATCH(
      "/api/endpoints/{endpointId}/rules/{ruleId}/conditions/{conditionId}",
      { params: { path: { endpointId, ruleId, conditionId } }, body },
    )
  },
  async deleteCondition(
    endpointId: string,
    ruleId: string,
    conditionId: string,
  ) {
    return apiClient.DELETE(
      "/api/endpoints/{endpointId}/rules/{ruleId}/conditions/{conditionId}",
      { params: { path: { endpointId, ruleId, conditionId } } },
    )
  },
}

export const eventService = {
  async list() {
    return apiClient.GET("/api/events")
  },
  async get(id: string) {
    return apiClient.GET("/api/events/{id}", { params: { path: { id } } })
  },
  async replay(id: string) {
    return apiClient.POST("/api/events/{id}/replay", {
      params: { path: { id } },
    })
  },
  async listAttempts(id: string) {
    return apiClient.GET("/api/events/{id}/attempts", {
      params: { path: { id } },
    })
  },
}

export const dlqService = {
  async list() {
    return apiClient.GET("/api/dlq")
  },
  async replay(body: { ids?: string[] }) {
    return apiClient.POST("/api/dlq/replay", { body })
  },
  async discard(body: { ids?: string[] }) {
    return apiClient.DELETE("/api/dlq", { body })
  },
}

export type CreateTestReceiverBody =
  operations["createTestReceiver"]["requestBody"]["content"]["application/json"]
export type SendTestBody =
  operations["sendTestWebhook"]["requestBody"]["content"]["application/json"]

export const testReceiverService = {
  async list(endpointId: string) {
    return apiClient.GET("/api/endpoints/{endpointId}/targets/test", {
      params: { path: { endpointId } },
    })
  },
  async create(endpointId: string, body: CreateTestReceiverBody) {
    return apiClient.POST("/api/endpoints/{endpointId}/targets/test", {
      params: { path: { endpointId } },
      body,
    })
  },
  async delete(endpointId: string, receiverId: string) {
    return apiClient.DELETE(
      "/api/endpoints/{endpointId}/targets/test/{receiverId}",
      { params: { path: { endpointId, receiverId } } },
    )
  },
  async listRequests(endpointId: string, receiverId: string) {
    return apiClient.GET(
      "/api/endpoints/{endpointId}/targets/test/{receiverId}/requests",
      { params: { path: { endpointId, receiverId } } },
    )
  },
  async clearRequests(endpointId: string, receiverId: string) {
    return apiClient.DELETE(
      "/api/endpoints/{endpointId}/targets/test/{receiverId}/requests",
      { params: { path: { endpointId, receiverId } } },
    )
  },
}
