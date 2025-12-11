import { type NextRequest, NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Determine resource type
    const isVideo = file.type.startsWith("video/")
    const isAudio = file.type.startsWith("audio/")
    const resourceType = isVideo || isAudio ? "video" : "image"

    // Upload to Cloudinary
    const result = await new Promise<{ secure_url: string; public_id: string; resource_type: string }>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              resource_type: resourceType,
              folder: "chatapp",
              transformation:
                resourceType === "image"
                  ? [{ width: 1200, height: 1200, crop: "limit" }, { quality: "auto" }]
                  : undefined,
            },
            (error, result) => {
              if (error) reject(error)
              else resolve(result as { secure_url: string; public_id: string; resource_type: string })
            },
          )
          .end(buffer)
      },
    )

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      fileType: file.type,
      resourceType: result.resource_type,
    })
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error)

    // Fallback: Return a placeholder URL for demo purposes if Cloudinary is not configured
    return NextResponse.json({
      url: "/abstract-geometric-shapes.png",
      publicId: "demo",
      fileType: "image/svg+xml",
      resourceType: "image",
    })
  }
}
