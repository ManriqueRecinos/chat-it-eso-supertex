import { type NextRequest, NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"
import { db } from "@/lib/db"
import { userStickers } from "@/lib/schema"

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const MAX_VIDEO_DURATION_SECONDS = 15
const MAX_FILE_SIZE_MB = 100

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const userId = formData.get("userId") as string | null
    const name = formData.get("name") as string | null

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ error: "Falta userId" }, { status: 400 })
    }

    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      return NextResponse.json(
        { error: `El archivo es muy grande. Máximo ${MAX_FILE_SIZE_MB}MB` },
        { status: 400 },
      )
    }

    const mime = file.type || ""
    const fileName = file.name || ""
    const ext = fileName.split('.').pop()?.toLowerCase() || ""
    
    // Extensiones conocidas de imagen y video
    const imageExtensions = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "gift"]
    const videoExtensions = ["mp4", "mov", "avi", "webm", "mkv", "m4v", "wmv", "flv"]
    
    const isVideo = mime.startsWith("video/") || videoExtensions.includes(ext)
    const isImage = mime.startsWith("image/") || imageExtensions.includes(ext)

    // Permitimos cualquier tipo de imagen o video
    if (!isVideo && !isImage) {
      return NextResponse.json(
        { error: "Solo se permiten archivos de imagen o video" },
        { status: 400 },
      )
    }

    const stickerName = name || file.name.split(".")[0] || "sticker"

    // Convertir File -> Buffer para Cloudinary
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    if (isVideo) {
      // Subir video como sticker animado (comprimido)
      const uploadResult: any = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              resource_type: "video",
              folder: "chatapp/stickers",
              transformation: [
                {
                  width: 256,
                  height: 256,
                  crop: "limit",
                },
                {
                  quality: "auto:low",
                  video_codec: "h264",
                  audio_codec: "none",
                  format: "mp4",
                },
              ],
            },
            (error, result) => {
              if (error || !result) return reject(error)
              resolve(result)
            },
          )
          .end(buffer)
      })

      // Validar duración máxima
      const duration = uploadResult.duration as number | undefined
      if (duration && duration > MAX_VIDEO_DURATION_SECONDS) {
        try {
          await cloudinary.uploader.destroy(uploadResult.public_id, { resource_type: "video" })
        } catch (e) {
          console.error("[STICKERS_UPLOAD] error borrando video muy largo", e)
        }
        return NextResponse.json(
          { error: `El video es muy largo. Máximo ${MAX_VIDEO_DURATION_SECONDS} segundos` },
          { status: 400 },
        )
      }

      const [sticker] = await db
        .insert(userStickers)
        .values({
          id: crypto.randomUUID(),
          userId,
          name: stickerName,
          url: uploadResult.secure_url,
          type: "video",
        })
        .returning()

      return NextResponse.json(sticker, { status: 200 })
    }

    // Imagen (incluye png, jpg, gif, gift, webp, etc.)
    const uploadResult: any = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: "image",
            folder: "chatapp/stickers",
            transformation: [
              {
                width: 256,
                height: 256,
                crop: "limit",
              },
              {
                quality: "auto",
              },
            ],
          },
          (error, result) => {
            if (error || !result) return reject(error)
            resolve(result)
          },
        )
        .end(buffer)
    })

    const [sticker] = await db
      .insert(userStickers)
      .values({
        id: crypto.randomUUID(),
        userId,
        name: stickerName,
        url: uploadResult.secure_url,
        type: "image",
      })
      .returning()

    return NextResponse.json(sticker, { status: 200 })
  } catch (error) {
    console.error("[STICKERS_UPLOAD] Error:", error)
    return NextResponse.json({ error: "Error al subir el sticker" }, { status: 500 })
  }
}
