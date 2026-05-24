import { useEffect, useRef, useState } from "react"
import { type ConnectionStatus, WebSocketClient } from "../lib/websocket-client"

// WS event message shape (matches backend broadcast)
export interface LiveFeedEvent {
  type: "event"
  id: string
  endpointId: string
  method: string
  sourceIp: string | null
  signatureValid: boolean | null
  receivedAt: string
}

type WsClientMessage = { type: "ping" }
type WsServerMessage = LiveFeedEvent

export function useLiveFeed() {
  const [events, setEvents] = useState<LiveFeedEvent[]>([])
  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const clientRef = useRef<WebSocketClient<
    WsClientMessage,
    WsServerMessage
  > | null>(null)

  useEffect(() => {
    const backendOrigin =
      import.meta.env.VITE_API_URL ?? "http://localhost:3001"
    const wsUrl = `${backendOrigin.replace(/^http/, "ws")}/ws/events`

    const client = new WebSocketClient<WsClientMessage, WsServerMessage>({
      autoReconnect: true,
      maxReconnectAttempts: 10,
    })
    clientRef.current = client

    const unsubStatus = client.onConnectionChange(setStatus)
    const unsubEvent = client.on("event", (msg) => {
      setEvents((prev) => [msg, ...prev].slice(0, 200))
    })

    client.connect(wsUrl, "")

    return () => {
      unsubStatus()
      unsubEvent()
      client.disconnect()
    }
  }, [])

  const clear = () => setEvents([])

  return { events, status, clear }
}
