import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabaseServer"

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

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Usage API endpoint called")

    // Get authorization header to check if user is logged in
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.replace('Bearer ', '')
    
    if (accessToken) {
      // User is potentially logged in, check with Supabase
      const supabase = createSupabaseServerClient(accessToken)
      
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (user && !userError) {
          console.log("[v0] Getting usage status for logged-in user")
          
          const { data, error } = await supabase.rpc('get_user_usage_status')
          
          if (error) {
            console.error("[v0] RPC Error:", error)
            return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
          }
          
          return NextResponse.json({
            success: data.success,
            message: data.message,
            remaining: data.remaining_count,
            isGuest: false,
            limit: 10
          })
        }
      } catch (error) {
        console.log("[v0] Auth check failed, treating as guest")
      }
    }
    
    // Handle guest user
    const clientIP = getClientIP(request)
    const deviceId = request.headers.get('x-device-id')
    
    if (!deviceId) {
      return NextResponse.json({ error: '缺少设备标识，请刷新页面重试' }, { status: 400 })
    }
    
    console.log("[v0] Getting usage status for guest device:", deviceId.substring(0, 16) + '...')
    
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('get_guest_conversation_status_v2', { 
      client_device_id: deviceId,
      client_ip: clientIP
    })
    
    if (error) {
      console.error("[v0] Guest RPC Error:", error)
      // 降级到IP追踪
      console.log("[v0] Falling back to IP-based status check")
      const fallbackResult = await supabase.rpc('get_guest_conversation_status', { client_ip: clientIP })
      
      if (fallbackResult.error) {
        return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
      }
      
      return NextResponse.json({
        success: fallbackResult.data.success,
        message: fallbackResult.data.message,
        remaining: fallbackResult.data.remaining_count,
        isGuest: true,
        limit: 3,
        trackingMethod: 'ip_fallback'
      })
    }
    
    return NextResponse.json({
      success: data.success,
      message: data.message,
      remaining: data.remaining_count,
      isGuest: true,
      limit: 3,
      trackingMethod: 'device_fingerprint'
    })
    
  } catch (error) {
    console.error("[v0] Usage API error:", error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}