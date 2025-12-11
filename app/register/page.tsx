import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { RegisterForm } from "@/components/auth/register-form"

export default async function RegisterPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get("userId")?.value

  // Si ya está logueado, redirigir al chat
  if (userId) {
    redirect("/chat")
  }

  return (
    <div className="min-h-screen bg-[#f5e9ff] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl bg-white/95 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Columna izquierda: formulario */}
        <div className="px-8 py-10 md:px-12 flex flex-col justify-center">
          <div className="mb-8 text-center md:text-left">
            <p className="text-xs font-semibold tracking-[0.25em] uppercase text-primary mb-2">
              Nuevo usuario
            </p>
            <h1 className="text-3xl font-bold text-foreground mb-1">
              Crear cuenta
            </h1>
            <p className="text-sm text-muted-foreground">
              Regístrate para comenzar a chatear en CHAT IT ESO SUPERTEX.
            </p>
          </div>

          <RegisterForm />
        </div>

        {/* Columna derecha: imagen */}
        <div className="hidden md:flex items-center justify-center bg-white">
          <div className="p-8 w-full flex items-center justify-center">
            <div className="rounded-3xl border border-neutral-200 shadow-lg max-w-sm w-full flex items-center justify-center bg-white">
              <img
                src="/register.png"
                alt="Registro CHAT IT ESO SUPERTEX"
                className="w-full h-full object-contain rounded-3xl"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
