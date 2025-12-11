import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import { generateId } from "@/lib/utils/generate-id"

// Obtener votos detallados de una encuesta
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("userId")?.value

    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const pollId = searchParams.get("pollId")

    if (!pollId) {
      return NextResponse.json({ error: "pollId required" }, { status: 400 })
    }

    // Obtener opciones con votos y usuarios
    const options = await sql`
      SELECT 
        po.id,
        po.option_text,
        po.option_order
      FROM poll_options po
      WHERE po.poll_id = ${pollId}
      ORDER BY po.option_order
    `

    // Para cada opción, obtener los usuarios que votaron
    const optionsWithVoters = await Promise.all(
      options.map(async (option: any) => {
        const voters = await sql`
          SELECT 
            u.id,
            u.username,
            u."profilePhotoUrl"
          FROM poll_votes pv
          JOIN users u ON u.id = pv.user_id
          WHERE pv.option_id = ${option.id}
          ORDER BY pv.voted_at DESC
        `
        return {
          ...option,
          voters
        }
      })
    )

    // Verificar si el usuario actual votó y por cuáles opciones
    const userVotes = await sql`
      SELECT option_id FROM poll_votes 
      WHERE poll_id = ${pollId} AND user_id = ${userId}
    `

    return NextResponse.json({
      options: optionsWithVoters,
      userVotedOptions: userVotes.map((v: any) => v.option_id)
    })
  } catch (error) {
    console.error("Error getting poll votes:", error)
    return NextResponse.json({ error: "Failed to get votes" }, { status: 500 })
  }
}

// Votar en una encuesta
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("userId")?.value

    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { pollId, optionId } = body as { pollId: string; optionId: string }

    if (!pollId || !optionId) {
      return NextResponse.json({ error: "pollId and optionId required" }, { status: 400 })
    }

    // Verificar que la encuesta existe y no ha terminado
    const pollCheck = await sql`
      SELECT allows_multiple, ends_at FROM polls WHERE id = ${pollId}
    `

    if (pollCheck.length === 0) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 })
    }

    const poll = pollCheck[0] as { allows_multiple: boolean; ends_at: string | null }

    if (poll.ends_at && new Date(poll.ends_at) < new Date()) {
      return NextResponse.json({ error: "Esta encuesta ya terminó" }, { status: 400 })
    }

    // Si no permite múltiples votos, eliminar voto anterior
    if (!poll.allows_multiple) {
      await sql`
        DELETE FROM poll_votes 
        WHERE poll_id = ${pollId} AND user_id = ${userId}
      `
    }

    // Verificar si ya votó por esta opción
    const existingVote = await sql`
      SELECT id FROM poll_votes 
      WHERE poll_id = ${pollId} AND option_id = ${optionId} AND user_id = ${userId}
    `

    if (existingVote.length > 0) {
      // Quitar voto
      await sql`
        DELETE FROM poll_votes 
        WHERE poll_id = ${pollId} AND option_id = ${optionId} AND user_id = ${userId}
      `
      return NextResponse.json({ success: true, action: "removed" })
    }

    // Agregar voto
    const voteId = `vote_${generateId()}`
    await sql`
      INSERT INTO poll_votes (id, poll_id, option_id, user_id)
      VALUES (${voteId}, ${pollId}, ${optionId}, ${userId})
    `

    // Obtener resultados actualizados
    const results = await sql`
      SELECT 
        po.id,
        po.option_text,
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

    return NextResponse.json({ 
      success: true, 
      action: "added",
      results,
      totalVotes: totalVotes[0]?.total || 0
    })
  } catch (error) {
    console.error("Error voting:", error)
    return NextResponse.json({ error: "Failed to vote" }, { status: 500 })
  }
}
