import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import { generateId } from "@/lib/utils/generate-id"

// Join a chat
export async function POST(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  console.log("Join endpoint hit")
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("userId")?.value

    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { chatId } = await params

    // Check if chat exists
    const chats = await sql`SELECT * FROM chats WHERE id = ${chatId}`

    if (chats.length === 0) {
      return NextResponse.json({ error: "Chat no encontrado" }, { status: 404 })
    }

    // Check if already a participant
    const existing = await sql`
      SELECT * FROM chat_participants 
      WHERE "userId" = ${userId} AND "chatId" = ${chatId}
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "Ya eres participante de este chat" }, { status: 400 })
    }

    // Get user info
    const users = await sql`SELECT * FROM users WHERE id = ${userId}`
    const user = users[0]

    // Add as participant
    const joinedAt = new Date()
    await sql`
      INSERT INTO chat_participants (id, "userId", "chatId", "joinedAt")
      VALUES (${generateId()}, ${userId}, ${chatId}, ${joinedAt})
    `

    // Create system message
    await sql`
      INSERT INTO system_messages(id, "chatId", type, "userId", "createdAt")
      VALUES(${generateId()}, ${chatId}, 'user_joined', ${userId}, ${joinedAt})
    `

    // Return success and data so client can emit socket event
    return NextResponse.json({
      success: true,
      joinedAt: joinedAt.toISOString(),
      username: user.username,
      // Data needed for user_joined socket event
      socketEvent: {
        type: "user_joined",
        chatId,
        message: {
          id: generateId(),
          type: "system",
          eventType: "user_joined",
          sentAt: joinedAt.toISOString(),
          systemUser: {
            id: user.id,
            username: user.username
          }
        },
        user: {
          userId: user.id,
          username: user.username,
          profilePhotoUrl: user.profilePhotoUrl,
          joinedAt: joinedAt.toISOString()
        }
      }
    })
  } catch (error) {
    console.error("Error joining chat:", error)
    return NextResponse.json({ error: "Error al unirse al chat" }, { status: 500 })
  }
}
