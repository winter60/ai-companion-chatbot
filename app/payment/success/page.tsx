"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabaseClient"
import { CheckCircle, Clock, XCircle, ArrowRight, Home } from "lucide-react"

type PaymentStatus = 'checking' | 'success' | 'pending' | 'failed'

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('order_id')
  
  const [status, setStatus] = useState<PaymentStatus>('checking')
  const [paymentInfo, setPaymentInfo] = useState<any>(null)
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    if (orderId) {
      checkPaymentStatus()
    } else {
      setStatus('failed')
    }
  }, [orderId])

  useEffect(() => {
    if (status === 'success' && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (status === 'success' && countdown === 0) {
      router.push('/')
    }
  }, [status, countdown, router])

  const checkPaymentStatus = async () => {
    try {
      // 获取当前用户
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        console.error('User not authenticated')
        setStatus('failed')
        return
      }

      // 首先尝试按订单ID查找
      let { data: payments, error } = await supabase
        .from('payments')
        .select('*')
        .eq('creem_order_id', orderId)
        .order('created_at', { ascending: false })

      let payment = payments && payments.length > 0 ? payments[0] : null

      // 如果按订单ID找不到，尝试查找该用户最近10分钟内的支付记录
      if (!payment) {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
        
        const { data: recentPayments, error: recentError } = await supabase
          .from('payments')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', tenMinutesAgo)
          .order('created_at', { ascending: false })
          .limit(1)

        if (recentError) {
          console.error('Error finding recent payments:', recentError)
        } else {
          payment = recentPayments && recentPayments.length > 0 ? recentPayments[0] : null
          if (payment) {
            console.log('Found payment by user ID and time:', payment.id)
          }
        }
      }

      // 如果还是找不到，尝试查找该用户最新的待处理支付
      if (!payment) {
        const { data: pendingPayments, error: pendingError } = await supabase
          .from('payments')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)

        if (!pendingError && pendingPayments && pendingPayments.length > 0) {
          payment = pendingPayments[0]
          console.log('Found pending payment by user ID:', payment.id)
        }
      }

      if (error || !payment) {
        console.error('Payment not found:', { 
          error: error?.message || error, 
          orderId,
          userId: user.id 
        })
        setStatus('failed')
        return
      }

      setPaymentInfo(payment)

      // 根据支付状态设置页面状态
      switch (payment.status) {
        case 'completed':
          setStatus('success')
          break
        case 'pending':
          // 如果是pending状态，先显示为success（因为用户已经到了成功页面）
          // 然后激活用户订阅
          setStatus('success')
          
          // 手动激活用户订阅
          const { error: activationError } = await supabase
            .from('payments')
            .update({ 
              status: 'completed',
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', payment.id)
          
          if (!activationError) {
            // 更新用户profile
            const expiresAt = payment.plan_type === 'lifetime' ? null : 
              new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

            await supabase
              .from('profiles')
              .upsert({
                id: payment.user_id,
                plan_type: payment.plan_type,
                daily_limit: 100,
                plan_expires_at: expiresAt,
                updated_at: new Date().toISOString()
              })
          }
          break
        case 'failed':
          setStatus('failed')
          break
        default:
          setStatus('pending')
      }
    } catch (error) {
      console.error('Error checking payment status:', error)
      setStatus('failed')
    }
  }

  const getPlanDisplayName = (planType: string) => {
    switch (planType) {
      case 'monthly':
        return '月订版'
      case 'lifetime':
        return '永久版'
      default:
        return '未知套餐'
    }
  }

  const renderContent = () => {
    switch (status) {
      case 'checking':
        return (
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-blue-600 animate-spin" />
              </div>
              <CardTitle>检查支付状态</CardTitle>
              <CardDescription>请稍候，正在验证您的支付...</CardDescription>
            </CardHeader>
          </Card>
        )

      case 'success':
        return (
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-green-800">支付成功！</CardTitle>
              <CardDescription>恭喜您成功订阅套餐，现在可以享受更多对话次数了</CardDescription>
            </CardHeader>
            
            {paymentInfo && (
              <CardContent className="space-y-4">
                <div className="bg-green-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">订阅套餐：</span>
                    <span className="font-semibold">{getPlanDisplayName(paymentInfo.plan_type)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">支付金额：</span>
                    <span className="font-semibold">¥{(paymentInfo.amount / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">每日对话次数：</span>
                    <span className="font-semibold text-green-600">100次</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">订单号：</span>
                    <span className="text-sm text-gray-500 font-mono">{paymentInfo.creem_order_id}</span>
                  </div>
                </div>

                <div className="text-center space-y-3">
                  <p className="text-sm text-gray-600">
                    {countdown > 0 ? (
                      `${countdown}秒后自动返回聊天页面`
                    ) : (
                      '正在跳转...'
                    )}
                  </p>
                  
                  <div className="space-x-3">
                    <Button 
                      onClick={() => router.push('/')} 
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      立即开始聊天
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )

      case 'pending':
        return (
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
              <CardTitle className="text-yellow-800">支付处理中</CardTitle>
              <CardDescription>您的支付正在处理中，请耐心等待</CardDescription>
            </CardHeader>
            
            <CardContent className="text-center space-y-4">
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-yellow-800">
                  通常支付确认需要1-3分钟，我们会自动检查支付状态。
                  如果长时间未更新，请联系客服。
                </p>
              </div>
              
              <div className="space-x-3">
                <Button variant="outline" onClick={() => checkPaymentStatus()}>
                  手动刷新
                </Button>
                <Button variant="outline" onClick={() => router.push('/')}>
                  返回首页
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 'failed':
        return (
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-red-800">支付失败</CardTitle>
              <CardDescription>很抱歉，您的支付未能成功完成</CardDescription>
            </CardHeader>
            
            <CardContent className="text-center space-y-4">
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-red-800">
                  可能的原因：支付被取消、网络异常或支付信息有误。
                  您可以重新尝试购买或联系客服获取帮助。
                </p>
              </div>
              
              <div className="space-x-3">
                <Button onClick={() => router.push('/pricing')}>
                  重新购买
                </Button>
                <Button variant="outline" onClick={() => router.push('/')}>
                  <Home className="mr-2 h-4 w-4" />
                  返回首页
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4">
      {renderContent()}
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">加载中...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  )
}