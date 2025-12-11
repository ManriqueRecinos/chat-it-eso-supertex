"use client"

import { useEffect, useRef, useState, useCallback } from "react"

export function useWebSocket(userId: string) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    // Use the WebSocket API route
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const wsUrl = `${protocol}//${window.location.host}/api/websocket?userId=${userId}`

    // For development, we'll use a polling-based approach instead
    // since the v0 preview doesn't support true WebSockets
    const eventSource = new EventSource(`/api/sse?userId=${userId}`)

    eventSource.onopen = () => {
      setIsConnected(true)
      reconnectAttempts.current = 0
    }

    eventSource.onmessage = (event) => {
      setLastMessage(event.data)
    }

    eventSource.onerror = () => {
      eventSource.close()
      setIsConnected(false)

      // Attempt to reconnect
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++
        reconnectTimeoutRef.current = setTimeout(
          () => {
            connect()
          },
          Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000),
        )
      }
    }

    return eventSource
  }, [userId])

  useEffect(() => {
    const eventSource = connect()

    return () => {
      eventSource.close()
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connect])

  const sendMessage = useCallback((message: string) => {
    // Send message via POST request since we're using SSE for receiving
    fetch("/api/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: message,
    }).catch(console.error)
  }, [])

  return {
    isConnected,
    lastMessage,
    sendMessage,
  }
}
