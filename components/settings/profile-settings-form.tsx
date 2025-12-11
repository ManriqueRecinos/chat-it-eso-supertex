"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Camera, Loader2, User } from "lucide-react"
import { toast } from "sonner"

interface ProfileSettingsFormProps {
  existingUser: {
    id: string
    username: string
    profilePhotoUrl: string | null
  }
}

export function ProfileSettingsForm({ existingUser }: ProfileSettingsFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profilePhotoUrl, setProfilePhotoUrl] = useState(existingUser.profilePhotoUrl || "")
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona un archivo de imagen")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen debe ser menor a 5MB")
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload-media", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to upload image")
      }

      const data = await response.json()
      setProfilePhotoUrl(data.url)
      toast.success("Foto de perfil subida")
    } catch {
      toast.error("Error al subir la imagen")
    } finally {
      setIsUploading(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsSaving(true)

    try {
      const response = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: existingUser.username,
          profilePhotoUrl: profilePhotoUrl || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || "Failed to update profile")
      }

      toast.success("Perfil actualizado exitosamente")
      router.push("/chat")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar el perfil")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="pt-6">
        <form onSubmit={handleUpdateProfile} className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profilePhotoUrl || "/placeholder.svg"} alt={existingUser.username} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  <User className="h-10 w-10" />
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Haz clic en el ícono de la cámara para subir una nueva foto de perfil.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Usuario</label>
            <Input value={existingUser.username} disabled className="h-12" />
          </div>

          <div className="space-y-3 pt-2">
            <Button
              type="submit"
              className="h-12 w-full bg-primary hover:bg-primary/90"
              disabled={isSaving || isUploading}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando cambios...
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-12 w-full"
              onClick={() => router.push("/chat")}
            >
              Volver al chat
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
