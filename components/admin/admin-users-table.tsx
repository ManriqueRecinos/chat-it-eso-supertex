"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"

export interface AdminUser {
  id: string
  username: string
  profilePhotoUrl: string | null
  createdAt: string
  role: string | null
}

interface AdminUsersTableProps {
  initialUsers: AdminUser[]
  availableRoles: string[]
}

export function AdminUsersTable({ initialUsers, availableRoles }: AdminUsersTableProps) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers)
  const [isCreating, setIsCreating] = useState(false)
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    profilePhotoUrl: "",
    role: "user",
  })
  const [savingUserId, setSavingUserId] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newUser.username.trim() || !newUser.password.trim()) {
      toast.error("Usuario y contraseña son requeridos")
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUser.username.trim(),
          password: newUser.password,
          profilePhotoUrl: newUser.profilePhotoUrl || null,
          role: newUser.role || "user",
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || "Error al crear usuario")
      }

      const created = (await response.json()) as AdminUser
      setUsers((prev) => [created, ...prev])
      setNewUser({ username: "", password: "", profilePhotoUrl: "", role: "user" })
      toast.success("Usuario creado correctamente")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear usuario")
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdate = async (user: AdminUser) => {
    setSavingUserId(user.id)
    try {
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          username: user.username,
          profilePhotoUrl: user.profilePhotoUrl,
          role: user.role,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || "Error al actualizar usuario")
      }

      const updated = (await response.json()) as AdminUser
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      toast.success("Usuario actualizado")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar usuario")
    } finally {
      setSavingUserId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Usuarios</h2>
        <p className="text-sm text-muted-foreground">
          Crea nuevos usuarios y edita sus datos y roles.
        </p>
      </div>

      {/* Crear nuevo usuario */}
      <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
        <h3 className="font-medium text-sm mb-2">Crear nuevo usuario</h3>
        <div className="grid gap-3 md:grid-cols-4 items-start">
          <Input
            placeholder="Usuario"
            value={newUser.username}
            onChange={(e) => setNewUser((prev) => ({ ...prev, username: e.target.value }))}
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={newUser.password}
            onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
          />
          <Input
            placeholder="URL foto (opcional)"
            value={newUser.profilePhotoUrl}
            onChange={(e) => setNewUser((prev) => ({ ...prev, profilePhotoUrl: e.target.value }))}
          />
          <Select
            value={newUser.role}
            onValueChange={(value) => setNewUser((prev) => ({ ...prev, role: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {newUser.profilePhotoUrl && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-12 w-12 rounded-full overflow-hidden bg-muted border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={newUser.profilePhotoUrl}
                alt="Preview nueva foto"
                className="h-full w-full object-cover"
              />
            </div>
            <span className="break-all">{newUser.profilePhotoUrl}</span>
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Creando..." : "Crear usuario"}
          </Button>
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Fecha creación</TableHead>
              <TableHead>Foto</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Input
                    value={user.username}
                    onChange={(e) =>
                      setUsers((prev) =>
                        prev.map((u) => (u.id === user.id ? { ...u, username: e.target.value } : u)),
                      )
                    }
                  />
                </TableCell>
                <TableCell className="max-w-[160px]">
                  <Select
                    value={user.role || "user"}
                    onValueChange={(value) =>
                      setUsers((prev) =>
                        prev.map((u) => (u.id === user.id ? { ...u, role: value } : u)),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(user.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="max-w-xs">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-muted border flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {user.profilePhotoUrl ? (
                        <img
                          src={user.profilePhotoUrl}
                          alt={user.username}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">
                          Sin foto
                        </div>
                      )}
                    </div>
                    <div className="w-full min-w-0">
                      <Input
                        placeholder="URL foto"
                        value={user.profilePhotoUrl || ""}
                        title={user.profilePhotoUrl || ""}
                        onChange={(e) =>
                          setUsers((prev) =>
                            prev.map((u) =>
                              u.id === user.id ? { ...u, profilePhotoUrl: e.target.value } : u,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right align-middle">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdate(user)}
                    disabled={savingUserId === user.id}
                  >
                    {savingUserId === user.id ? "Guardando..." : "Guardar"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
