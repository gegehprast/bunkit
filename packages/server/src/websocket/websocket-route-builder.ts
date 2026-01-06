import type { z } from "zod"
import type { Server } from "../types/server"
import type {
  BinaryMessageHandler,
  CloseHandler,
  ConnectHandler,
  ErrorHandler,
  ExtractWsParams,
  MessageHandler,
  RegisteredMessageHandler,
  WebSocketAuthFn,
  WebSocketRouteDefinition,
} from "./types/websocket"
import {
  WebSocketRouteRegistry,
  webSocketRouteRegistry,
} from "./websocket-registry"
/**
 * WebSocket route builder with fluent API and type-safe generics
 * Automatically extracts path parameters and enforces handler type safety
 */
export class WebSocketRouteBuilder<
  TPath extends string,
  TParams = ExtractWsParams<TPath>,
  TServerMsg = unknown,
  TUser = unknown,
> {
  private _authFn?: WebSocketAuthFn<TUser>
  private _messageHandlers: RegisteredMessageHandler[] = []
  private _binaryHandler?: BinaryMessageHandler<TServerMsg, TUser>
  private _connectHandler?: ConnectHandler<TServerMsg, TUser>
  private _closeHandler?: CloseHandler<TServerMsg, TUser>
  private _errorHandler?: ErrorHandler<TServerMsg, TUser>
  private _serverMessageSchema?: z.ZodType<TServerMsg>

  public constructor(
    private readonly path: TPath,
    private readonly server?: Server,
  ) {}

  /**
   * Define server message schema for type-safe send/publish
   * The schema will be used for type generation and validation
   */
  public serverMessages<T extends z.ZodType>(
    schema: T,
  ): WebSocketRouteBuilder<TPath, TParams, z.infer<T>, TUser> {
    const builder = this as unknown as WebSocketRouteBuilder<
      TPath,
      TParams,
      z.infer<T>,
      TUser
    >
    builder._serverMessageSchema = schema as z.ZodType<z.infer<T>>
    return builder
  }

  /**
   * Add authentication to this WebSocket route
   * Auth is checked during the upgrade request
   */
  public authenticate<TNewUser>(
    authFn: WebSocketAuthFn<TNewUser>,
  ): WebSocketRouteBuilder<TPath, TParams, TServerMsg, TNewUser> {
    this._authFn = authFn as unknown as WebSocketAuthFn<TUser>
    return this as unknown as WebSocketRouteBuilder<
      TPath,
      TParams,
      TServerMsg,
      TNewUser
    >
  }

  /**
   * Register a handler for a specific message type
   * Messages are validated against the provided Zod schema
   */
  public on<TSchema extends z.ZodType>(
    type: string,
    schema: TSchema,
    handler: MessageHandler<z.infer<TSchema>, TServerMsg, TUser>,
  ): WebSocketRouteBuilder<TPath, TParams, TServerMsg, TUser> {
    this._messageHandlers.push({
      type,
      schema,
      handler: handler as MessageHandler<unknown, unknown, unknown>,
    })
    return this
  }

  /**
   * Register a handler for binary messages
   */
  public onBinary(
    handler: BinaryMessageHandler<TServerMsg, TUser>,
  ): WebSocketRouteBuilder<TPath, TParams, TServerMsg, TUser> {
    this._binaryHandler = handler
    return this
  }

  /**
   * Register a handler for connection open
   */
  public onConnect(
    handler: ConnectHandler<TServerMsg, TUser>,
  ): WebSocketRouteBuilder<TPath, TParams, TServerMsg, TUser> {
    this._connectHandler = handler
    return this
  }

  /**
   * Register a handler for connection close
   */
  public onClose(
    handler: CloseHandler<TServerMsg, TUser>,
  ): WebSocketRouteBuilder<TPath, TParams, TServerMsg, TUser> {
    this._closeHandler = handler
    return this
  }

  /**
   * Register a handler for errors (validation failures, handler exceptions)
   */
  public onError(
    handler: ErrorHandler<TServerMsg, TUser>,
  ): WebSocketRouteBuilder<TPath, TParams, TServerMsg, TUser> {
    this._errorHandler = handler
    return this
  }

  /**
   * Build and register the WebSocket route
   */
  public build(): WebSocketRouteDefinition<TServerMsg, TUser> {
    const definition: WebSocketRouteDefinition<TServerMsg, TUser> = {
      path: this.path,
      authFn: this._authFn,
      messageHandlers: this._messageHandlers,
      binaryHandler: this._binaryHandler,
      connectHandler: this._connectHandler,
      closeHandler: this._closeHandler,
      errorHandler: this._errorHandler,
      serverMessageSchema: this._serverMessageSchema,
    }

    // If server is provided, register to local registry
    // Otherwise, register to global registry
    if (this.server) {
      if (!this.server._wsRouteRegistry) {
        this.server._wsRouteRegistry = new WebSocketRouteRegistry()
      }
      this.server._wsRouteRegistry.register(
        definition as WebSocketRouteDefinition<unknown, unknown>,
      )
    } else {
      webSocketRouteRegistry.register(
        definition as WebSocketRouteDefinition<unknown, unknown>,
      )
    }

    return definition
  }
}

/**
 * Create a new WebSocket route
 *
 * @param path - WebSocket route path with optional parameters (e.g., "/chat/:roomId")
 * @param server - Optional server instance to register the route to.
 *                 If provided, the route is registered to the server's local registry.
 *                 If not provided, the route is registered to the global registry.
 *
 * @example
 * ```typescript
 * // Global registration (works with any server)
 * createWebSocketRoute("/api/chat")
 *   .serverMessages<ServerMessage>()
 *   .on("chat", ChatSchema, (ws, data, ctx) => {
 *     ws.publish("room:general", { type: "message", text: data.text })
 *   })
 *   .build()
 *
 * // Server-specific registration
 * const server = createServer({ port: 3000 })
 * createWebSocketRoute("/api/chat", server)
 *   .on("chat", ChatSchema, handler)
 *   .build()
 * ```
 */
export function createWebSocketRoute<TPath extends string>(
  path: TPath,
  server?: Server,
): WebSocketRouteBuilder<TPath> {
  return new WebSocketRouteBuilder(path, server)
}
