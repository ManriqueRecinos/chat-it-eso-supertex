import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"

// Obtener mensajes fijados de un chat
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

    const pinnedMessages = await sql`
      SELECT 
        pm.id as pin_id,
        pm.pinned_at,
        pm.pinned_by,
        u_pinner.username as pinned_by_username,
        m.id,
        m.content,
        m."sentAt",
        m."senderId",
        u_sender.username as "senderUsername",
        u_sender."profilePhotoUrl" as "senderProfilePhotoUrl"
      FROM pinned_messages pm
      JOIN messages m ON m.id = pm.message_id
      JOIN users u_pinner ON u_pinner.id = pm.pinned_by
      JOIN users u_sender ON u_sender.id = m."senderId"
      WHERE pm.chat_id = ${chatId}
      ORDER BY pm.pinned_at DESC
    `

    return NextResponse.json(pinnedMessages)
  } catch (error) {
    console.error("Error getting pinned messages:", error)
    return NextResponse.json({ error: "Failed to get pinned messages" }, { status: 500 })
  }
}

// Fijar un mensaje
export async function POST(
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
    const body = await request.json()
    const { messageId } = body

    if (!messageId) {
      return NextResponse.json({ error: "messageId required" }, { status: 400 })
    }

    // Verificar que el mensaje pertenece al chat
    const messageCheck = await sql`
      SELECT id FROM messages WHERE id = ${messageId} AND "chatId" = ${chatId}
    `

    if (messageCheck.length === 0) {
      return NextResponse.json({ error: "Message not found in this chat" }, { status: 404 })
    }

    // Insertar mensaje fijado
    const result = await sql`
      INSERT INTO pinned_messages (chat_id, message_id, pinned_by)
      VALUES (${chatId}, ${messageId}, ${userId})
      ON CONFLICT (chat_id, message_id) DO NOTHING
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Message already pinned" }, { status: 400 })
    }

    return NextResponse.json({ success: true, pinned: result[0] })
  } catch (error) {
    console.error("Error pinning message:", error)
    return NextResponse.json({ error: "Failed to pin message" }, { status: 500 })
  }
}

// Desfijar un mensaje
export async function DELETE(
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
    const messageId = searchParams.get("messageId")

    if (!messageId) {
      return NextResponse.json({ error: "messageId required" }, { status: 400 })
    }

    await sql`
      DELETE FROM pinned_messages 
      WHERE chat_id = ${chatId} AND message_id = ${messageId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error unpinning message:", error)
    return NextResponse.json({ error: "Failed to unpin message" }, { status: 500 })
  }
}
