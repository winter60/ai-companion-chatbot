"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabaseClient"
import { type User } from '@supabase/supabase-js'
import { Check, Crown, Zap, Heart, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface PlanFeature {
  included: boolean
  text: string
}

interface Plan {
  id: string
  name: string
  nameEn: string
  price: number
  priceDisplay: string
  period: string
  periodEn: string
  description: string
  descriptionEn: string
  features: PlanFeature[]
  featuresEn: PlanFeature[]
  icon: React.ReactNode
  popular?: boolean
  creemProductId?: string
  buttonText: string
  buttonTextEn: string
  buttonVariant: "default" | "outline" | "secondary"
}

const plans: Plan[] = [
  {
    id: "free",
    name: "免费版",
    nameEn: "Free",
    price: 0,
    priceDisplay: "¥0",
    period: "永久免费",
    periodEn: "Forever Free",
    description: "体验基础AI情感陪伴功能",
    descriptionEn: "Experience basic AI emotional companionship",
    features: [
      { included: true, text: "访客：3次/天对话" },
      { included: true, text: "登录用户：10次/天对话" },
      { included: true, text: "基础情感陪伴功能" },
      { included: true, text: "3种个性选择" },
      { included: false, text: "无广告体验" },
      { included: false, text: "优先客服支持" }
    ],
    featuresEn: [
      { included: true, text: "Guests: 3 chats/day" },
      { included: true, text: "Logged users: 10 chats/day" },
      { included: true, text: "Basic emotional companionship" },
      { included: true, text: "3 personality types" },
      { included: false, text: "Ad-free experience" },
      { included: false, text: "Priority support" }
    ],
    icon: <Heart className="h-6 w-6" />,
    buttonText: "当前使用",
    buttonTextEn: "Current Plan",
    buttonVariant: "outline"
  },
  {
    id: "monthly",
    name: "月订版",
    nameEn: "Monthly",
    price: 9.9,
    priceDisplay: "¥9.9",
    period: "30天",
    periodEn: "30 Days",
    description: "适合短期深度体验用户",
    descriptionEn: "Perfect for short-term intensive use",
    features: [
      { included: true, text: "100次/天对话" },
      { included: true, text: "所有情感陪伴功能" },
      { included: true, text: "3种个性选择" },
      { included: true, text: "无广告体验" },
      { included: true, text: "优先客服支持" },
      { included: true, text: "30天有效期" }
    ],
    featuresEn: [
      { included: true, text: "100 chats/day" },
      { included: true, text: "All emotional features" },
      { included: true, text: "3 personality types" },
      { included: true, text: "Ad-free experience" },
      { included: true, text: "Priority support" },
      { included: true, text: "30 days validity" }
    ],
    icon: <Zap className="h-6 w-6" />,
    popular: true,
    creemProductId: "prod_4d5HDu2UIJi1sTRb2IMvDE",
    buttonText: "立即订阅",
    buttonTextEn: "Subscribe Now",
    buttonVariant: "default"
  },
  {
    id: "lifetime",
    name: "永久版",
    nameEn: "Lifetime",
    price: 99,
    priceDisplay: "¥99",
    period: "一次付费永久使用",
    periodEn: "One-time Payment",
    description: "最佳性价比，长期陪伴之选",
    descriptionEn: "Best value for long-term companionship",
    features: [
      { included: true, text: "100次/天对话" },
      { included: true, text: "所有情感陪伴功能" },
      { included: true, text: "3种个性选择" },
      { included: true, text: "无广告体验" },
      { included: true, text: "优先客服支持" },
      { included: true, text: "永久有效" }
    ],
    featuresEn: [
      { included: true, text: "100 chats/day" },
      { included: true, text: "All emotional features" },
      { included: true, text: "3 personality types" },
      { included: true, text: "Ad-free experience" },
      { included: true, text: "Priority support" },
      { included: true, text: "Lifetime access" }
    ],
    icon: <Crown className="h-6 w-6" />,
    creemProductId: "prod_1p1RujKUJPUS4WXAmRcZ48",
    buttonText: "终身购买",
    buttonTextEn: "Buy Lifetime",
    buttonVariant: "default"
  }
]

export default function PricingPage() {
  const [user, setUser] = useState<User | null>(null)
  const [currentPlan, setCurrentPlan] = useState<string>("free")
  const [loading, setLoading] = useState(true)
  const [language, setLanguage] = useState<"zh" | "en">("zh")
  const router = useRouter()

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        // 获取用户当前套餐
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan_type')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          setCurrentPlan(profile.plan_type || "free")
        }
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async (plan: Plan) => {
    if (!user) {
      // 未登录，跳转到登录页面
      router.push('/auth?redirect=pricing')
      return
    }

    if (plan.id === "free") {
      return // 免费套餐不需要操作，其他版本不能降级到免费版
    }

    if (!plan.creemProductId) {
      console.error('缺少Creem产品ID')
      return
    }

    try {
      // 调用新的checkout接口创建支付链接
      const response = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: plan.creemProductId,
          userId: user.id,
          email: user.email,
          name: user.user_metadata?.name || 'User',
        })
      })

      if (!response.ok) {
        throw new Error('支付请求失败')
      }

      const data = await response.json()
      
      if (data.checkoutUrl) {
        // 跳转到Creem支付页面
        window.location.href = data.checkoutUrl
      } else {
        console.error('创建支付链接失败:', data.error)
        alert('支付链接创建失败，请稍后重试')
      }
    } catch (error) {
      console.error('支付请求失败:', error)
      alert('网络错误，请稍后重试')
    }
  }

  const getButtonText = (plan: Plan) => {
    if (plan.id === "free") {
      return language === "zh" ? "当前使用" : "Current Plan"
    }
    
    if (currentPlan === plan.id) {
      return language === "zh" ? "当前套餐" : "Current Plan"
    }
    
    if (currentPlan === "monthly" && plan.id === "lifetime") {
      return language === "zh" ? "升级到永久版" : "Upgrade to Lifetime"
    }
    
    return language === "zh" ? plan.buttonText : plan.buttonTextEn
  }

  const getButtonVariant = (plan: Plan) => {
    if (currentPlan === plan.id) {
      return "outline"
    }
    return plan.buttonVariant
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 min-h-screen py-4 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8 sm:space-y-16 pb-8 sm:pb-16">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-6">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {language === "zh" ? "返回聊天" : "Back to Chat"}
              </Button>
            </Link>
          </div>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {language === "zh" ? "选择您的陪伴套餐" : "Choose Your Companion Plan"}
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {language === "zh" 
              ? "升级您的AI情感陪伴体验，获得更多对话次数和专属功能"
              : "Upgrade your AI emotional companion experience with more conversations and exclusive features"
            }
          </p>
          
          {!user && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200 max-w-md mx-auto">
              <p className="text-sm text-blue-800">
                {language === "zh" 
                  ? "💡 需要登录后才能购买付费套餐"
                  : "💡 Login required to purchase premium plans"
                }
              </p>
            </div>
          )}
        </div>

        {/* Language Toggle */}
        <div className="flex justify-center">
          <div className="bg-white rounded-lg p-1 shadow-sm border">
            <Button
              variant={language === "zh" ? "default" : "ghost"}
              size="sm"
              onClick={() => setLanguage("zh")}
            >
              中文
            </Button>
            <Button
              variant={language === "en" ? "default" : "ghost"}
              size="sm"
              onClick={() => setLanguage("en")}
            >
              English
            </Button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                plan.popular ? 'ring-2 ring-purple-500 shadow-lg' : ''
              } ${currentPlan === plan.id ? 'bg-gradient-to-br from-purple-50 to-pink-50 ring-2 ring-purple-300' : 'bg-white'}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600">
                  {language === "zh" ? "最受欢迎" : "Most Popular"}
                </Badge>
              )}
              
              {currentPlan === plan.id && (
                <Badge variant="outline" className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-white">
                  {language === "zh" ? "当前套餐" : "Current Plan"}
                </Badge>
              )}

              <CardHeader className="text-center pb-6">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  plan.id === 'free' ? 'bg-gray-100 text-gray-600' :
                  plan.id === 'monthly' ? 'bg-gradient-to-br from-purple-100 to-pink-100 text-purple-600' :
                  'bg-gradient-to-br from-yellow-100 to-orange-100 text-orange-600'
                }`}>
                  {plan.icon}
                </div>
                <CardTitle className="text-2xl font-bold">
                  {language === "zh" ? plan.name : plan.nameEn}
                </CardTitle>
                <CardDescription className="text-gray-600">
                  {language === "zh" ? plan.description : plan.descriptionEn}
                </CardDescription>
              </CardHeader>

              <CardContent className="text-center pb-6">
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">
                    {plan.priceDisplay}
                  </span>
                  <span className="text-gray-600 ml-2">
                    / {language === "zh" ? plan.period : plan.periodEn}
                  </span>
                </div>

                <div className="space-y-3">
                  {(language === "zh" ? plan.features : plan.featuresEn).map((feature, index) => (
                    <div key={index} className="flex items-center text-sm">
                      <Check 
                        className={`h-4 w-4 mr-3 flex-shrink-0 ${
                          feature.included ? 'text-green-500' : 'text-gray-300'
                        }`}
                      />
                      <span className={feature.included ? 'text-gray-700' : 'text-gray-400'}>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={getButtonVariant(plan)}
                  onClick={() => handleSubscribe(plan)}
                  disabled={currentPlan === plan.id || (plan.id === "free" && currentPlan !== "free")}
                >
                  {getButtonText(plan)}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
            {language === "zh" ? "常见问题" : "Frequently Asked Questions"}
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                {language === "zh" ? "如何升级套餐？" : "How to upgrade plans?"}
              </h3>
              <p className="text-gray-600 text-sm">
                {language === "zh" 
                  ? "登录后直接购买新套餐即可，系统会自动激活。月订版用户可直接购买永久版进行升级。"
                  : "Simply purchase the new plan after logging in, and the system will automatically activate it. Monthly users can directly purchase the lifetime plan to upgrade."
                }
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                {language === "zh" ? "支付安全吗？" : "Is payment secure?"}
              </h3>
              <p className="text-gray-600 text-sm">
                {language === "zh" 
                  ? "我们使用Creem安全支付平台处理所有交易，支持微信支付、支付宝等多种方式，确保您的支付信息安全。"
                  : "We use the secure Creem payment platform to process all transactions, supporting WeChat Pay, Alipay and other methods to ensure your payment information is secure."
                }
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                {language === "zh" ? "可以退款吗？" : "Can I get a refund?"}
              </h3>
              <p className="text-gray-600 text-sm">
                {language === "zh" 
                  ? "由于数字产品的特殊性，我们暂不支持退款。建议您先使用免费版体验功能后再决定是否购买。"
                  : "Due to the nature of digital products, we currently do not support refunds. We recommend trying the free version first before deciding to purchase."
                }
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                {language === "zh" ? "有技术支持吗？" : "Is there technical support?"}
              </h3>
              <p className="text-gray-600 text-sm">
                {language === "zh" 
                  ? "付费用户享有优先客服支持。如遇问题，可通过应用内反馈或邮件联系我们。"
                  : "Premium users enjoy priority customer support. If you encounter any issues, you can contact us through in-app feedback or email."
                }
              </p>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}