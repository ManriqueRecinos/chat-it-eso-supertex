"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Camera, User, Loader2, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

interface SettingsFormProps {
  existingUser: {
    id: string
    username: string
    profilePhotoUrl: string | null
  } | null
}

export function SettingsForm({ existingUser }: SettingsFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [username, setUsername] = useState(existingUser?.username || "")
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(existingUser?.profilePhotoUrl || "")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [mode, setMode] = useState<"login" | "signup">("login") // Default to login

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona un archivo de imagen")
      return
    }

    // Validate file size (max 5MB)
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

  // Actualizar solo foto de perfil (y mantener username) para usuarios existentes
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!existingUser) return

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
        const error = await response.json()
        throw new Error(error.error || "Failed to update profile")
      }

      toast.success("Perfil actualizado exitosamente")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar el perfil")
    } finally {
      setIsSaving(false)
    }
  }

  // Sincronizar imagen lateral (login/register) con el modo actual
  useEffect(() => {
    const img = document.getElementById("auth-side-image") as HTMLImageElement | null
    if (!img) return

    if (existingUser) {
      img.src = "/icono_app.png"
      img.alt = "Perfil CHAT IT ESO SUPERTEX"
      return
    }

    if (mode === "login") {
      img.src = "/icono_app.png"
      img.alt = "Login CHAT IT ESO SUPERTEX"
    } else {
      img.src = "/register.png"
      img.alt = "Registro CHAT IT ESO SUPERTEX"
    }
  }, [mode, existingUser])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!username.trim()) {
      toast.error("El nombre de usuario es requerido")
      return
    }

    if (username.length < 3) {
      toast.error("El nombre de usuario debe tener al menos 3 caracteres")
      return
    }

    if (!password) {
      toast.error("La contraseña es requerida")
      return
    }

    setIsSaving(true)

    try {
      // Check if user exists
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          mode: "login",
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to login")
      }

      const data = await response.json()

      if (!data.isNewUser) {
        toast.success("Sesión iniciada exitosamente")
      }

      // Usar window.location para forzar navegación completa en producción
      window.location.href = "/chat"
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al iniciar sesión")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!username.trim()) {
      toast.error("El nombre de usuario es requerido")
      return
    }

    if (username.length < 3) {
      toast.error("Username must be at least 3 characters")
      return
    }

    if (!password) {
      toast.error("La contraseña es requerida")
      return
    }

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden")
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          profilePhotoUrl: profilePhotoUrl || null,
          mode: "signup",
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create account")
      }

      const data = await response.json()

      // Check if user was created or already existed
      if (data.isNewUser) {
        toast.success("Cuenta creada exitosamente")
      } else {
        // User already exists when trying to signup
        toast.error("El nombre de usuario ya existe. Por favor inicia sesión.")
        setMode("login")
        setIsSaving(false)
        return
      }

      // Usar window.location para forzar navegación completa en producción
      window.location.href = "/chat"
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear la cuenta")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = existingUser
    ? handleUpdateProfile // En settings, solo actualizar foto / perfil
    : (mode === "login" ? handleLogin : handleSignup)

  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {(existingUser || (!existingUser && mode === "signup")) && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profilePhotoUrl || "/placeholder.svg"} alt={username} />
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
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </div>
              <p className="text-sm text-muted-foreground">Haz clic en el ícono de la cámara para subir una foto de perfil</p>
            </div>
          )}

          {/* Contenido que cambia entre login y registro, con animación */}
          <div
            key={existingUser ? "profile" : mode}
            className="space-y-6 animate-in fade-in-50 slide-in-from-right-2 duration-300"
          >
            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                type="text"
                placeholder="Ingresa tu usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12"
                maxLength={30}
                disabled={!!existingUser}
              />
            </div>

            {/* Password */}
            {!existingUser && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Ingresa tu contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Repite tu contraseña"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-12 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Submit Button y links */}
            {existingUser ? (
              <Button
                type="submit"
                className="h-12 w-full bg-primary hover:bg-primary/90"
                disabled={isSaving || isUploading}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  "Actualizar Perfil"
                )}
              </Button>
            ) : (
              <>
                <Button
                  type="submit"
                  className="h-12 w-full bg-primary hover:bg-primary/90"
                  disabled={isSaving || isUploading}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {mode === "login" ? "Iniciando sesión..." : "Creando cuenta..."}
                    </>
                  ) : mode === "login" ? (
                    "Iniciar Sesión"
                  ) : (
                    "Registrarse"
                  )}
                </Button>

                {/* Toggle between login and signup */}
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {mode === "login" ? (
                      <>
                        ¿No tienes una cuenta?{" "}
                        <button
                          type="button"
                          onClick={() => setMode("signup")}
                          className="text-primary hover:underline font-medium"
                        >
                          Regístrate
                        </button>
                      </>
                    ) : (
                      <>
                        ¿Ya tienes una cuenta?{" "}
                        <button
                          type="button"
                          onClick={() => setMode("login")}
                          className="text-primary hover:underline font-medium"
                        >
                          Iniciar Sesión
                        </button>
                      </>
                    )}
                  </p>
                </div>
              </>
            )}
          </div>

        </form>
      </CardContent>
    </Card>
  )
}
