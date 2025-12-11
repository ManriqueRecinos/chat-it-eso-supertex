import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import { SettingsForm } from "@/components/settings/settings-form"
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form"

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get("userId")?.value

  let existingUser: { id: string; username: string; profilePhotoUrl: string | null } | null = null

  if (userId) {
    const users = await sql`SELECT * FROM users WHERE id = ${userId}`
    if (users.length > 0) {
      existingUser = users[0] as { id: string; username: string; profilePhotoUrl: string | null }
    }
  }

  return (
    <div className="min-h-screen bg-[#f5e9ff] flex items-center justify-center p-4 sm:px-4 sm:py-8">
      <div className="w-full max-w-5xl bg-white/95 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Columna izquierda: encabezado + formulario */}
        <div className="px-4 py-6 sm:px-8 sm:py-10 md:px-12 flex flex-col justify-center">
          {/* Logo para móvil */}
          <div className="flex justify-center mb-6 md:hidden">
            <img
              src="/icono_app.png"
              alt="CHAT IT ESO SUPERTEX"
              className="w-20 h-20 object-contain"
            />
          </div>
          
          <div className="mb-6 sm:mb-8 text-center md:text-left">
            <p className="text-[10px] sm:text-xs font-semibold tracking-[0.25em] uppercase text-primary mb-2">
              {existingUser ? "Tu perfil" : "Bienvenido"}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
              {existingUser ? "Actualizar perfil" : "Inicia sesión"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {existingUser
                ? "Actualiza tu información para seguir chateando."
                : "Ingresa tu nombre de usuario para entrar."}
            </p>
          </div>

          {existingUser ? (
            <ProfileSettingsForm existingUser={existingUser} />
          ) : (
            <SettingsForm existingUser={null} />
          )}
        </div>

        {/* Columna derecha: imagen sobre fondo blanco (login / registro) */}
        <div className="hidden md:flex items-center justify-center bg-white">
          <div className="p-8 w-full flex items-center justify-center">
            <div className="rounded-3xl border border-neutral-200 shadow-lg max-w-sm w-full flex items-center justify-center bg-white">
              <img
                id="auth-side-image"
                src="/icono_app.png"
                alt="Login CHAT IT ESO SUPERTEX"
                className="w-full h-full object-contain rounded-3xl"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
