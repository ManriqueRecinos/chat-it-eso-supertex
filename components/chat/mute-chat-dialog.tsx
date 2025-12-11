"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { BellOff } from "lucide-react"
import { toast } from "sonner"

interface MuteChatDialogProps {
  chatId: string
  chatName: string
  isOpen: boolean
  onClose: () => void
  onMuted?: (muted: boolean) => void
}

const MUTE_OPTIONS = [
  { value: "1", label: "1 hora" },
  { value: "8", label: "8 horas" },
  { value: "24", label: "24 horas" },
  { value: "168", label: "1 semana" },
  { value: "0", label: "Hasta que lo reactive" },
]

export function MuteChatDialog({ chatId, chatName, isOpen, onClose, onMuted }: MuteChatDialogProps) {
  const [duration, setDuration] = useState("8")
  const [isMuting, setIsMuting] = useState(false)

  const handleMute = async () => {
    setIsMuting(true)
    try {
      const response = await fetch(`/api/chats/${chatId}/mute`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          muted: true,
          duration: duration === "0" ? null : parseInt(duration),
        }),
      })

      if (!response.ok) throw new Error("Failed to mute")

      toast.success(`Chat silenciado`)
      onMuted?.(true)
      onClose()
    } catch {
      toast.error("Error al silenciar chat")
    } finally {
      setIsMuting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Silenciar chat
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            No recibirás notificaciones de <strong>{chatName}</strong>
          </p>

          <RadioGroup value={duration} onValueChange={setDuration}>
            {MUTE_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`mute-${option.value}`} />
                <Label htmlFor={`mute-${option.value}`} className="cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleMute} disabled={isMuting}>
            {isMuting ? "Silenciando..." : "Silenciar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
