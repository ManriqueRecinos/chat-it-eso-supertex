import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"

// Silenciar/desilenciar un chat
export async function PUT(
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
    const { muted, duration } = body as { muted: boolean; duration?: number } // duration in hours

    let mutedUntil = null
    if (muted && duration) {
      const date = new Date()
      date.setHours(date.getHours() + duration)
      mutedUntil = date.toISOString()
    }

    const result = await sql`
      UPDATE chat_participants 
      SET muted = ${muted}, muted_until = ${mutedUntil}
      WHERE "chatId" = ${chatId} AND "userId" = ${userId}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Not a participant of this chat" }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      muted, 
      mutedUntil 
    })
  } catch (error) {
    console.error("Error muting chat:", error)
    return NextResponse.json({ error: "Failed to mute chat" }, { status: 500 })
  }
}

// Obtener estado de silencio
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

    const result = await sql`
      SELECT muted, muted_until 
      FROM chat_participants 
      WHERE "chatId" = ${chatId} AND "userId" = ${userId}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Not a participant" }, { status: 404 })
    }

    const { muted, muted_until } = result[0] as { muted: boolean; muted_until: string | null }
    
    // Si tiene tiempo límite, verificar si ya expiró
    if (muted && muted_until && new Date(muted_until) < new Date()) {
      // Expiró, actualizar a no silenciado
      await sql`
        UPDATE chat_participants 
        SET muted = false, muted_until = NULL
        WHERE "chatId" = ${chatId} AND "userId" = ${userId}
      `
      return NextResponse.json({ muted: false, mutedUntil: null })
    }

    return NextResponse.json({ muted, mutedUntil: muted_until })
  } catch (error) {
    console.error("Error getting mute status:", error)
    return NextResponse.json({ error: "Failed to get mute status" }, { status: 500 })
  }
}
