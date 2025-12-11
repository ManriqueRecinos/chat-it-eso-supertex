
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { userStickers } from "@/lib/schema"
import { desc, eq } from "drizzle-orm"

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const userId = searchParams.get("userId")

        if (!userId) {
            return new NextResponse("User ID required", { status: 400 })
        }

        const stickers = await db.select().from(userStickers)
            .where(eq(userStickers.userId, userId))
            .orderBy(desc(userStickers.createdAt))

        return NextResponse.json(stickers)
    } catch (error) {
        console.error("[STICKERS_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { userId, name, url } = body

        if (!userId || !name || !url) {
            return new NextResponse("Missing data", { status: 400 })
        }

        const sticker = await db.insert(userStickers).values({
            id: crypto.randomUUID(),
            userId,
            name,
            url,
        }).returning()

        return NextResponse.json(sticker[0])
    } catch (error) {
        console.error("[STICKERS_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
