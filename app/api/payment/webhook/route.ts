import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import crypto from 'crypto'

const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET

// 验证Webhook签名（根据Creem文档调整）
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret) {
    console.error('Missing CREEM_WEBHOOK_SECRET')
    return false
  }
  
  try {
    // Remove any prefix from signature (e.g., "sha256=")
    const cleanSignature = signature.startsWith('sha256=') ? signature.slice(7) : signature
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex')
    
    console.log('Signature verification details:', {
      originalSignature: signature,
      cleanSignature: cleanSignature,
      expectedSignature: expectedSignature,
      payloadLength: payload.length,
      secretLength: secret.length
    })
    
    // Ensure both strings have the same length before comparison
    if (cleanSignature.length !== expectedSignature.length) {
      console.error('Signature length mismatch:', { 
        received: cleanSignature.length, 
        expected: expectedSignature.length 
      })
      return false
    }
    
    const isValid = crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
    
    console.log('Signature verification result:', isValid)
    return isValid
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text()
    const signature = request.headers.get('x-creem-signature') || request.headers.get('x-signature') || ''
    
    console.log('Webhook debug info:', {
      hasPayload: !!payload,
      payloadLength: payload.length,
      hasSignature: !!signature,
      signatureLength: signature.length,
      headers: Object.fromEntries(request.headers.entries()),
      hasSecret: !!CREEM_WEBHOOK_SECRET
    })

    // 验证签名
    if (!verifyWebhookSignature(payload, signature, CREEM_WEBHOOK_SECRET || '')) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const webhookData = JSON.parse(payload)
    console.log('Received webhook:', webhookData)

    // 根据实际webhook数据结构动态解析
    const event_type = webhookData.event_type || webhookData.type
    const data = webhookData.data || webhookData
    
    const creemOrderId = data.order_id || data.id || data.checkout_id
    const creemProductId = data.product_id 
    const customer_email = data.customer_email
    const userId = data.customer_id || data.user_id || data.request_id
    const amount = data.amount
    const currency = data.currency
    const payment_method = data.payment_method
    const paymentStatus = data.status
    const paid_at = data.paid_at

    console.log('Parsed webhook data:', {
      event_type,
      creemOrderId,
      creemProductId,
      userId,
      amount,
      paymentStatus
    })

    // 处理支付成功事件
    if (event_type === 'payment.completed' || event_type === 'order.paid' || event_type === 'checkout.session.completed') {
      
      // 如果没有找到明确的订单ID，尝试通过用户ID查找最近的待支付记录
      let payment = null;
      let paymentFindError = null;

      if (creemOrderId) {
        // 首先尝试按订单ID查找
        const result = await supabaseServer
          .from('payments')
          .select('*')
          .eq('creem_order_id', creemOrderId)
          .single();
        
        payment = result.data;
        paymentFindError = result.error;
      }

      // 如果按订单ID找不到，尝试按用户ID查找最近的待支付记录
      if (!payment && userId) {
        console.log('Order ID not found, searching by user ID:', userId);
        
        const result = await supabaseServer
          .from('payments')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        payment = result.data;
        if (!result.error) {
          paymentFindError = null;
          console.log('Found payment by user ID:', payment?.id);
        } else {
          paymentFindError = result.error;
        }
      }

      if (paymentFindError || !payment) {
        console.error('Payment record not found:', creemOrderId)
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
      }

      // 防止重复处理
      if (payment.status === 'completed') {
        console.log('Payment already processed:', creemOrderId)
        return NextResponse.json({ success: true, message: 'Already processed' })
      }

      // 更新支付记录
      const { error: paymentUpdateError } = await supabaseServer
        .from('payments')
        .update({
          status: 'completed',
          payment_method: payment_method,
          paid_at: paid_at ? new Date(paid_at).toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id)

      if (paymentUpdateError) {
        console.error('Failed to update payment:', paymentUpdateError)
        return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
      }

      // 激活用户订阅
      const { data: activationResult, error: activationError } = await supabaseServer.rpc(
        'activate_user_subscription',
        {
          p_user_id: payment.user_id,
          p_plan_type: payment.plan_type,
          p_creem_order_id: creemOrderId,
          p_creem_product_id: creemProductId
        }
      )

      if (activationError || !activationResult) {
        console.error('Failed to activate subscription:', activationError)
        
        // 如果订阅激活失败，将支付状态回滚
        await supabaseServer
          .from('payments')
          .update({ status: 'failed' })
          .eq('id', payment.id)

        return NextResponse.json({ error: 'Failed to activate subscription' }, { status: 500 })
      }

      console.log('Subscription activated successfully for user:', payment.user_id)
      
      return NextResponse.json({ 
        success: true, 
        message: 'Payment processed and subscription activated' 
      })
    }

    // 处理支付失败事件
    if (event_type === 'payment.failed' || event_type === 'order.cancelled') {
      
      const { error: paymentUpdateError } = await supabaseServer
        .from('payments')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('creem_order_id', creemOrderId)

      if (paymentUpdateError) {
        console.error('Failed to update failed payment:', paymentUpdateError)
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Payment marked as failed' 
      })
    }

    // 处理退款事件
    if (event_type === 'payment.refunded') {
      
      const { error: paymentUpdateError } = await supabaseServer
        .from('payments')
        .update({
          status: 'refunded',
          updated_at: new Date().toISOString()
        })
        .eq('creem_order_id', creemOrderId)

      if (paymentUpdateError) {
        console.error('Failed to update refunded payment:', paymentUpdateError)
      }

      // 可以在这里添加订阅取消逻辑
      // TODO: 根据业务需求决定是否取消用户订阅

      return NextResponse.json({ 
        success: true, 
        message: 'Payment marked as refunded' 
      })
    }

    console.log('Unhandled webhook event type:', event_type)
    return NextResponse.json({ 
      success: true, 
      message: 'Event acknowledged but not processed' 
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Webhook processing failed' 
    }, { status: 500 })
  }
}

// 支持GET请求用于Webhook验证（某些支付提供商需要）
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const challenge = searchParams.get('challenge')
  
  if (challenge) {
    return NextResponse.json({ challenge })
  }
  
  return NextResponse.json({ message: 'Webhook endpoint is active' })
}