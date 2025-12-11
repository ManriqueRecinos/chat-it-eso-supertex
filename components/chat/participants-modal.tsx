"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Users, Crown } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

interface Participant {
    userId: string
    username: string
    profilePhotoUrl: string | null
    joinedAt: string
}

interface ParticipantsModalProps {
    isOpen: boolean
    onClose: () => void
    participants: Participant[]
    adminId: string
    onlineUsers: Set<string>
    currentUserId: string
    onRemoveParticipant: (participant: Participant) => void | Promise<void>
}

export function ParticipantsModal({
    isOpen,
    onClose,
    participants,
    adminId,
    onlineUsers,
    currentUserId,
    onRemoveParticipant,
}: ParticipantsModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Participantes ({participants.length})
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {participants.map((participant) => {
                        const isOnline = onlineUsers.has(participant.userId)
                        const isAdmin = participant.userId === adminId

                        return (
                            <div
                                key={participant.userId}
                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                            >
                                <div className="relative">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={participant.profilePhotoUrl || undefined} />
                                        <AvatarFallback className="bg-primary/10 text-primary">
                                            {participant.username.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    {isOnline && (
                                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-[var(--color-online)]" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium truncate">{participant.username}</p>
                                        {isAdmin && (
                                            <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                                        Se unió {formatDistanceToNow(new Date(participant.joinedAt), {
                                            addSuffix: true,
                                            locale: es
                                        })}
                                    </p>
                                </div>

                                <div className="flex flex-col items-end gap-1">
                                    {isOnline && (
                                        <span className="text-xs text-primary font-medium">En línea</span>
                                    )}

                                    {currentUserId === adminId && !isAdmin && (
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            className="text-xs h-7 px-2"
                                            onClick={() => onRemoveParticipant(participant)}
                                        >
                                            Eliminar
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </DialogContent>
        </Dialog>
    )
}
