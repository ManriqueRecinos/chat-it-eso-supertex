"use client"

import { useMemo } from "react"

interface MediaEmbedProps {
  url: string
  className?: string
}

// Detectar tipo de media y extraer ID
function detectMediaType(url: string): { type: 'youtube' | 'facebook' | 'spotify' | 'tiktok' | null; id: string | null; embedUrl: string | null } {
  // YouTube - múltiples formatos
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ]
  
  for (const pattern of youtubePatterns) {
    const match = url.match(pattern)
    if (match) {
      return {
        type: 'youtube',
        id: match[1],
        embedUrl: `https://www.youtube.com/embed/${match[1]}?rel=0`
      }
    }
  }

  // Facebook Video
  const facebookPatterns = [
    /facebook\.com\/.*\/videos\/(\d+)/,
    /facebook\.com\/watch\/?\?v=(\d+)/,
    /fb\.watch\/([a-zA-Z0-9_-]+)/,
    /facebook\.com\/reel\/(\d+)/,
  ]
  
  for (const pattern of facebookPatterns) {
    const match = url.match(pattern)
    if (match) {
      return {
        type: 'facebook',
        id: match[1],
        embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=560`
      }
    }
  }

  // Spotify - tracks, albums, playlists, episodes
  const spotifyPatterns = [
    /open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/,
    /spotify\.link\/([a-zA-Z0-9]+)/,
  ]
  
  for (const pattern of spotifyPatterns) {
    const match = url.match(pattern)
    if (match) {
      if (pattern.source.includes('spotify\\.link')) {
        // Short link - usamos el URL completo
        return {
          type: 'spotify',
          id: match[1],
          embedUrl: null // No podemos embeber short links directamente
        }
      }
      const contentType = match[1]
      const contentId = match[2]
      return {
        type: 'spotify',
        id: contentId,
        embedUrl: `https://open.spotify.com/embed/${contentType}/${contentId}?utm_source=generator&theme=0`
      }
    }
  }

  // TikTok
  const tiktokPatterns = [
    /tiktok\.com\/@[^\/]+\/video\/(\d+)/,
    /vm\.tiktok\.com\/([a-zA-Z0-9]+)/,
  ]
  
  for (const pattern of tiktokPatterns) {
    const match = url.match(pattern)
    if (match) {
      return {
        type: 'tiktok',
        id: match[1],
        embedUrl: `https://www.tiktok.com/embed/v2/${match[1]}`
      }
    }
  }

  return { type: null, id: null, embedUrl: null }
}

export function MediaEmbed({ url, className = "" }: MediaEmbedProps) {
  const media = useMemo(() => detectMediaType(url), [url])

  if (!media.type || !media.embedUrl) {
    return null
  }

  return (
    <div className={`mt-2 overflow-hidden rounded-lg ${className}`}>
      {media.type === 'youtube' && (
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute inset-0 h-full w-full rounded-lg"
            src={media.embedUrl}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}

      {media.type === 'facebook' && (
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute inset-0 h-full w-full rounded-lg"
            src={media.embedUrl}
            title="Facebook video"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}

      {media.type === 'spotify' && (
        <iframe
          className="w-full rounded-lg"
          src={media.embedUrl}
          height="152"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          title="Spotify embed"
        />
      )}

      {media.type === 'tiktok' && (
        <div className="relative w-full" style={{ paddingBottom: '177.78%', maxHeight: '500px' }}>
          <iframe
            className="absolute inset-0 h-full w-full rounded-lg"
            src={media.embedUrl}
            title="TikTok video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  )
}

// Función helper para detectar si un texto contiene URLs de media embebible
export function extractMediaUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const urls = text.match(urlRegex) || []
  
  return urls.filter(url => {
    const media = detectMediaType(url)
    return media.type !== null && media.embedUrl !== null
  })
}

// Función para verificar si una URL es embebible
export function isEmbeddableUrl(url: string): boolean {
  const media = detectMediaType(url)
  return media.type !== null && media.embedUrl !== null
}
