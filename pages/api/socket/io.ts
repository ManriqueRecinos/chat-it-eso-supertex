
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
        })
        res.socket.server.io = io

        io.on("connection", (socket) => {
            console.log("Socket connected:", socket.id)

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
                console.log("User joined event received", data)
                const { chatId } = data
                io.to(chatId).emit("user_joined", data)
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
