import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import { generateId } from "@/lib/utils/generate-id"

// Crear una encuesta
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("userId")?.value

    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { chatId, question, options, allowsMultiple, endsAt } = body as {
      chatId: string
      question: string
      options: string[]
      allowsMultiple?: boolean
      endsAt?: string
    }

    if (!chatId || !question || !options || options.length < 2) {
      return NextResponse.json({ 
        error: "Se requiere chatId, question y al menos 2 opciones" 
      }, { status: 400 })
    }

    // Obtener info del usuario
    const userResult = await sql`
      SELECT username, "profilePhotoUrl" FROM users WHERE id = ${userId}
    `
    const user = userResult[0]

    // Crear mensaje para la encuesta con tipo especial
    const messageId = generateId()
    const pollContent = JSON.stringify({
      type: "poll",
      question,
      options: options.map((opt, i) => ({ id: `temp_${i}`, text: opt, votes: 0 })),
      allowsMultiple: allowsMultiple || false,
      totalVotes: 0
    })
    
    await sql`
      INSERT INTO messages (id, "chatId", "senderId", content, "sentAt")
      VALUES (${messageId}, ${chatId}, ${userId}, ${pollContent}, NOW())
    `

    // Crear la encuesta en tabla separada
    const pollId = `poll_${generateId()}`
    await sql`
      INSERT INTO polls (id, message_id, question, allows_multiple, ends_at)
      VALUES (${pollId}, ${messageId}, ${question}, ${allowsMultiple || false}, ${endsAt || null})
    `

    // Crear las opciones y actualizar el contenido del mensaje con los IDs reales
    const optionIds: string[] = []
    for (let i = 0; i < options.length; i++) {
      const optionId = `opt_${generateId()}`
      optionIds.push(optionId)
      await sql`
        INSERT INTO poll_options (id, poll_id, option_text, option_order)
        VALUES (${optionId}, ${pollId}, ${options[i]}, ${i})
      `
    }

    // Actualizar el mensaje con los IDs reales de las opciones
    const finalPollContent = JSON.stringify({
      type: "poll",
      pollId,
      question,
      options: options.map((opt, i) => ({ id: optionIds[i], text: opt, votes: 0 })),
      allowsMultiple: allowsMultiple || false,
      totalVotes: 0
    })
    
    await sql`
      UPDATE messages SET content = ${finalPollContent} WHERE id = ${messageId}
    `

    // Obtener el mensaje completo para devolverlo
    const messageResult = await sql`
      SELECT 
        m.id,
        m."chatId",
        m."senderId",
        m.content,
        m."sentAt",
        u.username as "senderUsername",
        u."profilePhotoUrl" as "senderProfilePhotoUrl"
      FROM messages m
      JOIN users u ON u.id = m."senderId"
      WHERE m.id = ${messageId}
    `

    return NextResponse.json({ 
      success: true, 
      messageId,
      pollId,
      message: {
        ...messageResult[0],
        sender: {
          id: userId,
          username: user?.username,
          profilePhotoUrl: user?.profilePhotoUrl
        },
        mediaFiles: [],
        readBy: []
      }
    })
  } catch (error: any) {
    console.error("Error creating poll:", error)
    return NextResponse.json({ error: error?.message || "Failed to create poll" }, { status: 500 })
  }
}

// Obtener encuesta por messageId
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get("messageId")

    if (!messageId) {
      return NextResponse.json({ error: "messageId required" }, { status: 400 })
    }

    const pollResult = await sql`
      SELECT id FROM polls WHERE message_id = ${messageId}
    `

    if (pollResult.length === 0) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 })
    }

    const poll = await getPollWithDetails(pollResult[0].id as string)
    return NextResponse.json(poll)
  } catch (error) {
    console.error("Error getting poll:", error)
    return NextResponse.json({ error: "Failed to get poll" }, { status: 500 })
  }
}

async function getPollWithDetails(pollId: string) {
  const pollData = await sql`
    SELECT 
      p.id,
      p.question,
      p.allows_multiple,
      p.ends_at,
      p.created_at,
      p.message_id
    FROM polls p
    WHERE p.id = ${pollId}
  `

  if (pollData.length === 0) return null

  const options = await sql`
    SELECT 
      po.id,
      po.option_text,
      po.option_order,
      COUNT(pv.id)::int as vote_count
    FROM poll_options po
    LEFT JOIN poll_votes pv ON pv.option_id = po.id
    WHERE po.poll_id = ${pollId}
    GROUP BY po.id, po.option_text, po.option_order
    ORDER BY po.option_order
  `

  const totalVotes = await sql`
    SELECT COUNT(DISTINCT user_id)::int as total
    FROM poll_votes
    WHERE poll_id = ${pollId}
  `

  return {
    ...pollData[0],
    options,
    totalVotes: totalVotes[0]?.total || 0
  }
}
