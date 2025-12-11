import { io as ClientIO } from "socket.io-client"

// Determinar la URL del socket dinámicamente
const getSocketUrl = () => {
    // En producción (Vercel), usar la URL del sitio
    if (process.env.NEXT_PUBLIC_SITE_URL) {
        return process.env.NEXT_PUBLIC_SITE_URL
    }
    
    // En desarrollo o cliente, usar la URL actual del navegador
    if (typeof window !== "undefined") {
        return window.location.origin
    }
    
    // Fallback para desarrollo local
    return "http://localhost:3000"
}

export const socket = ClientIO(getSocketUrl(), {
    path: "/api/socket/io",
    autoConnect: false,
    // Configuración de reconexión automática
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    // Transports para mejor compatibilidad
    transports: ["websocket", "polling"],
})
