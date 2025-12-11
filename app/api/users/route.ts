import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import { generateId } from "@/lib/utils/generate-id"
import crypto from "crypto"

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex")
}

// Login or signup with username + password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, profilePhotoUrl, mode } = body as {
      username?: string
      password?: string
      profilePhotoUrl?: string | null
      mode?: "login" | "signup"
    }

    const effectiveMode: "login" | "signup" = mode || "login"

    if (!username || username.trim().length < 3) {
      return NextResponse.json({ error: "El usuario debe tener al menos 3 caracteres" }, { status: 400 })
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
    }

    const normalizedUsername = username.trim()

    // Buscar usuario por username
    const existing = await sql`
      SELECT * FROM users WHERE LOWER(username) = LOWER(${normalizedUsername})
    `

    if (effectiveMode === "login") {
      if (existing.length === 0) {
        return NextResponse.json({ error: "El usuario no existe" }, { status: 400 })
      }

      const user = existing[0] as { id: string; pass: string | null }

      if (!user.pass) {
        return NextResponse.json({ error: "Este usuario no tiene contraseña configurada" }, { status: 400 })
      }

      const hashed = hashPassword(password)
      if (user.pass !== hashed) {
        return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 400 })
      }

      const cookieStore = await cookies()
      cookieStore.set("userId", user.id, {
        httpOnly: true,
        secure: false, // Deshabilitado para permitir HTTP en red local
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      })

      return NextResponse.json({ ...user, isNewUser: false })
    }

    // SIGNUP
    if (existing.length > 0) {
      return NextResponse.json({ error: "El usuario ya existe" }, { status: 400 })
    }

    // Obtener el role_id del rol "user"
    const roleResult = await sql`
      SELECT id FROM roles WHERE name = 'user'
    `
    
    if (roleResult.length === 0) {
      return NextResponse.json({ error: "Rol 'user' no encontrado en la base de datos" }, { status: 500 })
    }
    
    const roleId = roleResult[0].id

    const id = generateId()
    const hashedPass = hashPassword(password)

    const result = await sql`
      INSERT INTO users (id, username, "profilePhotoUrl", "createdAt", pass, role_id)
      VALUES (${id}, ${normalizedUsername}, ${profilePhotoUrl || null}, NOW(), ${hashedPass}, ${roleId})
      RETURNING *
    `

    const newUser = result[0]

    const cookieStore = await cookies()
    cookieStore.set("userId", newUser.id, {
      httpOnly: true,
      secure: false, // Deshabilitado para permitir HTTP en red local
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    })

    return NextResponse.json({ ...newUser, isNewUser: true })
  } catch (error: any) {
    console.error("Error creating/logging in user:", error)
    // Mostrar error más específico para debugging
    const errorMessage = error?.message || "Error al crear/iniciar sesión"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// Update existing user
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("userId")?.value

    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { username, profilePhotoUrl } = body

    if (!username || username.trim().length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 })
    }

    // Check if username is taken by another user
    const existing = await sql`
      SELECT id FROM users 
      WHERE LOWER(username) = LOWER(${username.trim()}) 
      AND id != ${userId}
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "Username already taken" }, { status: 400 })
    }

    const result = await sql`
      UPDATE users 
      SET username = ${username.trim()}, "profilePhotoUrl" = ${profilePhotoUrl || null}
      WHERE id = ${userId}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}

// Get current user
export async function GET() {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("userId")?.value

    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const result = await sql`
      SELECT * FROM users WHERE id = ${userId}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("Error getting user:", error)
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 })
  }
}
