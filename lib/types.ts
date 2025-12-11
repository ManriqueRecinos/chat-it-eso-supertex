// Type definitions for the chat application

export type ChatType = "INDIVIDUAL" | "GROUP"

export interface User {
  id: string
  username: string
  profilePhotoUrl: string | null
  createdAt: Date
}

export interface Chat {
  id: string
  type: ChatType
  name: string | null
  adminId: string
  createdAt: Date
}

export interface ChatParticipant {
  id: string
  userId: string
  chatId: string
  joinedAt: Date
}

export interface Message {
  id: string
  chatId: string
  senderId: string
  content: string | null
  sentAt: Date
  deletedAt?: Date | null
  editedAt?: Date | null
}

export interface MediaFile {
  id: string
  messageId: string
  fileUrl: string
  fileType: string
  createdAt: Date
}

// Extended types with relations
export interface ChatWithDetails extends Chat {
  admin: User
  participants: (ChatParticipant & { user: User })[]
  messages: MessageWithDetails[]
  lastMessage?: MessageWithDetails
  unreadCount?: number
}

export interface MessageWithDetails extends Message {
  sender: User
  mediaFiles: MediaFile[]
  readBy?: {
    userId: string
    username: string
    readAt: Date
  }[]
  reactions?: {
    id: string
    emoji: string
    userId: string
    username: string
  }[]
}

// WebSocket event types
export type WebSocketEventType =
  | "message"
  | "typing"
  | "stop_typing"
  | "online"
  | "offline"
  | "join_chat"
  | "leave_chat"

export interface WebSocketMessage {
  type: WebSocketEventType
  chatId?: string
  userId?: string
  data?: unknown
}

export interface TypingIndicator {
  chatId: string
  userId: string
  username: string
}
