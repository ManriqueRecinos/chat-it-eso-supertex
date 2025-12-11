import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import { generateId } from "@/lib/utils/generate-id"
import crypto from "crypto"

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex")
}

async function requireAdmin() {
  const cookieStore = await cookies()
  const userId = cookieStore.get("userId")?.value

  if (!userId) {
    return null
  }

  const users = await sql`
    SELECT u.*, r.name AS role
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.id = ${userId}
  `

  if (!users || users.length === 0) return null

  const user = users[0] as { id: string; role: string | null }
  if (user.role !== "admin") return null

  return user
}

// Listar todos los usuarios (solo admin)
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const users = await sql`
      SELECT 
        u.id,
        u.username,
        u."profilePhotoUrl",
        u."createdAt",
        r.name AS role
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      ORDER BY u."createdAt" DESC
    `

    return NextResponse.json(users)
  } catch (error) {
    console.error("Error fetching users (admin):", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

// Crear nuevo usuario (solo admin)
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()
    const { username, password, profilePhotoUrl, role } = body as {
      username?: string
      password?: string
      profilePhotoUrl?: string | null
      role?: string | null
    }

    if (!username || username.trim().length < 3) {
      return NextResponse.json({ error: "El usuario debe tener al menos 3 caracteres" }, { status: 400 })
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
    }

    const normalizedUsername = username.trim()

    const existing = await sql`
      SELECT id FROM users WHERE LOWER(username) = LOWER(${normalizedUsername})
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "El usuario ya existe" }, { status: 400 })
    }

    // Obtener rol (por nombre). Si no se envía, usar 'user'.
    const roleName = role || "user"
    const roles = await sql`
      SELECT id FROM roles WHERE name = ${roleName}
    `

    if (roles.length === 0) {
      return NextResponse.json({ error: `Rol no encontrado: ${roleName}` }, { status: 400 })
    }

    const roleId = (roles[0] as { id: string }).id

    const id = generateId()
    const hashedPass = hashPassword(password)

    const result = await sql`
      INSERT INTO users (id, username, "profilePhotoUrl", "createdAt", pass, role_id)
      VALUES (${id}, ${normalizedUsername}, ${profilePhotoUrl || null}, NOW(), ${hashedPass}, ${roleId})
      RETURNING id, username, "profilePhotoUrl", "createdAt", ${roleName} AS role
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("Error creating user (admin):", error)
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}

// Actualizar usuario existente (solo admin)
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()
    const { id, username, profilePhotoUrl, role } = body as {
      id?: string
      username?: string
      profilePhotoUrl?: string | null
      role?: string | null
    }

    if (!id) {
      return NextResponse.json({ error: "User id is required" }, { status: 400 })
    }

    if (!username || username.trim().length < 3) {
      return NextResponse.json({ error: "El usuario debe tener al menos 3 caracteres" }, { status: 400 })
    }

    const normalizedUsername = username.trim()

    // Comprobar colisión de username
    const existing = await sql`
      SELECT id FROM users 
      WHERE LOWER(username) = LOWER(${normalizedUsername})
      AND id != ${id}
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "El nombre de usuario ya está en uso" }, { status: 400 })
    }

    // Resolver rol
    let roleId: string | null = null
    let roleName: string | null = null
    if (role) {
      const roles = await sql`
        SELECT id, name FROM roles WHERE name = ${role}
      `
      if (roles.length === 0) {
        return NextResponse.json({ error: `Rol no encontrado: ${role}` }, { status: 400 })
      }
      roleId = (roles[0] as { id: string }).id
      roleName = (roles[0] as { name: string }).name
    }

    const result = await sql`
      UPDATE users
      SET
        username = ${normalizedUsername},
        "profilePhotoUrl" = ${profilePhotoUrl || null},
        role_id = ${roleId}
      WHERE id = ${id}
      RETURNING id, username, "profilePhotoUrl", "createdAt"
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const updated = result[0] as {
      id: string
      username: string
      profilePhotoUrl: string | null
      createdAt: string
    }

    return NextResponse.json({ ...updated, role: roleName })
  } catch (error) {
    console.error("Error updating user (admin):", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
