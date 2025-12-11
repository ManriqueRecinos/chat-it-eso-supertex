"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, X, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

interface SearchResult {
  id: string
  content: string
  sentAt: string
  senderId: string
  senderUsername: string
  senderProfilePhotoUrl: string | null
}

interface ChatSearchProps {
  chatId: string
  onResultClick?: (messageId: string) => void
  onClose?: () => void
}

export function ChatSearch({ chatId, onResultClick, onClose }: ChatSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>(undefined)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (query.trim().length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      searchMessages()
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, chatId])

  const searchMessages = async () => {
    if (query.trim().length < 2) return

    setIsSearching(true)
    try {
      const response = await fetch(`/api/chats/${chatId}/search?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setResults(data)
      }
    } catch (error) {
      console.error("Error searching:", error)
    } finally {
      setIsSearching(false)
      setHasSearched(true)
    }
  }

  const highlightMatch = (text: string) => {
    if (!query.trim()) return text
    const regex = new RegExp(`(${query.trim()})`, "gi")
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <div className="border-b bg-background p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en este chat..."
            className="pl-9 pr-9"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {hasSearched && (
        <div className="mt-2">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No se encontraron mensajes
            </p>
          ) : (
            <ScrollArea className="max-h-60">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground mb-2">
                  {results.length} resultado{results.length !== 1 ? "s" : ""}
                </p>
                {results.map((result) => (
                  <div
                    key={result.id}
                    onClick={() => onResultClick?.(result.id)}
                    className="p-2 rounded-md hover:bg-muted cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span className="font-medium text-foreground">
                        {result.senderUsername}
                      </span>
                      <span suppressHydrationWarning>
                        {formatDistanceToNow(new Date(result.sentAt), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2">{highlightMatch(result.content || "")}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  )
}
