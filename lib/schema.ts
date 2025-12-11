import { pgTable, unique, varchar, timestamp, foreignKey, text, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const chatType = pgEnum("chat_type", ['INDIVIDUAL', 'GROUP'])


export const user = pgTable("User", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	username: varchar({ length: 100 }).notNull(),
	profilePhotoUrl: varchar({ length: 512 }),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	unique("User_username_key").on(table.username),
]);

export const chat = pgTable("Chat", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	type: chatType().notNull(),
	name: varchar({ length: 255 }),
	adminId: varchar({ length: 255 }),
}, (table) => [
	foreignKey({
			columns: [table.adminId],
			foreignColumns: [user.id],
			name: "Chat_adminId_fkey"
		}).onDelete("set null"),
]);

export const chatParticipant = pgTable("ChatParticipant", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	userId: varchar({ length: 255 }).notNull(),
	chatId: varchar({ length: 255 }).notNull(),
	joinedAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "ChatParticipant_userId_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "ChatParticipant_chatId_fkey"
		}).onDelete("cascade"),
	unique("ChatParticipant_userId_chatId_key").on(table.userId, table.chatId),
]);

export const message = pgTable("Message", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	chatId: varchar({ length: 255 }).notNull(),
	senderId: varchar({ length: 255 }).notNull(),
	content: text(),
	sentAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "Message_chatId_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.senderId],
			foreignColumns: [user.id],
			name: "Message_senderId_fkey"
		}).onDelete("restrict"),
]);

export const mediaFile = pgTable("MediaFile", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	messageId: varchar({ length: 255 }),
	fileUrl: varchar({ length: 512 }).notNull(),
	fileType: varchar({ length: 50 }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [message.id],
			name: "MediaFile_messageId_fkey"
		}).onDelete("set null"),
]);

export const users = pgTable("users", {
	id: text().primaryKey().notNull(),
	username: text().notNull(),
	profilePhotoUrl: text(),
	pass: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("users_username_key").on(table.username),
]);

export const chats = pgTable("chats", {
	id: text().primaryKey().notNull(),
	type: text().default('INDIVIDUAL'),
	name: text(),
	adminId: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.adminId],
			foreignColumns: [users.id],
			name: "chats_adminId_fkey"
		}).onDelete("cascade"),
]);

export const chatParticipants = pgTable("chat_participants", {
	id: text().primaryKey().notNull(),
	userId: text().notNull(),
	chatId: text().notNull(),
	joinedAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "chat_participants_userId_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chats.id],
			name: "chat_participants_chatId_fkey"
		}).onDelete("cascade"),
	unique("chat_participants_userId_chatId_key").on(table.userId, table.chatId),
]);

export const systemMessages = pgTable("system_messages", {
	id: text().primaryKey().notNull(),
	chatId: text().notNull(),
	type: text().notNull(),
	userId: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chats.id],
			name: "system_messages_chatId_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "system_messages_userId_fkey"
		}).onDelete("set null"),
]);

export const mediaFiles = pgTable("media_files", {
	id: text().primaryKey().notNull(),
	messageId: text().notNull(),
	fileUrl: text().notNull(),
	fileType: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "media_files_messageId_fkey"
		}).onDelete("cascade"),
]);

export const messages = pgTable("messages", {
	id: text().primaryKey().notNull(),
	chatId: text().notNull(),
	senderId: text().notNull(),
	content: text(),
	sentAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	deletedAt: timestamp({ mode: 'string' }),
	editedAt: timestamp({ mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chats.id],
			name: "messages_chatId_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.senderId],
			foreignColumns: [users.id],
			name: "messages_senderId_fkey"
		}).onDelete("cascade"),
]);

export const messageHistory = pgTable("message_history", {
	id: text().default(sql`(\'mh_\'::text || substr(md5((random())::text), 1, 12))`).primaryKey().notNull(),
	messageId: text().notNull(),
	previousContent: text(),
	changedAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "message_history_messageId_fkey"
		}).onDelete("cascade"),
]);

export const userStickers = pgTable("user_stickers", {
	id: text().primaryKey().notNull(),
	userId: text().notNull(),
	name: text().notNull(),
	url: text().notNull(),
	type: text().default("image").notNull(), // "image" or "video"
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_stickers_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);
