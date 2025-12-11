"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ChatSidebar } from "./chat-sidebar"
import { ChatView } from "./chat-view"
import { EmptyChatView } from "./empty-chat-view"
import { useSocket } from "@/hooks/use-socket"
import type { MessageWithDetails } from "@/lib/types"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface ChatLayoutProps {
  currentUser: {
    id: string
    username: string
    profilePhotoUrl: string | null
    role?: string | null
  }
  initialChats: Array<{
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
    }
  }>
}

export function ChatLayout({ currentUser, initialChats }: ChatLayoutProps) {
  const [chats, setChats] = useState(initialChats)
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageWithDetails[]>([])
  const [typingUsers, setTypingUsers] = useState<Map<string, Set<string>>>(new Map())
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  
  // Borradores: mapa de chatId -> texto del borrador
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map())
  
  // Estado para móvil: mostrar sidebar o chat
  const [showMobileChat, setShowMobileChat] = useState(false)

  const selectedChat = chats.find((c) => c.id === selectedChatId)

  // Ref to track state inside socket listeners
  const selectedChatIdRef = useRef<string | null>(null)
  const chatsRef = useRef(initialChats)

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId
  }, [selectedChatId])

  useEffect(() => {
    chatsRef.current = chats
  }, [chats])

  // Socket connection - pasar el userId para registro automático
  const { socket, isConnected, reconnectAttempt } = useSocket(currentUser.id)

  // Unirse a todos los chats cuando cambian o cuando el socket se conecta
  useEffect(() => {
    if (socket && isConnected && chats.length > 0) {
      console.log("[CLIENT] Socket connected, joining all chats:", chats.map(c => c.id))
      // Pequeño delay para asegurar que el socket esté listo
      const timeoutId = setTimeout(() => {
        chats.forEach(chat => {
          socket.emit("join_chat", chat.id)
        })
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [socket, isConnected, chats])

  // Toast de reconexión cuando se pierde la conexión - actualiza en tiempo real
  const wasConnectedRef = useRef(true)
  
  useEffect(() => {
    if (!isConnected && reconnectAttempt > 0) {
      // Actualizar toast con el número de intentos
      toast(
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <div className="flex flex-col">
            <span className="font-medium">Reconectando...</span>
            <span className="text-xs opacity-80">Intento #{reconnectAttempt}</span>
          </div>
        </div>,
        {
          id: "reconnect-toast",
          duration: Infinity,
          position: "top-right",
          style: {
            background: "rgb(59 130 246 / 0.1)",
            border: "1px solid rgb(59 130 246 / 0.3)",
            color: "rgb(59 130 246)",
          },
        }
      )
      wasConnectedRef.current = false
    } else if (isConnected && !wasConnectedRef.current) {
      // Cerrar toast cuando se reconecta
      toast.dismiss("reconnect-toast")
      toast.success("¡Conexión restablecida!", { 
        duration: 3000,
        position: "top-right",
      })
      wasConnectedRef.current = true
    }
  }, [isConnected, reconnectAttempt])

  // Unlock audio context on first user interaction
  useEffect(() => {
    const unlockAudio = () => {
      const audio = new Audio("data:audio/mp3;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAGDCwIIAA8kQoVEbPOqBetsMEoZYp9DiGNk/Gf2ZjrVFsp9H4g5BFhOdXIv2znKg4pBTOtC8Vng5G88/x6cuLV8mC9x296ky69vnnnvff/95/3//////9///////zv/---/8=")
      audio.volume = 0
      audio.play().then(() => {
        console.log("[CLIENT] Audio Unlocked")
      }).catch((e) => {
        console.warn("[CLIENT] Audio unlock failed:", e)
      })
      window.removeEventListener("click", unlockAudio)
      window.removeEventListener("keydown", unlockAudio)
    }

    window.addEventListener("click", unlockAudio)
    window.addEventListener("keydown", unlockAudio)

    return () => {
      window.removeEventListener("click", unlockAudio)
      window.removeEventListener("keydown", unlockAudio)
    }
  }, [])

  // Permitir salir del chat actual con la tecla Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedChatId(null)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleUserLeft = useCallback((data: any) => {
    // Remover participante del chat correspondiente
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id === data.chatId) {
          return {
            ...chat,
            participants: chat.participants.filter((p) => p.userId !== data.user.userId),
          }
        }
        return chat
      }),
    )

    // Si estamos viendo este chat, agregar mensaje de sistema
    if (data.chatId === selectedChatIdRef.current) {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === data.message.id)
        if (exists) return prev
        return [...prev, data.message]
      })
    }

    // Re-sincronizar lista de chats/participantes desde la API
    fetch("/api/chats")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setChats(data)
        }
      })
      .catch((err) => console.error("Failed to refresh chats after user_left:", err))
  }, [])

  const handleNewMessage = useCallback((message: MessageWithDetails) => {
    // 1. Play Sound (if not own message)
    if (message.senderId !== currentUser.id) {
      const audio = new Audio("/new_message.mpeg")
      audio.volume = 0.5
      audio.play().catch(e => console.log("Audio play blocked", e))
    }

    // 2. Update messages if in the same chat
    setMessages((prev) => {
      // Use ref to get current selectedChatId
      if (message.chatId === selectedChatIdRef.current) {
        // Avoid duplicates
        if (prev.some((m) => m.id === message.id)) return prev
        return [...prev, message]
      }
      return prev
    })

    // 3. Update last message in chat list AND Reorder Chat to Top
    setChats((prev) => {
      // Find the chat that needs updating
      const chatIndex = prev.findIndex(chat => chat.id === message.chatId)

      if (chatIndex === -1) return prev

      const updatedChat = {
        ...prev[chatIndex],
        lastMessage: {
          id: message.id,
          content: message.content || (message.mediaFiles.some(m => m.fileType === 'image/sticker') ? "⭐ Sticker" : "📎 Archivo"),
          sentAt: message.sentAt.toString(),
          senderId: message.senderId,
          senderUsername: message.sender.username,
        },
      }

      // Move to top
      const newChats = [...prev]
      newChats.splice(chatIndex, 1) // Remove old
      newChats.unshift(updatedChat) // Add new to top
      return newChats
    })
  }, [currentUser.id])

  const handleUserJoined = useCallback((data: any) => {
    // Update chat participants
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id === data.chatId) {
          // Check if participant already exists to avoid duplicates
          const exists = chat.participants.some((p) => p.userId === data.user.userId)
          if (!exists) {
            return {
              ...chat,
              participants: [...chat.participants, data.user],
            }
          }
        }
        return chat
      }),
    )

    // If currently looking at this chat, add system message
    if (data.chatId === selectedChatIdRef.current) {
      setMessages((prev) => {
        // Check if message already exists
        const exists = prev.some(m => m.id === data.message.id)
        if (exists) return prev
        return [...prev, data.message]
      })
    }

    // Re-sincronizar lista de chats/participantes desde la API para asegurar consistencia
    fetch("/api/chats")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setChats(data)
        }
      })
      .catch((err) => console.error("Failed to refresh chats after user_joined:", err))
  }, [])

  const handleMessageUpdated = useCallback((updatedMessage: MessageWithDetails) => {
    // Update in messages list if currently selected
    if (updatedMessage.chatId === selectedChatIdRef.current) {
      setMessages((prev) => prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m)))
    }

    // Update in chats list (lastMessage)
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id === updatedMessage.chatId && chat.lastMessage?.id === updatedMessage.id) {
          return {
            ...chat,
            lastMessage: {
              ...chat.lastMessage,
              content: updatedMessage.content,
              sentAt: updatedMessage.sentAt.toString(),
            },
          }
        }
        return chat
      })
    )
  }, [])

  const handleMessageDeleted = useCallback((messageId: string, chatId: string) => {
    // Update in messages list if currently selected
    if (chatId === selectedChatIdRef.current) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            // Preserve the original object structure but mark as deleted
            ? { ...m, deletedAt: new Date() }
            : m
        )
      )
    }

    // Update in chats list (lastMessage)
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id === chatId && chat.lastMessage?.id === messageId) {
          return {
            ...chat,
            lastMessage: {
              ...chat.lastMessage,
              content: "🚫 Este mensaje fue eliminado",
            },
          }
        }
        return chat
      })
    )
  }, [])

  useEffect(() => {
    if (!socket) return

    // Socket event listeners
    const onConnect = () => {
      console.log("[CLIENT] Socket Connected:", socket.id)
      
      // Join ALL chat rooms to receive notifications
      if (chatsRef.current.length > 0) {
        console.log("[CLIENT] Joining all chats:", chatsRef.current.map(c => c.id))
        chatsRef.current.forEach(chat => {
          socket.emit("join_chat", chat.id)
        })
      }
    }

    socket.on("connect", onConnect)

    // Usuario está escribiendo
    socket.on("typing", (data: { chatId: string; userId: string; username: string }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev)
        const currentSet = new Set(next.get(data.chatId) || [])
        currentSet.add(data.username)
        next.set(data.chatId, currentSet)
        return next
      })
    })

    // Usuario dejó de escribir
    socket.on("stop_typing", (data: { chatId: string; userId: string; username: string }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev)
        const currentSet = new Set(next.get(data.chatId) || [])
        currentSet.delete(data.username)
        if (currentSet.size === 0) {
          next.delete(data.chatId)
        } else {
          next.set(data.chatId, currentSet)
        }
        return next
      })
    })

    socket.on("message", (data: { chatId: string, message: MessageWithDetails }) => {
      console.log("[CLIENT] Received message for chat:", data.chatId)
      handleNewMessage(data.message)
    })

    socket.on("user_joined", (data: any) => {
      console.log("[CLIENT] User Joined:", data)
      handleUserJoined(data)
    })

    socket.on("message_updated", (data: { chatId: string, message: MessageWithDetails }) => {
      handleMessageUpdated(data.message)
    })

    socket.on("message_deleted", (data: { chatId: string, messageId: string }) => {
      handleMessageDeleted(data.messageId, data.chatId)
    })

    socket.on("user_left", (data: any) => {
      console.log("[CLIENT] User Left:", data)
      handleUserLeft(data)
    })

    // Cuando alguien lee mensajes
    socket.on("messages_read", (data: { chatId: string, messageIds: string[], userId: string, username: string, readAt: string }) => {
      console.log("[CLIENT] Messages read:", data)
      // Actualizar el estado de los mensajes con la nueva lectura
      setMessages((prev) =>
        prev.map((m) => {
          if (data.messageIds.includes(m.id)) {
            const existingReadBy = Array.isArray((m as any).readBy) ? (m as any).readBy : []
            // Solo agregar si no existe ya
            if (!existingReadBy.some((r: any) => r.userId === data.userId)) {
              return {
                ...m,
                readBy: [
                  ...existingReadBy,
                  {
                    userId: data.userId,
                    username: data.username,
                    readAt: data.readAt,
                  },
                ],
              } as any
            }
          }
          return m
        })
      )
    })

    // Cuando me agregan a un chat nuevo
    socket.on("added_to_chat", (data: { chatId: string }) => {
      console.log("[CLIENT] ✅ ADDED TO CHAT EVENT RECEIVED:", data)
      console.log("[CLIENT] Current user ID:", currentUser.id)
      console.log("[CLIENT] Chat ID:", data.chatId)
      
      // Refrescar la lista de chats para obtener el nuevo chat
      console.log("[CLIENT] Fetching updated chat list...")
      fetch("/api/chats")
        .then((res) => {
          console.log("[CLIENT] Chats API response status:", res.status)
          return res.ok ? res.json() : null
        })
        .then((chatsData) => {
          if (chatsData) {
            console.log("[CLIENT] Updated chats received:", chatsData.length, "chats")
            setChats(chatsData)
            // Unirse al room del nuevo chat
            console.log("[CLIENT] Joining new chat room:", data.chatId)
            socket.emit("join_chat", data.chatId)
          }
        })
        .catch((err) => console.error("[CLIENT] ❌ Failed to refresh chats after being added:", err))
    })

    return () => {
      socket.off("connect", onConnect)
      socket.off("message")
      socket.off("typing")
      socket.off("stop_typing")
      socket.off("user_joined")
      socket.off("user_left")
      socket.off("message_updated")
      socket.off("message_deleted")
      socket.off("messages_read")
      socket.off("added_to_chat")
    }
  }, [socket, handleNewMessage, handleUserJoined, handleUserLeft, handleMessageUpdated, handleMessageDeleted])

  const refreshChats = useCallback(async () => {
    try {
      const response = await fetch("/api/chats")
      if (response.ok) {
        const data = await response.json()
        setChats(data)
        // Also ensure we join any new chats found
        if (socket) {
          data.forEach((c: any) => socket.emit("join_chat", c.id))
        }
      }
    } catch (error) {
      console.error("Failed to refresh chats:", error)
    }
  }, [socket])

  const selectChat = async (chatId: string) => {
    // We do NOT leave the previous chat room anymore, to keep receiving notifications
    setSelectedChatId(chatId)

    // Ensure we are joined to this room (just in case)
    if (socket) socket.emit("join_chat", chatId)

    // Fetch messages for this chat
    try {
      const response = await fetch(`/api/chats/${chatId}/messages`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data)

        // Marcar como leídos los mensajes recibidos (no propios)
        const messagesToMark = (data as any[]).filter((m) =>
          m.type === 'message' &&
          m.senderId !== currentUser.id &&
          !(Array.isArray(m.readBy) && m.readBy.some((r: any) => r.userId === currentUser.id))
        )

        if (messagesToMark.length > 0) {
          const ids = messagesToMark.map((m) => m.id)
          fetch('/api/messages/read-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, messageIds: ids }),
          }).then(() => {
            // Emitir evento de lectura por WebSocket
            if (socket && socket.connected) {
              socket.emit("messages_read", {
                chatId,
                messageIds: ids,
                userId: currentUser.id,
                username: currentUser.username,
              })
            }
          }).catch((err) => console.error('Failed to mark messages as read:', err))

          // Actualizar localmente el estado para reflejar las lecturas
          setMessages((prev) =>
            prev.map((m) => {
              if (ids.includes(m.id) && (m as any).type === 'message') {
                const existingReadBy = Array.isArray((m as any).readBy) ? (m as any).readBy : []
                if (!existingReadBy.some((r: any) => r.userId === currentUser.id)) {
                  return {
                    ...m,
                    readBy: [
                      ...existingReadBy,
                      {
                        userId: currentUser.id,
                        username: currentUser.username,
                        readAt: new Date().toISOString(),
                      },
                    ],
                  } as any
                }
              }
              return m
            })
          )
        }
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error)
    }
  }

  const sendChatMessage = async (
    content: string,
    mediaFiles?: Array<{ fileUrl: string; fileType: string }>,
    replyToMessageId?: string,
  ) => {
    if (!selectedChatId) return

    try {
      const response = await fetch(`/api/chats/${selectedChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, mediaFiles, replyToMessageId }),
      })

      if (response.ok) {
        const newMessage = await response.json()

        // 1. Update local state immediately for better UX
        handleNewMessage(newMessage)

        // 2. Emit socket event for other users
        if (socket && socket.connected) {
          console.log("[CLIENT] Emitting send_message to chat:", selectedChatId)
          socket.emit("send_message", {
            chatId: selectedChatId,
            message: newMessage
          })
        } else {
          console.warn("[CLIENT] Socket not connected, message not broadcasted")
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error)
    }
  }

  const loadOlderMessages = async () => {
    if (!selectedChatId || messages.length === 0) return

    const oldest = messages[0]
    const before = oldest.sentAt

    try {
      const response = await fetch(`/api/chats/${selectedChatId}/messages?before=${encodeURIComponent(before as any)}`)
      if (!response.ok) return

      const older = await response.json()
      if (!Array.isArray(older) || older.length === 0) return

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id))
        const filteredOlder = (older as any[]).filter((m) => !existingIds.has(m.id))
        return [...filteredOlder, ...prev]
      })
    } catch (error) {
      console.error("Failed to load older messages:", error)
    }
  }

  const sendTypingIndicator = (isTyping: boolean) => {
    if (!selectedChatId) return

    socket.emit(isTyping ? "typing" : "stop_typing", {
      chatId: selectedChatId,
      userId: currentUser.id,
      username: currentUser.username,
    })
  }

  const handleChatCreated = (newChat: (typeof chats)[0]) => {
    setChats((prev) => [newChat, ...prev])
    setSelectedChatId(newChat.id)
    socket.emit("join_chat", newChat.id)
  }

  const addParticipantToSelectedChat = async (username: string) => {
    if (!selectedChatId) return

    try {
      const response = await fetch(`/api/chats/${selectedChatId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const errorMessage = data?.error || "Error al agregar participante"
        console.error("Failed to add participant:", errorMessage)
        return { success: false, error: errorMessage }
      }

      // Emitir evento por socket para que todos actualicen el chat
      if (socket && data?.socketEvent) {
        console.log("[CLIENT] 📤 Emitting user_joined event:", data.socketEvent)
        console.log("[CLIENT] User being added:", data.socketEvent.user)
        socket.emit("user_joined", data.socketEvent)
      } else {
        console.warn("[CLIENT] ⚠️ Cannot emit user_joined:", { hasSocket: !!socket, hasEvent: !!data?.socketEvent })
      }

      return { success: true }
    } catch (error) {
      console.error("Failed to add participant:", error)
      return { success: false, error: "Error al agregar participante" }
    }
  }

  const removeParticipantFromSelectedChat = async (userId: string) => {
    if (!selectedChatId) return

    try {
      const response = await fetch(`/api/chats/${selectedChatId}/participants`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const errorMessage = data?.error || "Error al eliminar participante"
        console.error("Failed to remove participant:", errorMessage)
        return { success: false, error: errorMessage }
      }

      if (socket && data?.socketEvent) {
        socket.emit("user_left", data.socketEvent)
      }

      return { success: true }
    } catch (error) {
      console.error("Failed to remove participant:", error)
      return { success: false, error: "Error al eliminar participante" }
    }
  }

  // Función para seleccionar chat (en móvil también muestra el chat)
  const handleSelectChat = (chatId: string) => {
    selectChat(chatId)
    setShowMobileChat(true)
  }

  // Función para volver al sidebar en móvil
  const handleBackToSidebar = () => {
    setShowMobileChat(false)
  }

  return (
    <div className="flex h-screen bg-[var(--color-chat-bg)] overflow-hidden">
      {/* Sidebar - oculto en móvil cuando hay chat seleccionado */}
      <div className={`
        ${showMobileChat ? 'hidden' : 'flex'} 
        md:flex 
        w-full md:w-auto md:max-w-sm
        flex-shrink-0
      `}>
        <ChatSidebar
          currentUser={currentUser}
          chats={chats}
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          onChatCreated={handleChatCreated}
          onRefreshChats={refreshChats}
          onlineUsers={onlineUsers}
          isConnected={isConnected}
          drafts={drafts}
          typingUsers={typingUsers}
        />
      </div>

      {/* Chat View - pantalla completa en móvil */}
      <div className={`
        ${showMobileChat ? 'flex' : 'hidden'} 
        md:flex 
        flex-1 
        flex-col
        min-w-0
      `}>
        {selectedChat ? (
          <ChatView
            currentUser={currentUser}
            chat={selectedChat}
            messages={messages}
            typingUsers={typingUsers.get(selectedChatId!) || new Set()}
            onSendMessage={sendChatMessage}
            onTyping={sendTypingIndicator}
            onAddParticipant={addParticipantToSelectedChat}
            onLoadOlderMessages={loadOlderMessages}
            onRemoveParticipant={removeParticipantFromSelectedChat}
            onBack={handleBackToSidebar}
            draft={drafts.get(selectedChatId!) || ""}
            onDraftChange={(text) => {
              setDrafts(prev => {
                const next = new Map(prev)
                if (text.trim()) {
                  next.set(selectedChatId!, text)
                } else {
                  next.delete(selectedChatId!)
                }
                return next
              })
            }}
            onEditMessage={async (messageId, newContent) => {
              try {
                const response = await fetch(`/api/messages/${messageId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ content: newContent }),
                })
                if (response.ok) {
                  const updatedMessage = await response.json()
                  handleMessageUpdated(updatedMessage)
                  socket.emit("message_updated", { chatId: selectedChatId, message: updatedMessage })
                }
              } catch (e) {
                console.error("Failed to edit message", e)
              }
            }}
            onDeleteMessage={async (messageId) => {
              try {
                const response = await fetch(`/api/messages/${messageId}`, {
                  method: "DELETE",
                })
                if (response.ok) {
                  // Soft delete on client immediately for UX
                  handleMessageDeleted(messageId, selectedChatId!)
                  socket.emit("message_deleted", { chatId: selectedChatId, messageId })
                }
              } catch (e) {
                console.error("Failed to delete message", e)
              }
            }}
            onlineUsers={onlineUsers}
          />
        ) : (
          <EmptyChatView />
        )}
      </div>
    </div>
  )
}
