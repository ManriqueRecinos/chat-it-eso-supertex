import { relations } from "drizzle-orm/relations";
import { user, chat, chatParticipant, message, mediaFile, users, chats, chatParticipants, systemMessages, messages, mediaFiles, messageHistory, userStickers } from "./schema";

export const chatRelations = relations(chat, ({one, many}) => ({
	user: one(user, {
		fields: [chat.adminId],
		references: [user.id]
	}),
	chatParticipants: many(chatParticipant),
	messages: many(message),
}));

export const userRelations = relations(user, ({many}) => ({
	chats: many(chat),
	chatParticipants: many(chatParticipant),
	messages: many(message),
}));

export const chatParticipantRelations = relations(chatParticipant, ({one}) => ({
	user: one(user, {
		fields: [chatParticipant.userId],
		references: [user.id]
	}),
	chat: one(chat, {
		fields: [chatParticipant.chatId],
		references: [chat.id]
	}),
}));

export const messageRelations = relations(message, ({one, many}) => ({
	chat: one(chat, {
		fields: [message.chatId],
		references: [chat.id]
	}),
	user: one(user, {
		fields: [message.senderId],
		references: [user.id]
	}),
	mediaFiles: many(mediaFile),
}));

export const mediaFileRelations = relations(mediaFile, ({one}) => ({
	message: one(message, {
		fields: [mediaFile.messageId],
		references: [message.id]
	}),
}));

export const chatsRelations = relations(chats, ({one, many}) => ({
	user: one(users, {
		fields: [chats.adminId],
		references: [users.id]
	}),
	chatParticipants: many(chatParticipants),
	systemMessages: many(systemMessages),
	messages: many(messages),
}));

export const usersRelations = relations(users, ({many}) => ({
	chats: many(chats),
	chatParticipants: many(chatParticipants),
	systemMessages: many(systemMessages),
	messages: many(messages),
	userStickers: many(userStickers),
}));

export const chatParticipantsRelations = relations(chatParticipants, ({one}) => ({
	user: one(users, {
		fields: [chatParticipants.userId],
		references: [users.id]
	}),
	chat: one(chats, {
		fields: [chatParticipants.chatId],
		references: [chats.id]
	}),
}));

export const systemMessagesRelations = relations(systemMessages, ({one}) => ({
	chat: one(chats, {
		fields: [systemMessages.chatId],
		references: [chats.id]
	}),
	user: one(users, {
		fields: [systemMessages.userId],
		references: [users.id]
	}),
}));

export const mediaFilesRelations = relations(mediaFiles, ({one}) => ({
	message: one(messages, {
		fields: [mediaFiles.messageId],
		references: [messages.id]
	}),
}));

export const messagesRelations = relations(messages, ({one, many}) => ({
	mediaFiles: many(mediaFiles),
	chat: one(chats, {
		fields: [messages.chatId],
		references: [chats.id]
	}),
	user: one(users, {
		fields: [messages.senderId],
		references: [users.id]
	}),
	messageHistories: many(messageHistory),
}));

export const messageHistoryRelations = relations(messageHistory, ({one}) => ({
	message: one(messages, {
		fields: [messageHistory.messageId],
		references: [messages.id]
	}),
}));

export const userStickersRelations = relations(userStickers, ({one}) => ({
	user: one(users, {
		fields: [userStickers.userId],
		references: [users.id]
	}),
}));