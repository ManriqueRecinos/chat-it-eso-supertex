import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function addSystemMessages() {
    try {
        console.log('Creando tabla de mensajes de sistema...')

        // Create system_messages table
        await sql`
      CREATE TABLE IF NOT EXISTS system_messages (
        id TEXT PRIMARY KEY,
        "chatId" TEXT NOT NULL,
        type TEXT NOT NULL,
        "userId" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("chatId") REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL
      )
    `

        console.log('✅ Tabla system_messages creada exitosamente!')
    } catch (error) {
        console.error('❌ Error creando tabla:', error)
        process.exit(1)
    }
}

addSystemMessages()
