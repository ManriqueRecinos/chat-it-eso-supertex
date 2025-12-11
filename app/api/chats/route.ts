import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import { generateChatId } from "@/lib/utils/generate-id"

// Get all chats for current user
export async function GET() {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("userId")?.value

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Determinar si el usuario es admin
    const roles = await sql`
      SELECT r.name as role
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = ${userId}
    `

    const roleName = roles[0]?.role as string | null
    const isAdmin = roleName === "admin"

    const chats = isAdmin
      ? await sql`
          SELECT 
            c.*,
            (
              SELECT json_build_object(
                'id', m.id,
                'content', m.content,
                'sentAt', m."sentAt",
                'senderId', m."senderId",
                'senderUsername', sender.username
              )
              FROM messages m
              JOIN users sender ON sender.id = m."senderId"
              WHERE m."chatId" = c.id
              ORDER BY m."sentAt" DESC
              LIMIT 1
            ) as "lastMessage"
          FROM chats c
          ORDER BY (
            SELECT MAX("sentAt") FROM messages WHERE "chatId" = c.id
          ) DESC NULLS LAST
        `
      : await sql`
          SELECT 
            c.*,
            (
              SELECT json_build_object(
                'id', m.id,
                'content', m.content,
                'sentAt', m."sentAt",
                'senderId', m."senderId",
                'senderUsername', sender.username
              )
              FROM messages m
              JOIN users sender ON sender.id = m."senderId"
              WHERE m."chatId" = c.id
              ORDER BY m."sentAt" DESC
              LIMIT 1
            ) as "lastMessage"
          FROM chats c
          JOIN chat_participants cp ON cp."chatId" = c.id
          WHERE cp."userId" = ${userId}
          ORDER BY (
            SELECT MAX("sentAt") FROM messages WHERE "chatId" = c.id
          ) DESC NULLS LAST
        `

    // Get participants for each chat
    const chatsWithParticipants = await Promise.all(
      chats.map(async (chat) => {
        const participants = await sql`
          SELECT 
            cp.*,
            u.username,
            u."profilePhotoUrl"
          FROM chat_participants cp
          JOIN users u ON u.id = cp."userId"
          WHERE cp."chatId" = ${chat.id}
        `
        return { ...chat, participants }
      }),
    )

    return NextResponse.json(chatsWithParticipants)
  } catch (error) {
    console.error("Error fetching chats:", error)
    return NextResponse.json({ error: "Failed to fetch chats" }, { status: 500 })
  }
}

// Create a new chat
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("userId")?.value

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, type = "GROUP", participantUsername } = body as {
      name?: string | null
      type?: string
      participantUsername?: string | null
    }

    // Generate unique chat ID
    let chatId = generateChatId()
    let attempts = 0

    while (attempts < 10) {
      const existing = await sql`SELECT id FROM chats WHERE id = ${chatId}`
      if (existing.length === 0) break
      chatId = generateChatId()
      attempts++
    }

    // Si se especifica participantUsername, crear chat individual directo
    if (participantUsername && participantUsername.trim().length > 0) {
      const normalizedUsername = participantUsername.trim()

      const targetUsers = await sql`
        SELECT id, username, "profilePhotoUrl" FROM users
        WHERE LOWER(username) = LOWER(${normalizedUsername})
      `

      if (targetUsers.length === 0) {
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
      }

      const otherUser = targetUsers[0] as { id: string }

      const chat = await sql`
        INSERT INTO chats (id, type, name, "adminId", "createdAt")
        VALUES (${chatId}, 'INDIVIDUAL', NULL, ${userId}, NOW())
        RETURNING *
      `

      // Añadir creador y otro usuario como participantes
      await sql`
        INSERT INTO chat_participants (id, "userId", "chatId", "joinedAt")
        VALUES (${generateChatId()}, ${userId}, ${chatId}, NOW())
      `

      await sql`
        INSERT INTO chat_participants (id, "userId", "chatId", "joinedAt")
        VALUES (${generateChatId()}, ${otherUser.id}, ${chatId}, NOW())
      `

      const participants = await sql`
        SELECT 
          cp.*,
          u.username,
          u."profilePhotoUrl"
        FROM chat_participants cp
        JOIN users u ON u.id = cp."userId"
        WHERE cp."chatId" = ${chatId}
      `

      return NextResponse.json({ ...chat[0], participants })
    }

    // Caso por defecto: chat de grupo con nombre opcional
    const chat = await sql`
      INSERT INTO chats (id, type, name, "adminId", "createdAt")
      VALUES (${chatId}, ${type}, ${name || null}, ${userId}, NOW())
      RETURNING *
    `

    await sql`
      INSERT INTO chat_participants (id, "userId", "chatId", "joinedAt")
      VALUES (${generateChatId()}, ${userId}, ${chatId}, NOW())
    `

    const participants = await sql`
      SELECT 
        cp.*,
        u.username,
        u."profilePhotoUrl"
      FROM chat_participants cp
      JOIN users u ON u.id = cp."userId"
      WHERE cp."chatId" = ${chatId}
    `

    return NextResponse.json({ ...chat[0], participants })
  } catch (error) {
    console.error("Error creating chat:", error)
    return NextResponse.json({ error: "Failed to create chat" }, { status: 500 })
  }
}
