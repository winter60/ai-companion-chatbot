import { type NextRequest, NextResponse } from "next/server"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function callOpenRouterWithRetry(messages: any[], maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[v0] Attempting OpenRouter API call, attempt ${attempt}`)

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "moonshotai/kimi-k2:free",
          messages: messages,
          temperature: 0.7,
          max_tokens: 500,
        }),
      })

      console.log(`[v0] OpenRouter API response status: ${response.status}`)

      if (response.status === 429) {
        if (attempt < maxRetries) {
          const waitTime = Math.pow(3, attempt) * 5000
          console.log(`[v0] Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}`)
          await delay(waitTime)
          continue
        } else {
          throw new Error("RATE_LIMITED")
        }
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.log(`[v0] OpenRouter API error response: ${errorText}`)
        throw new Error(`OpenRouter API error: ${response.status}`)
      }

      const data = await response.json()
      console.log(`[v0] OpenRouter API success, response length: ${data.choices[0]?.message?.content?.length || 0}`)
      return data
    } catch (error) {
      console.log(`[v0] Error in attempt ${attempt}:`, error)
      if (attempt === maxRetries) {
        throw error
      }
      await delay(3000)
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Chat API endpoint called")

    const { message, personality, conversationHistory, language } = await request.json()

    console.log(
      `[v0] Request params - personality: ${personality}, language: ${language}, message length: ${message?.length || 0}`,
    )

    // 根据人格类型创建系统提示
    const personalityPrompts = {
      gentle: {
        zh: "你是一个温柔、关怀的情感陪伴者，像一个总是理解用户的贴心朋友。你的回复应该充满同理心、温暖和支持。用温柔的语气，表达关怀和理解。",
        en: "You are a gentle, caring emotional companion, like a caring friend who always understands the user. Your responses should be full of empathy, warmth and support. Use a gentle tone and express care and understanding.",
      },
      rational: {
        zh: "你是一个理性、智慧的导师，帮助用户清晰思考问题。你的回复应该分析性强、有逻辑、提供深思熟虑的观点和建议。保持客观但关怀的态度。",
        en: "You are a rational, wise mentor who helps users think clearly about problems. Your responses should be analytical, logical, and provide thoughtful perspectives and advice. Maintain an objective but caring attitude.",
      },
      lively: {
        zh: "你是一个活泼、充满活力的伙伴，带来欢乐和笑声。你的回复应该积极向上、幽默风趣、充满正能量。用轻松愉快的语气，帮助用户看到生活的美好一面。",
        en: "You are a lively, energetic companion who brings joy and laughter. Your responses should be positive, humorous, and full of positive energy. Use a light-hearted tone to help users see the bright side of life.",
      },
    }

    // 构建消息历史
    const messages = [
      {
        role: "system",
        content: personalityPrompts[personality as keyof typeof personalityPrompts][language as "zh" | "en"],
      },
      // 添加最近的对话历史（最多5条）
      ...conversationHistory.slice(-5).map((msg: any) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content,
      })),
      {
        role: "user",
        content: message,
      },
    ]

    console.log(`[v0] Calling OpenRouter with ${messages.length} messages`)
    const data = await callOpenRouterWithRetry(messages)
    const aiResponse = data.choices[0]?.message?.content || "抱歉，我现在无法回复。请稍后再试。"

    console.log(`[v0] Returning AI response, length: ${aiResponse.length}`)
    return NextResponse.json({ response: aiResponse })
  } catch (error) {
    console.error("[v0] Chat API error:", error)

    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return NextResponse.json(
        {
          error: "请求过于频繁，请稍等片刻再试。 / Too many requests, please wait a moment and try again.",
        },
        { status: 429 },
      )
    }

    return NextResponse.json(
      {
        error: "抱歉，我现在无法回复。请稍后再试。 / Sorry, I cannot reply right now. Please try again later.",
      },
      { status: 500 },
    )
  }
}
