import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { ChatLayout } from "@/components/chat/chat-layout"

export default async function ChatPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get("userId")?.value

  if (!userId) {
    redirect("/settings")
  }

  // Get user data including role
  const users = await sql`
    SELECT 
      u.*, 
      r.name AS role
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.id = ${userId}
  `

  if (users.length === 0) {
    redirect("/settings")
  }

  const currentUser = users[0] as {
    id: string
    username: string
    profilePhotoUrl: string | null
    role: string | null
  }

  const isAdmin = currentUser.role === "admin"

  // Get chats with last message
  const chats = isAdmin
    ? await sql`
        SELECT 
          c.*,
          u.username as "adminUsername",
          u."profilePhotoUrl" as "adminProfilePhotoUrl",
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
        JOIN users u ON u.id = c."adminId"
        ORDER BY (
          SELECT MAX("sentAt") FROM messages WHERE "chatId" = c.id
        ) DESC NULLS LAST
      `
    : await sql`
        SELECT 
          c.*,
          u.username as "adminUsername",
          u."profilePhotoUrl" as "adminProfilePhotoUrl",
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
        JOIN users u ON u.id = c."adminId"
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

  return (
    <ChatLayout
      currentUser={currentUser}
      initialChats={chatsWithParticipants as any}
    />
  )
}
