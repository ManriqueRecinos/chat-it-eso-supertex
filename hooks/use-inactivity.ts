"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { useRouter } from "next/navigation"

interface UseInactivityOptions {
  timeoutMs?: number // Tiempo de inactividad antes de cerrar sesión (default: 30 min)
  warningMs?: number // Tiempo antes del cierre para mostrar advertencia (default: 2 min)
  onLogout?: () => void
  onWarning?: () => void
}

export function useInactivity({
  timeoutMs = 30 * 60 * 1000, // 30 minutos
  warningMs = 2 * 60 * 1000,  // 2 minutos antes
  onLogout,
  onWarning,
}: UseInactivityOptions = {}) {
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [remainingTime, setRemainingTime] = useState(0)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  const logout = useCallback(async () => {
    // Limpiar timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    
    setShowWarning(false)

    // Llamar callback personalizado si existe
    if (onLogout) {
      onLogout()
    }

    // Cerrar sesión eliminando la cookie
    try {
      await fetch("/api/users", {
        method: "DELETE",
      })
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
    }

    // Redirigir al login
    router.push("/login")
  }, [onLogout, router])

  const resetTimer = useCallback(() => {
    // Limpiar timers existentes
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    
    setShowWarning(false)

    // Timer para mostrar advertencia (2 min antes del cierre)
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true)
      setRemainingTime(Math.floor(warningMs / 1000))
      
      if (onWarning) {
        onWarning()
      }

      // Iniciar countdown
      countdownRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }, timeoutMs - warningMs)

    // Timer para cerrar sesión
    timeoutRef.current = setTimeout(() => {
      logout()
    }, timeoutMs)
  }, [timeoutMs, warningMs, logout, onWarning])

  const dismissWarning = useCallback(() => {
    // El usuario interactuó, resetear todo
    resetTimer()
  }, [resetTimer])

  useEffect(() => {
    // Eventos que indican actividad del usuario
    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "wheel",
    ]

    // Throttle para no resetear el timer en cada pequeño movimiento
    let lastActivity = Date.now()
    const throttleMs = 1000 // Solo resetear cada segundo máximo

    const handleActivity = () => {
      const now = Date.now()
      if (now - lastActivity > throttleMs) {
        lastActivity = now
        resetTimer()
      }
    }

    // Agregar listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    // Iniciar timer inicial
    resetTimer()

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity)
      })
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [resetTimer])

  return {
    showWarning,
    remainingTime,
    dismissWarning,
    logout,
  }
}
