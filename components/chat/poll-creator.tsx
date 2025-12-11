"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, X, BarChart3 } from "lucide-react"
import { toast } from "sonner"
import { socket } from "@/lib/socket"

interface PollCreatorProps {
  chatId: string
  isOpen: boolean
  onClose: () => void
  onPollCreated?: (message: any) => void
}

export function PollCreator({ chatId, isOpen, onClose, onPollCreated }: PollCreatorProps) {
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState(["", ""])
  const [allowsMultiple, setAllowsMultiple] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""])
    }
  }

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index))
    }
  }

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const handleCreate = async () => {
    if (!question.trim()) {
      toast.error("Escribe una pregunta")
      return
    }

    const validOptions = options.filter((o) => o.trim())
    if (validOptions.length < 2) {
      toast.error("Necesitas al menos 2 opciones")
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          question: question.trim(),
          options: validOptions,
          allowsMultiple,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create poll")
      }

      const data = await response.json()
      
      // Emitir el mensaje por socket para que otros usuarios lo vean
      if (data.message && socket.connected) {
        socket.emit("send_message", {
          chatId,
          message: data.message,
        })
      }
      
      toast.success("Encuesta creada")
      onPollCreated?.(data.message)
      handleClose()
    } catch {
      toast.error("Error al crear encuesta")
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    setQuestion("")
    setOptions(["", ""])
    setAllowsMultiple(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Crear encuesta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="question">Pregunta</Label>
            <Input
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="¿Cuál es tu pregunta?"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label>Opciones</Label>
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Opción ${index + 1}`}
                  maxLength={100}
                />
                {options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(index)}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 10 && (
              <Button
                variant="outline"
                size="sm"
                onClick={addOption}
                className="w-full mt-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar opción
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="multiple" className="cursor-pointer">
              Permitir múltiples respuestas
            </Label>
            <Switch
              id="multiple"
              checked={allowsMultiple}
              onCheckedChange={setAllowsMultiple}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Creando..." : "Crear encuesta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
