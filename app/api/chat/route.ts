import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabaseServer"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Helper function to get client IP address
function getClientIP(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const real = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  if (cfConnectingIP) return cfConnectingIP
  if (forwarded) return forwarded.split(',')[0].trim()
  if (real) return real
  
  return request.ip || null
}

async function callOpenRouterWithStreamRetry(messages: any[], maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[v0] Attempting OpenRouter streaming API call, attempt ${attempt}`)

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
          stream: true,
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

      console.log(`[v0] OpenRouter streaming API success`)
      return response
    } catch (error) {
      console.log(`[v0] Error in attempt ${attempt}:`, error)
      if (attempt === maxRetries) {
        throw error
      }
      await delay(3000)
    }
  }
  throw new Error("All retry attempts failed")
}

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Chat API endpoint called")

    const { message, personality, conversationHistory, language } = await request.json()

    console.log(
      `[v0] Request params - personality: ${personality}, language: ${language}, message length: ${message?.length || 0}`,
    )

    // Get authorization header to check if user is logged in
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.replace('Bearer ', '')
    
    let usageResult: any = null
    let isLoggedIn = false
    
    if (accessToken) {
      // User is potentially logged in, check with Supabase
      const supabase = createSupabaseServerClient(accessToken)
      
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (user && !userError) {
          isLoggedIn = true
          console.log("[v0] Logged-in user detected, checking conversation limits")
          
          // Call updated RPC function to check and increment conversation count (with subscription support)
          const { data, error } = await supabase.rpc('check_user_conversation_limit_v2', {
            p_user_id: user.id
          })
          
          if (error) {
            console.error("[v0] RPC Error:", error)
            return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
          }
          
          usageResult = data
          
          if (!data.success) {
            return NextResponse.json({
              error: data.message,
              limitReached: true,
              remaining: data.remaining_count
            }, { status: 429 })
          }
        }
      } catch (error) {
        console.log("[v0] Auth check failed, treating as guest")
      }
    }
    
    if (!isLoggedIn) {
      // Handle guest user
      const clientIP = getClientIP(request)
      const deviceId = request.headers.get('x-device-id')
      const userAgent = request.headers.get('user-agent')
      const deviceFingerprint = request.headers.get('x-device-fingerprint')
      
      if (!deviceId) {
        return NextResponse.json({ error: '缺少设备标识，请刷新页面重试' }, { status: 400 })
      }
      
      console.log("[v0] Guest user detected, checking conversation limits for device:", deviceId.substring(0, 16) + '...')
      
      // Use service role client for guest operations
      const supabase = createSupabaseServerClient()
      const { data, error } = await supabase.rpc('check_guest_conversation_limit_v2', { 
        client_device_id: deviceId,
        client_ip: clientIP,
        client_user_agent: userAgent,
        client_fingerprint: deviceFingerprint
      })
      
      if (error) {
        console.error("[v0] Guest RPC Error:", error)
        // 降级到旧版本IP追踪
        console.log("[v0] Falling back to IP-based tracking")
        const fallbackResult = await supabase.rpc('check_guest_conversation_limit', { client_ip: clientIP })
        
        if (fallbackResult.error) {
          return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
        }
        
        usageResult = fallbackResult.data
      } else {
        usageResult = data
      }
      
      if (!usageResult.success) {
        return NextResponse.json({
          error: usageResult.message,
          limitReached: true,
          remaining: usageResult.remaining_count || 0,
          isGuest: true
        }, { status: 429 })
      }
    }

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
    const response = await callOpenRouterWithStreamRetry(messages)
    
    // Create a ReadableStream to handle the streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        try {
          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error('No response body')
          }

          let buffer = ''
          
          while (true) {
            const { done, value } = await reader.read()
            
            if (done) {
              // Send final metadata
              const finalData = {
                type: 'metadata',
                remaining: usageResult?.remaining_count || 0,
                isGuest: !isLoggedIn
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`))
              controller.close()
              break
            }

            buffer += new TextDecoder().decode(value)
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.trim().startsWith('data: ')) {
                const data = line.replace('data: ', '').trim()
                
                if (data === '[DONE]') {
                  continue
                }

                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content
                  
                  if (content) {
                    const streamData = {
                      type: 'content',
                      content: content
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(streamData)}\n\n`))
                  }
                } catch (parseError) {
                  console.error('Parse error:', parseError)
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream processing error:', error)
          const errorData = {
            type: 'error',
            error: '抱歉，我现在无法回复。请稍后再试。'
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
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
