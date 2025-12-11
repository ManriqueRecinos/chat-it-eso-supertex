"use client"

import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Circle, Moon, MinusCircle, Eye } from "lucide-react"
import { toast } from "sonner"

const STATUS_OPTIONS = [
  { value: "available", label: "Disponible", icon: Circle, color: "text-green-500", bgColor: "bg-green-500" },
  { value: "busy", label: "Ocupado", icon: MinusCircle, color: "text-yellow-500", bgColor: "bg-yellow-500" },
  { value: "dnd", label: "No molestar", icon: Moon, color: "text-red-500", bgColor: "bg-red-500" },
  { value: "offline", label: "Invisible", icon: Eye, color: "text-gray-500", bgColor: "bg-gray-500" },
] as const

type Status = typeof STATUS_OPTIONS[number]["value"]

interface UserStatusSelectorProps {
  currentStatus: Status
  onStatusChange?: (status: Status) => void
}

export function UserStatusSelector({ currentStatus, onStatusChange }: UserStatusSelectorProps) {
  const [status, setStatus] = useState<Status>(currentStatus)
  const [isUpdating, setIsUpdating] = useState(false)

  const currentOption = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]

  const handleStatusChange = async (newStatus: Status) => {
    if (newStatus === status) return

    setIsUpdating(true)
    try {
      const response = await fetch("/api/users/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) throw new Error("Failed to update status")

      setStatus(newStatus)
      onStatusChange?.(newStatus)
      toast.success(`Estado cambiado a ${STATUS_OPTIONS.find(s => s.value === newStatus)?.label}`)
    } catch {
      toast.error("Error al cambiar estado")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 h-8"
          disabled={isUpdating}
        >
          <span className={`h-2 w-2 rounded-full ${currentOption.bgColor}`} />
          <span className="text-xs">{currentOption.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {STATUS_OPTIONS.map((option) => {
          const Icon = option.icon
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleStatusChange(option.value)}
              className="gap-2"
            >
              <Icon className={`h-4 w-4 ${option.color}`} />
              <span>{option.label}</span>
              {status === option.value && (
                <span className="ml-auto text-xs text-muted-foreground">✓</span>
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function StatusIndicator({ status, size = "sm" }: { status: Status; size?: "sm" | "md" | "lg" }) {
  const option = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]
  const sizeClasses = {
    sm: "h-2 w-2",
    md: "h-3 w-3",
    lg: "h-4 w-4",
  }

  return (
    <span 
      className={`rounded-full ${option.bgColor} ${sizeClasses[size]}`} 
      title={option.label}
    />
  )
}
