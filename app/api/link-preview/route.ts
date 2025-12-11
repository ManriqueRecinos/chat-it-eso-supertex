import { NextRequest, NextResponse } from "next/server"

// Cache simple en memoria para evitar peticiones repetidas
const previewCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 // 1 hora

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 })
  }

  // Validar que sea una URL válida
  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  // Revisar cache
  const cached = previewCache.get(url)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data)
  }

  try {
    // Fetch the page HTML
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch URL" }, { status: 400 })
    }

    const contentType = response.headers.get("content-type") || ""
    
    // Si es una imagen directa, retornar como preview de imagen
    if (contentType.startsWith("image/")) {
      const data = {
        url,
        title: url.split("/").pop() || "Image",
        description: null,
        image: url,
        siteName: new URL(url).hostname,
        type: "image",
      }
      previewCache.set(url, { data, timestamp: Date.now() })
      return NextResponse.json(data)
    }

    const html = await response.text()

    // Parse Open Graph and meta tags
    const getMetaContent = (property: string): string | null => {
      // Try og: tags first
      const ogMatch = html.match(
        new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']*)["']`, "i")
      ) || html.match(
        new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${property}["']`, "i")
      )
      if (ogMatch) return ogMatch[1]

      // Try twitter: tags
      const twitterMatch = html.match(
        new RegExp(`<meta[^>]*name=["']twitter:${property}["'][^>]*content=["']([^"']*)["']`, "i")
      ) || html.match(
        new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']twitter:${property}["']`, "i")
      )
      if (twitterMatch) return twitterMatch[1]

      // Try regular meta tags for description
      if (property === "description") {
        const descMatch = html.match(
          /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i
        ) || html.match(
          /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i
        )
        if (descMatch) return descMatch[1]
      }

      return null
    }

    // Get title from og:title, twitter:title, or <title> tag
    let title = getMetaContent("title")
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      title = titleMatch ? titleMatch[1].trim() : null
    }

    const description = getMetaContent("description")
    let image = getMetaContent("image")
    const siteName = getMetaContent("site_name") || new URL(url).hostname

    // Resolve relative image URLs
    if (image && !image.startsWith("http")) {
      const baseUrl = new URL(url)
      image = new URL(image, baseUrl.origin).href
    }

    const data = {
      url,
      title: title ? decodeHTMLEntities(title) : null,
      description: description ? decodeHTMLEntities(description) : null,
      image,
      siteName,
      type: "website",
    }

    // Guardar en cache
    previewCache.set(url, { data, timestamp: Date.now() })

    return NextResponse.json(data)
  } catch (error) {
    console.error("Link preview error:", error)
    return NextResponse.json({ error: "Failed to fetch preview" }, { status: 500 })
  }
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
}
