import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import { generateId } from "@/lib/utils/generate-id"

// Get messages for a chat
export async function GET(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("userId")?.value
    const { chatId } = await params
    const { searchParams } = new URL(request.url)
    const before = searchParams.get("before") // ISO string de fecha/hora

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

    // Para usuarios normales, verificar participación y usar joinedAt.
    // Para admin, permitimos leer todos los mensajes del chat desde el inicio.
    let joinedAt: any

    if (isAdmin) {
      joinedAt = new Date(0).toISOString() // Epoch: sin filtro real por fecha de ingreso
    } else {
      const participant = await sql`
        SELECT * FROM chat_participants 
        WHERE "chatId" = ${chatId} AND "userId" = ${userId}
      `

      if (participant.length === 0) {
        return NextResponse.json({ error: "Not a participant" }, { status: 403 })
      }

      joinedAt = participant[0].joinedAt
    }

    // Get regular messages (filtered by joinedAt)
    const messages = before
      ? await sql`
      SELECT 
        m.*,
        'message' as type,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'profilePhotoUrl', u."profilePhotoUrl"
        ) as sender,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', mf.id,
                'fileUrl', mf."fileUrl",
                'fileType', mf."fileType"
              )
            )
            FROM media_files mf
            WHERE mf."messageId" = m.id
          ),
          '[]'
        ) as "mediaFiles",
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'userId', mr."userId",
                'username', ru.username,
                'readAt', mr."readAt"
              )
            )
            FROM message_reads mr
            JOIN users ru ON ru.id = mr."userId"
            WHERE mr."messageId" = m.id
          ),
          '[]'
        ) as "readBy",
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', r.id,
                'emoji', r.emoji,
                'userId', r."userId",
                'username', ru2.username
              )
            )
            FROM message_reactions r
            JOIN users ru2 ON ru2.id = r."userId"
            WHERE r."messageId" = m.id
          ),
          '[]'
        ) as "reactions"
      FROM messages m
      JOIN users u ON u.id = m."senderId"
      WHERE m."chatId" = ${chatId} 
        AND m."sentAt" >= ${joinedAt}
        AND m."sentAt" < ${before}
      ORDER BY m."sentAt" ASC
      LIMIT 100
    `
      : await sql`
      SELECT 
        m.*,
        'message' as type,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'profilePhotoUrl', u."profilePhotoUrl"
        ) as sender,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', mf.id,
                'fileUrl', mf."fileUrl",
                'fileType', mf."fileType"
              )
            )
            FROM media_files mf
            WHERE mf."messageId" = m.id
          ),
          '[]'
        ) as "mediaFiles",
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'userId', mr."userId",
                'username', ru.username,
                'readAt', mr."readAt"
              )
            )
            FROM message_reads mr
            JOIN users ru ON ru.id = mr."userId"
            WHERE mr."messageId" = m.id
          ),
          '[]'
        ) as "readBy",
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', r.id,
                'emoji', r.emoji,
                'userId', r."userId",
                'username', ru2.username
              )
            )
            FROM message_reactions r
            JOIN users ru2 ON ru2.id = r."userId"
            WHERE r."messageId" = m.id
          ),
          '[]'
        ) as "reactions"
      FROM messages m
      JOIN users u ON u.id = m."senderId"
      WHERE m."chatId" = ${chatId} 
        AND m."sentAt" >= ${joinedAt}
      ORDER BY m."sentAt" ASC
      LIMIT 100
    `

    // Get system messages (filtered by joinedAt)
    const systemMessages = before
      ? await sql`
      SELECT 
        sm.id,
        sm."chatId",
        sm.type as "eventType",
        sm."createdAt" as "sentAt",
        'system' as type,
        json_build_object(
          'id', u.id,
          'username', u.username
        ) as "systemUser"
      FROM system_messages sm
      LEFT JOIN users u ON u.id = sm."userId"
      WHERE sm."chatId" = ${chatId}
        AND sm."createdAt" >= ${joinedAt}
        AND sm."createdAt" < ${before}
      ORDER BY sm."createdAt" ASC
    `
      : await sql`
      SELECT 
        sm.id,
        sm."chatId",
        sm.type as "eventType",
        sm."createdAt" as "sentAt",
        'system' as type,
        json_build_object(
          'id', u.id,
          'username', u.username
        ) as "systemUser"
      FROM system_messages sm
      LEFT JOIN users u ON u.id = sm."userId"
      WHERE sm."chatId" = ${chatId}
        AND sm."createdAt" >= ${joinedAt}
      ORDER BY sm."createdAt" ASC
    `

    // Combine and sort all messages
    const allMessages = [...messages, ...systemMessages].sort((a, b) =>
      new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
    )

    return NextResponse.json(allMessages)
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}

// Send a new message
export async function POST(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("userId")?.value
    const { chatId } = await params

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { content, mediaFiles, replyToMessageId } = body

    if (!content && (!mediaFiles || mediaFiles.length === 0)) {
      return NextResponse.json({ error: "Message must have content or media" }, { status: 400 })
    }

    // Verify user is a participant
    const participant = await sql`
      SELECT * FROM chat_participants 
      WHERE "chatId" = ${chatId} AND "userId" = ${userId}
    `

    if (participant.length === 0) {
      return NextResponse.json({ error: "Not a participant" }, { status: 403 })
    }

    // Create message (including optional replyToMessageId for replies)
    const messageId = generateId()
    const message = await sql`
      INSERT INTO messages (id, "chatId", "senderId", content, "sentAt", "replyToMessageId")
      VALUES (${messageId}, ${chatId}, ${userId}, ${content || null}, NOW(), ${replyToMessageId || null})
      RETURNING *
    `

    // Add media files if any
    const insertedMediaFiles = []
    if (mediaFiles && mediaFiles.length > 0) {
      for (const media of mediaFiles) {
        const mediaFile = await sql`
          INSERT INTO media_files (id, "messageId", "fileUrl", "fileType", "createdAt")
          VALUES (${generateId()}, ${messageId}, ${media.fileUrl}, ${media.fileType}, NOW())
          RETURNING *
        `
        insertedMediaFiles.push(mediaFile[0])
      }
    }

    // Get sender info
    const sender = await sql`
      SELECT id, username, "profilePhotoUrl" FROM users WHERE id = ${userId}
    `

    return NextResponse.json({
      ...message[0],
      sender: sender[0],
      mediaFiles: insertedMediaFiles,
    })
  } catch (error) {
    console.error("Error sending message:", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}
