import type { NextRequest } from "next/server"

// In-memory store for connected clients (in production, use Redis)
const clients = new Map<string, Set<ReadableStreamDefaultController>>()
const messageQueue = new Map<string, string[]>()

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId")

  if (!userId) {
    return new Response("Missing userId", { status: 400 })
  }

  const stream = new ReadableStream({
    start(controller) {
      // Add this client to the connected clients
      if (!clients.has(userId)) {
        clients.set(userId, new Set())
      }
      clients.get(userId)!.add(controller)

      // Send any queued messages
      const queue = messageQueue.get(userId) || []
      queue.forEach((msg) => {
        controller.enqueue(`data: ${msg}\n\n`)
      })
      messageQueue.delete(userId)

      // Send initial connected message
      controller.enqueue(`data: ${JSON.stringify({ type: "connected" })}\n\n`)

      // Keep-alive ping every 30 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(`data: ${JSON.stringify({ type: "ping" })}\n\n`)
        } catch {
          clearInterval(pingInterval)
        }
      }, 30000)

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        clearInterval(pingInterval)
        clients.get(userId)?.delete(controller)
        if (clients.get(userId)?.size === 0) {
          clients.delete(userId)
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

// Export the clients map for use in broadcast
export { clients, messageQueue }
