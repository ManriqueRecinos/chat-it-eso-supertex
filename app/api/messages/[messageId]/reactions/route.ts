import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import { generateId } from "@/lib/utils/generate-id"

export async function POST(request: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("userId")?.value
    const { messageId } = await params

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { emoji } = body as { emoji?: string }

    if (!emoji) {
      return NextResponse.json({ error: "Emoji is required" }, { status: 400 })
    }

    // Verificar que el mensaje existe y pertenece a un chat donde el usuario participa
    const messages = await sql`
      SELECT m."chatId" FROM messages m WHERE m.id = ${messageId}
    `

    if (messages.length === 0) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    const chatId = (messages[0] as { chatId: string }).chatId

    const participant = await sql`
      SELECT 1 FROM chat_participants 
      WHERE "chatId" = ${chatId} AND "userId" = ${userId}
    `

    if (participant.length === 0) {
      return NextResponse.json({ error: "Not a participant" }, { status: 403 })
    }

    // Toggle: si ya existe la reacción con ese emoji para este usuario, la eliminamos; si no, la creamos
    const existing = await sql`
      SELECT id FROM message_reactions
      WHERE "messageId" = ${messageId} AND "userId" = ${userId} AND emoji = ${emoji}
    `

    if (existing.length > 0) {
      await sql`
        DELETE FROM message_reactions WHERE id = ${existing[0].id}
      `
    } else {
      await sql`
        INSERT INTO message_reactions (id, "messageId", "userId", emoji, "createdAt")
        VALUES (${generateId()}, ${messageId}, ${userId}, ${emoji}, NOW())
      `
    }

    // Devolver reacciones actualizadas del mensaje
    const reactions = await sql`
      SELECT r.id, r.emoji, r."userId", u.username
      FROM message_reactions r
      JOIN users u ON u.id = r."userId"
      WHERE r."messageId" = ${messageId}
      ORDER BY r."createdAt" ASC
    `

    return NextResponse.json(reactions)
  } catch (error) {
    console.error("Error toggling reaction:", error)
    return NextResponse.json({ error: "Failed to toggle reaction" }, { status: 500 })
  }
}
