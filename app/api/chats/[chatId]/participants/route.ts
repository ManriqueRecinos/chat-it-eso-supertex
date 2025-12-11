import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import { generateId } from "@/lib/utils/generate-id"

export async function GET(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("userId")?.value
    const { chatId } = await params

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const participants = await sql`
      SELECT 
        cp."userId",
        u.username,
        u."profilePhotoUrl"
      FROM chat_participants cp
      JOIN users u ON u.id = cp."userId"
      WHERE cp."chatId" = ${chatId}
    `

    return NextResponse.json(participants)
  } catch (error) {
    console.error("Error fetching participants:", error)
    return NextResponse.json({ error: "Failed to fetch participants" }, { status: 500 })
  }
}

// Solo el admin puede eliminar participantes de un chat de grupo
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const cookieStore = await cookies()
    const currentUserId = cookieStore.get("userId")?.value
    const { chatId } = await params

    if (!currentUserId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const userIdToRemove = body?.userId?.trim?.()

    if (!userIdToRemove) {
      return NextResponse.json({ error: "ID de usuario requerido" }, { status: 400 })
    }

    // Verificar chat y admin
    const chats = await sql`SELECT * FROM chats WHERE id = ${chatId}`
    if (chats.length === 0) {
      return NextResponse.json({ error: "Chat no encontrado" }, { status: 404 })
    }

    const chat = chats[0] as { id: string; type: string; adminId: string }

    if (chat.type !== "GROUP") {
      return NextResponse.json({ error: "Solo los chats de grupo permiten eliminar participantes" }, { status: 400 })
    }

    if (chat.adminId !== currentUserId) {
      return NextResponse.json({ error: "Solo el propietario del grupo puede eliminar participantes" }, { status: 403 })
    }

    if (userIdToRemove === chat.adminId) {
      return NextResponse.json({ error: "El propietario del grupo no puede ser eliminado" }, { status: 400 })
    }

    // Verificar que el usuario exista y sea participante
    const users = await sql`
      SELECT id, username, "profilePhotoUrl" FROM users
      WHERE id = ${userIdToRemove}
    `

    if (users.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    const user = users[0] as { id: string; username: string; profilePhotoUrl: string | null }

    // Cargar datos del admin para el mensaje de sistema
    const adminRows = await sql`
      SELECT id, username FROM users WHERE id = ${currentUserId}
    `
    const admin = adminRows[0] as { id: string; username: string }

    const existing = await sql`
      SELECT * FROM chat_participants
      WHERE "userId" = ${user.id} AND "chatId" = ${chatId}
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: "Este usuario no es participante de este chat" }, { status: 400 })
    }

    // Eliminar de participantes
    await sql`
      DELETE FROM chat_participants
      WHERE "userId" = ${user.id} AND "chatId" = ${chatId}
    `

    const leftAt = new Date()
    const systemMessageId = generateId()

    // Mensaje de sistema tipo user_removed_by_admin
    await sql`
      INSERT INTO system_messages(id, "chatId", type, "userId", "createdAt")
      VALUES(${systemMessageId}, ${chatId}, 'user_removed_by_admin', ${user.id}, ${leftAt})
    `

    const participant = {
      userId: user.id,
      username: user.username,
      profilePhotoUrl: user.profilePhotoUrl,
      joinedAt: leftAt.toISOString(),
    }

    const message = {
      id: systemMessageId,
      type: "system" as const,
      sentAt: leftAt.toISOString(),
      eventType: "user_removed_by_admin" as const,
      systemUser: {
        id: user.id,
        username: user.username,
      },
      adminUser: {
        id: admin.id,
        username: admin.username,
      },
    }

    const socketEvent = {
      type: "user_left" as const,
      chatId,
      message,
      user: participant,
    }

    return NextResponse.json({
      success: true,
      participant,
      message,
      socketEvent,
    })
  } catch (error) {
    console.error("Error eliminando participante:", error)
    return NextResponse.json({ error: "Error al eliminar participante" }, { status: 500 })
  }
}

// Solo el admin puede agregar participantes a un chat de grupo
export async function POST(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const cookieStore = await cookies()
    const currentUserId = cookieStore.get("userId")?.value
    const { chatId } = await params

    if (!currentUserId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const username = body?.username?.trim?.()

    if (!username) {
      return NextResponse.json({ error: "Nombre de usuario requerido" }, { status: 400 })
    }

    // Verificar chat y admin
    const chats = await sql`SELECT * FROM chats WHERE id = ${chatId}`
    if (chats.length === 0) {
      return NextResponse.json({ error: "Chat no encontrado" }, { status: 404 })
    }

    const chat = chats[0] as { id: string; type: string; adminId: string }

    if (chat.type !== "GROUP") {
      return NextResponse.json({ error: "Solo los chats de grupo permiten agregar participantes" }, { status: 400 })
    }

    if (chat.adminId !== currentUserId) {
      return NextResponse.json({ error: "Solo el propietario del grupo puede agregar participantes" }, { status: 403 })
    }

    // Buscar usuario por username (case-insensitive)
    const users = await sql`
      SELECT id, username, "profilePhotoUrl" FROM users
      WHERE LOWER(username) = LOWER(${username})
    `

    if (users.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    const user = users[0] as { id: string; username: string; profilePhotoUrl: string | null }

    // Cargar datos del admin para el mensaje de sistema
    const adminRows = await sql`
      SELECT id, username FROM users WHERE id = ${currentUserId}
    `
    const admin = adminRows[0] as { id: string; username: string }

    // Verificar si ya es participante
    const existing = await sql`
      SELECT * FROM chat_participants
      WHERE "userId" = ${user.id} AND "chatId" = ${chatId}
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "Este usuario ya es participante de este chat" }, { status: 400 })
    }

    const joinedAt = new Date()

    // Agregar como participante
    await sql`
      INSERT INTO chat_participants (id, "userId", "chatId", "joinedAt")
      VALUES (${generateId()}, ${user.id}, ${chatId}, ${joinedAt})
    `

    // Crear mensaje de sistema para "user_joined_by_admin"
    const systemMessageId = generateId()

    await sql`
      INSERT INTO system_messages(id, "chatId", type, "userId", "createdAt")
      VALUES(${systemMessageId}, ${chatId}, 'user_joined_by_admin', ${user.id}, ${joinedAt})
    `

    const participant = {
      userId: user.id,
      username: user.username,
      profilePhotoUrl: user.profilePhotoUrl,
      joinedAt: joinedAt.toISOString(),
    }

    const message = {
      id: systemMessageId,
      type: "system" as const,
      sentAt: joinedAt.toISOString(),
      eventType: "user_joined_by_admin" as const,
      systemUser: {
        id: user.id,
        username: user.username,
      },
      adminUser: {
        id: admin.id,
        username: admin.username,
      },
    }

    // Datos para emitir por socket en el cliente
    const socketEvent = {
      type: "user_joined" as const,
      chatId,
      message,
      user: participant,
    }

    return NextResponse.json({
      success: true,
      participant,
      message,
      socketEvent,
    })
  } catch (error) {
    console.error("Error agregando participante:", error)
    return NextResponse.json({ error: "Error al agregar participante" }, { status: 500 })
  }
}
