import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { text, language } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    // Generate random reqid
    const reqid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

    console.log("[v0] TTS API request:", { text: text.substring(0, 50) + "...", language, reqid })

    const response = await fetch("https://openspeech.bytedance.com/api/v1/tts", {
      method: "POST",
      headers: {
        "x-api-key": process.env.TTS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app: {
          cluster: "volcano_tts",
        },
        user: {
          uid: "豆包语音",
        },
        audio: {
          voice_type: "BV001",
          encoding: "mp3",
          speed_ratio: 1.0,
          volume_ratio: 1.0,
          pitch_ratio: 1.0,
        },
        request: {
          reqid: reqid,
          text: text,
          operation: "query",
        },
      }),
    })

    if (!response.ok) {
      console.log("[v0] TTS API error:", response.status, response.statusText)
      throw new Error(`TTS API error: ${response.status}`)
    }

    const data = await response.json()
    console.log("[v0] TTS API response:", { code: data.code, message: data.message, hasData: !!data.data })

    if (data.code !== 3000) {
      throw new Error(`TTS API error: ${data.message}`)
    }

    return NextResponse.json({
      audioData: data.data,
      reqid: data.reqid,
    })
  } catch (error) {
    console.error("[v0] TTS API error:", error)
    return NextResponse.json({ error: "Failed to generate speech" }, { status: 500 })
  }
}
