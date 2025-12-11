"use client"

import { useEffect, useState, useCallback } from "react"
import { socket } from "@/lib/socket"

export const useSocket = () => {
    const [isConnected, setIsConnected] = useState(false)
    const [reconnectAttempt, setReconnectAttempt] = useState(0)

    const manualReconnect = useCallback(() => {
        if (!socket.connected) {
            console.log("[SOCKET] Manual reconnect triggered")
            socket.connect()
        }
    }, [])

    useEffect(() => {
        // Initialize socket connection
        if (!socket.connected) {
            socket.connect()
        }

        const onConnect = () => {
            console.log("[SOCKET] Connected")
            setIsConnected(true)
            setReconnectAttempt(0)
        }

        const onDisconnect = (reason: string) => {
            console.log("[SOCKET] Disconnected:", reason)
            setIsConnected(false)
            setReconnectAttempt(1)
        }

        const onConnectError = (error: Error) => {
            console.log("[SOCKET] Connection error:", error.message)
            setIsConnected(false)
            setReconnectAttempt(prev => prev === 0 ? 1 : prev)
        }

        const onReconnectAttempt = (attempt: number) => {
            console.log("[SOCKET] Reconnection attempt:", attempt)
            setReconnectAttempt(attempt)
        }

        const onReconnect = () => {
            console.log("[SOCKET] Reconnected successfully")
            setIsConnected(true)
            setReconnectAttempt(0)
        }

        const onReconnectError = (error: Error) => {
            console.log("[SOCKET] Reconnection error:", error.message)
        }

        const onReconnectFailed = () => {
            console.log("[SOCKET] Reconnection failed after all attempts")
        }

        socket.on("connect", onConnect)
        socket.on("disconnect", onDisconnect)
        socket.on("connect_error", onConnectError)
        socket.io.on("reconnect_attempt", onReconnectAttempt)
        socket.io.on("reconnect", onReconnect)
        socket.io.on("reconnect_error", onReconnectError)
        socket.io.on("reconnect_failed", onReconnectFailed)

        // Verificar estado inicial
        setIsConnected(socket.connected)

        return () => {
            socket.off("connect", onConnect)
            socket.off("disconnect", onDisconnect)
            socket.off("connect_error", onConnectError)
            socket.io.off("reconnect_attempt", onReconnectAttempt)
            socket.io.off("reconnect", onReconnect)
            socket.io.off("reconnect_error", onReconnectError)
            socket.io.off("reconnect_failed", onReconnectFailed)
        }
    }, [])

    return { socket, isConnected, reconnectAttempt, manualReconnect }
}
