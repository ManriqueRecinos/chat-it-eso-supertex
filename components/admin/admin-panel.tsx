"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AdminUsersTable, type AdminUser } from "./admin-users-table"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, LogOut, MessageSquare, Settings, Users } from "lucide-react"

export interface AdminMessageDetails {
  id: string
  content: string | null
  sentAt: string
  chatId: string
  chatName: string | null
  senderId: string
  senderUsername: string
  reads: {
    userId: string
    username: string
    readAt: string
  }[]
  reactions: {
    emoji: string
    userId: string
    username: string
  }[]
  history: {
    id: string
    previousContent: string | null
    changedAt: string
  }[]
}

export interface AdminChat {
  id: string
  name: string | null
  type: string
  adminId: string
  createdAt: string
  adminUsername: string
  participantsCount: number
}

interface AdminPanelProps {
  currentUsername: string
  initialUsers: AdminUser[]
  availableRoles: string[]
  initialChats: AdminChat[]
  initialMessages: AdminMessageDetails[]
}

const TABS = [
  { id: "users", label: "Usuarios", icon: Users },
  { id: "chats", label: "Chats", icon: MessageSquare },
  { id: "messages", label: "Mensajes", icon: MessageSquare },
]

export function AdminPanel({ currentUsername, initialUsers, availableRoles, initialChats, initialMessages }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<string>("users")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [messageSearch, setMessageSearch] = useState("")
  const router = useRouter()

  const messagesByChat = initialMessages.reduce((acc, msg) => {
    const key = msg.chatId
    if (!acc[key]) {
      acc[key] = {
        chatId: msg.chatId,
        chatName: msg.chatName,
        messages: [] as AdminMessageDetails[],
      }
    }
    acc[key].messages.push(msg)
    return acc
  }, {} as Record<string, { chatId: string; chatName: string | null; messages: AdminMessageDetails[] }>)

  const rawChatGroups = Object.values(messagesByChat).sort((a, b) => {
    const aDate = a.messages[0]?.sentAt ? new Date(a.messages[0].sentAt).getTime() : 0
    const bDate = b.messages[0]?.sentAt ? new Date(b.messages[0].sentAt).getTime() : 0
    return bDate - aDate
  })

  const normalizedSearch = messageSearch.trim().toLowerCase()
  const chatGroups = rawChatGroups
    .map((group) => {
      if (!normalizedSearch) return group

      const matchesChat =
        group.chatName?.toLowerCase().includes(normalizedSearch) ||
        group.chatId.toLowerCase().includes(normalizedSearch)

      const filteredMessages = group.messages.filter((m) => {
        if (m.senderUsername.toLowerCase().includes(normalizedSearch)) return true
        if ((m.content || "").toLowerCase().includes(normalizedSearch)) return true
        return false
      })

      if (matchesChat) {
        // si coincide el chat, dejamos todos los mensajes
        return group
      }

      return { ...group, messages: filteredMessages }
    })
    .filter((group) => group.messages.length > 0)

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Sidebar */}
      <div
        className={cn(
          "shrink-0 rounded-xl border bg-card p-3 flex flex-col justify-between transition-all duration-200",
          sidebarCollapsed ? "w-16" : "w-56",
        )}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            {!sidebarCollapsed && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Panel de admin</p>
                <p className="text-xs text-muted-foreground/80 truncate max-w-[140px]">
                  {currentUsername}
                </p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={() => setSidebarCollapsed((v) => !v)}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "w-full justify-start gap-2",
                    sidebarCollapsed && "justify-center px-0",
                  )}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon className="h-4 w-4" />
                  {!sidebarCollapsed && <span>{tab.label}</span>}
                </Button>
              )
            })}
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t mt-2">
          <Button
            variant="outline"
            size="sm"
            className={cn("w-full justify-start gap-2", sidebarCollapsed && "justify-center px-0")}
            onClick={() => router.push("/chat")}
          >
            <ChevronLeft className="h-4 w-4" />
            {!sidebarCollapsed && <span>Volver al chat</span>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full justify-start gap-2 text-red-500", sidebarCollapsed && "justify-center px-0")}
            onClick={async () => {
              try {
                await fetch("/api/auth/logout", { method: "POST" })
                window.location.href = "/login"
              } catch (error) {
                console.error("Error logging out:", error)
              }
            }}
          >
            <LogOut className="h-4 w-4" />
            {!sidebarCollapsed && <span>Cerrar sesión</span>}
          </Button>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0 space-y-4 overflow-hidden">
        {activeTab === "users" && (
          <AdminUsersTable initialUsers={initialUsers} availableRoles={availableRoles} />
        )}

        {activeTab === "chats" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-1">Chats</h2>
              <p className="text-sm text-muted-foreground">
                Lista solo lectura de todos los chats del sistema. Solo visible para administradores.
              </p>
            </div>
            <div className="rounded-xl border bg-card">
              <ScrollArea className="h-[520px] p-4 chat-scrollbar">
                <div className="space-y-2 text-sm">
                  {initialChats.map((chat) => (
                    <div
                      key={chat.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg border bg-background/60 px-3 py-2"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-semibold truncate">
                          {chat.name || chat.id}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          ID: {chat.id}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">
                          Tipo: {chat.type}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">
                          Admin: {chat.adminUsername}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">
                          Participantes: {chat.participantsCount}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">
                          Creado: {new Date(chat.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}

                  {initialChats.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No hay chats registrados.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        {activeTab === "messages" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-1">Mensajes recientes por chat</h2>
              <p className="text-sm text-muted-foreground">
                Vista de solo lectura agrupada por chat para monitorear actividad, lecturas, reacciones e historial.
              </p>
            </div>
            <div className="rounded-xl border bg-card">
              <div className="border-b px-4 pt-3 pb-2 flex items-center gap-2">
                <Input
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  placeholder="Buscar por chat, usuario o contenido..."
                  className="h-8 text-sm"
                />
              </div>
              <ScrollArea className="h-[480px] p-4 chat-scrollbar">
                <div className="space-y-4">
                  <Accordion type="multiple" className="space-y-3">
                    {chatGroups.map((group) => (
                      <AccordionItem key={group.chatId} value={group.chatId} className="border rounded-lg">
                        <AccordionTrigger className="px-3 py-2 hover:no-underline">
                          <div className="flex flex-1 items-center justify-between gap-2 text-left">
                            <div>
                              <p className="font-semibold text-sm truncate max-w-[260px]">
                                {group.chatName || group.chatId}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {group.messages.length} mensaje(s) coinciden
                              </p>
                            </div>
                            <span className="text-[11px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground flex-shrink-0">
                              ID chat: {group.chatId}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="mt-1 space-y-2 border-l border-dashed border-border/60 pl-3 ml-2">
                            {group.messages.map((msg) => (
                              <div
                                key={msg.id}
                                className="relative rounded-lg bg-background/60 p-3 text-xs space-y-2 shadow-sm border border-border/60"
                              >
                                <div className="absolute -left-3 top-3 h-2 w-2 rounded-full bg-primary" />
                                <div className="flex items-center justify-between gap-2">
                                  <div className="space-y-0.5">
                                    <p className="font-medium flex items-center gap-1">
                                      <span>{msg.senderUsername}</span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {new Date(msg.sentAt).toLocaleString()}
                                      </span>
                                    </p>
                                    <p className="text-[11px] text-muted-foreground break-all">
                                      ID mensaje: {msg.id}
                                    </p>
                                  </div>
                                </div>

                                <div className="rounded-md bg-muted/60 px-2 py-1 text-sm">
                                  {msg.content || (
                                    <span className="italic text-muted-foreground">(sin texto)</span>
                                  )}
                                </div>

                                <div className="grid gap-2 md:grid-cols-3">
                                  {/* Lecturas */}
                                  <div className="text-[11px] text-muted-foreground space-y-1">
                                    <p className="font-semibold">Leído por</p>
                                    {msg.reads.length === 0 ? (
                                      <p className="italic">Nadie aún</p>
                                    ) : (
                                      <ul className="space-y-0.5">
                                        {msg.reads.map((r) => (
                                          <li key={r.userId + r.readAt}>
                                            {r.username}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>

                                  {/* Reacciones */}
                                  <div className="text-[11px] text-muted-foreground space-y-1">
                                    <p className="font-semibold">Reacciones</p>
                                    {msg.reactions.length === 0 ? (
                                      <p className="italic">Sin reacciones</p>
                                    ) : (
                                      <div className="flex flex-wrap gap-1">
                                        {msg.reactions.map((r, index) => (
                                          <div
                                            key={msg.id + r.emoji + r.userId + index}
                                            className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 gap-1"
                                          >
                                            <span>{r.emoji}</span>
                                            <span>{r.username}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Historial */}
                                  <div className="text-[11px] text-muted-foreground space-y-1">
                                    <p className="font-semibold">Historial</p>
                                    {msg.history.length === 0 ? (
                                      <p className="italic">Sin historial</p>
                                    ) : (
                                      <ul className="space-y-0.5 max-h-24 overflow-y-auto">
                                        {msg.history.map((h) => (
                                          <li key={h.id}>
                                            <span className="font-medium">
                                              {new Date(h.changedAt).toLocaleString()}:
                                            </span>{" "}
                                            <span>{h.previousContent || "(vacío)"}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>

                  {chatGroups.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No hay mensajes para mostrar.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
