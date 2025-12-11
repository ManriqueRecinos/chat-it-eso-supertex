import { MessageSquare } from "lucide-react"

export function EmptyChatView() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[var(--color-chat-bg)]">
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
          <MessageSquare className="h-12 w-12 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground">CHAT IT ESO SUPERTEX</h2>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Envía y recibe mensajes en tiempo real. Selecciona un chat de la barra lateral para comenzar.
        </p>
        <div className="mt-8 rounded-lg bg-card p-4 text-sm text-muted-foreground shadow-sm">
          <p>
            <strong>Consejo:</strong> ¡Crea un nuevo chat y comparte el código de invitación con tus amigos!
          </p>
        </div>
      </div>
    </div>
  )
}
