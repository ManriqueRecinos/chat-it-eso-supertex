"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MessageSquarePlus, Settings, Search, MoreVertical, Users, LogIn, LogOut, Wifi, WifiOff, Shield, BellOff } from "lucide-react"
import { UserStatusSelector } from "./user-status-selector"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import Link from "next/link"
import { socket } from "@/lib/socket"

interface ChatSidebarProps {
  currentUser: {
    id: string
    username: string
    profilePhotoUrl: string | null
    role?: string | null
  }
  chats: Array<{
    id: string
    name: string | null
    type: string
    adminId: string
    participants: Array<{
      userId: string
      username: string
      profilePhotoUrl: string | null
      joinedAt: string
    }>
    lastMessage?: {
      id: string
      content: string | null
      sentAt: string
      senderId: string
      senderUsername: string
      readBy?: Array<{ userId: string }>
    }
  }>
  selectedChatId: string | null
  onSelectChat: (chatId: string) => void
  onChatCreated: (chat: ChatSidebarProps["chats"][0]) => void
  onRefreshChats: () => void
  onlineUsers: Set<string>
  isConnected: boolean
  drafts: Map<string, string>
  typingUsers: Map<string, Set<string>> // chatId -> Set of usernames typing
}

export function ChatSidebar({
  currentUser,
  chats,
  selectedChatId,
  onSelectChat,
  onChatCreated,
  onRefreshChats,
  onlineUsers,
  isConnected,
  drafts,
  typingUsers,
}: ChatSidebarProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)
  const [showJoinChatDialog, setShowJoinChatDialog] = useState(false)
  const [newChatName, setNewChatName] = useState("")
  const [newChatMode, setNewChatMode] = useState<"group" | "direct">("group")
  const [directUsername, setDirectUsername] = useState("")
  const [joinChatId, setJoinChatId] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to logout")
      }

      toast.success("Sesión cerrada exitosamente")
      window.location.href = "/login"
    } catch {
      toast.error("Error al cerrar sesión")
    }
  }

  const filteredChats = chats.filter((chat) => {
    const chatName = getChatDisplayName(chat, currentUser.id)
    return chatName.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const handleCreateChat = async () => {
    setIsCreating(true)
    try {
      let body: any

      if (newChatMode === "group") {
        body = {
          name: newChatName.trim() || null,
          type: "GROUP",
        }
      } else {
        if (!directUsername.trim()) {
          toast.error("Ingresa el nombre de usuario para el chat directo")
          setIsCreating(false)
          return
        }

        body = {
          type: "INDIVIDUAL",
          participantUsername: directUsername.trim(),
        }
      }

      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || "Failed to create chat")
      }

      const newChat = await response.json()
      onChatCreated(newChat)
      setShowNewChatDialog(false)
      setNewChatName("")
      setDirectUsername("")

      if (newChatMode === "group") {
        toast.success(`Chat de grupo creado. Código para compartir: ${newChat.id}`)
      } else {
        toast.success("Chat directo creado correctamente")
      }
    } catch {
      toast.error("Error al crear el chat")
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinChat = async () => {
    if (!joinChatId.trim()) {
      toast.error("Por favor ingresa un código de chat")
      return
    }

    setIsJoining(true)
    try {
      const response = await fetch(`/api/chats/${joinChatId.toUpperCase()}/join`, {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to join chat")
      }

      const data = await response.json()

      // Emit socket event if present in response
      if (data.socketEvent) {
        socket.emit("user_joined", data.socketEvent)
      }

      await onRefreshChats()
      onSelectChat(joinChatId.toUpperCase())
      setShowJoinChatDialog(false)
      setJoinChatId("")
      toast.success("¡Te uniste al chat exitosamente!")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al unirse al chat")
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className="flex h-full w-full md:max-w-sm flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
            <AvatarImage src={currentUser.profilePhotoUrl || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {currentUser.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm sm:text-base truncate">{currentUser.username}</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {isConnected ? (
                  <>
                    <Wifi className="h-3 w-3 text-primary" />
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-destructive" />
                  </>
                )}
              </span>
              <UserStatusSelector currentStatus="available" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowNewChatDialog(true)}>
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                Nuevo Chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowJoinChatDialog(true)}>
                <LogIn className="mr-2 h-4 w-4" />
                Unirse a Chat
              </DropdownMenuItem>
              {currentUser.role === "admin" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Shield className="mr-2 h-4 w-4" />
                      Panel de administrador
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Configuración
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar o iniciar nuevo chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-10"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto chat-scrollbar">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">No hay chats aún</p>
            <p className="mt-1 text-sm text-muted-foreground/70">Crea un nuevo chat o únete a uno</p>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const chatTypingUsers = typingUsers.get(chat.id)
            const typingUsernames = chatTypingUsers 
              ? Array.from(chatTypingUsers).filter(name => name !== currentUser.username)
              : []
            return (
              <ChatListItem
                key={chat.id}
                chat={chat}
                currentUserId={currentUser.id}
                isSelected={chat.id === selectedChatId}
                onSelect={() => onSelectChat(chat.id)}
                isOnline={chat.participants.some((p) => p.userId !== currentUser.id && onlineUsers.has(p.userId))}
                draft={chat.id === selectedChatId ? undefined : drafts.get(chat.id)}
                typingUsernames={typingUsernames}
              />
            )
          })
        )}
      </div>

      {/* New Chat Dialog */}
      <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Chat</DialogTitle>
            <DialogDescription>
              Crea un chat de grupo con código para compartir o un chat directo escribiendo el usuario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2 text-sm font-medium">
              <button
                type="button"
                onClick={() => setNewChatMode("group")}
                className={`flex-1 rounded-md border px-3 py-2 ${newChatMode === "group" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
              >
                Chat de grupo
              </button>
              <button
                type="button"
                onClick={() => setNewChatMode("direct")}
                className={`flex-1 rounded-md border px-3 py-2 ${newChatMode === "direct" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
              >
                Chat directo
              </button>
            </div>

            {newChatMode === "group" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre del Chat (opcional)</label>
                <Input
                  placeholder="ej., Discusión del Proyecto"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Usuario para chat directo</label>
                <Input
                  placeholder="Nombre de usuario exacto"
                  value={directUsername}
                  onChange={(e) => setDirectUsername(e.target.value)}
                />
              </div>
            )}

            <Button onClick={handleCreateChat} disabled={isCreating} className="w-full bg-primary hover:bg-primary/90">
              {isCreating ? "Creando..." : newChatMode === "group" ? "Crear Chat" : "Crear Chat Directo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Chat Dialog */}
      <Dialog open={showJoinChatDialog} onOpenChange={setShowJoinChatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unirse a Chat</DialogTitle>
            <DialogDescription>Ingresa el código del chat para unirte a una conversación existente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Código del Chat</label>
              <Input
                placeholder="e.g., ABCD123"
                value={joinChatId}
                onChange={(e) => setJoinChatId(e.target.value.toUpperCase())}
                className="text-center text-lg font-mono tracking-wider"
                maxLength={10}
              />
            </div>
            <Button
              onClick={handleJoinChat}
              disabled={isJoining || !joinChatId.trim()}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {isJoining ? "Uniéndose..." : "Unirse al Chat"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ChatListItem({
  chat,
  currentUserId,
  isSelected,
  onSelect,
  isOnline,
  draft,
  typingUsernames = [],
}: {
  chat: ChatSidebarProps["chats"][0]
  currentUserId: string
  isSelected: boolean
  onSelect: () => void
  isOnline: boolean
  draft?: string
  typingUsernames?: string[]
}) {
  const displayName = getChatDisplayName(chat, currentUserId)
  const otherParticipant = chat.participants.find((p) => p.userId !== currentUserId)
  const avatarUrl = chat.type === "INDIVIDUAL" ? otherParticipant?.profilePhotoUrl : null

  // Detectar si hay mensajes no leídos
  const hasUnread =
    chat.lastMessage &&
    chat.lastMessage.senderId !== currentUserId &&
    (!Array.isArray(chat.lastMessage.readBy) ||
      !chat.lastMessage.readBy.some((r) => r.userId === currentUserId))

  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 transition-colors ${
        isSelected
          ? "bg-muted"
          : hasUnread
          ? "bg-green-500/5 hover:bg-green-500/10"
          : "hover:bg-muted/50"
      }`}
    >
      <div className="relative flex-shrink-0">
        <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
          <AvatarImage src={avatarUrl || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {chat.type === "GROUP" ? <Users className="h-4 w-4 sm:h-5 sm:w-5" /> : displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {isOnline && (
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full border-2 border-card bg-[var(--color-online)]" />
        )}
      </div>

      <div className="flex-1 overflow-hidden text-left min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium truncate text-sm sm:text-base">{displayName}</span>
          {chat.lastMessage && (
            <span className="text-[10px] sm:text-xs text-muted-foreground flex-shrink-0" suppressHydrationWarning>
              {formatDistanceToNow(new Date(chat.lastMessage.sentAt), {
                addSuffix: false,
              })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {typingUsernames.length > 0 ? (
            <p className="truncate text-sm text-green-600 italic animate-pulse">
              {typingUsernames.length === 1 
                ? `${typingUsernames[0]} está escribiendo...`
                : `${typingUsernames.slice(0, 2).join(", ")}${typingUsernames.length > 2 ? ` y ${typingUsernames.length - 2} más` : ""} están escribiendo...`
              }
            </p>
          ) : draft ? (
            <p className="truncate text-sm">
              <span className="text-red-500 font-medium">Borrador: </span>
              <span className="text-muted-foreground italic">{draft}</span>
            </p>
          ) : chat.lastMessage ? (
            <p className="truncate text-sm text-muted-foreground">
              {chat.type === "GROUP" && (
                <span className={chat.lastMessage.senderId === currentUserId ? "text-primary" : "text-foreground/70"}>
                  {chat.lastMessage.senderId === currentUserId ? "Tú" : chat.lastMessage.senderUsername}:{" "}
                </span>
              )}
              {chat.type === "INDIVIDUAL" && chat.lastMessage.senderId === currentUserId && (
                <span className="text-primary">Tú: </span>
              )}
              {(() => {
                // Detectar si es una encuesta
                const content = chat.lastMessage.content
                if (content) {
                  try {
                    if (content.trim().startsWith('{')) {
                      const parsed = JSON.parse(content)
                      if (parsed.type === "poll") {
                        return `📊 Encuesta: ${parsed.question}`
                      }
                    }
                  } catch {
                    // No es JSON, mostrar contenido normal
                  }
                }
                return content || "📎 Media"
              })()}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground/70 italic">No hay mensajes aún</p>
          )}
        </div>
      </div>
    </button>
  )
}

function getChatDisplayName(chat: ChatSidebarProps["chats"][0], currentUserId: string): string {
  if (chat.name) return chat.name

  if (chat.type === "INDIVIDUAL") {
    const otherParticipant = chat.participants.find((p) => p.userId !== currentUserId)
    return otherParticipant?.username || "Unknown"
  }

  // For groups without a name, show participant names
  const names = chat.participants
    .filter((p) => p.userId !== currentUserId)
    .map((p) => p.username)
    .slice(0, 3)

  if (names.length === 0) return "Chat Vacío"
  if (names.length <= 3) return names.join(", ")
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`
}
