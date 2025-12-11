"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Pin, X, ChevronDown, ChevronUp } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

interface PinnedMessage {
  pin_id: string
  pinned_at: string
  pinned_by: string
  pinned_by_username: string
  id: string
  content: string
  sentAt: string
  senderId: string
  senderUsername: string
  senderProfilePhotoUrl: string | null
}

interface PinnedMessagesProps {
  chatId: string
  onUnpin?: (messageId: string) => void
  onMessageClick?: (messageId: string) => void
  canUnpin?: boolean
}

export function PinnedMessages({ chatId, onUnpin, onMessageClick, canUnpin = false }: PinnedMessagesProps) {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadPinnedMessages()
  }, [chatId])

  const loadPinnedMessages = async () => {
    try {
      const response = await fetch(`/api/chats/${chatId}/pin`)
      if (response.ok) {
        const data = await response.json()
        setPinnedMessages(data)
      }
    } catch (error) {
      console.error("Error loading pinned messages:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnpin = async (messageId: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}/pin?messageId=${messageId}`, {
        method: "DELETE",
      })
      if (response.ok) {
        setPinnedMessages(prev => prev.filter(m => m.id !== messageId))
        onUnpin?.(messageId)
      }
    } catch (error) {
      console.error("Error unpinning message:", error)
    }
  }

  if (isLoading || pinnedMessages.length === 0) return null

  const displayedMessages = isExpanded ? pinnedMessages : pinnedMessages.slice(0, 1)

  return (
    <div className="border-b bg-muted/30 px-4 py-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Pin className="h-4 w-4 text-primary" />
          <span>Mensajes fijados ({pinnedMessages.length})</span>
        </div>
        {pinnedMessages.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 px-2"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      <ScrollArea className={isExpanded ? "max-h-40" : ""}>
        <div className="space-y-2">
          {displayedMessages.map((msg) => (
            <div
              key={msg.pin_id}
              className="flex items-start gap-2 p-2 rounded-md bg-background/50 hover:bg-background/80 cursor-pointer group"
              onClick={() => onMessageClick?.(msg.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{msg.senderUsername}</span>
                  <span suppressHydrationWarning>
                    {formatDistanceToNow(new Date(msg.sentAt), { addSuffix: true, locale: es })}
                  </span>
                </div>
                <p className="text-sm truncate">{msg.content}</p>
              </div>
              {canUnpin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleUnpin(msg.id)
                  }}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
