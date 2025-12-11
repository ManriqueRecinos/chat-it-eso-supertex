import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"

// Buscar mensajes en un chat
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("userId")?.value

    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { chatId } = await params
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")
    const limit = parseInt(searchParams.get("limit") || "20")

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 })
    }

    // Verificar que el usuario es participante del chat
    const participantCheck = await sql`
      SELECT id FROM chat_participants 
      WHERE "chatId" = ${chatId} AND "userId" = ${userId}
    `

    if (participantCheck.length === 0) {
      return NextResponse.json({ error: "Not a participant of this chat" }, { status: 403 })
    }

    // Buscar mensajes que contengan el texto
    const searchTerm = `%${query.toLowerCase()}%`
    const messages = await sql`
      SELECT 
        m.id,
        m.content,
        m."sentAt",
        m."senderId",
        m."editedAt",
        u.username as "senderUsername",
        u."profilePhotoUrl" as "senderProfilePhotoUrl"
      FROM messages m
      JOIN users u ON u.id = m."senderId"
      WHERE m."chatId" = ${chatId}
        AND m."deletedAt" IS NULL
        AND LOWER(m.content) LIKE ${searchTerm}
      ORDER BY m."sentAt" DESC
      LIMIT ${limit}
    `

    return NextResponse.json(messages)
  } catch (error) {
    console.error("Error searching messages:", error)
    return NextResponse.json({ error: "Failed to search messages" }, { status: 500 })
  }
}
