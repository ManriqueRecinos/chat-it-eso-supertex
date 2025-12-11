-- Tabla para reacciones a mensajes
CREATE TABLE IF NOT EXISTS message_reactions (
  id          text PRIMARY KEY,
  "messageId" text NOT NULL REFERENCES messages(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "userId"    text NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  emoji       text NOT NULL,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT message_reactions_messageId_userId_emoji_key UNIQUE ("messageId", "userId", emoji)
);
