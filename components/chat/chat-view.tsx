"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Send, Paperclip, MoreVertical, Copy, Users, File, X, Loader2, Smile, Trash2, Pencil, PlusCircle, Play, Pause, Reply, Search, Pin, BellOff, BarChart3, ArrowLeft } from "lucide-react"
import EmojiPicker, { Theme as EmojiTheme } from "emoji-picker-react"
import { format, isToday, isYesterday } from "date-fns"
import { toast } from "sonner"
import type { MessageWithDetails } from "@/lib/types"
import { STICKERS } from "@/lib/stickers"
import { ParticipantsModal } from "./participants-modal"
import { SystemMessage } from "./system-message"
import { LinkPreview, extractUrls } from "./link-preview"
import { PinnedMessages } from "./pinned-messages"
import { ChatSearch } from "./chat-search"
import { PollCreator } from "./poll-creator"
import { PollDisplay } from "./poll-display"
import { MuteChatDialog } from "./mute-chat-dialog"

async function saveStickerFromUrl(
  url: string,
  userId: string,
  customStickers: typeof STICKERS,
  setCustomStickers: React.Dispatch<React.SetStateAction<typeof STICKERS>>,
) {
  const defaultName = url.split("/").pop()?.split(".")[0] || "sticker"
  const name = defaultName.trim()

  // Evitar duplicados por URL o por nombre
  const alreadyExists = customStickers.some(
    (s) => s.url === url || s.name.toLowerCase() === name.toLowerCase(),
  )

  if (alreadyExists) {
    toast.info("Ya tienes este sticker guardado")
    return
  }

  const toastId = toast.loading("Guardando sticker...")
  try {
    const response = await fetch("/api/stickers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        name,
        url,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.error || "Error al guardar sticker")
    }

    const savedSticker = await response.json()
    const newSticker = {
      id: savedSticker.id,
      name: savedSticker.name,
      url: savedSticker.url,
      keywords: [savedSticker.name, "custom"],
    }
    setCustomStickers((prev) => [newSticker, ...prev])
    toast.success("Sticker guardado", { id: toastId })
  } catch (e) {
    console.error("Failed to save sticker from message", e)
    toast.error("Error al guardar sticker", { id: toastId })
  }
}

interface ChatViewProps {
  currentUser: {
    id: string
    username: string
    profilePhotoUrl: string | null
  }
  chat: {
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
  }
  messages: MessageWithDetails[]
  typingUsers: Set<string>
  onSendMessage: (
    content: string,
    mediaFiles?: Array<{ fileUrl: string; fileType: string }>,
    replyToMessageId?: string,
  ) => void
  onTyping: (isTyping: boolean) => void
  onAddParticipant: (username: string) => Promise<{ success: boolean; error?: string } | void>
  onRemoveParticipant: (userId: string) => Promise<{ success: boolean; error?: string } | void>
  onLoadOlderMessages?: () => Promise<void> | void
  onEditMessage: (messageId: string, newContent: string) => void
  onDeleteMessage: (messageId: string) => void
  onlineUsers: Set<string>
  draft?: string
  onDraftChange?: (text: string) => void
  onBack?: () => void
  socket?: any
}

export function ChatView({
  currentUser,
  chat,
  messages,
  typingUsers,
  onSendMessage,
  onTyping,
  onAddParticipant,
  onRemoveParticipant,
  onLoadOlderMessages,
  onlineUsers,
  onEditMessage,
  onDeleteMessage,
  draft = "",
  onDraftChange,
  onBack,
  socket,
}: ChatViewProps) {
  const [messageInput, setMessageInput] = useState(draft)
  // Unified Attachment State
  const [attachments, setAttachments] = useState<Array<{ type: 'file' | 'sticker', file?: File, stickerUrl?: string, stickerType?: 'image' | 'video', id: string }>>([])

  const [isUploading, setIsUploading] = useState(false)
  const [showParticipantsModal, setShowParticipantsModal] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showAddParticipantDialog, setShowAddParticipantDialog] = useState(false)
  const [newParticipantUsername, setNewParticipantUsername] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)

  // Picker State
  const [showPicker, setShowPicker] = useState(false)
  const [pickerTab, setPickerTab] = useState<'emoji' | 'sticker'>('emoji')

  // Command State (stickers ::)
  const [commandQuery, setCommandQuery] = useState<string | null>(null)
  // Mentions State (@)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)

  // Edit state
  const [editingMessage, setEditingMessage] = useState<MessageWithDetails | null>(null)
  const [replyingTo, setReplyingTo] = useState<MessageWithDetails | null>(null)

  const [customStickers, setCustomStickers] = useState<typeof STICKERS>([])
  const [stickerPreview, setStickerPreview] = useState<{ file: File; url: string; name: string; type: "image" | "video" } | null>(null)
  const [stickerName, setStickerName] = useState("")
  const [stickerUploading, setStickerUploading] = useState(false)

  const [profilePreview, setProfilePreview] = useState<{ url: string; username: string } | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageZoom, setImageZoom] = useState(1)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // New feature states
  const [showSearch, setShowSearch] = useState(false)
  const [showPollCreator, setShowPollCreator] = useState(false)
  const [showMuteDialog, setShowMuteDialog] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const stickerInputRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const displayName = getChatDisplayName(chat, currentUser.id)
  const otherParticipants = chat.participants.filter((p) => p.userId !== currentUser.id)
  const isAnyOnline = otherParticipants.some((p) => onlineUsers.has(p.userId))
  const typingUsernames = Array.from(typingUsers).filter((name) => name !== currentUser.username)
  const hasTyping = typingUsernames.length > 0

  // Asegurar que al iniciar una respuesta el foco vaya siempre al input
  useEffect(() => {
    if (replyingTo && messageInputRef.current) {
      // Pequeño delay para que el menú contextual se cierre primero
      const timer = setTimeout(() => {
        messageInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [replyingTo])

  const openProfilePreview = (url: string | null, username: string) => {
    const safeUrl = url || "/placeholder-user.jpg"
    setProfilePreview({ url: safeUrl, username })
  }

  // Ref para saber si es la carga inicial del chat
  const isInitialLoadRef = useRef(true)
  const prevMessagesLengthRef = useRef(0)

  // Scroll to bottom cuando cambia el chat - INSTANTÁNEO
  useEffect(() => {
    isInitialLoadRef.current = true
    prevMessagesLengthRef.current = 0
    
    // Scroll instantáneo al cambiar de chat
    const id = setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "instant", block: "end" })
      }
      // Marcar que ya no es carga inicial después del primer scroll
      setTimeout(() => {
        isInitialLoadRef.current = false
        prevMessagesLengthRef.current = messages.length
      }, 50)
    }, 50)

    return () => clearTimeout(id)
  }, [chat.id])

  // Scroll to bottom cuando llegan nuevos mensajes
  useEffect(() => {
    // Si es carga inicial o no hay mensajes, no hacer nada (lo maneja el otro useEffect)
    if (isInitialLoadRef.current || messages.length === 0) return
    
    // Solo hacer scroll si hay mensajes nuevos (no cuando se cargan antiguos)
    if (messages.length > prevMessagesLengthRef.current) {
      if (messagesEndRef.current) {
        // Scroll instantáneo para mensajes nuevos
        messagesEndRef.current.scrollIntoView({ behavior: "instant", block: "end" })
      }
    }
    prevMessagesLengthRef.current = messages.length
  }, [messages.length])

  // Referencia al chat anterior para guardar borrador al cambiar
  const prevChatIdRef = useRef<string>(chat.id)
  const currentInputRef = useRef<string>(messageInput)
  
  // Mantener actualizada la referencia del input actual
  useEffect(() => {
    currentInputRef.current = messageInput
  }, [messageInput])

  // Guardar borrador del chat anterior cuando cambiamos de chat
  useEffect(() => {
    if (prevChatIdRef.current !== chat.id) {
      // Guardar el borrador del chat anterior
      onDraftChange?.(currentInputRef.current)
      // Emitir stop_typing para el chat anterior
      onTyping(false)
      prevChatIdRef.current = chat.id
    }
    
    // Cargar borrador del nuevo chat
    setMessageInput(draft)
    setAttachments([])
    setReplyingTo(null)
    setEditingMessage(null)
    setShowPicker(false)
    setCommandQuery(null)
    setMentionQuery(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id]) // Solo cuando cambia el chat

  // Guardar borrador y emitir stop_typing cuando el componente se desmonta
  useEffect(() => {
    return () => {
      onDraftChange?.(currentInputRef.current)
      onTyping(false)
      // Limpiar timeout de typing
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const validateAndAddFiles = (files: File[]) => {
    const validFiles = files.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} es muy pesado (max 10MB)`)
        return false
      }
      return true
    })

    if (validFiles.length > 0) {
      const newAttachments = validFiles.map(f => ({
        type: 'file' as const,
        file: f,
        id: Math.random().toString(36).substring(7)
      }))
      setAttachments((prev) => [...prev, ...newAttachments].slice(0, 5))
      toast.success(`${validFiles.length} archivo(s) añadido(s)`)
    }
  }

  // Click outside to close picker
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Fetch custom stickers on mount
  useEffect(() => {
    fetch(`/api/stickers?userId=${currentUser.id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          // Filter out duplicates if any, or just set them.
          // Map DB shape to Sticker shape if different, but here we kept it consistent.
          const mapped = data.map((s: any) => ({
            id: s.id,
            name: s.name,
            url: s.url,
            type: s.type || "image", // "image" or "video"
            keywords: [s.name, "custom"]
          }))
          setCustomStickers(mapped)
        }
      })
      .catch(err => console.error("Failed to load stickers", err))
  }, [currentUser.id])

  const handleStickerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Detectar tipo por MIME o por extensión del archivo
    const ext = file.name.split('.').pop()?.toLowerCase() || ""
    const imageExtensions = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "gift"] // gift = gif mal nombrado
    const videoExtensions = ["mp4", "mov", "avi", "webm", "mkv", "m4v", "wmv", "flv"]
    
    const isVideo = file.type.startsWith("video/") || videoExtensions.includes(ext)
    const isImage = file.type.startsWith("image/") || imageExtensions.includes(ext)

    if (!isVideo && !isImage) {
      toast.error("Solo se permiten imágenes o videos")
      return
    }

    // Check file size (max 100MB)
    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > 100) {
      toast.error("El archivo es muy grande. Máximo 100MB")
      return
    }

    // For videos, check duration using a video element
    if (isVideo) {
      const video = document.createElement("video")
      video.preload = "metadata"
      
      const durationCheck = new Promise<boolean>((resolve) => {
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(video.src)
          if (video.duration > 15) {
            toast.error("El video es muy largo. Máximo 15 segundos")
            resolve(false)
          } else {
            resolve(true)
          }
        }
        video.onerror = () => {
          toast.error("No se pudo leer el video")
          resolve(false)
        }
      })
      
      video.src = URL.createObjectURL(file)
      const isValid = await durationCheck
      if (!isValid) return
    }

    // Show preview
    const defaultName = file.name.split('.')[0]
    setStickerPreview({ 
      file, 
      url: URL.createObjectURL(file), 
      name: defaultName,
      type: isVideo ? "video" : "image"
    })
    setStickerName(defaultName)
    if (stickerInputRef.current) stickerInputRef.current.value = ""
  }

  const confirmStickerUpload = async () => {
    if (!stickerPreview || !stickerName.trim()) {
      toast.error("Por favor ingresa un nombre para el sticker")
      return
    }

    setStickerUploading(true)
    const isVideo = stickerPreview.type === "video"
    const toastId = toast.loading(isVideo ? "Subiendo y comprimiendo video..." : "Subiendo sticker...")
    
    const formData = new FormData()
    formData.append("file", stickerPreview.file)
    formData.append("userId", currentUser.id)
    formData.append("name", stickerName.trim())

    try {
      // Use the new unified upload endpoint that handles both upload and save
      const response = await fetch("/api/stickers/upload", { method: "POST", body: formData })
      
      if (response.ok) {
        const savedSticker = await response.json()
        const newSticker = {
          id: savedSticker.id,
          name: savedSticker.name,
          url: savedSticker.url,
          type: savedSticker.type,
          keywords: [savedSticker.name, "custom"],
        }
        setCustomStickers((prev) => [newSticker, ...prev])
        toast.success("Sticker guardado", { id: toastId })
        setStickerPreview(null)
        setStickerName("")
      } else {
        const error = await response.json().catch(() => ({ error: "Error desconocido" }))
        toast.error(error.error || "Error al subir sticker", { id: toastId })
      }
    } catch {
      toast.error("Error al procesar", { id: toastId })
    } finally {
      setStickerUploading(false)
    }
  }

  const cancelStickerUpload = () => {
    setStickerPreview(null)
    setStickerName("")
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setMessageInput(value)
    onDraftChange?.(value)

    // Auto-resize textarea
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`

    // Detectar menciones (@username)
    const cursorPos = e.target.selectionStart || 0
    const textBeforeCursor = value.slice(0, cursorPos)
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/)
    
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1])
      setCommandQuery(null)
    } else {
      setMentionQuery(null)
    }

    // Detectar comandos (/sticker)
    const commandMatch = textBeforeCursor.match(/\/(\w*)$/)
    if (commandMatch) {
      setCommandQuery(commandMatch[1])
      setMentionQuery(null)
    } else if (!mentionMatch) {
      setCommandQuery(null)
    }

    // Typing indicator
    if (value.trim()) {
      onTyping(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => onTyping(false), 2000)
    } else {
      onTyping(false)
    }
  }

  const handleEmojiClick = (emojiData: any) => {
    setMessageInput((prev) => prev + emojiData.emoji)
    if (messageInputRef.current) {
      messageInputRef.current.focus()
    }
  }

  const handleStickerSelect = (sticker: typeof STICKERS[0] & { type?: string }) => {
    setAttachments(prev => [...prev, {
      type: 'sticker',
      stickerUrl: sticker.url,
      stickerType: (sticker as any).type === "video" ? "video" : "image",
      id: sticker.id // or generate unique ID if allowing multiple of same
    }])
    setShowPicker(false)
    if (messageInputRef.current) {
      messageInputRef.current.focus()
    }
  }

  // Handle command selection via Space or Enter
  const handleCommandSelect = (sticker: typeof STICKERS[0]) => {
    // Remove command text
    setMessageInput(prev => prev.replace(/::\w*$/, ""))
    handleStickerSelect(sticker)
    setCommandQuery(null)
  }

  const handleMentionSelect = (username: string) => {
    setMessageInput((prev) => prev.replace(/@\w*$/, `@${username} `))
    setMentionQuery(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    validateAndAddFiles(files)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file") {
        const file = items[i].getAsFile()
        if (file) files.push(file)
      }
    }
    if (files.length > 0) {
      e.preventDefault()
      validateAndAddFiles(files)
    }
  }

  // Drag handlers reused similarly...
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) validateAndAddFiles(files)
  }

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    if (target.scrollTop < 80 && !isLoadingOlder && onLoadOlderMessages) {
      setIsLoadingOlder(true)
      try {
        await onLoadOlderMessages()
      } finally {
        setIsLoadingOlder(false)
      }
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const startEditing = (message: MessageWithDetails) => {
    setReplyingTo(null)
    setEditingMessage(message)
    setMessageInput(message.content || "")
  }

  const cancelEditing = () => {
    setEditingMessage(null)
    setMessageInput("")
  }

  const startReply = (message: MessageWithDetails) => {
    setEditingMessage(null)
    setReplyingTo(message)
    if (messageInputRef.current) {
      messageInputRef.current.focus()
    }
  }

  const handleSend = async () => {
    if (!messageInput.trim() && attachments.length === 0) return

    if (editingMessage) {
      onEditMessage(editingMessage.id, messageInput.trim())
      setEditingMessage(null)
      setMessageInput("")
      return
    }

    setIsUploading(true)

    try {
      const mediaFiles: Array<{ fileUrl: string; fileType: string }> = []

      // Process Attachments
      for (const att of attachments) {
        if (att.type === 'file' && att.file) {
          const formData = new FormData()
          formData.append("file", att.file)
          const response = await fetch("/api/upload-media", { method: "POST", body: formData })
          if (response.ok) {
            const data = await response.json()
            mediaFiles.push({ fileUrl: data.url, fileType: att.file.type })
          }
        } else if (att.type === 'sticker' && att.stickerUrl) {
          // Treat sticker as a special type for rendering (image or video)
          const stickerFileType = att.stickerType === "video" ? "video/sticker" : "image/sticker"
          mediaFiles.push({ fileUrl: att.stickerUrl, fileType: stickerFileType })
        }
      }

      onSendMessage(
        messageInput.trim(),
        mediaFiles.length > 0 ? mediaFiles : undefined,
        replyingTo ? replyingTo.id : undefined,
      )
      setMessageInput("")
      onDraftChange?.("") // Limpiar borrador al enviar
      setAttachments([])
      setReplyingTo(null)
      onTyping(false)
      setShowPicker(false)
    } catch {
      toast.error("Failed to send message")
    } finally {
      setIsUploading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Si hay una mención activa, completar primero
      if (mentionQuery !== null) {
        const query = mentionQuery.toLowerCase()
        const candidates = chat.participants.filter((p) =>
          p.username.toLowerCase().startsWith(query),
        )
        if (candidates.length > 0) {
          e.preventDefault()
          handleMentionSelect(candidates[0].username)
          return
        }
      }

      e.preventDefault()
      handleSend()
    }
    if (e.key === "Escape") {
      if (editingMessage) cancelEditing()
      if (replyingTo) setReplyingTo(null)
      setShowPicker(false)
      setCommandQuery(null)
      setMentionQuery(null)
    }
    // Space or Tab to autocomplete command
    if ((e.key === " " || e.key === "Tab") && commandQuery !== null) {
      const allStickers = [...customStickers, ...STICKERS]
      const filteredStickers = allStickers.filter(s => s.name.toLowerCase().startsWith(commandQuery.toLowerCase()))
      if (filteredStickers.length > 0) {
        e.preventDefault()
        handleCommandSelect(filteredStickers[0]) // Pick first match
      }
    }
  }

  const copyInviteCode = async () => {
    console.log("Attempting to copy chat ID:", chat.id)
    try {
      // 1. Try modern API if available and secure
      if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(chat.id)
        toast.success("¡Código del chat copiado!")
      } else {
        // 2. Fallback for insecure contexts (HTTP)
        const textarea = document.createElement("textarea")
        textarea.value = chat.id

        // Move off-screen but keep part of it visible to avoid browser restrictions
        textarea.style.position = "fixed"
        textarea.style.left = "-9999px"
        textarea.style.top = "0"
        textarea.setAttribute("readonly", "")

        document.body.appendChild(textarea)

        // Select text
        textarea.focus()
        textarea.select()
        textarea.setSelectionRange(0, 99999) // Mobile support

        try {
          const successful = document.execCommand("copy")
          if (successful) {
            toast.success("¡Código del chat copiado!")
          } else {
            throw new Error("execCommand failed")
          }
        } catch (err) {
          console.error("Fallback copy failed:", err)
          // 3. Last resort: Prompt user to copy manually
          window.prompt("Copia este código manualmente:", chat.id)
        } finally {
          document.body.removeChild(textarea)
        }
      }
    } catch (err) {
      console.error("Failed to copy:", err)
      toast.error("Error al copiar. Código: " + chat.id)
      // Ultimate fallback
      window.prompt("Copia este código manualmente:", chat.id)
    }
  }

  // Group messages by date
  const groupedMessages = groupMessagesByDate(messages)
  const messagesById = new Map(messages.map((m) => [m.id, m]))

  const scrollToMessage = (messageId: string) => {
    const el = document.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)
    if (!el) return

    el.scrollIntoView({ behavior: "smooth", block: "center" })
    el.classList.add("ring-2", "ring-primary")
    setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary")
    }, 1200)
  }

  const handleAddParticipant = async () => {
    const username = newParticipantUsername.trim()
    if (!username) {
      toast.error("Ingresa el nombre de usuario")
      return
    }

    const result = await onAddParticipant(username)

    if (!result || !result.success) {
      toast.error(result?.error || "Error al agregar participante")
      return
    }

    toast.success("Participante agregado correctamente")
    setNewParticipantUsername("")
    setShowAddParticipantDialog(false)
  }

  const handleRemoveParticipant = async (participant: { userId: string; username: string }) => {
    const result = await onRemoveParticipant(participant.userId)

    if (!result || !result.success) {
      toast.error(result?.error || "Error al eliminar participante")
      return
    }

    toast.success(`${participant.username} ha sido eliminado del chat`)
  }

  return (
    <div
      className="flex h-full flex-col bg-[var(--color-chat-bg)] relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-lg bg-card p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
              <File className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Suelta los archivos aquí</h3>
            <p className="mt-2 text-sm text-muted-foreground">Para adjuntarlos al mensaje</p>
          </div>
        </div>
      )}

      {/* Header - sticky para que siempre sea visible */}
      <div className="flex items-center justify-between border-b border-border bg-card px-2 sm:px-4 py-2 sm:py-3 sticky top-0 z-30 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Botón volver - solo visible en móvil */}
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="md:hidden h-9 w-9 flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          
          <button
            type="button"
            onClick={() => {
              if (chat.type === "INDIVIDUAL" && otherParticipants[0]) {
                openProfilePreview(otherParticipants[0].profilePhotoUrl, otherParticipants[0].username)
              }
            }}
            className="focus:outline-none flex-shrink-0"
          >
            <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
              {chat.type === "INDIVIDUAL" && otherParticipants[0]?.profilePhotoUrl ? (
                <AvatarImage src={otherParticipants[0].profilePhotoUrl || "/placeholder.svg"} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {chat.type === "GROUP" ? <Users className="h-4 w-4 sm:h-5 sm:w-5" /> : displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-sm sm:text-base truncate">{displayName}</h2>
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              {hasTyping ? (
                <span className="text-primary">{typingUsernames.join(", ")} escribiendo...</span>
              ) : isAnyOnline ? (
                <span className="text-[var(--color-online)]">En línea</span>
              ) : (
                `${chat.participants.length} participantes`
              )}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowInviteDialog(true)}>
              <Copy className="mr-2 h-4 w-4" />
              Ver Código de Invitación
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowParticipantsModal(true)}>
              <Users className="mr-2 h-4 w-4" />
              Ver Participantes ({chat.participants.length})
            </DropdownMenuItem>
            {chat.type === "GROUP" && chat.adminId === currentUser.id && (
              <DropdownMenuItem onClick={() => setShowAddParticipantDialog(true)}>
                <Users className="mr-2 h-4 w-4" />
                Agregar participante
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setShowSearch(true)}>
              <Search className="mr-2 h-4 w-4" />
              Buscar en chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowPollCreator(true)}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Crear encuesta
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowMuteDialog(true)}>
              <BellOff className="mr-2 h-4 w-4" />
              {isMuted ? "Desilenciar chat" : "Silenciar chat"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <ChatSearch
          chatId={chat.id}
          onResultClick={(messageId) => {
            // Scroll to message
            const element = document.getElementById(`message-${messageId}`)
            if (element) {
              element.scrollIntoView({ behavior: "smooth", block: "center" })
              element.classList.add("bg-primary/20")
              setTimeout(() => element.classList.remove("bg-primary/20"), 2000)
            }
            setShowSearch(false)
          }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Pinned Messages */}
      <PinnedMessages
        chatId={chat.id}
        canUnpin={chat.adminId === currentUser.id}
        onMessageClick={(messageId) => {
          const element = document.getElementById(`message-${messageId}`)
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" })
            element.classList.add("bg-primary/20")
            setTimeout(() => element.classList.remove("bg-primary/20"), 2000)
          }
        }}
      />

      {/* Invite Code Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Código de Invitación</DialogTitle>
            <DialogDescription>
              Comparte este código con otros usuarios para que puedan unirse a este chat.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <Input
                readOnly
                value={chat.id}
                className="font-mono text-center text-lg"
              />
            </div>
            <Button size="icon" onClick={copyInviteCode} className="px-3">
              <span className="sr-only">Copiar</span>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Participant Dialog (solo admin) */}
      <Dialog open={showAddParticipantDialog} onOpenChange={setShowAddParticipantDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar participante</DialogTitle>
            <DialogDescription>
              Solo el propietario del grupo puede agregar participantes escribiendo el nombre de usuario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nombre de usuario exacto"
              value={newParticipantUsername}
              onChange={(e) => setNewParticipantUsername(e.target.value)}
            />
            <Button className="w-full" onClick={handleAddParticipant}>
              Agregar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 chat-scrollbar" onScroll={handleScroll}>
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            <div className="mb-4 flex justify-center">
              <span className="rounded-lg bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">{date}</span>
            </div>
            {msgs.map((message: any, index) => (
              message.type === 'system' ? (
                <SystemMessage
                  key={message.id}
                  type={message.eventType}
                  username={message.systemUser?.username}
                  adminUsername={message.adminUser?.username}
                  timestamp={message.sentAt}
                />
              ) : (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.senderId === currentUser.id}
                  showAvatar={index === 0 || msgs[index - 1]?.senderId !== message.senderId}
                  onAvatarClick={openProfilePreview}
                  totalParticipants={chat.participants.length}
                  participants={chat.participants.map((p) => ({ userId: p.userId, username: p.username }))}
                  currentUserUsername={currentUser.username}
                  onReply={() => startReply(message)}
                  onSaveSticker={(url) => saveStickerFromUrl(url, currentUser.id, customStickers, setCustomStickers)}
                  onEdit={() => startEditing(message)}
                  onDelete={() => onDeleteMessage(message.id)}
                  repliedToMessage={message.replyToMessageId ? messagesById.get(message.replyToMessageId) : undefined}
                  onGoToMessage={scrollToMessage}
                  chatId={chat.id}
                  onPinMessage={async () => {
                    try {
                      const res = await fetch(`/api/chats/${chat.id}/pin`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ messageId: message.id }),
                      })
                      if (res.ok) {
                        toast.success("Mensaje fijado")
                      } else {
                        const data = await res.json()
                        toast.error(data.error || "Error al fijar mensaje")
                      }
                    } catch {
                      toast.error("Error al fijar mensaje")
                    }
                  }}
                  socket={socket}
                  onImageClick={setImagePreview}
                />
              )
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} className="h-4" /> {/* Add some height to ensure scrolling goes to very bottom */}
      </div>

      {/* File Preview (Attachments) */}
      {attachments.length > 0 && (
        <div className="flex gap-2 border-t border-border bg-card p-2 overflow-x-auto">
          {attachments.map((att) => (
            <div key={att.id} className="relative h-16 w-16 min-w-[4rem] rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
              {att.type === 'file' && att.file?.type.startsWith('image/') ? (
                <img src={URL.createObjectURL(att.file)} alt="preview" className="h-full w-full object-cover" />
              ) : att.type === 'file' && att.file?.type.startsWith('video/') ? (
                <video src={URL.createObjectURL(att.file)} className="h-full w-full object-cover" muted />
              ) : att.type === 'sticker' && att.stickerType === 'video' ? (
                <video src={att.stickerUrl} className="h-full w-full object-contain" autoPlay loop muted playsInline />
              ) : att.type === 'sticker' ? (
                <img src={att.stickerUrl} alt="sticker" className="h-full w-full object-contain" />
              ) : (
                <File className="h-6 w-6 text-muted-foreground" />
              )}
              <button onClick={() => removeAttachment(att.id)} className="absolute -right-1 -top-1 bg-destructive text-destructive-foreground rounded-full p-0.5"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Command Autocomplete Popover */}
      {commandQuery !== null && (() => {
        const allStickers = [...customStickers, ...STICKERS]
        const filteredStickers = allStickers.filter(s => s.name.toLowerCase().startsWith(commandQuery.toLowerCase()))
        return filteredStickers.length > 0 && (
          <div className="absolute bottom-20 left-4 z-50 bg-popover border shadow-md rounded-md p-1 min-w-[150px] max-h-[300px] overflow-y-auto">
            {filteredStickers.map(s => (
              <button key={s.id} onClick={() => handleCommandSelect(s)} className="flex items-center gap-2 w-full p-2 hover:bg-muted text-sm rounded text-left">
                {(s as any).type === "video" ? (
                  <video src={s.url} className="w-6 h-6 object-contain" autoPlay loop muted playsInline />
                ) : (
                  <img src={s.url} className="w-6 h-6 object-contain" />
                )}
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        )
      })()}

      {/* Mentions Autocomplete Popover */}
      {mentionQuery !== null && (() => {
        const query = mentionQuery.toLowerCase()
        const candidates = chat.participants.filter((p) =>
          p.username.toLowerCase().startsWith(query),
        )
        return candidates.length > 0 && (
          <div className="absolute bottom-20 left-4 z-50 bg-popover border shadow-md rounded-md p-1 min-w-[200px] max-h-[260px] overflow-y-auto">
            {candidates.map((p) => (
              <button
                key={p.userId}
                type="button"
                onClick={() => handleMentionSelect(p.username)}
                className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-muted text-sm rounded text-left"
              >
                <Avatar className="h-6 w-6">
                  {p.profilePhotoUrl ? (
                    <AvatarImage src={p.profilePhotoUrl} />
                  ) : (
                    <AvatarFallback className="text-[10px]">
                      {p.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span className="truncate">@{p.username}</span>
              </button>
            ))}
          </div>
        )
      })()}

      {/* Typing indicator dentro del chat (solo otros usuarios) */}
      {hasTyping && (
        <div className="px-4 pb-1 text-xs text-muted-foreground">
          <span className="text-primary">
            {typingUsernames.join(", ")} está escribiendo...
          </span>
        </div>
      )}

      {/* Input - sticky en la parte inferior */}
      <div className="border-t border-border bg-card p-2 sm:p-3 relative z-40 sticky bottom-0 flex-shrink-0">
        {/* Emoji/Sticker Picker */}
        {showPicker && (
          <div ref={pickerRef} className="absolute bottom-full left-0 right-0 sm:right-auto mb-2 sm:mb-4 z-50 bg-card border shadow-xl rounded-xl w-full sm:w-[90vw] sm:max-w-[500px] h-[50vh] sm:h-[500px] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2">
            <div className="flex border-b bg-muted/30">
              <button onClick={() => setPickerTab('emoji')} className={`flex-1 p-3 text-sm font-semibold transition-colors ${pickerTab === 'emoji' ? 'bg-background border-b-2 border-primary text-primary' : 'text-muted-foreground hover:bg-muted/50'}`}>Emojis 😃</button>
              <button onClick={() => setPickerTab('sticker')} className={`flex-1 p-3 text-sm font-semibold transition-colors ${pickerTab === 'sticker' ? 'bg-background border-b-2 border-primary text-primary' : 'text-muted-foreground hover:bg-muted/50'}`}>Stickers ⭐</button>
            </div>
            <div className="flex-1 overflow-y-auto p-0 bg-background">

              {pickerTab === 'emoji' ? (
                <div className="flex flex-col h-full">
                  <div className="p-2 border-b bg-muted/20">
                    <button onClick={() => stickerInputRef.current?.click()} className="flex items-center gap-2 w-full p-2 text-sm bg-card hover:bg-muted border border-dashed rounded-md transition-colors text-muted-foreground hover:text-foreground justify-center">
                      <PlusCircle className="h-4 w-4" />
                      <span>Subir Emoji Personalizado</span>
                    </button>
                  </div>
                  <div className="flex-1">
                    <EmojiPicker
                      onEmojiClick={handleEmojiClick}
                      theme={EmojiTheme.LIGHT}
                      width="100%"
                      height="100%"
                      lazyLoadEmojis={true}
                      previewConfig={{ showPreview: false }}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3">
                  {stickerPreview ? (
                    <div className="flex flex-col items-center justify-center p-4 h-full">
                      <h3 className="font-semibold mb-4">
                        Confirmar {stickerPreview.type === "video" ? "Video Sticker" : "Sticker"}
                      </h3>
                      <div className="w-40 h-40 bg-muted/50 rounded-lg p-2 mb-4 border border-dashed flex items-center justify-center overflow-hidden">
                        {stickerPreview.type === "video" ? (
                          <video 
                            src={stickerPreview.url} 
                            className="max-w-full max-h-full object-contain" 
                            autoPlay 
                            loop 
                            muted 
                            playsInline
                          />
                        ) : (
                          <img src={stickerPreview.url} alt="Preview" className="max-w-full max-h-full object-contain" />
                        )}
                      </div>
                      {stickerPreview.type === "video" && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Los videos se comprimirán automáticamente
                        </p>
                      )}
                      <div className="w-full mb-4">
                        <label className="text-sm font-medium mb-2 block">Nombre del sticker</label>
                        <Input
                          value={stickerName}
                          onChange={(e) => setStickerName(e.target.value)}
                          placeholder="Ej: feliz, triste, like..."
                          className="w-full"
                          autoFocus
                        />
                        <p className="text-xs text-muted-foreground mt-1">Usa :: + nombre para enviar rápido</p>
                      </div>
                      <div className="flex gap-2 w-full">
                        <Button onClick={cancelStickerUpload} variant="outline" className="flex-1" disabled={stickerUploading}>
                          Cancelar
                        </Button>
                        <Button onClick={confirmStickerUpload} className="flex-1" disabled={!stickerName.trim() || stickerUploading}>
                          {stickerUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sí, Subir"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4">
                        <h3 className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Favoritos & Custom</h3>
                        <div className="grid grid-cols-4 gap-2">
                          <button onClick={() => stickerInputRef.current?.click()} className="flex flex-col items-center justify-center h-20 bg-muted/50 rounded-lg hover:bg-muted border border-dashed border-muted-foreground/30 transition-colors">
                            <PlusCircle className="h-6 w-6 text-muted-foreground mb-1" />
                            <span className="text-[10px] text-muted-foreground">Añadir</span>
                          </button>
                          <input ref={stickerInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleStickerUpload} />
                          {customStickers.map(s => (
                            <button key={s.id} onClick={() => handleStickerSelect(s)} className="h-20 hover:bg-muted/50 rounded-lg p-1 transition-transform hover:scale-105 overflow-hidden">
                              {(s as any).type === "video" ? (
                                <video 
                                  src={s.url} 
                                  className="w-full h-full object-contain" 
                                  autoPlay 
                                  loop 
                                  muted 
                                  playsInline
                                />
                              ) : (
                                <img src={s.url} alt={s.name} className="w-full h-full object-contain" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Populares</h3>
                        <div className="grid grid-cols-4 gap-2">
                          {STICKERS.map(s => (
                            <button key={s.id} onClick={() => handleStickerSelect(s)} className="h-20 hover:bg-muted/50 rounded-lg p-1 transition-transform hover:scale-105">
                              <img src={s.url} alt={s.name} className="w-full h-full object-contain" title={s.name} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {editingMessage && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="truncate">Editando: {editingMessage.content}</span>
            <Button variant="ghost" size="sm" onClick={cancelEditing} className="h-6 w-6 p-0 rounded-full">
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {replyingTo && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2 text-xs">
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-primary truncate">
                Respondiendo a {replyingTo.sender?.username || "usuario"}
              </span>
              <span className="text-muted-foreground truncate">
                {replyingTo.content || "(sin texto)"}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReplyingTo(null)}
              className="h-6 w-6 p-0 rounded-full"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Menu Plus Icon */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                <PlusCircle className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="mr-2 h-4 w-4" /> Adjuntar Archivo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Emoji Toggle */}
          <Button variant="ghost" size="icon" onClick={() => setShowPicker(!showPicker)} className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
            <Smile className={`h-5 w-5 sm:h-6 sm:w-6 ${showPicker ? 'text-primary' : 'text-muted-foreground'}`} />
          </Button>

          <Textarea
            ref={messageInputRef}
            value={messageInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={editingMessage ? "Editar..." : "Mensaje..."}
            className="flex-1 min-h-[36px] max-h-32 text-sm resize-none py-2 sm:min-h-[40px]"
            disabled={isUploading}
            autoFocus
            rows={1}
          />

          <Button
            onClick={handleSend}
            disabled={(!messageInput.trim() && attachments.length === 0) || isUploading}
            className="bg-primary hover:bg-primary/90 h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
            size="icon"
          >
            {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Participants Modal */}
      <ParticipantsModal
        isOpen={showParticipantsModal}
        onClose={() => setShowParticipantsModal(false)}
        participants={chat.participants}
        adminId={chat.adminId}
        onlineUsers={onlineUsers}
        currentUserId={currentUser.id}
        onRemoveParticipant={handleRemoveParticipant}
      />

      {/* Profile Photo Preview Overlay */}
      {profilePreview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setProfilePreview(null)}
        >
          <div
            className="relative max-w-sm w-[80vw] sm:w-[360px] aspect-square bg-card rounded-3xl overflow-hidden shadow-2xl border border-border animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={profilePreview.url}
              alt={profilePreview.username}
              className="h-full w-full object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
              <p className="text-sm font-medium text-white truncate">{profilePreview.username}</p>
            </div>
            <button
              type="button"
              onClick={() => setProfilePreview(null)}
              className="absolute top-2 right-2 rounded-full bg-black/60 text-white p-1 hover:bg-black/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Poll Creator Dialog */}
      <PollCreator
        chatId={chat.id}
        isOpen={showPollCreator}
        onClose={() => setShowPollCreator(false)}
        onPollCreated={() => {
          // El mensaje de la encuesta se agregará via socket
        }}
      />

      {/* Mute Chat Dialog */}
      <MuteChatDialog
        chatId={chat.id}
        chatName={displayName}
        isOpen={showMuteDialog}
        onClose={() => setShowMuteDialog(false)}
        onMuted={(muted) => setIsMuted(muted)}
      />

      {/* Image Preview Dialog */}
      <Dialog open={!!imagePreview} onOpenChange={() => {
        setImagePreview(null)
        setImageZoom(1)
        setImagePosition({ x: 0, y: 0 })
      }}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] p-0 overflow-hidden bg-black/95 border-none">
          <div className="relative w-full h-full flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/20 bg-black/50"
              onClick={() => {
                setImagePreview(null)
                setImageZoom(1)
                setImagePosition({ x: 0, y: 0 })
              }}
            >
              <X className="h-6 w-6" />
            </Button>
            
            {/* Zoom controls */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 bg-black/50 rounded-lg p-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={() => setImageZoom(Math.max(0.5, imageZoom - 0.25))}
              >
                -
              </Button>
              <span className="text-white text-sm px-2 flex items-center">
                {Math.round(imageZoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={() => setImageZoom(Math.min(3, imageZoom + 0.25))}
              >
                +
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={() => {
                  setImageZoom(1)
                  setImagePosition({ x: 0, y: 0 })
                }}
              >
                Reset
              </Button>
            </div>

            {imagePreview && (
              <div
                className="w-full h-full overflow-auto cursor-move"
                onWheel={(e) => {
                  e.preventDefault()
                  const delta = e.deltaY * -0.001
                  setImageZoom(Math.max(0.5, Math.min(3, imageZoom + delta)))
                }}
                onMouseDown={(e) => {
                  if (imageZoom > 1) {
                    setIsDraggingImage(true)
                    setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y })
                  }
                }}
                onMouseMove={(e) => {
                  if (isDraggingImage && imageZoom > 1) {
                    setImagePosition({
                      x: e.clientX - dragStart.x,
                      y: e.clientY - dragStart.y
                    })
                  }
                }}
                onMouseUp={() => setIsDraggingImage(false)}
                onMouseLeave={() => setIsDraggingImage(false)}
                onTouchStart={(e) => {
                  if (e.touches.length === 1 && imageZoom > 1) {
                    setIsDraggingImage(true)
                    setDragStart({
                      x: e.touches[0].clientX - imagePosition.x,
                      y: e.touches[0].clientY - imagePosition.y
                    })
                  }
                }}
                onTouchMove={(e) => {
                  if (isDraggingImage && e.touches.length === 1 && imageZoom > 1) {
                    setImagePosition({
                      x: e.touches[0].clientX - dragStart.x,
                      y: e.touches[0].clientY - dragStart.y
                    })
                  }
                }}
                onTouchEnd={() => setIsDraggingImage(false)}
              >
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-w-none"
                  style={{
                    transform: `scale(${imageZoom}) translate(${imagePosition.x / imageZoom}px, ${imagePosition.y / imageZoom}px)`,
                    transformOrigin: 'center center',
                    transition: isDraggingImage ? 'none' : 'transform 0.1s ease-out',
                    width: '100%',
                    height: 'auto',
                    objectFit: 'contain'
                  }}
                  loading="eager"
                  draggable={false}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Helper para detectar si un texto es solo emojis (ignorando espacios)
function isEmojiOnly(text: string): boolean {
  const stripped = text.replace(/\s+/g, "")
  if (!stripped) return false
  // Muy simplificado: si no contiene letras ni dígitos y sí contiene caracteres no ASCII, lo tratamos como emoji-only
  const hasLetterOrDigit = /[\p{L}\p{N}]/u.test(stripped)
  const hasNonAscii = /[^\x00-\x7F]/.test(stripped)
  return !hasLetterOrDigit && hasNonAscii
}

// Helper to get consistent color based on user ID
function getUserColor(userId: string) {
  const colors = [
    "bg-red-100 text-red-900 border-red-200",
    "bg-orange-100 text-orange-900 border-orange-200",
    "bg-amber-100 text-amber-900 border-amber-200",
    "bg-green-100 text-green-900 border-green-200",
    "bg-emerald-100 text-emerald-900 border-emerald-200",
    "bg-teal-100 text-teal-900 border-teal-200",
    "bg-cyan-100 text-cyan-900 border-cyan-200",
    "bg-sky-100 text-sky-900 border-sky-200",
    "bg-blue-100 text-blue-900 border-blue-200",
    "bg-indigo-100 text-indigo-900 border-indigo-200",
    "bg-violet-100 text-violet-900 border-violet-200",
    "bg-purple-100 text-purple-900 border-purple-200",
    "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200",
    "bg-pink-100 text-pink-900 border-pink-200",
    "bg-rose-100 text-rose-900 border-rose-200",
  ]

  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}

function MessageBubble({
  message,
  isOwn,
  showAvatar,
  onEdit,
  onDelete,
  onAvatarClick,
  totalParticipants,
  participants,
  currentUserUsername,
  onReply,
  onSaveSticker,
  repliedToMessage,
  onGoToMessage,
  onPinMessage,
  chatId,
  socket,
  onImageClick,
}: {
  message: MessageWithDetails
  isOwn: boolean
  showAvatar: boolean
  onEdit: () => void
  onDelete: () => void
  onAvatarClick: (url: string | null, username: string) => void
  totalParticipants: number
  participants: { userId: string; username: string }[]
  currentUserUsername: string
  onReply: () => void
  onSaveSticker?: (url: string) => void
  repliedToMessage?: MessageWithDetails
  onGoToMessage?: (messageId: string) => void
  onPinMessage?: () => void
  chatId: string
  socket?: any
  onImageClick?: (url: string) => void
}) {
  const isSticker = message.mediaFiles?.some((m) => m.fileType === "image/sticker" || m.fileType === "video/sticker")
  const stickerMedia = message.mediaFiles?.find((m) => m.fileType === "image/sticker" || m.fileType === "video/sticker")
  
  // Detectar si es una encuesta
  const isPoll = (() => {
    try {
      if (!message.content) return false
      // Verificar si empieza con { para evitar parsear texto normal
      const trimmed = message.content.trim()
      if (!trimmed.startsWith('{')) return false
      const parsed = JSON.parse(trimmed)
      const result = parsed.type === "poll"
      if (result) {
        console.log("Poll detected:", { messageId: message.id, parsed })
      }
      return result
    } catch (e) {
      // Solo loguear si parece JSON pero falló
      if (message.content?.trim().startsWith('{')) {
        console.log("Failed to parse potential poll:", message.content, e)
      }
      return false
    }
  })()
  
  const pollData = isPoll ? (() => {
    try {
      return JSON.parse(message.content!.trim())
    } catch {
      return null
    }
  })() : null

  if (message.deletedAt) {
    return (
      <div className={`mb-2 flex items-end gap-2 message-enter ${isOwn ? "flex-row-reverse" : ""}`}>
        <div className="w-8" />
        <div className="rounded-xl px-3 py-2 text-sm italic text-muted-foreground bg-muted/50 border border-border/50">
          🚫 Este mensaje fue eliminado
        </div>
      </div>
    )
  }

  const userColorClass = !isOwn ? getUserColor(message.senderId) : ""
  const isEmojiMessage = message.content ? isEmojiOnly(message.content) : false
  const mentionsCurrentUser =
    !!message.content &&
    new RegExp(`@${currentUserUsername}(?![\w])`, "i").test(message.content)

  const readCount = Array.isArray((message as any).readBy)
    ? (message as any).readBy.length
    : 0

  const otherParticipantsCount = Math.max(totalParticipants - 1, 0)

  let readStatus: string | null = null
  if (isOwn) {
    if (otherParticipantsCount === 0 || readCount === 0) {
      readStatus = "Enviado"
    } else if (readCount >= otherParticipantsCount) {
      readStatus = "Leído por todos"
    } else {
      readStatus = `Leído por ${readCount} de ${otherParticipantsCount}`
    }
  }

  const allReceivers = participants.filter((p) => p.userId !== message.senderId)
  const readByArray: { userId: string; username: string; readAt: string }[] = Array.isArray(
    (message as any).readBy,
  )
    ? (message as any).readBy
    : []
  const readIds = new Set(readByArray.map((r) => r.userId))
  const [showInfo, setShowInfo] = useState(false)

  // Reacciones por mensaje (se inicializan desde el mensaje recibido del servidor)
  const [reactions, setReactions] = useState<any[]>(
    Array.isArray((message as any).reactions) ? (message as any).reactions : [],
  )
  const [showReactionsPicker, setShowReactionsPicker] = useState(false)
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleReactionMouseEnter = (emoji: string) => {
    // Si ya hay un tooltip visible, cambiarlo inmediatamente sin delay
    if (hoveredEmoji) {
      setHoveredEmoji(emoji)
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    } else {
      // Si no hay tooltip, esperar 1s antes de mostrarlo
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredEmoji(emoji)
      }, 1000)
    }
  }

  const handleReactionMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    // Delay para ocultar el tooltip, permitiendo mover entre reacciones
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredEmoji(null)
    }, 200)
  }

  const reactionGroups = Array.isArray(reactions)
    ? Object.values(
        (reactions as any[]).reduce((acc: any, r: any) => {
          if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, count: 0, users: [] as string[] }
          acc[r.emoji].count += 1
          acc[r.emoji].users.push(r.username)
          return acc
        }, {}),
      )
    : []

  const topReactions = (reactionGroups as any[]).slice(0, 5)
  const extraReactionsCount = Math.max((reactionGroups as any[]).length - 5, 0)

  const toggleReaction = async (emoji: string) => {
    try {
      const res = await fetch(`/api/messages/${message.id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => null)
        throw new Error(error?.error || "Error al reaccionar")
      }

      const updated = await res.json()
      setReactions(updated)
      setShowReactionsPicker(false)
    } catch {
      toast.error("No se pudo actualizar la reacción")
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          id={`message-${message.id}`}
          className={`mb-2 flex items-end gap-2 message-enter group transition-colors duration-500 ${isOwn ? "flex-row-reverse" : ""}`}
          data-message-id={message.id}
        >
          {showAvatar && !isOwn ? (
            <button
              type="button"
              onClick={() =>
                onAvatarClick(message.sender?.profilePhotoUrl || null, message.sender?.username || "Usuario")
              }
              className="focus:outline-none"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={message.sender?.profilePhotoUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {message.sender?.username?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </button>
          ) : (
            <div className="w-8" />
          )}

          <div className="relative max-w-[85%] sm:max-w-[70%]">
            {topReactions.length > 0 && (
              <div className={`absolute -top-4 ${isOwn ? "right-0" : "left-8"} flex items-center gap-1`}>
                {topReactions.map((r: any) => (
                  <button
                    key={r.emoji}
                    type="button"
                    onClick={() => toggleReaction(r.emoji)}
                    onMouseEnter={() => handleReactionMouseEnter(r.emoji)}
                    onMouseLeave={handleReactionMouseLeave}
                    className="inline-flex items-center rounded-full bg-black/10 px-2 py-0.5 text-[11px] hover:bg-black/20"
                  >
                    <span className="mr-1">{r.emoji}</span>
                    <span>{r.count}</span>
                  </button>
                ))}
                {extraReactionsCount > 0 && (
                  <span className="text-[10px] text-muted-foreground ml-1">
                    +{extraReactionsCount}
                  </span>
                )}
              </div>
            )}
            {isOwn && (
              <div className="absolute -top-6 right-0 opacity-0 transition-opacity group-hover:opacity-100">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-full bg-card shadow-sm border"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!isSticker && (
                      <DropdownMenuItem onClick={onEdit}>
                        <Pencil className="mr-2 h-3 w-3" />
                        Editar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-3 w-3" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            <div
              className={`rounded-2xl px-3 py-2 shadow-sm ${
                isOwn
                  ? "rounded-br-md bg-[var(--color-bubble-outgoing)]"
                  : `rounded-bl-md ${userColorClass} border`
              }`}
            >
              {repliedToMessage && (
                <div
                  className="mb-1 rounded-md bg-black/5 dark:bg-white/5 px-2 py-1 text-[11px] border border-black/5 dark:border-white/10 max-w-[240px] flex items-center gap-2 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  onClick={() => repliedToMessage.id && onGoToMessage?.(repliedToMessage.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold truncate opacity-80">
                      Respondiendo a {repliedToMessage.sender?.username ?? "mensaje"}
                    </p>
                    {repliedToMessage.content ? (
                      <p className="truncate text-[11px] opacity-80">
                        {repliedToMessage.content}
                      </p>
                    ) : repliedToMessage.mediaFiles?.length ? (
                      <p className="text-[11px] opacity-80 italic">[Mensaje con archivo]</p>
                    ) : (
                      <p className="text-[11px] opacity-80 italic">[Mensaje]</p>
                    )}
                  </div>

                  {repliedToMessage.mediaFiles?.length ? (
                    (() => {
                      const media = repliedToMessage.mediaFiles[0]
                      if (media.fileType.startsWith("image/")) {
                        return (
                          <img
                            src={media.fileUrl}
                            alt="preview"
                            className="h-6 w-6 rounded object-cover flex-shrink-0"
                          />
                        )
                      }
                      return null
                    })()
                  ) : null}
                </div>
              )}

              {!isOwn && showAvatar && (
                <p className="mb-1 text-xs font-bold opacity-80">{message.sender?.username}</p>
              )}

              {message.mediaFiles && message.mediaFiles.length > 0 && (
                <div className="mb-2 space-y-2">
                  {message.mediaFiles.map((media) => (
                    <MediaPreview key={media.id} media={media} isOwn={isOwn} onImageClick={onImageClick} />
                  ))}
                </div>
              )}

              {isPoll && pollData && (
                <InlinePoll 
                  pollData={pollData} 
                  messageId={message.id}
                  isOwn={isOwn}
                  socket={socket}
                />
              )}

              {message.content && !isPoll && (
                <>
                  <p
                    className={
                      "whitespace-pre-wrap break-words " +
                      (isEmojiMessage ? "text-3xl leading-tight" : "text-sm")
                    }
                  >
                    {message.content
                      // Primero dividir por URLs, luego por menciones
                      .split(/(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi)
                      .map((segment, segIndex) => {
                        // Si es una URL, renderizar como enlace
                        if (/^https?:\/\//i.test(segment)) {
                          return (
                            <a
                              key={segIndex}
                              href={segment}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 underline hover:opacity-80 break-all"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {segment}
                            </a>
                          )
                        }

                        // Si no es URL, procesar menciones
                        return segment.split(/(\@[A-Za-z0-9_]+)/g).map((part, partIndex) => {
                          if (!part.startsWith("@")) {
                            return <span key={`${segIndex}-${partIndex}`}>{part}</span>
                          }

                          const username = part.slice(1)
                          const isMentionOfCurrent =
                            username.toLowerCase() === currentUserUsername.toLowerCase()

                          return (
                            <span
                              key={`${segIndex}-${partIndex}`}
                              className={
                                "font-semibold px-1 rounded-md " +
                                (isMentionOfCurrent
                                  ? "bg-blue-500/20 text-blue-900 dark:text-blue-100"
                                  : "bg-blue-500/10 text-blue-900 dark:text-blue-100")
                              }
                            >
                              {part}
                            </span>
                          )
                        })
                      })}
                    {message.editedAt && (
                      <span className="text-[10px] opacity-70 ml-1 align-bottom">(editado)</span>
                    )}
                  </p>

                  {/* Link Preview - solo para la primera URL encontrada */}
                  {(() => {
                    const urls = extractUrls(message.content)
                    if (urls.length > 0) {
                      return <LinkPreview url={urls[0]} isOwn={isOwn} />
                    }
                    return null
                  })()}
                </>
              )}

              {hoveredEmoji && (
                <div
                  className={`absolute -top-16 ${isOwn ? "right-0" : "left-8"} z-40 rounded-lg border bg-popover px-3 py-2 shadow-md min-w-[140px]`}
                  onMouseEnter={() => {
                    // Cancelar el timeout de cierre cuando el cursor entra al tooltip
                    if (hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current)
                      hoverTimeoutRef.current = null
                    }
                  }}
                  onMouseLeave={() => {
                    // Cerrar el tooltip cuando el cursor sale
                    setHoveredEmoji(null)
                  }}
                >
                  <p className="text-[11px] font-semibold mb-1">Reacciones {hoveredEmoji}</p>
                  <ul className="text-[11px] space-y-0.5">
                    {((reactionGroups as any[]).find((g) => g.emoji === hoveredEmoji)?.users || []).map(
                      (u: string, index: number) => (
                        <li key={u + index}>{u}</li>
                      ),
                    )}
                  </ul>
                </div>
              )}

              <div className="mt-1 flex items-center justify-between gap-2 text-[10px] opacity-70">
                <div className="flex items-center gap-2">
                  {isOwn && readStatus && (
                    <span className="text-left text-muted-foreground">{readStatus}</span>
                  )}
                  {!isOwn && mentionsCurrentUser && (
                    <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      Te mencionó
                    </span>
                  )}
                </div>
                <span className="ml-auto text-right">
                  {new Date(message.sentAt).toLocaleTimeString("es-SV", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                    timeZone: "America/El_Salvador",
                  })}
                </span>
              </div>
            </div>

            {/* Picker de emojis para reacciones (se abre con click derecho -> Reaccionar) */}
            {showReactionsPicker && (
              <div className="absolute -bottom-2 left-0 translate-y-full z-40 bg-card border rounded-xl shadow-lg w-[260px]">
                <EmojiPicker
                  onEmojiClick={(emojiData: any) => toggleReaction(emojiData.emoji)}
                  theme={EmojiTheme.LIGHT}
                  width="100%"
                  height={300}
                  lazyLoadEmojis
                  previewConfig={{ showPreview: false }}
                />
              </div>
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      {/* Menú contextual para mensajes propios */}
      {isOwn && (
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setShowReactionsPicker(true)}>
            <Smile className="mr-2 h-4 w-4" />
            Reaccionar
          </ContextMenuItem>
          <ContextMenuItem onClick={onReply}>
            <Reply className="mr-2 h-4 w-4" />
            Responder
          </ContextMenuItem>
          {!isSticker && (
            <ContextMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setShowInfo(true)}>
            <Users className="mr-2 h-4 w-4" />
            Info del mensaje
          </ContextMenuItem>
          {onPinMessage && (
            <ContextMenuItem onClick={onPinMessage}>
              <Pin className="mr-2 h-4 w-4" />
              Fijar mensaje
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      )}

      {/* Menú contextual para mensajes de otros usuarios */}
      {!isOwn && (
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setShowReactionsPicker(true)}>
            <Smile className="mr-2 h-4 w-4" />
            Reaccionar
          </ContextMenuItem>
          <ContextMenuItem onClick={onReply}>
            <Reply className="mr-2 h-4 w-4" />
            Responder
          </ContextMenuItem>
          {isSticker && stickerMedia && onSaveSticker && (
            <ContextMenuItem onClick={() => onSaveSticker(stickerMedia.fileUrl)}>
              <Users className="mr-2 h-4 w-4" />
              Guardar sticker
            </ContextMenuItem>
          )}
          {onPinMessage && (
            <ContextMenuItem onClick={onPinMessage}>
              <Pin className="mr-2 h-4 w-4" />
              Fijar mensaje
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      )}
      {isOwn && (
        <Dialog open={showInfo} onOpenChange={setShowInfo}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Información del mensaje</DialogTitle>
              <DialogDescription>
                Detalle de qué usuarios recibieron este mensaje y quiénes ya lo han leído.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Usuarios que recibieron este mensaje ({allReceivers.length}):
              </p>

              {allReceivers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay otros participantes en este chat.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto border rounded-md p-2 bg-muted/40 space-y-1">
                  {allReceivers.map((u) => {
                    const hasRead = readIds.has(u.userId)
                    return (
                      <div
                        key={u.userId}
                        className="flex items-center justify-between rounded-md bg-background px-2 py-1 text-sm shadow-sm"
                      >
                        <span className="truncate mr-2">{u.username}</span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            hasRead ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {hasRead ? "Leído" : "Sin leer"}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </ContextMenu>
  )
}

function AudioPlayer({ url, isOwn }: { url: string; isOwn: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener("timeupdate", updateTime)
    audio.addEventListener("loadedmetadata", updateDuration)
    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.removeEventListener("timeupdate", updateTime)
      audio.removeEventListener("loadedmetadata", updateDuration)
      audio.removeEventListener("ended", handleEnded)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return

    const newTime = Number.parseFloat(e.target.value)
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const formatTime = (time: number) => {
    if (Number.isNaN(time)) return "0:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 min-w-[220px] max-w-[280px] ${
      isOwn 
        ? "bg-white/20" 
        : "bg-black/5"
    }`}>
      <audio ref={audioRef} src={url} preload="metadata" />
      
      <button
        type="button"
        onClick={togglePlay}
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all hover:scale-105 active:scale-95 shadow-sm ${
          isOwn
            ? "bg-white/90 text-primary hover:bg-white"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        {isPlaying ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4 ml-0.5" fill="currentColor" />}
      </button>

      <div className="flex flex-1 flex-col gap-1.5">
        <div className="relative h-1 w-full bg-black/10 rounded-full overflow-hidden cursor-pointer group" onClick={(e) => {
          const audio = audioRef.current
          if (!audio || !duration) return
          const rect = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - rect.left
          const percentage = x / rect.width
          const newTime = percentage * duration
          audio.currentTime = newTime
          setCurrentTime(newTime)
        }}>
          <div 
            className={`absolute left-0 top-0 h-full rounded-full transition-all ${
              isOwn ? "bg-white/80" : "bg-primary"
            }`}
            style={{ width: `${progress}%` }}
          />
          <div 
            className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity ${
              isOwn ? "bg-white" : "bg-primary"
            }`}
            style={{ left: `calc(${progress}% - 5px)` }}
          />
        </div>
        
        <div className="flex justify-between items-center">
          <span className={`text-[11px] font-medium tabular-nums ${
            isOwn ? "text-white/90" : "text-foreground/70"
          }`}>{formatTime(currentTime)}</span>
          <span className={`text-[11px] tabular-nums ${
            isOwn ? "text-white/70" : "text-muted-foreground"
          }`}>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  )
}

// Componente para mostrar encuestas inline
function InlinePoll({ 
  pollData, 
  messageId,
  isOwn,
  socket
}: { 
  pollData: { 
    pollId?: string
    question: string
    options: Array<{ id: string; text: string; votes: number }>
    allowsMultiple: boolean
    totalVotes: number
  }
  messageId: string
  isOwn: boolean
  socket?: any
}) {
  const [options, setOptions] = useState(pollData.options || [])
  const [totalVotes, setTotalVotes] = useState(pollData.totalVotes || 0)
  const [votedOptions, setVotedOptions] = useState<Set<string>>(new Set())
  const [isVoting, setIsVoting] = useState(false)
  const [showVotersDialog, setShowVotersDialog] = useState(false)
  const [votersData, setVotersData] = useState<Array<{
    id: string
    option_text: string
    voters: Array<{ id: string; username: string; profilePhotoUrl: string | null }>
  }>>([])
  const [loadingVoters, setLoadingVoters] = useState(false)

  // Cargar votos del usuario al montar
  useEffect(() => {
    if (pollData.pollId) {
      loadUserVotes()
    }
  }, [pollData.pollId])

  const loadUserVotes = async () => {
    if (!pollData.pollId) return
    try {
      const res = await fetch(`/api/polls/vote?pollId=${pollData.pollId}`)
      if (res.ok) {
        const data = await res.json()
        setVotedOptions(new Set(data.userVotedOptions || []))
        // Actualizar opciones con conteo de votos
        if (data.options) {
          setOptions(data.options.map((o: any) => ({
            id: o.id,
            text: o.option_text,
            votes: o.voters?.length || 0
          })))
          setTotalVotes(data.options.reduce((sum: number, o: any) => sum + (o.voters?.length || 0), 0))
        }
      }
    } catch (e) {
      console.error("Error loading user votes:", e)
    }
  }

  const handleVote = async (optionId: string) => {
    if (!pollData.pollId || isVoting) return

    setIsVoting(true)
    try {
      const response = await fetch("/api/polls/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: pollData.pollId, optionId }),
      })

      if (response.ok) {
        const data = await response.json()
        
        // Actualizar votos locales
        const newVoted = new Set(votedOptions)
        if (data.action === "added") {
          if (!pollData.allowsMultiple) {
            newVoted.clear()
          }
          newVoted.add(optionId)
        } else {
          newVoted.delete(optionId)
        }
        setVotedOptions(newVoted)
        
        // Actualizar resultados
        if (data.results) {
          setOptions(data.results.map((r: any) => ({
            id: r.id,
            text: r.option_text,
            votes: r.vote_count
          })))
        }
        setTotalVotes(data.totalVotes || 0)
        
        // Emitir evento por socket para actualizar en tiempo real
        if (socket && data.socketEvent) {
          console.log("[CLIENT] 📤 Emitting poll_vote_updated:", data.socketEvent)
          socket.emit("poll_vote_updated", data.socketEvent)
        }
      }
    } catch (error) {
      console.error("Error voting:", error)
    } finally {
      setIsVoting(false)
    }
  }

  const showVoters = async () => {
    if (!pollData.pollId) return
    setLoadingVoters(true)
    setShowVotersDialog(true)
    
    try {
      const res = await fetch(`/api/polls/vote?pollId=${pollData.pollId}`)
      if (res.ok) {
        const data = await res.json()
        setVotersData(data.options || [])
      }
    } catch (e) {
      console.error("Error loading voters:", e)
    } finally {
      setLoadingVoters(false)
    }
  }

  const maxVotes = Math.max(...options.map(o => o.votes), 1)
  
  // Colores para las barras de progreso
  const getBarColor = (index: number, isVoted: boolean, isWinning: boolean) => {
    if (isVoted) return "bg-gradient-to-r from-emerald-500/40 to-emerald-400/30"
    if (isWinning) return "bg-gradient-to-r from-blue-500/30 to-blue-400/20"
    const colors = [
      "bg-gradient-to-r from-violet-500/20 to-violet-400/10",
      "bg-gradient-to-r from-amber-500/20 to-amber-400/10",
      "bg-gradient-to-r from-rose-500/20 to-rose-400/10",
      "bg-gradient-to-r from-cyan-500/20 to-cyan-400/10",
      "bg-gradient-to-r from-fuchsia-500/20 to-fuchsia-400/10",
    ]
    return colors[index % colors.length]
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <div className="min-w-[180px] sm:min-w-[220px] max-w-[260px] sm:max-w-[300px] p-1">
            {/* Header de la encuesta */}
            <div className="flex items-start gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <span className="font-semibold text-sm leading-tight block">{pollData.question}</span>
                <span className="text-[10px] text-muted-foreground">
                  {pollData.allowsMultiple ? "Selección múltiple" : "Selección única"}
                </span>
              </div>
            </div>
            
            {/* Opciones */}
            <div className="space-y-2">
              {options.map((option, index) => {
                const percentage = totalVotes > 0 
                  ? Math.round((option.votes / totalVotes) * 100) 
                  : 0
                const isVoted = votedOptions.has(option.id)
                const isWinning = option.votes === maxVotes && option.votes > 0

                return (
                  <button
                    key={option.id}
                    onClick={() => handleVote(option.id)}
                    disabled={isVoting || !pollData.pollId}
                    className={`w-full text-left p-2.5 rounded-xl border-2 text-xs transition-all relative overflow-hidden group
                      ${isVoted 
                        ? "border-emerald-500/50 shadow-sm shadow-emerald-500/10" 
                        : "border-transparent bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                      }
                      ${isVoting ? "opacity-50 cursor-wait" : "cursor-pointer"}
                    `}
                  >
                    {/* Barra de progreso */}
                    <div 
                      className={`absolute inset-0 transition-all duration-500 ease-out ${getBarColor(index, isVoted, isWinning)}`}
                      style={{ width: `${percentage}%` }}
                    />
                    
                    {/* Contenido */}
                    <div className="relative flex items-center justify-between gap-2">
                      <span className={`flex items-center gap-2 ${isVoted ? "font-semibold" : ""}`}>
                        {/* Checkbox/Radio visual */}
                        <span className={`flex items-center justify-center w-4 h-4 rounded-full border-2 transition-all
                          ${isVoted 
                            ? "border-emerald-500 bg-emerald-500 text-white" 
                            : "border-muted-foreground/30 group-hover:border-muted-foreground/50"
                          }`}
                        >
                          {isVoted && (
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="truncate">{option.text}</span>
                      </span>
                      
                      {/* Estadísticas */}
                      <span className={`flex items-center gap-1 text-[11px] font-medium whitespace-nowrap
                        ${isVoted ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}
                      `}>
                        <span className="tabular-nums">{percentage}%</span>
                        {option.votes > 0 && (
                          <span className="text-[9px] opacity-70">({option.votes})</span>
                        )}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
              <p className="text-[9px] sm:text-[10px] text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {totalVotes} voto{totalVotes !== 1 ? "s" : ""}
              </p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground/70 hidden sm:block">
                Click derecho para ver detalles
              </p>
              <p className="text-[9px] text-muted-foreground/70 sm:hidden">
                Mantén presionado
              </p>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={showVoters}>
            <Users className="mr-2 h-4 w-4" />
            Ver respuestas
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Dialog para ver quién votó */}
      <Dialog open={showVotersDialog} onOpenChange={setShowVotersDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              Respuestas de la encuesta
            </DialogTitle>
            <DialogDescription className="text-sm font-medium">{pollData.question}</DialogDescription>
          </DialogHeader>
          
          {loadingVoters ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {votersData.map((option, index) => {
                const optionPercentage = totalVotes > 0 
                  ? Math.round((option.voters.length / totalVotes) * 100) 
                  : 0
                const isWinning = option.voters.length === maxVotes && option.voters.length > 0
                
                return (
                  <div key={option.id} className="rounded-xl border bg-card/50 overflow-hidden">
                    {/* Header de opción */}
                    <div className={`p-3 ${isWinning ? "bg-gradient-to-r from-amber-500/10 to-transparent" : ""}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm flex items-center gap-2">
                          {isWinning && <span className="text-amber-500">👑</span>}
                          {option.option_text}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                          ${isWinning 
                            ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" 
                            : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {optionPercentage}%
                        </span>
                      </div>
                      
                      {/* Barra de progreso */}
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            isWinning 
                              ? "bg-gradient-to-r from-amber-500 to-amber-400" 
                              : "bg-gradient-to-r from-violet-500 to-violet-400"
                          }`}
                          style={{ width: `${optionPercentage}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* Votantes */}
                    <div className="px-3 pb-3">
                      {option.voters.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {option.voters.map((voter) => (
                            <div 
                              key={voter.id}
                              className="flex items-center gap-1.5 bg-muted/80 hover:bg-muted rounded-full px-2 py-1 transition-colors"
                            >
                              <Avatar className="h-5 w-5 border border-border">
                                <AvatarImage src={voter.profilePhotoUrl || undefined} />
                                <AvatarFallback className="text-[9px] bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                                  {voter.username.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-medium">{voter.username}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic mt-2 flex items-center gap-1">
                          <span className="opacity-50">—</span> Sin votos aún
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          
          {/* Footer del dialog */}
          <div className="flex items-center justify-center pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Total: <span className="font-semibold">{totalVotes}</span> voto{totalVotes !== 1 ? "s" : ""}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MediaPreview({ media, isOwn = false, onImageClick }: { media: { fileUrl: string; fileType: string }; isOwn?: boolean; onImageClick?: (url: string) => void }) {
  const url = media.fileUrl || "/placeholder.svg"
  const type = media.fileType || ""

  // Custom type for image stickers
  if (type === "image/sticker") {
    return (
      <img
        src={url}
        alt="Sticker"
        className="h-24 w-auto object-contain hover:scale-110 transition-transform drop-shadow-sm"
        loading="lazy"
      />
    )
  }

  // Custom type for video stickers
  if (type === "video/sticker") {
    return (
      <video
        src={url}
        className="h-24 w-auto object-contain hover:scale-110 transition-transform drop-shadow-sm"
        autoPlay
        loop
        muted
        playsInline
      />
    )
  }

  // Imágenes
  if (type.startsWith("image/")) {
    return (
      <img
        src={url}
        alt="Shared image"
        className="max-h-64 rounded-lg object-contain bg-background/50 cursor-pointer hover:opacity-90 transition-opacity"
        loading="lazy"
        onClick={() => onImageClick?.(url)}
      />
    )
  }

  // Videos
  if (type.startsWith("video/")) {
    return <video src={url} controls className="max-h-64 rounded-lg" />
  }

  // Audios: detectar por tipo o por extensión común
  const audioExtensions = [".mp3", ".wav", ".ogg", ".m4a", ".aac"]
  const isAudioByExt = audioExtensions.some((ext) => url.toLowerCase().endsWith(ext))

  if (type.startsWith("audio/") || isAudioByExt) {
    return <AudioPlayer url={url} isOwn={isOwn} />
  }

  // Cualquier otro archivo: enlace de descarga
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg bg-muted p-3"
    >
      <File className="h-8 w-8 text-muted-foreground" />
      <span className="text-sm underline">Download File</span>
    </a>
  )
}

function getChatDisplayName(chat: ChatViewProps["chat"], currentUserId: string): string {
  if (chat.name) return chat.name

  if (chat.type === "INDIVIDUAL") {
    const otherParticipant = chat.participants.find((p) => p.userId !== currentUserId)
    return otherParticipant?.username || "Unknown"
  }

  const names = chat.participants
    .filter((p) => p.userId !== currentUserId)
    .map((p) => p.username)
    .slice(0, 3)

  if (names.length === 0) return "Chat Vacío"
  if (names.length <= 3) return names.join(", ")
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`
}

function groupMessagesByDate(messages: MessageWithDetails[]) {
  const groups: Record<string, MessageWithDetails[]> = {}

  messages.forEach((message) => {
    const date = new Date(message.sentAt)
    let dateKey: string

    if (isToday(date)) {
      dateKey = "Hoy"
    } else if (isYesterday(date)) {
      dateKey = "Ayer"
    } else {
      dateKey = format(date, "d 'de' MMMM, yyyy")
    }

    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(message)
  })

  return groups
}
