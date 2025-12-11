-- Create enum type for chat types
CREATE TYPE "ChatType" AS ENUM ('INDIVIDUAL', 'GROUP');

-- Create users table
CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "profilePhotoUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Create unique index on username
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");

-- Create chats table
CREATE TABLE IF NOT EXISTS "chats" (
  "id" TEXT NOT NULL,
  "type" "ChatType" NOT NULL DEFAULT 'INDIVIDUAL',
  "name" TEXT,
  "adminId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- Create chat_participants table
CREATE TABLE IF NOT EXISTS "chat_participants" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on userId and chatId combination
CREATE UNIQUE INDEX IF NOT EXISTS "chat_participants_userId_chatId_key" ON "chat_participants"("userId", "chatId");

-- Create messages table
CREATE TABLE IF NOT EXISTS "messages" (
  "id" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "content" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- Create media_files table
CREATE TABLE IF NOT EXISTS "media_files" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "chats" ADD CONSTRAINT "chats_adminId_fkey" 
  FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_chatId_fkey" 
  FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_chatId_fkey" 
  FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" 
  FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "media_files" ADD CONSTRAINT "media_files_messageId_fkey" 
  FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "messages_chatId_idx" ON "messages"("chatId");
CREATE INDEX IF NOT EXISTS "messages_senderId_idx" ON "messages"("senderId");
CREATE INDEX IF NOT EXISTS "chat_participants_userId_idx" ON "chat_participants"("userId");
CREATE INDEX IF NOT EXISTS "chat_participants_chatId_idx" ON "chat_participants"("chatId");
