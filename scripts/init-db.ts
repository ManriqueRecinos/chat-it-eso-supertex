import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function initDatabase() {
    try {
        console.log('Creating database tables...')

        // Create users table
        await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        "profilePhotoUrl" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

        // Create chats table
        await sql`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        type TEXT DEFAULT 'INDIVIDUAL',
        name TEXT,
        "adminId" TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("adminId") REFERENCES users(id) ON DELETE CASCADE
      )
    `

        // Create chat_participants table
        await sql`
      CREATE TABLE IF NOT EXISTS chat_participants (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "chatId" TEXT NOT NULL,
        "joinedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY ("chatId") REFERENCES chats(id) ON DELETE CASCADE,
        UNIQUE ("userId", "chatId")
      )
    `

        // Create messages table
        await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        "chatId" TEXT NOT NULL,
        "senderId" TEXT NOT NULL,
        content TEXT,
        "sentAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("chatId") REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY ("senderId") REFERENCES users(id) ON DELETE CASCADE
      )
    `

        // Ensure replyToMessageId column exists for message replies
        await sql`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS "replyToMessageId" TEXT
      REFERENCES messages(id)
      ON DELETE SET NULL
    `

        // Ensure type column exists for user_stickers (image or video)
        await sql`
      ALTER TABLE user_stickers
      ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'image' NOT NULL
    `

        // Create media_files table
        await sql`
      CREATE TABLE IF NOT EXISTS media_files (
        id TEXT PRIMARY KEY,
        "messageId" TEXT NOT NULL,
        "fileUrl" TEXT NOT NULL,
        "fileType" TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("messageId") REFERENCES messages(id) ON DELETE CASCADE
      )
    `

        console.log('✅ Database tables created successfully!')
    } catch (error) {
        console.error('❌ Error creating database tables:', error)
        process.exit(1)
    }
}

initDatabase()
