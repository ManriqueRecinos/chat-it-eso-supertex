import { neon } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'

dotenv.config()

const sql = neon(process.env.DATABASE_URL!)

async function migrateDatabase() {
    try {
        console.log('Starting migration for advanced message features...')

        // 1. Add columns to messages table
        console.log('Adding specific columns to messages table...')
        try {
            await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP`
            await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP`
            console.log('✅ messages table altered.')
        } catch (e) {
            console.log('⚠️ Could not alter messages table (might already exist):', e)
        }

        // 2. Create message_history table
        console.log('Creating message_history table...')
        await sql`
      CREATE TABLE IF NOT EXISTS message_history (
        id TEXT PRIMARY KEY DEFAULT ('mh_' || substr(md5(random()::text), 1, 12)),
        "messageId" TEXT NOT NULL,
        "previousContent" TEXT,
        "changedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("messageId") REFERENCES messages(id) ON DELETE CASCADE
      )
    `
        console.log('✅ message_history table created.')

        console.log('🎉 Migration completed successfully!')
    } catch (error) {
        console.error('❌ Error during migration:', error)
        process.exit(1)
    }
}

migrateDatabase()
