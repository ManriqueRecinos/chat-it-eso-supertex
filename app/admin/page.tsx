import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { type AdminUser } from "@/components/admin/admin-users-table"
import { AdminPanel, type AdminMessageDetails, type AdminChat } from "@/components/admin/admin-panel"

export default async function AdminPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get("userId")?.value

  if (!userId) {
    redirect("/login")
  }

  // Verificar que el usuario es admin
  const currentUsers = await sql`
    SELECT 
      u.id,
      u.username,
      r.name AS role
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.id = ${userId}
  `

  if (!currentUsers || currentUsers.length === 0) {
    redirect("/login")
  }

  const currentUser = currentUsers[0] as { id: string; username: string; role: string | null }

  if (currentUser.role !== "admin") {
    redirect("/chat")
  }

  // Cargar todos los usuarios con rol
  const users = (await sql`
    SELECT 
      u.id,
      u.username,
      u."profilePhotoUrl",
      u."createdAt",
      r.name AS role
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    ORDER BY u."createdAt" DESC
  `) as AdminUser[]

  // Cargar roles disponibles
  const roles = await sql`
    SELECT name FROM roles ORDER BY name ASC
  ` as { name: string }[]

  const availableRoles = roles.map((r) => r.name)

  // Cargar todos los chats (solo lectura)
  const chats = (await sql`
    SELECT 
      c.id,
      c.name,
      c.type,
      c."adminId",
      c."createdAt",
      u.username AS "adminUsername",
      (
        SELECT COUNT(*)::int
        FROM chat_participants cp
        WHERE cp."chatId" = c.id
      ) AS "participantsCount"
    FROM chats c
    JOIN users u ON u.id = c."adminId"
    ORDER BY c."createdAt" DESC
  `) as AdminChat[]

  // Cargar mensajes recientes con lecturas, reacciones e historial (solo lectura)
  const messages = (await sql`
    SELECT 
      m.id,
      m.content,
      m."sentAt",
      m."chatId",
      c.name AS "chatName",
      u.id AS "senderId",
      u.username AS "senderUsername",
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'userId', mr."userId",
              'username', ur.username,
              'readAt', mr."readAt"
            )
          )
          FROM message_reads mr
          JOIN users ur ON ur.id = mr."userId"
          WHERE mr."messageId" = m.id
        ),
        '[]'
      ) AS "reads",
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'emoji', r.emoji,
              'userId', r."userId",
              'username', ru.username
            )
          )
          FROM message_reactions r
          JOIN users ru ON ru.id = r."userId"
          WHERE r."messageId" = m.id
        ),
        '[]'
      ) AS "reactions",
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', h.id,
              'previousContent', h."previousContent",
              'changedAt', h."changedAt"
            )
          )
          FROM message_history h
          WHERE h."messageId" = m.id
        ),
        '[]'
      ) AS "history"
    FROM messages m
    JOIN users u ON u.id = m."senderId"
    LEFT JOIN chats c ON c.id = m."chatId"
    ORDER BY m."sentAt" DESC
    LIMIT 50
  `) as AdminMessageDetails[]

  return (
    <div className="min-h-screen bg-[var(--color-chat-bg)] flex flex-col px-4 py-4">
      <header className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Panel de administrador</h1>
          <p className="text-sm text-muted-foreground">
            Bienvenido, {currentUser.username}. Administra usuarios y revisa la actividad de los mensajes.
          </p>
        </div>
      </header>

      <main className="flex-1 min-h-0">
        <AdminPanel
          currentUsername={currentUser.username}
          initialUsers={users}
          availableRoles={availableRoles}
          initialChats={chats}
          initialMessages={messages}
        />
      </main>
    </div>
  )
}
