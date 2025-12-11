import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"

export default async function HomePage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get("userId")?.value

  // If no user ID, redirect to login
  if (!userId) {
    redirect("/login")
  }

  // Check if user exists in database
  const users = await sql`SELECT id FROM users WHERE id = ${userId}`

  if (users.length === 0) {
    redirect("/login")
  }

  // User exists, redirect to chat
  redirect("/chat")
}
