/**
 * Type-Safe WebSocket Client
 *
 * Generic WebSocket client with automatic reconnection, message queuing,
 * and type-safe message handling.
 */

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error"

export interface WebSocketClientOptions {
  /** Automatic reconnection enabled (default: true) */
  autoReconnect?: boolean
  /** Maximum reconnection attempts (default: 5) */
  maxReconnectAttempts?: number
  /** Initial reconnection delay in ms (default: 1000) */
  reconnectDelay?: number
  /** Maximum reconnection delay in ms (default: 30000) */
  maxReconnectDelay?: number
  /** Enable debug logging (default: false) */
  debug?: boolean
}

type MessageHandler<TMessage> = (message: TMessage) => void
type ConnectionHandler = (status: ConnectionStatus) => void
type Unsubscribe = () => void

/**
 * Type-safe WebSocket client with automatic reconnection
 */
export class WebSocketClient<TClientMessage, TServerMessage> {
  private ws: WebSocket | null = null
  private url: string = ""
  private token: string = ""
  private connectionStatus: ConnectionStatus = "disconnected"
  private reconnectAttempts: number = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private messageQueue: TClientMessage[] = []
  private messageHandlers: Map<string, Set<MessageHandler<TServerMessage>>> =
    new Map()
  private connectionHandlers: Set<ConnectionHandler> = new Set()
  private options: Required<WebSocketClientOptions>

  public constructor(options: WebSocketClientOptions = {}) {
    this.options = {
      autoReconnect: options.autoReconnect ?? true,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      reconnectDelay: options.reconnectDelay ?? 1000,
      maxReconnectDelay: options.maxReconnectDelay ?? 30000,
      debug: options.debug ?? false,
    }
  }

  /**
   * Connect to WebSocket server
   */
  public connect(url: string, token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.log("Already connected")
      return
    }

    this.url = url
    this.token = token
    this.setConnectionStatus("connecting")

    try {
      // Add token as query parameter for authentication
      const wsUrl = `${url}?token=${encodeURIComponent(token)}`
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = this.handleOpen.bind(this)
      this.ws.onmessage = this.handleMessage.bind(this)
      this.ws.onerror = this.handleError.bind(this)
      this.ws.onclose = this.handleClose.bind(this)

      this.log("Connecting to", url)
    } catch (error) {
      this.log("Connection error:", error)
      this.setConnectionStatus("error")
      this.scheduleReconnect()
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.log("Disconnecting")
    this.options.autoReconnect = false
    this.clearReconnectTimer()

    if (this.ws) {
      this.ws.close(1000, "Client disconnect")
      this.ws = null
    }

    this.setConnectionStatus("disconnected")
    this.messageQueue = []
  }

  /**
   * Send a message to the server
   */
  public send<T extends TClientMessage>(message: T): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const payload = JSON.stringify(message)
      this.ws.send(payload)
      this.log("Sent:", message)
    } else {
      this.log("Queuing message (not connected):", message)
      this.messageQueue.push(message)
    }
  }

  /**
   * Subscribe to messages of a specific type
   */
  public on(
    messageType: string,
    handler: MessageHandler<TServerMessage>,
  ): Unsubscribe {
    const handlers = this.messageHandlers.get(messageType) || new Set()
    handlers.add(handler)
    this.messageHandlers.set(messageType, handlers)

    // Return unsubscribe function
    return () => {
      const currentHandlers = this.messageHandlers.get(messageType)
      if (currentHandlers) {
        currentHandlers.delete(handler)
        if (currentHandlers.size === 0) {
          this.messageHandlers.delete(messageType)
        }
      }
    }
  }

  /**
   * Subscribe to connection status changes
   */
  public onConnectionChange(handler: ConnectionHandler): Unsubscribe {
    this.connectionHandlers.add(handler)

    // Call immediately with current status
    handler(this.connectionStatus)

    // Return unsubscribe function
    return () => {
      this.connectionHandlers.delete(handler)
    }
  }

  /**
   * Get current connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.connectionStatus === "connected"
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    this.log("Connected")
    this.setConnectionStatus("connected")
    this.reconnectAttempts = 0

    // Send queued messages
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      if (message) {
        this.send(message)
      }
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as TServerMessage & {
        type: string
      }
      this.log("Received:", message)

      // Call type-specific handlers
      const handlers = this.messageHandlers.get(message.type)
      if (handlers) {
        for (const handler of handlers) {
          handler(message)
        }
      }

      // Also call wildcard handlers
      const wildcardHandlers = this.messageHandlers.get("*")
      if (wildcardHandlers) {
        for (const handler of wildcardHandlers) {
          handler(message)
        }
      }
    } catch (error) {
      this.log("Error parsing message:", error)
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    this.log("WebSocket error:", event)
    this.setConnectionStatus("error")
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    this.log("Connection closed:", event.code, event.reason)
    this.ws = null

    if (event.code !== 1000) {
      // Abnormal closure
      this.setConnectionStatus("error")
      this.scheduleReconnect()
    } else {
      this.setConnectionStatus("disconnected")
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (!this.options.autoReconnect) {
      return
    }

    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.log("Max reconnect attempts reached")
      this.setConnectionStatus("error")
      return
    }

    this.clearReconnectTimer()

    // Exponential backoff
    const delay = Math.min(
      this.options.reconnectDelay * 2 ** this.reconnectAttempts,
      this.options.maxReconnectDelay,
    )

    this.log(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`,
    )

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect(this.url, this.token)
    }, delay)
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * Update connection status and notify handlers
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status
      for (const handler of this.connectionHandlers) {
        handler(status)
      }
    }
  }

  /**
   * Debug logging
   */
  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log("[WebSocketClient]", ...args)
    }
  }
}
