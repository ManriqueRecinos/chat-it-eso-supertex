"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Clock } from "lucide-react"

interface InactivityWarningProps {
  open: boolean
  remainingTime: number
  onContinue: () => void
  onLogout: () => void
}

export function InactivityWarning({
  open,
  remainingTime,
  onContinue,
  onLogout,
}: InactivityWarningProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, "0")}`
    }
    return `${secs} segundos`
  }

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
            <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-500" />
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Sesión por expirar
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Tu sesión se cerrará automáticamente por inactividad en{" "}
            <span className="font-bold text-foreground">{formatTime(remainingTime)}</span>.
            <br />
            <br />
            ¿Deseas continuar trabajando?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogAction
            onClick={onLogout}
            className="bg-muted text-muted-foreground hover:bg-muted/80"
          >
            Cerrar sesión
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onContinue}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Continuar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
