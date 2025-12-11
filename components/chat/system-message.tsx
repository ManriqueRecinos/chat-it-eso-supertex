interface SystemMessageProps {
    type: string
    username?: string
    timestamp: string
    adminUsername?: string
}

export function SystemMessage({ type, username, timestamp, adminUsername }: SystemMessageProps) {
    const getMessage = () => {
        switch (type) {
            case "user_joined":
                // Usuario que se une por código / link
                return `${username ?? "Alguien"} ha ingresado al chat`
            case "user_joined_by_admin":
                // Admin agrega a otro usuario
                if (adminUsername) {
                    return `${adminUsername} ha agregado a ${username ?? "alguien"} al chat`
                }
                return `${username ?? "Alguien"} ha sido agregado al chat`
            case "user_removed_by_admin":
                // Usuario eliminado del chat por un admin
                return `Se ha eliminado a ${username ?? "alguien"} del chat`
            case "user_left":
                // Usuario que se va por su cuenta (si existe este tipo)
                return `${username ?? "Alguien"} salió del grupo`
            default:
                return "Evento del sistema"
        }
    }

    return (
        <div className="flex justify-center my-4">
            <div className="bg-muted/50 px-4 py-2 rounded-full">
                <p className="text-xs text-muted-foreground text-center">
                    {getMessage()}
                </p>
            </div>
        </div>
    )
}
