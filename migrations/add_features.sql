-- =============================================
-- MIGRACIONES PARA NUEVAS FUNCIONALIDADES
-- Ejecutar en orden en tu base de datos Neon
-- =============================================

-- 1. ESTADOS DE USUARIO (Disponible, Ocupado, No molestar)
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 2. MENSAJES FIJADOS (Pinned Messages)
CREATE TABLE IF NOT EXISTS pinned_messages (
    id TEXT PRIMARY KEY DEFAULT ('pin_' || substr(md5(random()::text), 1, 12)),
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    pinned_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pinned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chat_id, message_id)
);

-- 3. CHATS SILENCIADOS (Muted Chats)
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS muted BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS muted_until TIMESTAMP;

-- 4. ENCUESTAS (Polls)
CREATE TABLE IF NOT EXISTS polls (
    id TEXT PRIMARY KEY DEFAULT ('poll_' || substr(md5(random()::text), 1, 12)),
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    allows_multiple BOOLEAN DEFAULT FALSE,
    ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS poll_options (
    id TEXT PRIMARY KEY DEFAULT ('opt_' || substr(md5(random()::text), 1, 12)),
    poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    option_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS poll_votes (
    id TEXT PRIMARY KEY DEFAULT ('vote_' || substr(md5(random()::text), 1, 12)),
    poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id TEXT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(poll_id, option_id, user_id)
);

-- 5. REACCIONES CON STICKERS (si la tabla existe)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_reactions') THEN
        ALTER TABLE message_reactions ADD COLUMN IF NOT EXISTS sticker_url TEXT;
    END IF;
END $$;

-- 6. ÍNDICES PARA BÚSQUEDA DE MENSAJES
CREATE INDEX IF NOT EXISTS idx_messages_chat_sent ON messages("chatId", "sentAt" DESC);

-- Verificar que todo se creó correctamente
SELECT 'Migraciones completadas exitosamente' as status;

-- =============================================
-- INSTRUCCIONES:
-- 1. Copia este SQL
-- 2. Ve a tu consola de Neon (https://console.neon.tech)
-- 3. Selecciona tu proyecto y base de datos
-- 4. Ve a "SQL Editor"
-- 5. Pega y ejecuta este script
-- =============================================
