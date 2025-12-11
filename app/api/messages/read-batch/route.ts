import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import { generateId } from "@/lib/utils/generate-id"

// Marca un conjunto de mensajes como leídos por el usuario actual
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("userId")?.value

    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const { chatId, messageIds } = body || {}

    if (!chatId || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: "chatId y messageIds son requeridos" }, { status: 400 })
    }

    // Verificar que el usuario es participante del chat
    const participant = await sql`
      SELECT * FROM chat_participants
      WHERE "chatId" = ${chatId} AND "userId" = ${userId}
    `

    if (participant.length === 0) {
      return NextResponse.json({ error: "No eres participante de este chat" }, { status: 403 })
    }

    // Insertar lecturas solo si no existen aún
    for (const messageId of messageIds as string[]) {
      await sql`
        INSERT INTO message_reads (id, "messageId", "userId", "readAt")
        SELECT ${generateId()}, ${messageId}, ${userId}, NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM message_reads
          WHERE "messageId" = ${messageId} AND "userId" = ${userId}
        )
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error marcando mensajes como leídos:", error)
    return NextResponse.json({ error: "Error al marcar mensajes como leídos" }, { status: 500 })
  }
}
