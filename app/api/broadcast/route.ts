import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

// Simple in-memory pub/sub (in production, use Redis)
const subscribers = new Map<string, Set<(message: string) => void>>()

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("userId")?.value

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { type, chatId, message, ...rest } = body

    // Create the message string to broadcast
    const broadcastMessage = JSON.stringify({ type, chatId, message, ...rest })

    // Broadcast to all connected clients in the chat
    // This is a simplified implementation - in production use Redis
    const { clients } = await import("../sse/route")

    if (chatId) {
      // Broadcast to all clients (simplified - in production filter by chat participants)
      clients.forEach((clientSet, participantId) => {
        clientSet.forEach((controller) => {
          try {
            controller.enqueue(`data: ${broadcastMessage}\n\n`)
          } catch {
            // Client disconnected
          }
        })
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Broadcast error:", error)
    return NextResponse.json({ error: "Broadcast failed" }, { status: 500 })
  }
}
