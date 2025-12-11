
import { Server as NetServer } from "http"
import { NextApiRequest } from "next"
import { Server as ServerIO } from "socket.io"

export const config = {
    api: {
        bodyParser: false,
    },
}

const ioHandler = (req: NextApiRequest, res: any) => {
    if (!res.socket.server.io) {
        const path = "/api/socket/io"
        const httpServer: NetServer = res.socket.server as any
        const io = new ServerIO(httpServer, {
            path: path,
            addTrailingSlash: false,
            cors: {
                origin: "*", // Permitir cualquier origen
                methods: ["GET", "POST"],
                credentials: true
            },
            // Polling primero para compatibilidad con Vercel
            transports: ["polling", "websocket"],
            allowEIO3: true, // Compatibilidad con versiones antiguas
            // Configuración para entornos serverless
            pingTimeout: 60000,
            pingInterval: 25000,
        })
        res.socket.server.io = io

        io.on("connection", (socket) => {
            console.log("Socket connected:", socket.id)

            // Unirse a un room personal basado en el userId para recibir notificaciones directas
            socket.on("register_user", (userId: string) => {
                console.log(`[SERVER] Socket ${socket.id} registering user: ${userId}`)
                socket.join(`user_${userId}`)
            })

            socket.on("join_chat", (chatId) => {
                console.log(`[SERVER] Socket ${socket.id} joining chat: ${chatId}`)
                socket.join(chatId)
                console.log(`[SERVER] Socket ${socket.id} joined chat: ${chatId}. Rooms:`, socket.rooms)
            })

            socket.on("leave_chat", (chatId) => {
                socket.leave(chatId)
                console.log(`Socket ${socket.id} left chat: ${chatId}`)
            })

            socket.on("send_message", (data) => {
                console.log(`[SERVER] Received message for chat ${data.chatId}`)
                const { chatId, message } = data
                io.to(chatId).emit("message", {
                    chatId,
                    message,
                })
                console.log(`[SERVER] Emitted message to room ${chatId}`)
            })

            socket.on("typing", (data) => {
                const { chatId, userId, username } = data
                socket.to(chatId).emit("typing", {
                    chatId,
                    userId,
                    username,
                })
            })

            socket.on("stop_typing", (data) => {
                const { chatId, userId, username } = data
                socket.to(chatId).emit("stop_typing", {
                    chatId,
                    userId,
                    username,
                })
            })

            socket.on("user_joined", (data) => {
                console.log("[SERVER] User joined event received", data)
                const { chatId, user } = data
                
                // Emitir a todos en el chat incluyendo al que agregó
                console.log(`[SERVER] Emitting user_joined to room: ${chatId}`)
                io.to(chatId).emit("user_joined", data)
                
                // Notificar al usuario agregado directamente para que actualice su lista de chats
                if (user?.userId) {
                    const userRoom = `user_${user.userId}`
                    console.log(`[SERVER] Notifying user ${user.userId} via room ${userRoom} about being added to chat ${chatId}`)
                    console.log(`[SERVER] Rooms in server:`, io.sockets.adapter.rooms)
                    
                    // Emitir al room del usuario
                    const emitted = io.to(userRoom).emit("added_to_chat", { 
                        chatId, 
                        user,
                        message: data.message 
                    })
                    console.log(`[SERVER] Event emitted to ${userRoom}:`, emitted)
                }
            })

            socket.on("user_left", (data) => {
                console.log("[SERVER] User left event received", data)
                const { chatId } = data
                // Emitir a todos en el chat
                io.to(chatId).emit("user_left", data)
            })

            // Evento para actualizar mensaje (edición)
            socket.on("message_updated", (data) => {
                console.log("[SERVER] Message updated event received", data)
                const { chatId, message } = data
                io.to(chatId).emit("message_updated", message)
            })

            // Evento para eliminar mensaje
            socket.on("message_deleted", (data) => {
                console.log("[SERVER] Message deleted event received", data)
                const { chatId, messageId } = data
                io.to(chatId).emit("message_deleted", { chatId, messageId })
            })

            // Cuando un usuario lee mensajes
            socket.on("messages_read", (data) => {
                console.log(`[SERVER] Messages read in chat ${data.chatId} by ${data.userId}`)
                const { chatId, messageIds, userId, username } = data
                // Notificar a todos en el chat (excepto al que leyó)
                socket.to(chatId).emit("messages_read", {
                    chatId,
                    messageIds,
                    userId,
                    username,
                    readAt: new Date().toISOString(),
                })
            })

            socket.on("disconnect", () => {
                console.log("Socket disconnected:", socket.id)
            })
        })
    } else {
        console.log("Socket.io already running")
    }
    res.end()
}

export default ioHandler
