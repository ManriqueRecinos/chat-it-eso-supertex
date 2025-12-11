"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Globe } from "lucide-react"

interface LinkPreviewData {
  url: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  type: string
}

interface LinkPreviewProps {
  url: string
  isOwn?: boolean
}

export function LinkPreview({ url, isOwn = false }: LinkPreviewProps) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    const fetchPreview = async () => {
      try {
        setLoading(true)
        setError(false)

        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
        
        if (!res.ok) {
          throw new Error("Failed to fetch preview")
        }

        const data = await res.json()
        
        if (!cancelled) {
          setPreview(data)
        }
      } catch {
        if (!cancelled) {
          setError(true)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchPreview()

    return () => {
      cancelled = true
    }
  }, [url])

  if (loading) {
    return (
      <div className="mt-2 rounded-lg border bg-muted/30 p-3 animate-pulse">
        <div className="flex gap-3">
          <div className="h-16 w-16 rounded bg-muted flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 rounded bg-muted" />
            <div className="h-2 w-full rounded bg-muted" />
            <div className="h-2 w-1/2 rounded bg-muted" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !preview || (!preview.title && !preview.image)) {
    return null // No mostrar nada si no hay preview disponible
  }

  const handleClick = () => {
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <div
      onClick={handleClick}
      className={`mt-2 rounded-lg border overflow-hidden cursor-pointer transition-all hover:bg-muted/50 ${
        isOwn ? "bg-black/5" : "bg-white/50 dark:bg-white/5"
      }`}
    >
      {/* Imagen grande si existe */}
      {preview.image && (
        <div className="relative w-full h-32 bg-muted overflow-hidden">
          <img
            src={preview.image}
            alt={preview.title || "Link preview"}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Ocultar imagen si falla la carga
              (e.target as HTMLImageElement).style.display = "none"
            }}
          />
        </div>
      )}

      {/* Contenido */}
      <div className="p-2.5">
        {/* Sitio */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
          <Globe className="h-3 w-3" />
          <span className="truncate">{preview.siteName || new URL(url).hostname}</span>
          <ExternalLink className="h-2.5 w-2.5 ml-auto flex-shrink-0" />
        </div>

        {/* Título */}
        {preview.title && (
          <p className="text-sm font-medium leading-tight line-clamp-2 mb-1">
            {preview.title}
          </p>
        )}

        {/* Descripción */}
        {preview.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {preview.description}
          </p>
        )}
      </div>
    </div>
  )
}

// Utilidad para extraer URLs de un texto
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi
  const matches = text.match(urlRegex)
  return matches ? [...new Set(matches)] : [] // Eliminar duplicados
}
