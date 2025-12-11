import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import { generateId } from "@/lib/utils/generate-id"

// Helper to get message with ownership verification
async function getMessageAndVerifyOwnership(messageId: string, userId: string) {
    const message = await sql`
    SELECT * FROM messages WHERE id = ${messageId}
  `

    if (message.length === 0) {
        return { error: "Message not found", status: 404 }
    }

    if (message[0].senderId !== userId) {
        return { error: "Unauthorized", status: 403 }
    }

    return { message: message[0], status: 200 }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
    try {
        const cookieStore = await cookies()
        const userId = cookieStore.get("userId")?.value
        const { messageId } = await params

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const { content } = body

        if (!content) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 })
        }

        // Verify ownership
        const { message, error, status } = await getMessageAndVerifyOwnership(messageId, userId)
        if (error) {
            return NextResponse.json({ error }, { status })
        }

        // 1. Save current content to history
        await sql`
      INSERT INTO message_history (id, "messageId", "previousContent", "changedAt")
      VALUES (${generateId()}, ${messageId}, ${message.content}, NOW())
    `

        // 2. Update message
        const updatedMessage = await sql`
      UPDATE messages
      SET content = ${content}, "editedAt" = NOW()
      WHERE id = ${messageId}
      RETURNING *
    `

        // 3. Get sender info and media files for full object return
        const sender = await sql`SELECT id, username, "profilePhotoUrl" FROM users WHERE id = ${updatedMessage[0].senderId}`
        const mediaFiles = await sql`SELECT id, "fileUrl", "fileType" FROM media_files WHERE "messageId" = ${messageId}`

        return NextResponse.json({
            ...updatedMessage[0],
            sender: sender[0],
            mediaFiles: mediaFiles,
        })
    } catch (error) {
        console.error("Error updating message:", error)
        return NextResponse.json({ error: "Failed to update message" }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
    try {
        const cookieStore = await cookies()
        const userId = cookieStore.get("userId")?.value
        const { messageId } = await params

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Verify ownership
        const { error, status } = await getMessageAndVerifyOwnership(messageId, userId)
        if (error) {
            return NextResponse.json({ error }, { status })
        }

        // Soft delete
        const deletedMessage = await sql`
      UPDATE messages
      SET "deletedAt" = NOW()
      WHERE id = ${messageId}
      RETURNING *
    `

        return NextResponse.json(deletedMessage[0])
    } catch (error) {
        console.error("Error deleting message:", error)
        return NextResponse.json({ error: "Failed to delete message" }, { status: 500 })
    }
}
