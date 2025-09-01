import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

// Creem支付配置
const CREEM_API_URL = process.env.CREEM_API_BASE_URL
const CREEM_API_KEY = process.env.CREEM_API_KEY
const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET

if (!CREEM_API_KEY) {
  console.error('Missing CREEM_API_KEY environment variable')
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Payment] Creating payment request...')
    const { productId, planType, userId } = await request.json()
    console.log('[Payment] Request params:', { productId, planType, userId: userId?.substring(0, 8) + '...' })

    // 验证环境变量
    if (!CREEM_API_KEY) {
      console.error('[Payment] CREEM_API_KEY is not configured')
      return NextResponse.json({ 
        success: false, 
        error: 'Payment system configuration error' 
      }, { status: 500 })
    }

    if (!process.env.NEXT_PUBLIC_APP_URL) {
      console.error('[Payment] NEXT_PUBLIC_APP_URL is not configured')
      return NextResponse.json({ 
        success: false, 
        error: 'App configuration error' 
      }, { status: 500 })
    }

    // 验证必需参数
    if (!productId || !planType || !userId) {
      console.error('[Payment] Missing required parameters:', { productId: !!productId, planType: !!planType, userId: !!userId })
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters' 
      }, { status: 400 })
    }

    // 验证用户存在
    console.log('[Payment] Validating user...')
    const { data: user, error: userError } = await supabaseServer.auth.admin.getUserById(userId)
    if (userError) {
      console.error('[Payment] User validation error:', userError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to validate user' 
      }, { status: 500 })
    }
    
    if (!user) {
      console.error('[Payment] User not found:', userId)
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 })
    }

    // 获取用户email
    const userEmail = user.user?.email
    if (!userEmail) {
      console.error('[Payment] User email not found for user:', userId)
      return NextResponse.json({ 
        success: false, 
        error: 'User email not found' 
      }, { status: 400 })
    }
    console.log('[Payment] User validated:', { email: userEmail })

    // 创建订单记录（pending状态）
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const amount = planType === 'monthly' ? 990 : 9900 // 价格（分为单位）
    
    console.log('[Payment] Creating payment record...', { orderId, amount, planType })
    
    const { data: payment, error: paymentError } = await supabaseServer
      .from('payments')
      .insert({
        user_id: userId,
        amount: amount,
        currency: 'CNY',
        creem_order_id: orderId,
        creem_product_id: productId,
        status: 'pending',
        plan_type: planType
      })
      .select()
      .single()

    if (paymentError) {
      console.error('[Payment] Failed to create payment record:', paymentError)
      // 检查是否是表不存在的错误
      if (paymentError.code === '42P01') {
        console.error('[Payment] Payments table does not exist. Please run database migrations.')
        return NextResponse.json({ 
          success: false, 
          error: 'Database not properly configured. Please contact support.' 
        }, { status: 500 })
      }
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create payment record' 
      }, { status: 500 })
    }
    
    console.log('[Payment] Payment record created:', payment.id)

    // 生成Creem Checkout URL
    console.log('[Payment] Generating checkout URL...')
    const checkoutUrl = `https://buy.creem.io/checkout/${productId}?` + new URLSearchParams({
      customer_email: userEmail,
      customer_id: userId,
      order_id: orderId,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?order_id=${orderId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`
    }).toString()

    console.log('[Payment] Checkout URL generated:', checkoutUrl)
    console.log('[Payment] Payment creation successful')

    return NextResponse.json({ 
      success: true, 
      checkoutUrl,
      orderId,
      paymentId: payment.id
    })

  } catch (error) {
    console.error('Payment creation error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}