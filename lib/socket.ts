import { io as ClientIO } from "socket.io-client"

export const socket = ClientIO(process.env.NEXT_PUBLIC_SITE_URL || "http://10.10.15.6:3000", {
    path: "/api/socket/io",
    autoConnect: false,
    // Configuración de reconexión automática
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
})
