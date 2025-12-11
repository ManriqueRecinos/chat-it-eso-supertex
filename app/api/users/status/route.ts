import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"

// Actualizar estado del usuario
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("userId")?.value

    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { status } = body as { status: "available" | "busy" | "dnd" | "offline" }

    const validStatuses = ["available", "busy", "dnd", "offline"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 })
    }

    await sql`
      UPDATE users 
      SET status = ${status}, last_seen = NOW()
      WHERE id = ${userId}
    `

    return NextResponse.json({ success: true, status })
  } catch (error) {
    console.error("Error updating status:", error)
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 })
  }
}

// Obtener estado de un usuario
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 })
    }

    const result = await sql`
      SELECT status, last_seen FROM users WHERE id = ${userId}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("Error getting status:", error)
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 })
  }
}
